import { describe, expect, it } from "vitest";
import { addDays, publishCutoff, todayInTz } from "../app/lib/dates";

const tz = "America/Toronto";

describe("todayInTz", () => {
  it("crosses midnight in winter (EST)", () => {
    expect(todayInTz(new Date("2026-01-15T04:59:59.999Z"), tz)).toBe("2026-01-14");
    expect(todayInTz(new Date("2026-01-15T05:00:00.000Z"), tz)).toBe("2026-01-15");
  });

  it("crosses midnight in summer (EDT)", () => {
    expect(todayInTz(new Date("2026-07-15T03:59:59.999Z"), tz)).toBe("2026-07-14");
    expect(todayInTz(new Date("2026-07-15T04:00:00.000Z"), tz)).toBe("2026-07-15");
  });

  it("stays on the spring-forward day", () => {
    expect(todayInTz(new Date("2026-03-08T04:59:59.999Z"), tz)).toBe("2026-03-07");
    expect(todayInTz(new Date("2026-03-08T05:00:00.000Z"), tz)).toBe("2026-03-08");
    expect(todayInTz(new Date("2026-03-08T06:59:59.999Z"), tz)).toBe("2026-03-08");
    expect(todayInTz(new Date("2026-03-08T07:00:00.000Z"), tz)).toBe("2026-03-08");
  });

  it("stays on the fall-back day through the repeated hour", () => {
    expect(todayInTz(new Date("2026-11-01T03:59:59.999Z"), tz)).toBe("2026-10-31");
    expect(todayInTz(new Date("2026-11-01T04:00:00.000Z"), tz)).toBe("2026-11-01");
    expect(todayInTz(new Date("2026-11-01T05:30:00.000Z"), tz)).toBe("2026-11-01");
    expect(todayInTz(new Date("2026-11-01T06:30:00.000Z"), tz)).toBe("2026-11-01");
  });
});

describe("publishCutoff", () => {
  const env = { SITE_TZ: tz, PUBLISH_DELAY_DAYS: "1" };

  it("is the previous Toronto date, including across DST", () => {
    expect(publishCutoff(env, new Date("2026-01-15T05:00:00.000Z"))).toEqual({
      today: "2026-01-15",
      cutoff: "2026-01-14",
    });
    expect(publishCutoff(env, new Date("2026-03-08T05:00:00.000Z"))).toEqual({
      today: "2026-03-08",
      cutoff: "2026-03-07",
    });
    expect(publishCutoff(env, new Date("2026-11-01T06:30:00.000Z"))).toEqual({
      today: "2026-11-01",
      cutoff: "2026-10-31",
    });
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});
