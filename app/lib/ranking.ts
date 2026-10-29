import { daysBetween } from "./dates";

export type RankingParams = {
  version: number;
  wR: number;
  wE: number;
  wU: number;
  tau: number;
  C: number;
  k: number;
  sigmaMin: number;
  priors: {
    outerwear: { mu0: number; sigma0: number };
    default: { mu0: number; sigma0: number };
  };
};

export const RANKING_PARAMS: RankingParams = {
  version: 1,
  wR: 0.4,
  wE: 0.4,
  wU: 0.2,
  tau: 21,
  C: 3,
  k: 3,
  sigmaMin: 4,
  priors: {
    outerwear: { mu0: 2, sigma0: 7 },
    default: { mu0: 12, sigma0: 14 },
  },
};

export type RankingItemInput = {
  id: string;
  slot: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  acquiredOn: string | null;
  createdOn: string;
};

export type RankingWearInput = {
  itemId: string;
  date: string;
  rating: number | null;
  effectiveTemp: number | null;
};

export type RankedItem = {
  id: string;
  rank: number;
  score: number;
  seasonFit: number;
  recency: number;
  enjoyment: number;
  underuse: number;
  lastWorn: string | null;
  shrunkRating: number;
  ratedCount: number;
};

type WearSummary = {
  dates: string[];
  temps: number[];
  ratings: number[];
};

export function rankItems(args: {
  items: RankingItemInput[];
  wears: RankingWearInput[];
  today: string;
  cutoff: string;
  effectiveTemp: number | null;
  params?: RankingParams;
}): RankedItem[] {
  const params = args.params ?? RANKING_PARAMS;
  const byItem = new Map<string, WearSummary>();
  const outfitRatings = new Map<string, number>();

  for (const wear of args.wears) {
    if (wear.date > args.cutoff) continue;
    const summary = byItem.get(wear.itemId) ?? { dates: [], temps: [], ratings: [] };
    summary.dates.push(wear.date);
    if (wear.effectiveTemp != null) summary.temps.push(wear.effectiveTemp);
    if (wear.rating != null) summary.ratings.push(wear.rating);
    byItem.set(wear.itemId, summary);
    if (wear.rating != null && !outfitRatings.has(wear.date)) {
      outfitRatings.set(wear.date, wear.rating);
    }
  }

  const ratingValues = [...outfitRatings.values()];
  const globalMean =
    ratingValues.length === 0
      ? 6
      : ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length;

  const rates = args.items.map((item) => wearRate(item, byItem.get(item.id), args.cutoff));
  const percentiles = averagePercentiles(rates);

  const scored = args.items.map((item, index) => {
    const summary = byItem.get(item.id);
    const dates = summary?.dates ?? [];
    const lastWorn = dates.length ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null;
    const prior = priorFor(item, params);
    const seasonFit = season(args.effectiveTemp, summary?.temps ?? [], prior, params);
    const recency = lastWorn == null ? 1 : 1 - Math.exp(-daysBetween(lastWorn, args.today) / params.tau);
    const ratings = summary?.ratings ?? [];
    const shrunkRating =
      (params.C * globalMean + ratings.reduce((sum, rating) => sum + rating, 0)) /
      (params.C + ratings.length);
    const enjoyment = (shrunkRating - 1) / 9;
    const underuse = 1 - (percentiles[index] ?? 0);
    const score = seasonFit * (params.wR * recency + params.wE * enjoyment + params.wU * underuse);
    return {
      id: item.id,
      score,
      seasonFit,
      recency,
      enjoyment,
      underuse,
      lastWorn,
      shrunkRating,
      ratedCount: ratings.length,
    };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.lastWorn !== b.lastWorn) {
      if (a.lastWorn == null) return -1;
      if (b.lastWorn == null) return 1;
      return a.lastWorn < b.lastWorn ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return scored.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function explainScore(args: {
  lastWorn: string | null;
  today: string;
  effectiveTemp: number | null;
  seasonFit: number;
  ratedCount: number;
  shrunkRating: number;
}): string {
  const parts: string[] = [];
  if (!args.lastWorn) {
    parts.push("Never worn");
  } else {
    const days = daysBetween(args.lastWorn, args.today);
    if (days <= 0) parts.push("Worn today");
    else if (days === 1) parts.push("Worn yesterday");
    else if (days >= 14) {
      const weeks = Math.max(1, Math.round(days / 7));
      parts.push(`Hasn't been worn in ${weeks} ${weeks === 1 ? "week" : "weeks"}`);
    } else {
      parts.push(`Hasn't been worn in ${days} days`);
    }
  }
  if (args.effectiveTemp != null) {
    const temp = Math.round(args.effectiveTemp);
    parts.push(args.seasonFit >= 0.5 ? `fits today's ${temp} °C` : `today is ${temp} °C`);
  }
  if (args.ratedCount > 0) parts.push(`you rate it ${args.shrunkRating.toFixed(1)}`);
  return parts.join(" · ");
}

function priorFor(item: RankingItemInput, params: RankingParams): { mu0: number; sigma0: number } {
  if (item.tempMinC != null && item.tempMaxC != null && item.tempMinC < item.tempMaxC) {
    return {
      mu0: (item.tempMinC + item.tempMaxC) / 2,
      sigma0: (item.tempMaxC - item.tempMinC) / 4,
    };
  }
  return item.slot === "outerwear" ? params.priors.outerwear : params.priors.default;
}

function season(
  temperature: number | null,
  temps: number[],
  prior: { mu0: number; sigma0: number },
  params: RankingParams,
): number {
  if (temperature == null) return 1;
  const n = temps.length;
  const mean = n === 0 ? prior.mu0 : temps.reduce((sum, value) => sum + value, 0) / n;
  const spread = n < 2 ? prior.sigma0 : sampleStdev(temps);
  const mu = (params.k * prior.mu0 + n * mean) / (params.k + n);
  const sigma = Math.max(params.sigmaMin, (params.k * prior.sigma0 + n * spread) / (params.k + n));
  const width = sigma > 0 ? sigma : params.sigmaMin || 4;
  return Math.exp(-((temperature - mu) ** 2) / (2 * width * width));
}

function sampleStdev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const square = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(square / (n - 1));
}

function wearRate(item: RankingItemInput, summary: WearSummary | undefined, cutoff: string): number {
  const dates = summary?.dates ?? [];
  const firstWorn = dates.length ? dates.reduce((earliest, date) => (date < earliest ? date : earliest)) : null;
  const starts = [item.acquiredOn, firstWorn, item.createdOn].filter((date): date is string => !!date);
  const start = starts.reduce((earliest, date) => (date < earliest ? date : earliest));
  const owned = Math.max(0, daysBetween(start, cutoff));
  return dates.length / Math.max(owned, 30);
}

function averagePercentiles(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  return values.map((value) => {
    let below = 0;
    let equal = 0;
    for (const other of values) {
      if (other < value) below++;
      else if (other === value) equal++;
    }
    return (below + 0.5 * equal) / n;
  });
}
