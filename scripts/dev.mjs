import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

loadEnvFile(".env");

const children = [
  spawn("npx", ["wrangler", "dev", "--port", "8787", "--ip", "127.0.0.1"], {
    stdio: "inherit",
    env: process.env,
  }),
  spawn("npx", ["react-router", "dev"], {
    stdio: "inherit",
    env: process.env,
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM") return;
    stop(code ?? 0);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
