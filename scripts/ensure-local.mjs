import { copyFileSync, existsSync, readFileSync, appendFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";

ensureFile(".dev.vars", ".dev.vars.example");
ensureFile(".env", ".env.example");
ensureLine(".dev.vars", "API_SECRET=local-api-secret");
ensureLine(".env", "CLOUDFLARE_API_URL=http://localhost:8787");
ensureLine(".env", "API_SECRET=local-api-secret");
ensureLine(".env", "MEDIA_ORIGIN=http://localhost:8787");

rmSync(".wrangler/deploy/config.json", { force: true });

execSync("npx wrangler d1 migrations apply wardrobe --local", {
  stdio: "inherit",
  env: { ...process.env, CI: "1" },
});

function ensureFile(path, example) {
  if (existsSync(path)) return;
  copyFileSync(example, path);
  console.log(`Created ${path} from ${example}`);
}

function ensureLine(path, line) {
  const key = line.slice(0, line.indexOf("="));
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (new RegExp(`^${key}=`, "m").test(text)) return;
  appendFileSync(path, `${text.endsWith("\n") || text.length === 0 ? "" : "\n"}${line}\n`);
  console.log(`Added ${key} to ${path}`);
}
