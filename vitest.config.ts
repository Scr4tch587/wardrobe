import { readFileSync } from "node:fs";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./test/entry.ts",
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          MIGRATION_SQL: readFileSync(new URL("./migrations/0000_init.sql", import.meta.url), "utf8"),
          IP_HASH_SALT: "test-salt",
          TURNSTILE_SECRET: "test-turnstile",
          ADMIN_SETUP_TOKEN: "test-setup",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
