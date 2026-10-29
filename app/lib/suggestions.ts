import { sha256Hex } from "./crypto";
import { isSlot, suggestionSlotError, type Slot } from "./slots";
import { clipVisitorText, containsLink, normalizeVisitorText } from "./text";

export type SuggestionPiece = {
  id: string;
  slot: string;
  archivedAt: number | null;
};

export function prepareVisitorFields(name: string | undefined, message: string | undefined) {
  const normalizedName = normalizeVisitorText(name);
  const normalizedMessage = normalizeVisitorText(message);
  if (containsLink(normalizedName) || containsLink(normalizedMessage)) {
    return { ok: false as const, error: "Links aren't allowed." };
  }
  return {
    ok: true as const,
    name: clipVisitorText(normalizedName, 40),
    message: clipVisitorText(normalizedMessage, 280),
  };
}

export function validateSuggestionPieces(pieces: SuggestionPiece[], itemIds: string[]) {
  if (new Set(itemIds).size !== itemIds.length) {
    return { ok: false as const, error: "Each piece can only be picked once." };
  }
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));
  const counts: Partial<Record<Slot, number>> = {};
  for (const id of itemIds) {
    const piece = byId.get(id);
    if (!piece || piece.archivedAt != null) {
      return { ok: false as const, error: "One of those pieces isn't available." };
    }
    if (!isSlot(piece.slot)) return { ok: false as const, error: "One of those pieces isn't available." };
    counts[piece.slot] = (counts[piece.slot] ?? 0) + 1;
  }
  const slotError = suggestionSlotError(counts);
  if (slotError) return { ok: false as const, error: slotError };
  return { ok: true as const };
}

export async function comboKey(itemIds: string[]): Promise<string> {
  return sha256Hex([...itemIds].sort().join(","));
}
