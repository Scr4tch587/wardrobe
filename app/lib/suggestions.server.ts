import { sha256Hex } from "./crypto";
import { SuggestionInput } from "./schemas";
import { comboKey, prepareVisitorFields, validateSuggestionPieces } from "./suggestions";

const FRIENDLY = "Check the outfit and try again.";

export type SuggestOutcome = { ok: true } | { ok: false; status: number; error: string };

export async function submitSuggestion(
  env: Env,
  request: Request,
  input: { itemIds: string[]; name?: string; message?: string; turnstileToken: string },
): Promise<SuggestOutcome> {
  const ip = request.headers.get("x-visitor-ip") ?? request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex(env.IP_HASH_SALT + ip);

  const limit = await env.SUGGEST_LIMITER.limit({ key: ipHash });
  if (!limit.success) {
    return { ok: false, status: 429, error: "Slow down a little and try again." };
  }

  const turnstile = await verifyTurnstile(env, input.turnstileToken, ip);
  if (!turnstile) {
    return { ok: false, status: 400, error: "Couldn't verify that submission. Refresh the page and try again." };
  }

  const parsed = SuggestionInput.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: "Check the outfit and try again." };

  const fields = prepareVisitorFields(parsed.data.name, parsed.data.message);
  if (!fields.ok) return { ok: false, status: 400, error: fields.error };

  const placeholders = parsed.data.itemIds.map(() => "?").join(",");
  const found = await env.DB.prepare(
    `SELECT id, slot, archived_at FROM items WHERE id IN (${placeholders})`,
  )
    .bind(...parsed.data.itemIds)
    .all<{ id: string; slot: string; archived_at: number | null }>();
  const pieces = validateSuggestionPieces(
    found.results.map((row) => ({ id: row.id, slot: row.slot, archivedAt: row.archived_at })),
    parsed.data.itemIds,
  );
  if (!pieces.ok) return { ok: false, status: 400, error: pieces.error };

  const since = Date.now() - 86_400_000;
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM suggestions WHERE ip_hash = ? AND created_at >= ?",
  )
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) {
    return { ok: false, status: 429, error: "That's enough suggestions for today." };
  }

  const pending = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM suggestions WHERE status = 'pending'",
  ).first<{ n: number }>();
  if ((pending?.n ?? 0) >= 200) {
    return { ok: false, status: 503, error: "Suggestions are paused while I catch up." };
  }

  const key = await comboKey(parsed.data.itemIds);
  const blocked = await env.DB.prepare("SELECT ip_hash FROM blocked_ips WHERE ip_hash = ?")
    .bind(ipHash)
    .first();
  const now = Date.now();
  const id = crypto.randomUUID();
  const status = blocked ? "rejected" : "pending";
  const reviewedAt = blocked ? now : null;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO suggestions
        (id, combo_key, name, message, status, text_hidden, ip_hash, created_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).bind(id, key, fields.name, fields.message, status, ipHash, now, reviewedAt),
    ...parsed.data.itemIds.map((itemId) =>
      env.DB.prepare("INSERT INTO suggestion_items (suggestion_id, item_id) VALUES (?, ?)").bind(id, itemId),
    ),
  ]);
  return { ok: true };
}

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { success?: boolean };
    return json.success === true;
  } catch (error) {
    console.error({
      job: "suggest",
      step: "turnstile",
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export { FRIENDLY };
