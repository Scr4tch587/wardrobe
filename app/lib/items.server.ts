import { eq } from "drizzle-orm";
import type { Database } from "./db.server";
import type { ItemInput } from "./schemas";
import { items } from "./schema";

export async function saveItem(db: Database, id: string, input: ItemInput, existingCreatedAt?: number) {
  const now = Date.now();
  const values = {
    id,
    name: input.name,
    slot: input.slot,
    color: input.color ?? null,
    brand: input.brand ?? null,
    acquiredOn: input.acquiredOn ?? null,
    anecdote: input.anecdote ?? null,
    photoKey: input.photo?.key ?? null,
    photoExt: input.photo?.ext ?? null,
    photoW: input.photo?.w ?? null,
    photoH: input.photo?.h ?? null,
    tempMinC: input.tempMinC ?? null,
    tempMaxC: input.tempMaxC ?? null,
    updatedAt: now,
  };
  if (existingCreatedAt == null) {
    await db.insert(items).values({ ...values, archivedAt: null, createdAt: now });
    return;
  }
  await db.update(items).set(values).where(eq(items.id, id));
}

export async function setArchived(db: Database, id: string, archived: boolean) {
  await db
    .update(items)
    .set({ archivedAt: archived ? Date.now() : null, updatedAt: Date.now() })
    .where(eq(items.id, id));
}

export async function deleteItem(db: Database, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.delete(items).where(eq(items.id, id));
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("foreign key")) {
      return { ok: false, error: "This piece is in an outfit or suggestion. Archive it instead." };
    }
    throw error;
  }
}
