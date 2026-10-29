export type WeatherWrite = {
  date: string;
  kind: "forecast" | "actual";
  tempMaxC: number;
  tempMinC: number;
  apparentMaxC: number;
  apparentMinC: number;
  precipMm: number | null;
  weatherCode: number | null;
  fetchedAt: number;
};

const UPSERT = `
INSERT INTO weather (
  date, kind, temp_max_c, temp_min_c, apparent_max_c, apparent_min_c, precip_mm, weather_code, fetched_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(date) DO UPDATE SET
  kind = excluded.kind,
  temp_max_c = excluded.temp_max_c,
  temp_min_c = excluded.temp_min_c,
  apparent_max_c = excluded.apparent_max_c,
  apparent_min_c = excluded.apparent_min_c,
  precip_mm = excluded.precip_mm,
  weather_code = excluded.weather_code,
  fetched_at = excluded.fetched_at
WHERE weather.kind = 'forecast' OR excluded.kind = 'actual'
`;

export async function upsertWeather(db: D1Database, rows: WeatherWrite[]): Promise<void> {
  if (rows.length === 0) return;
  await db.batch(
    rows.map((row) =>
      db
        .prepare(UPSERT)
        .bind(
          row.date,
          row.kind,
          row.tempMaxC,
          row.tempMinC,
          row.apparentMaxC,
          row.apparentMinC,
          row.precipMm,
          row.weatherCode,
          row.fetchedAt,
        ),
    ),
  );
}

type OpenMeteoDaily = {
  time?: string[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  apparent_temperature_max?: (number | null)[];
  apparent_temperature_min?: (number | null)[];
  precipitation_sum?: (number | null)[];
  weather_code?: (number | null)[];
};

export function rowsFromDaily(daily: OpenMeteoDaily, today: string, fetchedAt: number): WeatherWrite[] {
  const dates = daily.time ?? [];
  const rows: WeatherWrite[] = [];
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    if (!date || date > today) continue;
    const tempMaxC = daily.temperature_2m_max?.[index];
    const tempMinC = daily.temperature_2m_min?.[index];
    const apparentMaxC = daily.apparent_temperature_max?.[index];
    const apparentMinC = daily.apparent_temperature_min?.[index];
    if (tempMaxC == null || tempMinC == null || apparentMaxC == null || apparentMinC == null) continue;
    rows.push({
      date,
      kind: date < today ? "actual" : "forecast",
      tempMaxC,
      tempMinC,
      apparentMaxC,
      apparentMinC,
      precipMm: daily.precipitation_sum?.[index] ?? null,
      weatherCode: daily.weather_code?.[index] ?? null,
      fetchedAt,
    });
  }
  return rows;
}

export function forecastUrl(env: Env, pastDays: number): string {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", env.SITE_LAT);
  url.searchParams.set("longitude", env.SITE_LON);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,weather_code",
  );
  url.searchParams.set("timezone", env.SITE_TZ);
  url.searchParams.set("past_days", String(pastDays));
  url.searchParams.set("forecast_days", "1");
  return url.toString();
}

export function archiveUrl(env: Env, start: string, end: string): string {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", env.SITE_LAT);
  url.searchParams.set("longitude", env.SITE_LON);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,weather_code",
  );
  url.searchParams.set("timezone", env.SITE_TZ);
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);
  return url.toString();
}

export async function fetchWeather(url: string): Promise<{ daily: OpenMeteoDaily }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
      return (await response.json()) as { daily: OpenMeteoDaily };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(300 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Weather request failed");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
