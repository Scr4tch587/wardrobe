import { addDays } from "./dates";
import type { Slot } from "./slots";

export type ItemCard = {
  id: string;
  name: string;
  slot: Slot;
  color: string | null;
  brand: string | null;
  acquiredOn: string | null;
  anecdote: string | null;
  photoKey: string | null;
  photoExt: "webp" | "jpg" | null;
  photoW: number | null;
  photoH: number | null;
  tempMinC: number | null;
  tempMaxC: number | null;
  archivedAt: number | null;
  createdAt: number;
  wearCount: number;
  lastWorn: string | null;
  firstWorn: string | null;
  avgRating: number | null;
  ratedCount: number;
  avgWornTemp: number | null;
  tempSamples: number;
};

const ITEM_STATS = `
SELECT
  i.id AS id,
  i.name AS name,
  i.slot AS slot,
  i.color AS color,
  i.brand AS brand,
  i.acquired_on AS acquired_on,
  i.anecdote AS anecdote,
  i.photo_key AS photo_key,
  i.photo_ext AS photo_ext,
  i.photo_w AS photo_w,
  i.photo_h AS photo_h,
  i.temp_min_c AS temp_min_c,
  i.temp_max_c AS temp_max_c,
  i.archived_at AS archived_at,
  i.created_at AS created_at,
  COUNT(oi.date) AS wear_count,
  MAX(oi.date) AS last_worn,
  MIN(oi.date) AS first_worn,
  AVG(o.rating) AS avg_rating,
  COUNT(o.rating) AS rated_count,
  AVG((w.apparent_max_c + w.apparent_min_c) / 2.0) AS avg_worn_temp,
  COUNT(w.date) AS temp_samples
FROM items i
LEFT JOIN outfit_items oi ON oi.item_id = i.id AND oi.date <= ?
LEFT JOIN outfits o ON o.date = oi.date
LEFT JOIN weather w ON w.date = oi.date AND w.kind = 'actual'
`;

type ItemSql = {
  id: string;
  name: string;
  slot: string;
  color: string | null;
  brand: string | null;
  acquired_on: string | null;
  anecdote: string | null;
  photo_key: string | null;
  photo_ext: string | null;
  photo_w: number | null;
  photo_h: number | null;
  temp_min_c: number | null;
  temp_max_c: number | null;
  archived_at: number | null;
  created_at: number;
  wear_count: number;
  last_worn: string | null;
  first_worn: string | null;
  avg_rating: number | null;
  rated_count: number;
  avg_worn_temp: number | null;
  temp_samples: number;
};

function mapItem(row: ItemSql): ItemCard {
  return {
    id: row.id,
    name: row.name,
    slot: row.slot as Slot,
    color: row.color,
    brand: row.brand,
    acquiredOn: row.acquired_on,
    anecdote: row.anecdote,
    photoKey: row.photo_key,
    photoExt: row.photo_ext === "webp" || row.photo_ext === "jpg" ? row.photo_ext : null,
    photoW: row.photo_w,
    photoH: row.photo_h,
    tempMinC: row.temp_min_c,
    tempMaxC: row.temp_max_c,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    wearCount: row.wear_count,
    lastWorn: row.last_worn,
    firstWorn: row.first_worn,
    avgRating: row.avg_rating,
    ratedCount: row.rated_count,
    avgWornTemp: row.avg_worn_temp,
    tempSamples: row.temp_samples,
  };
}

export async function listActiveItems(env: Env, cutoff: string): Promise<ItemCard[]> {
  const rows = await env.DB.prepare(`${ITEM_STATS} WHERE i.archived_at IS NULL GROUP BY i.id`)
    .bind(cutoff)
    .all<ItemSql>();
  return rows.results.map(mapItem);
}

export async function getItem(env: Env, id: string, cutoff: string): Promise<ItemCard | null> {
  const row = await env.DB.prepare(`${ITEM_STATS} WHERE i.id = ? GROUP BY i.id`).bind(cutoff, id).first<ItemSql>();
  return row ? mapItem(row) : null;
}

export async function wearDates(env: Env, id: string, cutoff: string): Promise<string[]> {
  const rows = await env.DB.prepare(
    "SELECT date FROM outfit_items WHERE item_id = ? AND date <= ? ORDER BY date",
  )
    .bind(id, cutoff)
    .all<{ date: string }>();
  return rows.results.map((row) => row.date);
}

