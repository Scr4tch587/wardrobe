import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { getDb } from "../app/lib/db.server";
import { saveOutfit } from "../app/lib/outfits.server";
import { applySchema } from "./migrate";

const itemId = "11111111-1111-4111-8111-111111111111";

describe("saveOutfit", () => {
  beforeAll(async () => {
    await applySchema();
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO items (id, name, slot, created_at, updated_at) VALUES (?, 'Shirt', 'top', ?, ?)`,
    )
      .bind(itemId, now, now)
      .run();
  });

  it("rejects future dates and duplicate items", async () => {
    const db = getDb(env);
    const future = await saveOutfit(
      db,
      { date: "2099-01-01", itemIds: [itemId] },
      "2026-10-28",
    );
    expect(future).toEqual({ ok: false, error: "That date hasn't happened yet." });

    const duplicate = await saveOutfit(
      db,
      { date: "2026-10-28", itemIds: [itemId, itemId] },
      "2026-10-28",
    );
    expect(duplicate.ok).toBe(false);

    const saved = await saveOutfit(db, { date: "2026-10-28", itemIds: [itemId], rating: 8 }, "2026-10-28");
    expect(saved.ok).toBe(true);
    const row = await env.DB.prepare("SELECT rating FROM outfits WHERE date = ?")
      .bind("2026-10-28")
      .first<{ rating: number }>();
    expect(row?.rating).toBe(8);
  });
});
