import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { upsertWeather, type WeatherWrite } from "../app/lib/weather.server";
import { applySchema } from "./migrate";

const fetchedAt = 1_700_000_000_000;

function row(date: string, kind: "forecast" | "actual", temp: number): WeatherWrite {
  return {
    date,
    kind,
    tempMaxC: temp,
    tempMinC: temp - 5,
    apparentMaxC: temp,
    apparentMinC: temp - 5,
    precipMm: 0,
    weatherCode: 1,
    fetchedAt,
  };
}

describe("weather upsert", () => {
  beforeAll(applySchema);

  it("never replaces an actual row with a forecast", async () => {
    await upsertWeather(env.DB, [row("2026-10-20", "forecast", 10)]);
    await upsertWeather(env.DB, [row("2026-10-20", "forecast", 12)]);
    let stored = await env.DB.prepare("SELECT kind, temp_max_c FROM weather WHERE date = ?")
      .bind("2026-10-20")
      .first<{ kind: string; temp_max_c: number }>();
    expect(stored).toEqual({ kind: "forecast", temp_max_c: 12 });

    await upsertWeather(env.DB, [row("2026-10-20", "actual", 8)]);
    stored = await env.DB.prepare("SELECT kind, temp_max_c FROM weather WHERE date = ?")
      .bind("2026-10-20")
      .first<{ kind: string; temp_max_c: number }>();
    expect(stored).toEqual({ kind: "actual", temp_max_c: 8 });

    await upsertWeather(env.DB, [row("2026-10-20", "forecast", 30)]);
    stored = await env.DB.prepare("SELECT kind, temp_max_c FROM weather WHERE date = ?")
      .bind("2026-10-20")
      .first<{ kind: string; temp_max_c: number }>();
    expect(stored).toEqual({ kind: "actual", temp_max_c: 8 });

    await upsertWeather(env.DB, [row("2026-10-20", "actual", 9)]);
    stored = await env.DB.prepare("SELECT kind, temp_max_c FROM weather WHERE date = ?")
      .bind("2026-10-20")
      .first<{ kind: string; temp_max_c: number }>();
    expect(stored).toEqual({ kind: "actual", temp_max_c: 9 });
  });
});