export async function pairings(env: Env, id: string, cutoff: string) {
  const rows = await env.DB.prepare(
    `SELECT b.item_id AS other_id, i.name AS name, i.photo_key, i.photo_ext, i.photo_w, i.photo_h,
            COUNT(*) AS together, AVG(o.rating) AS avg_rating
     FROM outfit_items a
     JOIN outfit_items b ON b.date = a.date AND b.item_id <> a.item_id
     JOIN outfits o ON o.date = a.date
     JOIN items i ON i.id = b.item_id
     WHERE a.item_id = ? AND a.date <= ?
     GROUP BY b.item_id
     ORDER BY together DESC, avg_rating DESC
     LIMIT 5`,
  )
    .bind(id, cutoff)
    .all<{
      other_id: string;
      name: string;
      photo_key: string | null;
      photo_ext: string | null;
      photo_w: number | null;
      photo_h: number | null;
      together: number;
      avg_rating: number | null;
    }>();
  return rows.results;
}

export type OutfitSummary = {
  date: string;
  rating: number | null;
  note: string | null;
  fitPicKey: string | null;
  fitPicExt: "webp" | "jpg" | null;
  fitPicW: number | null;
  fitPicH: number | null;
  sourceSuggestionId: string | null;
  items: {
    id: string;
    name: string;
    slot: string;
    photoKey: string | null;
    photoExt: "webp" | "jpg" | null;
    photoW: number | null;
    photoH: number | null;
  }[];
};

export async function listOutfits(env: Env, cutoff: string, before: string | null, limit = 30) {
  const rows = await env.DB.prepare(
    `SELECT date, rating, note, fit_pic_key, fit_pic_ext, fit_pic_w, fit_pic_h, source_suggestion_id
     FROM outfits
     WHERE date <= ? AND (? IS NULL OR date < ?)
     ORDER BY date DESC
     LIMIT ?`,
  )
    .bind(cutoff, before, before, limit)
    .all<{
      date: string;
      rating: number | null;
      note: string | null;
      fit_pic_key: string | null;
      fit_pic_ext: string | null;
      fit_pic_w: number | null;
      fit_pic_h: number | null;
      source_suggestion_id: string | null;
    }>();
  return attachItems(env, rows.results.map(mapOutfit));
}

export async function getOutfit(env: Env, date: string): Promise<OutfitSummary | null> {
  const row = await env.DB.prepare(
    `SELECT date, rating, note, fit_pic_key, fit_pic_ext, fit_pic_w, fit_pic_h, source_suggestion_id
     FROM outfits WHERE date = ?`,
  )
    .bind(date)
    .first<{
      date: string;
      rating: number | null;
      note: string | null;
      fit_pic_key: string | null;
      fit_pic_ext: string | null;
      fit_pic_w: number | null;
      fit_pic_h: number | null;
      source_suggestion_id: string | null;
    }>();
  if (!row) return null;
  const [outfit] = await attachItems(env, [mapOutfit(row)]);
  return outfit ?? null;
}

function mapOutfit(row: {
  date: string;
  rating: number | null;
  note: string | null;
  fit_pic_key: string | null;
  fit_pic_ext: string | null;
  fit_pic_w: number | null;
  fit_pic_h: number | null;
  source_suggestion_id: string | null;
}): OutfitSummary {
  return {
    date: row.date,
    rating: row.rating,
    note: row.note,
    fitPicKey: row.fit_pic_key,
    fitPicExt: row.fit_pic_ext === "webp" || row.fit_pic_ext === "jpg" ? row.fit_pic_ext : null,
    fitPicW: row.fit_pic_w,
    fitPicH: row.fit_pic_h,
    sourceSuggestionId: row.source_suggestion_id,
    items: [],
  };
}

