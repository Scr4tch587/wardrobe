import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/lib/schema.ts",
  out: "./migrations",
});
