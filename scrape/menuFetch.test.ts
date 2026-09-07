import { describe, expect, it } from "vitest";
import { pickFreshestMenu } from "../site/menuFetch.js";

describe("pickFreshestMenu", () => {
  it("prefers the newer weekStart even if local exists", () => {
    const stale = { weekStart: "2026-08-31", scrapedAt: "2026-09-03T09:27:00" };
    const fresh = { weekStart: "2026-09-07", scrapedAt: "2026-09-07T10:45:00+02:00" };
    expect(pickFreshestMenu([stale, stale, fresh])).toBe(fresh);
  });

  it("breaks a tie on scrapedAt", () => {
    const morning = { weekStart: "2026-09-07", scrapedAt: "2026-09-07T08:10:00+02:00" };
    const noon = { weekStart: "2026-09-07", scrapedAt: "2026-09-07T09:10:00+02:00" };
    expect(pickFreshestMenu([morning, noon])).toBe(noon);
  });

  it("skips failed fetches", () => {
    const fresh = { weekStart: "2026-09-07", scrapedAt: "2026-09-07T10:45:00+02:00" };
    expect(pickFreshestMenu([undefined, null, fresh])).toBe(fresh);
  });

  it("returns undefined when nothing loaded", () => {
    expect(pickFreshestMenu([undefined, null])).toBeUndefined();
  });
});