async function attachItems(env: Env, outfits: OutfitSummary[]): Promise<OutfitSummary[]> {
  if (outfits.length === 0) return [];
  const placeholders = outfits.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT oi.date AS date, i.id AS id, i.name AS name, i.slot AS slot,
            i.photo_key AS photo_key, i.photo_ext AS photo_ext, i.photo_w AS photo_w, i.photo_h AS photo_h
     FROM outfit_items oi
     JOIN items i ON i.id = oi.item_id
     WHERE oi.date IN (${placeholders})
     ORDER BY i.slot, i.name`,
  )
    .bind(...outfits.map((outfit) => outfit.date))
    .all<{
      date: string;
      id: string;
      name: string;
      slot: string;
      photo_key: string | null;
      photo_ext: string | null;
      photo_w: number | null;
      photo_h: number | null;
    }>();
  const grouped = new Map<string, OutfitSummary["items"]>();
  for (const row of rows.results) {
    const list = grouped.get(row.date) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      slot: row.slot,
      photoKey: row.photo_key,
      photoExt: row.photo_ext === "webp" || row.photo_ext === "jpg" ? row.photo_ext : null,
      photoW: row.photo_w,
      photoH: row.photo_h,
    });
    grouped.set(row.date, list);
  }
  return outfits.map((outfit) => ({ ...outfit, items: grouped.get(outfit.date) ?? [] }));
}

export async function outfitDates(env: Env, cutoff: string): Promise<string[]> {
  const rows = await env.DB.prepare("SELECT date FROM outfits WHERE date <= ? ORDER BY date")
    .bind(cutoff)
    .all<{ date: string }>();
  return rows.results.map((row) => row.date);
}

export function streaks(dates: string[], cutoff: string): { longest: number; current: number } {
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of dates) {
    run = previous && addDays(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  const set = new Set(dates);
  let current = 0;
  if (set.has(cutoff)) {
    current = 1;
    let cursor = cutoff;
    while (set.has(addDays(cursor, -1))) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }
  return { longest, current };
}

export function concentration(wearCounts: number[]): number | null {
  const total = wearCounts.reduce((sum, count) => sum + count, 0);
  if (total === 0 || wearCounts.length === 0) return null;
  const sorted = [...wearCounts].sort((a, b) => b - a);
  let sum = 0;
  let count = 0;
  for (const wears of sorted) {
    sum += wears;
    count++;
    if (sum * 2 >= total) break;
  }
  return (count / wearCounts.length) * 100;
}

export async function weatherFor(env: Env, date: string) {
  return env.DB.prepare(
    `SELECT date, kind, temp_max_c, temp_min_c, apparent_max_c, apparent_min_c, precip_mm, weather_code
     FROM weather WHERE date = ?`,
  )
    .bind(date)
    .first<{
      date: string;
      kind: string;
      temp_max_c: number;
      temp_min_c: number;
      apparent_max_c: number;
      apparent_min_c: number;
      precip_mm: number | null;
      weather_code: number | null;
    }>();
}

export async function leaderboard(env: Env, date: string, limit: number) {
  const rows = await env.DB.prepare(
    `SELECT r.rank, r.score, r.season_fit, r.recency, r.enjoyment, r.underuse, r.item_id,
            i.name, i.slot, i.photo_key, i.photo_ext, i.photo_w, i.photo_h,
            run.effective_temp, run.status, run.computed_at
     FROM rankings r
     JOIN items i ON i.id = r.item_id
     JOIN ranking_runs run ON run.date = r.date
     WHERE r.date = ?
     ORDER BY r.rank
     LIMIT ?`,
  )
    .bind(date, limit)
    .all<{
      rank: number;
      score: number;
      season_fit: number;
      recency: number;
      enjoyment: number;
      underuse: number;
      item_id: string;
      name: string;
      slot: string;
      photo_key: string | null;
      photo_ext: string | null;
      photo_w: number | null;
      photo_h: number | null;
      effective_temp: number | null;
      status: string;
      computed_at: number;
    }>();
  return rows.results;
}

export async function ranksFor(env: Env, date: string): Promise<Map<string, number>> {
  const rows = await env.DB.prepare("SELECT item_id, rank FROM rankings WHERE date = ?")
    .bind(date)
    .all<{ item_id: string; rank: number }>();
  return new Map(rows.results.map((row) => [row.item_id, row.rank]));
}

export async function latestRun(env: Env) {
  return env.DB.prepare(
    "SELECT date, status, effective_temp, computed_at FROM ranking_runs ORDER BY date DESC LIMIT 1",
  ).first<{ date: string; status: string; effective_temp: number | null; computed_at: number }>();
}
