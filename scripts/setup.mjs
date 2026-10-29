import { execSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const domain = flag("--domain");
const rpOverride = flag("--rp-id");

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function capture(command) {
  return execSync(command, { encoding: "utf8", env: process.env });
}

function captureAll(command) {
  const result = spawnSync(command, {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
  });
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) {
    console.error(text);
    throw new Error(`${command} failed`);
  }
  return text;
}

function run(command, extraEnv = {}) {
  execSync(command, { stdio: "inherit", env: { ...process.env, CI: "1", ...extraEnv } });
}

function tryRun(command) {
  try {
    return capture(command);
  } catch (error) {
    return error instanceof Error && "stdout" in error ? String(error.stdout ?? "") : "";
  }
}

console.log("Checking Cloudflare login…");
let who = "";
try {
  who = capture("npx wrangler whoami --json");
} catch {
  console.log("A browser window will open so Wrangler can sign in. Approve it, then this script continues.");
  run("npx wrangler login");
  who = capture("npx wrangler whoami --json");
}
const identity = JSON.parse(who);
const accountId = identity.accounts?.[0]?.id ?? identity.account?.id;
if (!accountId) {
  console.error("Wrangler is logged in, but no account id was returned.");
  process.exit(1);
}

let config = readFileSync("wrangler.jsonc", "utf8");
let databaseId = config.match(/"database_id":\s*"([^"]+)"/)?.[1];
if (!databaseId || databaseId.startsWith("00000000")) {
  const listed = tryRun("npx wrangler d1 list --json");
  const databases = listed.trim().startsWith("[") ? JSON.parse(listed) : [];
  const existing = databases.find((row) => row.name === "wardrobe" || row.database_name === "wardrobe");
  databaseId = existing?.uuid ?? existing?.database_id;
  if (!databaseId) {
    console.log("Creating D1 database wardrobe…");
    const created = capture("npx wrangler d1 create wardrobe");
    const match = created.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
      console.error(created);
      throw new Error("Could not read the new D1 database id.");
    }
    databaseId = match[0];
  }
  config = config.replace(/"database_id":\s*"[^"]+"/, `"database_id": "${databaseId}"`);
}

console.log("Creating R2 bucket wardrobe-media if needed…");
try {
  capture("npx wrangler r2 bucket create wardrobe-media");
} catch (error) {
  const text = error instanceof Error ? `${error.message}\n${"stderr" in error ? error.stderr : ""}` : "";
  if (!/already exists/i.test(text)) {
    console.error(text || "Could not create the R2 bucket.");
    process.exit(1);
  }
}

