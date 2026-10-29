import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "./db.server";
import type { OutfitInput } from "./schemas";
import { items, outfitItems, outfits, suggestions } from "./schema";

export type SaveOutfitResult =
  | { ok: true; previous: { key: string | null; ext: string | null } | null }
  | { ok: false; error: string };

export async function saveOutfit(db: Database, input: OutfitInput, today: string): Promise<SaveOutfitResult> {
  if (input.date > today) return { ok: false, error: "That date hasn't happened yet." };
  if (new Set(input.itemIds).size !== input.itemIds.length) {
    return { ok: false, error: "Each piece can only be in the outfit once." };
  }

  const found = await db.select().from(items).where(inArray(items.id, input.itemIds));
  if (found.length !== input.itemIds.length) {
    return { ok: false, error: "One of those pieces doesn't exist." };
  }
  const current = await db.select().from(outfitItems).where(eq(outfitItems.date, input.date));
  const already = new Set(current.map((row) => row.itemId));
  if (found.some((item) => item.archivedAt != null && !already.has(item.id))) {
    return { ok: false, error: "Retired pieces can only stay in outfits they were already in." };
  }

  if (input.sourceSuggestionId) {
    const suggestion = await db
      .select({ status: suggestions.status })
      .from(suggestions)
      .where(eq(suggestions.id, input.sourceSuggestionId));
    if (suggestion[0]?.status !== "approved") {
      return { ok: false, error: "That suggestion isn't approved." };
    }
  }

  const existing = await db.select().from(outfits).where(eq(outfits.date, input.date));
  const now = Date.now();
  const photo = input.fitPic ?? null;
  await db.batch([
    db
      .insert(outfits)
      .values({
        date: input.date,
        rating: input.rating ?? null,
        note: input.note ?? null,
        fitPicKey: photo?.key ?? null,
        fitPicExt: photo?.ext ?? null,
        fitPicW: photo?.w ?? null,
        fitPicH: photo?.h ?? null,
        sourceSuggestionId: input.sourceSuggestionId ?? null,
        createdAt: existing[0]?.createdAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: outfits.date,
        set: {
          rating: input.rating ?? null,
          note: input.note ?? null,
          fitPicKey: photo?.key ?? null,
          fitPicExt: photo?.ext ?? null,
          fitPicW: photo?.w ?? null,
          fitPicH: photo?.h ?? null,
          sourceSuggestionId: input.sourceSuggestionId ?? null,
          updatedAt: now,
        },
      }),
    db.delete(outfitItems).where(eq(outfitItems.date, input.date)),
    db.insert(outfitItems).values(input.itemIds.map((itemId) => ({ date: input.date, itemId }))),
  ]);

  return {
    ok: true,
    previous: existing[0] ? { key: existing[0].fitPicKey, ext: existing[0].fitPicExt } : null,
  };
}

export async function deleteOutfit(db: Database, date: string) {
  const existing = await db.select().from(outfits).where(and(eq(outfits.date, date)));
  await db.delete(outfits).where(eq(outfits.date, date));
  return existing[0] ?? null;
}
