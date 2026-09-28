import { describe, expect, it } from "vitest";
import {
  berlinWeekday,
  isoDatePart,
  shouldScrape,
  type PreviousMenu,
} from "./shouldRun.ts";

const okSources: PreviousMenu["sources"] = {
  stmuv: { status: "ok" },
  sodexo: { status: "ok" },
  bella23: { status: "ok" },
};

const thisWeek: PreviousMenu = {
  weekStart: "2026-09-07",
  lastSuccessAt: "2026-09-07T08:12:00+02:00",
  sources: okSources,
};

describe("isoDatePart", () => {
  it("reads the calendar date from a timestamp", () => {
    expect(isoDatePart("2026-09-07T08:12:00+02:00")).toBe("2026-09-07");
    expect(isoDatePart("2026-09-03T09:27:00")).toBe("2026-09-03");
    expect(isoDatePart(undefined)).toBeUndefined();
  });
});

describe("berlinWeekday", () => {
  it("uses Europe/Berlin even around UTC midnight", () => {
    expect(berlinWeekday(new Date("2026-09-07T00:30:00+02:00"))).toBe(1);
    expect(berlinWeekday(new Date("2026-09-06T23:30:00+02:00"))).toBe(0);
  });
});

describe("shouldScrape", () => {
  it("forces a run regardless of the live menu", () => {
    expect(shouldScrape(new Date("2026-09-08T08:10:00+02:00"), thisWeek, { force: true })).toEqual({
      needed: true,
      reason: "forced",
    });
  });

  it("runs when there is no previous menu", () => {
    expect(shouldScrape(new Date("2026-09-08T08:10:00+02:00"), undefined)).toEqual({
      needed: true,
      reason: "no previous menu",
    });
  });

  it("skips later slots once today already succeeded", () => {
    expect(shouldScrape(new Date("2026-09-07T11:10:00+02:00"), thisWeek)).toEqual({
      needed: false,
      reason: "already scraped today",
    });
  });

  it("runs on monday when the live menu is last week", () => {
    const previous: PreviousMenu = {
      weekStart: "2026-08-31",
      lastSuccessAt: "2026-09-03T09:27:00+02:00",
      sources: okSources,
    };
    expect(shouldScrape(new Date("2026-09-07T08:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "live menu is from another week",
    });
  });

  it("runs wednesday so daily specials can replace the monday scrape", () => {
    expect(shouldScrape(new Date("2026-09-09T08:10:00+02:00"), thisWeek)).toEqual({
      needed: true,
      reason: "menu may have changed since yesterday",
    });
  });

  it("runs tuesday when monday was missed", () => {
    const previous: PreviousMenu = {
      weekStart: "2026-08-31",
      lastSuccessAt: "2026-09-03T09:27:00+02:00",
      sources: okSources,
    };
    expect(shouldScrape(new Date("2026-09-08T08:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "live menu is from another week",
    });
  });

  it("runs tuesday after a successful monday so later days can update", () => {
    expect(shouldScrape(new Date("2026-09-08T08:10:00+02:00"), thisWeek)).toEqual({
      needed: true,
      reason: "menu may have changed since yesterday",
    });
  });

  it("runs midday when a source is still missing", () => {
    const previous: PreviousMenu = {
      ...thisWeek,
      sources: {
        ...okSources,
        sodexo: { status: "error", error: "zu wenig Gerichte" },
      },
    };
    expect(shouldScrape(new Date("2026-09-07T11:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "a source is error or stale",
    });
  });

  it("runs thursday if the week is still incomplete", () => {
    const previous: PreviousMenu = {
      ...thisWeek,
      sources: {
        ...okSources,
        bella23: { status: "stale", error: "timeout" },
      },
    };
    expect(shouldScrape(new Date("2026-09-10T08:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "a source is error or stale",
    });
  });

  it("runs thursday after a wednesday scrape so later days can update", () => {
    const previous: PreviousMenu = {
      weekStart: "2026-09-07",
      lastSuccessAt: "2026-09-09T08:12:00+02:00",
      sources: okSources,
    };
    expect(shouldScrape(new Date("2026-09-10T08:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "menu may have changed since yesterday",
    });
  });

  it("skips a later thursday slot after a thursday morning scrape", () => {
    const previous: PreviousMenu = {
      weekStart: "2026-09-07",
      lastSuccessAt: "2026-09-10T08:12:00+02:00",
      sources: okSources,
    };
    expect(shouldScrape(new Date("2026-09-10T11:10:00+02:00"), previous)).toEqual({
      needed: false,
      reason: "already scraped today",
    });
  });

  it("runs again the same day when a canteen is missing a weekday", () => {
    const previous: PreviousMenu = {
      ...thisWeek,
      days: {
        monday: {
          date: "2026-09-07",
          canteens: [
            { id: "stmuv", dishes: [{ name: "Suppe", diet: "unknown" }] },
            { id: "sodexo", dishes: [{ name: "Schnitzel", diet: "meat" }] },
            { id: "bella23", dishes: [{ name: "Pasta", diet: "veggie" }] },
          ],
        },
        tuesday: {
          date: "2026-09-08",
          canteens: [
            { id: "stmuv", dishes: [{ name: "Suppe", diet: "unknown" }] },
            { id: "sodexo", dishes: [{ name: "Schnitzel", diet: "meat" }] },
            { id: "bella23", dishes: [{ name: "Pasta", diet: "veggie" }] },
          ],
        },
        wednesday: {
          date: "2026-09-09",
          canteens: [
            { id: "stmuv", dishes: [{ name: "Suppe", diet: "unknown" }] },
            { id: "sodexo", dishes: [{ name: "Schnitzel", diet: "meat" }] },
            { id: "bella23", dishes: [{ name: "Pasta", diet: "veggie" }] },
          ],
        },
        thursday: {
          date: "2026-09-10",
          canteens: [
            { id: "stmuv", dishes: [{ name: "Suppe", diet: "unknown" }] },
            { id: "sodexo", dishes: [{ name: "Schnitzel", diet: "meat" }] },
            { id: "bella23", dishes: [] },
          ],
        },
        friday: {
          date: "2026-09-11",
          canteens: [
            { id: "stmuv", dishes: [{ name: "Suppe", diet: "unknown" }] },
            { id: "sodexo", dishes: [{ name: "Schnitzel", diet: "meat" }] },
            { id: "bella23", dishes: [{ name: "Pizza", diet: "meat" }] },
          ],
        },
      },
    };
    expect(shouldScrape(new Date("2026-09-07T11:10:00+02:00"), previous)).toEqual({
      needed: true,
      reason: "a canteen day is empty",
    });
  });
});
