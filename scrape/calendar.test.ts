import { describe, expect, it } from "vitest";
import { addDays, weekStartBerlin as scrapeWeekStart } from "./lib.ts";
import { isMenuWeekFresh, weekStartBerlin } from "../site/calendar.js";

const week = {
  monday: new Date("2026-09-14T10:00:00+02:00"),
  wednesday: new Date("2026-09-16T12:00:00+02:00"),
  friday: new Date("2026-09-18T11:30:00+02:00"),
  saturday: new Date("2026-09-19T16:00:00+02:00"),
  sunday: new Date("2026-09-20T15:00:00+02:00"),
  nextMonday: new Date("2026-09-21T08:00:00+02:00"),
};

describe("weekStartBerlin", () => {
  it("matches the scrape helper for midweek, weekend, and Monday", () => {
    for (const now of Object.values(week)) {
      expect(weekStartBerlin(now)).toBe(scrapeWeekStart(now));
    }
  });

  it("keeps Saturday and Sunday on the same Monday", () => {
    expect(weekStartBerlin(week.saturday)).toBe("2026-09-14");
    expect(weekStartBerlin(week.sunday)).toBe("2026-09-14");
  });

  it("rolls to the new Monday after the weekend", () => {
    expect(weekStartBerlin(week.nextMonday)).toBe("2026-09-21");
    expect(addDays(weekStartBerlin(week.nextMonday), 4)).toBe("2026-09-25");
  });
});

describe("isMenuWeekFresh", () => {
  it("is fresh when scraped on Monday, Wednesday, or Friday of this week", () => {
    expect(isMenuWeekFresh("2026-09-14T10:00:00+02:00", week.wednesday)).toBe(true);
    expect(isMenuWeekFresh("2026-09-16T10:00:00+02:00", week.wednesday)).toBe(true);
    expect(isMenuWeekFresh("2026-09-18T11:30:00+02:00", week.wednesday)).toBe(true);
  });

  it("is stale when scraped the previous Friday", () => {
    expect(isMenuWeekFresh("2026-09-11T10:00:00+02:00", week.wednesday)).toBe(false);
  });

  it("keeps a Friday scrape fresh through the weekend", () => {
    expect(isMenuWeekFresh("2026-09-18T11:00:00+02:00", week.saturday)).toBe(true);
    expect(isMenuWeekFresh("2026-09-18T11:00:00+02:00", week.sunday)).toBe(true);
  });

  it("goes stale on the following Monday", () => {
    expect(isMenuWeekFresh("2026-09-18T11:00:00+02:00", week.nextMonday)).toBe(
      false,
    );
  });

  it("treats a missing or invalid scrapedAt as stale", () => {
    expect(isMenuWeekFresh(undefined, week.wednesday)).toBe(false);
    expect(isMenuWeekFresh("", week.wednesday)).toBe(false);
    expect(isMenuWeekFresh("not-a-date", week.wednesday)).toBe(false);
  });
});
