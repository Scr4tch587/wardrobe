import { env } from "cloudflare:workers";

export async function applySchema(): Promise<void> {
  const sql = (env as Env & { MIGRATION_SQL?: string }).MIGRATION_SQL;
  if (!sql) throw new Error("MIGRATION_SQL binding is missing");
  const statements = sql
    .split(/--> statement-breakpoint/)
    .map((part) => part.trim().replace(/;$/, ""))
    .filter(Boolean);
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
}
