import { describe, expect, it } from "vitest";
import { prepareVisitorFields, validateSuggestionPieces } from "../app/lib/suggestions";

const active = [
  { id: "top-1", slot: "top", archivedAt: null },
  { id: "top-2", slot: "top", archivedAt: null },
  { id: "bottom", slot: "bottom", archivedAt: null },
  { id: "shoes", slot: "shoes", archivedAt: null },
  { id: "coat", slot: "outerwear", archivedAt: null },
  { id: "retired", slot: "top", archivedAt: 1 },
];

describe("suggestion validation", () => {
  it("accepts a legal slot mix and rejects extras", () => {
    expect(validateSuggestionPieces(active, ["top-1", "bottom", "shoes"]).ok).toBe(true);
    const extraBottom = validateSuggestionPieces(active, ["top-1", "bottom", "bottom", "shoes"]);
    expect(extraBottom.ok).toBe(false);
    const noTop = validateSuggestionPieces(active, ["bottom", "shoes", "coat"]);
    expect(noTop.ok).toBe(false);
    if (!noTop.ok) expect(noTop.error).toMatch(/top/i);
  });

  it("rejects archived and duplicate pieces", () => {
    const archived = validateSuggestionPieces(active, ["retired", "bottom", "shoes"]);
    expect(archived.ok).toBe(false);
    const duplicate = validateSuggestionPieces(active, ["top-1", "top-1", "bottom", "shoes"]);
    expect(duplicate.ok).toBe(false);
  });

  it("rejects links and drops control and zero-width characters", () => {
    expect(prepareVisitorFields("see example.com", "hello").ok).toBe(false);
    expect(prepareVisitorFields("Ada", "visit https://example.com").ok).toBe(false);
    const cleaned = prepareVisitorFields("Ada\u200B", "hi\u0000 there");
    expect(cleaned).toEqual({ ok: true, name: "Ada", message: "hi there" });
    const empty = prepareVisitorFields("\u200B \u0000", "   ");
    expect(empty).toEqual({ ok: true, name: null, message: null });
    const composed = prepareVisitorFields("e\u0301", undefined);
    expect(composed.ok && composed.name).toBe("é".normalize("NFC"));
  });
});
