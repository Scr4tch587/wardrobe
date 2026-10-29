import { addDays, daysBetween, instantToDate, publishCutoff } from "./dates";
import { RANKING_PARAMS, rankItems, type RankingItemInput, type RankingWearInput } from "./ranking";
import {
  archiveUrl,
  fetchWeather,
  forecastUrl,
  rowsFromDaily,
  upsertWeather,
} from "./weather.server";

const SAFETY_CRON = "0 15 * * *";

export async function runDaily(env: Env, options: { force: boolean; cron?: string }): Promise<void> {
  const { today, cutoff } = publishCutoff(env);
  if (!options.force && options.cron === SAFETY_CRON) {
    const existing = await env.DB.prepare("SELECT status FROM ranking_runs WHERE date = ?")
      .bind(today)
      .first<{ status: string }>();
    if (existing?.status === "ok") return;
  }

  let degraded = false;
  try {
    const payload = await fetchWeather(forecastUrl(env, 7));
    await upsertWeather(env.DB, rowsFromDaily(payload.daily, today, Date.now()));
  } catch (error) {
    degraded = true;
    console.error({ job: "daily", step: "forecast", error: errorText(error) });
  }

  try {
    await backfillWeather(env, today);
  } catch (error) {
    degraded = true;
    console.error({ job: "daily", step: "backfill", error: errorText(error) });
  }

  let effectiveTemp: number | null = null;
  try {
    const resolved = await resolveTemperature(env, today, degraded);
    effectiveTemp = resolved.temp;
    if (resolved.degraded) degraded = true;
  } catch (error) {
    degraded = true;
    console.error({ job: "daily", step: "temperature", error: errorText(error) });
  }

  try {
    const items = await loadCandidates(env);
    const wears = await loadWears(env, cutoff);
    const ranked = rankItems({
      items,
      wears,
      today,
      cutoff,
      effectiveTemp,
      params: RANKING_PARAMS,
    });
    await writeRankings(env, today, degraded ? "degraded" : "ok", effectiveTemp, ranked);
  } catch (error) {
    console.error({ job: "daily", step: "rankings", error: errorText(error) });
    throw error;
  }

  try {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
      env.DB.prepare("DELETE FROM suggestions WHERE status = 'rejected' AND reviewed_at < ?").bind(
        now - 90 * 86_400_000,
      ),
    ]);
  } catch (error) {
    console.error({ job: "daily", step: "housekeeping", error: errorText(error) });
  }
}

async function backfillWeather(env: Env, today: string): Promise<void> {
  const missing = await env.DB.prepare(
    `SELECT o.date AS date
     FROM outfits o
     LEFT JOIN weather w ON w.date = o.date AND w.kind = 'actual'
     WHERE w.date IS NULL AND o.date < ?
     ORDER BY o.date
     LIMIT 365`,
  )
    .bind(today)
    .all<{ date: string }>();
  const dates = missing.results.map((row) => row.date);
  if (dates.length === 0) return;

  const recent = dates.filter((date) => daysBetween(date, today) <= 90);
  const older = dates.filter((date) => daysBetween(date, today) > 90);
  const fetchedAt = Date.now();

  if (recent.length > 0) {
    const pastDays = Math.min(92, Math.max(1, daysBetween(recent[0]!, today)));
    const payload = await fetchWeather(forecastUrl(env, pastDays));
    await upsertWeather(env.DB, rowsFromDaily(payload.daily, today, fetchedAt));
  }

  if (older.length > 0) {
    const start = older[0]!;
    const last = older[older.length - 1]!;
    const end = last < addDays(start, 364) ? last : addDays(start, 364);
    const payload = await fetchWeather(archiveUrl(env, start, end));
    await upsertWeather(env.DB, rowsFromDaily(payload.daily, today, fetchedAt));
  }
}

async function resolveTemperature(
  env: Env,
  today: string,
  forecastFailed: boolean,
): Promise<{ temp: number | null; degraded: boolean }> {
  const todayRow = await env.DB.prepare(
    "SELECT apparent_max_c, apparent_min_c FROM weather WHERE date = ?",
  )
    .bind(today)
    .first<{ apparent_max_c: number; apparent_min_c: number }>();
  if (!forecastFailed && todayRow) {
    return { temp: mean(todayRow.apparent_max_c, todayRow.apparent_min_c), degraded: false };
  }
  const recent = await env.DB.prepare(
    "SELECT apparent_max_c, apparent_min_c FROM weather ORDER BY date DESC LIMIT 1",
  ).first<{ apparent_max_c: number; apparent_min_c: number }>();
  if (recent) return { temp: mean(recent.apparent_max_c, recent.apparent_min_c), degraded: true };
  return { temp: null, degraded: true };
}

async function loadCandidates(env: Env): Promise<RankingItemInput[]> {
  const rows = await env.DB.prepare(
    `SELECT id, slot, temp_min_c, temp_max_c, acquired_on, created_at
     FROM items WHERE archived_at IS NULL`,
  ).all<{
    id: string;
    slot: string;
    temp_min_c: number | null;
    temp_max_c: number | null;
    acquired_on: string | null;
    created_at: number;
  }>();
  return rows.results.map((row) => ({
    id: row.id,
    slot: row.slot,
    tempMinC: row.temp_min_c,
    tempMaxC: row.temp_max_c,
    acquiredOn: row.acquired_on,
    createdOn: instantToDate(row.created_at, env.SITE_TZ),
  }));
}

async function loadWears(env: Env, cutoff: string): Promise<RankingWearInput[]> {
  const rows = await env.DB.prepare(
    `SELECT oi.item_id AS item_id, oi.date AS date, o.rating AS rating,
            CASE WHEN w.date IS NOT NULL THEN (w.apparent_max_c + w.apparent_min_c) / 2.0 END AS effective_temp
     FROM outfit_items oi
     JOIN outfits o ON o.date = oi.date
     LEFT JOIN weather w ON w.date = oi.date AND w.kind = 'actual'
     WHERE oi.date <= ?`,
  )
    .bind(cutoff)
    .all<{ item_id: string; date: string; rating: number | null; effective_temp: number | null }>();
  return rows.results.map((row) => ({
    itemId: row.item_id,
    date: row.date,
    rating: row.rating,
    effectiveTemp: row.effective_temp,
  }));
}

async function writeRankings(
  env: Env,
  today: string,
  status: "ok" | "degraded",
  effectiveTemp: number | null,
  ranked: ReturnType<typeof rankItems>,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ranking_runs WHERE date = ?").bind(today),
    env.DB.prepare(
      `INSERT INTO ranking_runs (date, status, effective_temp, params_json, computed_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(today, status, effectiveTemp, JSON.stringify(RANKING_PARAMS), Date.now()),
    ...ranked.map((row) =>
      env.DB.prepare(
        `INSERT INTO rankings (date, item_id, rank, score, season_fit, recency, enjoyment, underuse)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(today, row.id, row.rank, row.score, row.seasonFit, row.recency, row.enjoyment, row.underuse),
    ),
  ]);
}

function mean(max: number, min: number): number {
  return (max + min) / 2;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
