import { describe, expect, it } from "vitest";
import { RANKING_PARAMS, rankItems, type RankingItemInput, type RankingParams } from "../app/lib/ranking";

const today = "2026-10-28";
const cutoff = "2026-10-27";

function item(partial: Partial<RankingItemInput> & Pick<RankingItemInput, "id">): RankingItemInput {
  return {
    slot: "top",
    tempMinC: null,
    tempMaxC: null,
    acquiredOn: null,
    createdOn: "2024-01-01",
    ...partial,
  };
}

describe("rankItems", () => {
  it("keeps every component and the score inside 0..1", () => {
    const ranked = rankItems({
      items: [
        item({ id: "cold", slot: "outerwear", tempMinC: -5, tempMaxC: 8 }),
        item({ id: "never" }),
        item({ id: "loved" }),
      ],
      wears: [
        { itemId: "loved", date: "2026-10-01", rating: 10, effectiveTemp: 12 },
        { itemId: "loved", date: "2026-09-01", rating: 9, effectiveTemp: 18 },
        { itemId: "loved", date: "2026-08-01", rating: 8, effectiveTemp: 22 },
        { itemId: "cold", date: "2026-01-10", rating: 7, effectiveTemp: 0 },
        { itemId: "cold", date: "2026-02-02", rating: 6, effectiveTemp: -2 },
      ],
      today,
      cutoff,
      effectiveTemp: 4,
    });
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3]);
    for (const row of ranked) {
      for (const value of [row.score, row.seasonFit, row.recency, row.enjoyment, row.underuse]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it("shrinks a single rating toward the global mean and trusts a long record", () => {
    const sparse = rankItems({
      items: [item({ id: "once" }), item({ id: "other" }), item({ id: "unrated" })],
      wears: [
        { itemId: "once", date: "2026-06-01", rating: 10, effectiveTemp: 20 },
        { itemId: "other", date: "2026-06-02", rating: 2, effectiveTemp: 20 },
      ],
      today,
      cutoff,
      effectiveTemp: null,
    });
    expect(sparse.find((row) => row.id === "once")?.shrunkRating).toBeCloseTo(7, 5);
    expect(sparse.find((row) => row.id === "unrated")?.shrunkRating).toBeCloseTo(6, 5);
    expect(sparse.find((row) => row.id === "unrated")?.ratedCount).toBe(0);

    const many = Array.from({ length: 20 }, (_, index) => ({
      itemId: "regular",
      date: `2025-01-${String(index + 1).padStart(2, "0")}`,
      rating: 10,
      effectiveTemp: 12,
    }));
    const trusted = rankItems({
      items: [item({ id: "regular" }), item({ id: "other" })],
      wears: [...many, { itemId: "other", date: "2026-06-02", rating: 2, effectiveTemp: 20 }],
      today,
      cutoff,
      effectiveTemp: null,
    });
    expect(trusted.find((row) => row.id === "regular")?.shrunkRating).toBeGreaterThan(9.5);
  });

  it("gives never-worn items full recency and uses F = 1 without weather", () => {
    const [only] = rankItems({
      items: [item({ id: "new", slot: "outerwear", tempMinC: -10, tempMaxC: 0 })],
      wears: [],
      today,
      cutoff,
      effectiveTemp: null,
    });
    expect(only?.recency).toBe(1);
    expect(only?.seasonFit).toBe(1);
    expect(only?.lastWorn).toBeNull();
  });

  it("breaks ties by never-worn, then older last wear, then id", () => {
    const params: RankingParams = { ...RANKING_PARAMS, wR: 0, wE: 0, wU: 0 };
    const ranked = rankItems({
      items: [item({ id: "c" }), item({ id: "a" }), item({ id: "b" })],
      wears: [
        { itemId: "c", date: "2024-01-01", rating: null, effectiveTemp: null },
        { itemId: "a", date: "2020-01-01", rating: null, effectiveTemp: null },
      ],
      today,
      cutoff,
      effectiveTemp: 10,
      params,
    });
    expect(ranked.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(new Set(ranked.map((row) => row.score)).size).toBe(1);

    const same = rankItems({
      items: [item({ id: "b" }), item({ id: "a" })],
      wears: [],
      today,
      cutoff,
      effectiveTemp: null,
      params,
    });
    expect(same.map((row) => row.id)).toEqual(["a", "b"]);
    const again = rankItems({
      items: [item({ id: "b" }), item({ id: "a" })],
      wears: [],
      today,
      cutoff,
      effectiveTemp: null,
      params,
    });
    expect(again.map((row) => row.id)).toEqual(same.map((row) => row.id));
  });
});