let turnstileSiteKey;
let turnstileSecret;
if (domain) {
  const origin = domain.startsWith("http") ? domain : `https://${domain}`;
  const host = new URL(origin).hostname;
  const rp =
    rpOverride ??
    (host === "localhost" ? "localhost" : host.split(".").length > 2 ? host.split(".").slice(-2).join(".") : host);
  config = config.replace(/"RP_ID":\s*"[^"]+"/, `"RP_ID": "${rp}"`);
  config = config.replace(/"ORIGIN":\s*"[^"]+"/, `"ORIGIN": "${origin}"`);
  config = config.replace(/,?\s*"routes":\s*\[\s*\{[^[\]]*custom_domain"\s*:\s*true\s*\}\s*\]/, "");
  const token = readOauthToken();
  if (token) {
    console.log(`Creating a Turnstile widget for ${host}…`);
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "wardrobe", domains: [host], mode: "managed" }),
    });
    const json = await response.json();
    if (json.success && json.result?.sitekey) {
      turnstileSiteKey = json.result.sitekey;
      turnstileSecret = json.result.secret;
      if (!turnstileSecret) {
        const rotated = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets/${turnstileSiteKey}/rotate_secret`,
          { method: "POST", headers: { Authorization: `Bearer ${token}` } },
        );
        const rotatedJson = await rotated.json();
        turnstileSecret = rotatedJson.result?.secret;
      }
      config = config.replace(/"TURNSTILE_SITE_KEY":\s*"[^"]+"/, `"TURNSTILE_SITE_KEY": "${turnstileSiteKey}"`);
    } else {
      console.log("Turnstile widget was not created. Suggestions will fail closed until a widget exists.");
      console.log(JSON.stringify(json.errors ?? json, null, 2));
    }
  }
}

writeFileSync("wrangler.jsonc", config);

const salt = randomBytes(32).toString("hex");
const setupToken = randomBytes(24).toString("base64url");
const apiSecret = randomBytes(32).toString("hex");
putSecret("IP_HASH_SALT", salt);
putSecret("ADMIN_SETUP_TOKEN", setupToken);
putSecret("API_SECRET", apiSecret);
if (turnstileSecret) putSecret("TURNSTILE_SECRET", turnstileSecret);
writeFileSync(".setup-token", `${setupToken}\n`);

const devVars = [
  "API_SECRET=local-api-secret",
  "TURNSTILE_SECRET=1x0000000000000000000000000000000AA",
  "IP_HASH_SALT=local-dev-salt",
  "ADMIN_SETUP_TOKEN=local-setup-token",
  "RP_ID=localhost",
  "ORIGIN=http://localhost:5173",
  "TURNSTILE_SITE_KEY=1x00000000000000000000AA",
  "",
].join("\n");
writeFileSync(".dev.vars", devVars);
writeFileSync(
  ".env",
  ["CLOUDFLARE_API_URL=http://localhost:8787", "API_SECRET=local-api-secret", "MEDIA_ORIGIN=http://localhost:8787", ""].join("\n"),
);

console.log("Applying database migrations…");
run("npx wrangler d1 migrations apply wardrobe --local");
run("npx wrangler d1 migrations apply wardrobe --remote");

console.log("Deploying the Worker…");
const deployed = captureAll("npx wrangler deploy");
console.log(deployed);
const mediaOrigin = deployed.match(/https:\/\/[\w.-]+\.workers\.dev/)?.[0] ?? null;

if (mediaOrigin) await configureVercel(mediaOrigin, apiSecret);
else console.log("Could not read the workers.dev URL. Set CLOUDFLARE_API_URL and MEDIA_ORIGIN on Vercel after deploy:api.");

const siteHost = domain ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
console.log("\nCloudflare is holding the data. Vercel will hold the site.");
console.log(`D1 database: ${databaseId}`);
console.log("R2 bucket: wardrobe-media");
if (mediaOrigin) console.log(`Worker: ${mediaOrigin}`);
console.log(`Production setup token (also saved in .setup-token): ${setupToken}`);
console.log("Local admin setup: http://localhost:5173/admin/setup?token=local-setup-token");
if (siteHost) console.log(`Register the live passkey at https://${siteHost}/admin/setup?token=${setupToken}`);
else console.log("Passkeys on the live site need the Vercel hostname. Re-run: npm run setup -- --domain your-app.vercel.app");

async function configureVercel(mediaOrigin, secret) {
  console.log("Checking Vercel login…");
  try {
    capture("npx vercel whoami");
  } catch {
    console.log("A browser window will open so Vercel can sign in. Approve it, then this script continues.");
    run("npx vercel login");
  }
  run("npx vercel link --yes --project wardrobe");
  const projectPath = join(".vercel", "project.json");
  const token = readVercelToken();
  if (!existsSync(projectPath) || !token) {
    console.log("Vercel is signed in, but the project link did not leave a token this script can use.");
    console.log(`Set CLOUDFLARE_API_URL and MEDIA_ORIGIN to ${mediaOrigin}, and API_SECRET to the value just stored on the Worker.`);
    return;
  }
  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  const team = project.orgId ? `?teamId=${project.orgId}` : "";
  for (const [key, value] of Object.entries({
    CLOUDFLARE_API_URL: mediaOrigin,
    MEDIA_ORIGIN: mediaOrigin,
    API_SECRET: secret,
  })) {
    console.log(`Setting Vercel ${key}…`);
    const listed = await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env${team}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listed.json();
    for (const row of list.envs ?? []) {
      if (row.key !== key) continue;
      await fetch(`https://api.vercel.com/v9/projects/${project.projectId}/env/${row.id}${team}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    const created = await fetch(`https://api.vercel.com/v10/projects/${project.projectId}/env${team}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type: "encrypted", target: ["production", "preview"] }),
    });
    if (!created.ok) {
      console.log(await created.text());
      throw new Error(`Could not set Vercel env ${key}.`);
    }
  }
  console.log("Deploying the site to Vercel…");
  run("npm run deploy:web");
}

function readVercelToken() {
  const candidates = [
    join(homedir(), "Library", "Application Support", "com.vercel.cli", "auth.json"),
    join(homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
    join(homedir(), ".config", "vercel", "auth.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const json = JSON.parse(readFileSync(path, "utf8"));
      if (json.token) return json.token;
    } catch {
      continue;
    }
  }
  return process.env.VERCEL_TOKEN;
}

function putSecret(name, value) {
  console.log(`Setting secret ${name}…`);
  execSync(`npx wrangler secret put ${name}`, {
    input: `${value}\n`,
    stdio: ["pipe", "inherit", "inherit"],
  });
}

function readOauthToken() {
  const candidates = [
    join(homedir(), "Library", "Preferences", ".wrangler", "config", "default.toml"),
    join(homedir(), ".config", ".wrangler", "config", "default.toml"),
    join(homedir(), ".wrangler", "config", "default.toml"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const match = readFileSync(path, "utf8").match(/oauth_token\s*=\s*"([^"]+)"/);
    if (match) return match[1];
  }
  return process.env.CLOUDFLARE_API_TOKEN;
}
