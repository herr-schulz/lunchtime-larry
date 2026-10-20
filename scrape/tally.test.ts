import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dayLeader,
  foldDay,
  foldNicks,
  hourBands,
  isoWeekKey,
  leadingDays,
  mergeNickTotals,
  peopleRows,
  recentDays,
  recentMonths,
  recentWeeks,
  shareOf,
  thursdayMarket,
  winsLine,
} from "../site/tally.js";
import {
  aufrufWord,
  countDigits,
  countPathFor,
  countPixelUrl,
  counterUrl,
  readCountAt,
  readTotalCount,
  totalCountUrl,
} from "../site/visits.js";

const ELEVEN = Date.parse("2026-10-19T09:30:00.000Z");
const NOON = Date.parse("2026-10-19T10:00:00.000Z");

describe("foldDay", () => {
  it("counts every pick, people once, and the Berlin hour", () => {
    expect(
      foldDay({
        0: { uid: "a", nick: "Ada", canteen: "stmuv", second: "bella23", at: ELEVEN },
        1: { uid: "a", nick: "Ada", canteen: "sodexo", at: NOON },
        2: { uid: "b", nick: "Benno", canteen: "egal", at: NOON },
      }),
    ).toEqual({
      stmuv: 1,
      sodexo: 0,
      bella23: 1,
      wochenmarkt: 0,
      egal: 1,
      second: 1,
      n: 2,
      h11: 1,
      h12: 1,
    });
  });

  it("drops a nick the rules would reject", () => {
    expect(foldNicks({ 0: { uid: "a", nick: "123", canteen: "stmuv", at: ELEVEN } })).toEqual({});
    expect(foldNicks({ 0: { uid: "a", nick: "Ada", canteen: "stmuv", second: "bella23", at: ELEVEN } })).toEqual({
      Ada: { stmuv: 1, sodexo: 0, bella23: 1, wochenmarkt: 0, egal: 0 },
    });
  });
});

describe("mergeNickTotals", () => {
  it("adds a day once and leaves a repeat untouched", () => {
    const once = mergeNickTotals(null, { stmuv: 1, bella23: 1 }, "2026-10-19");
    expect(once.stmuv).toBe(1);
    expect(once.days?.["2026-10-19"]).toBe(true);
    const again = mergeNickTotals(once, { stmuv: 1, bella23: 1 }, "2026-10-19");
    expect(again).toEqual(once);
    const next = mergeNickTotals(again, { stmuv: 2 }, "2026-10-20");
    expect(next.stmuv).toBe(3);
    expect(next.days?.["2026-10-20"]).toBe(true);
  });
});

describe("ranges", () => {
  const days = {
    "2026-10-19": { stmuv: 4, sodexo: 1, bella23: 0, wochenmarkt: 0, egal: 0, second: 0, n: 4, h11: 3 },
    "2026-10-22": { stmuv: 0, sodexo: 0, bella23: 1, wochenmarkt: 2, egal: 1, second: 1, n: 3, h12: 2 },
  };

  it("keeps a Monday and the following Sunday in one week", () => {
    expect(isoWeekKey("2026-10-19")).toBe(isoWeekKey("2026-10-25"));
    expect(isoWeekKey("2026-10-19")).not.toBe(isoWeekKey("2026-10-26"));
  });

  it("ends the day window yesterday and leaves gaps empty", () => {
    const rows = recentDays(days, "2026-10-20", 3);
    expect(rows.map((row) => row.key)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19"]);
    expect(rows[0].tally).toBeNull();
    expect(rows[2].tally?.stmuv).toBe(4);
    expect(rows[2].label).toBe("Mo 19.10.");
  });

  it("sums a week and a month from the day objects", () => {
    const week = recentWeeks(days, "2026-10-26", 1)[0];
    expect(week.tally?.n).toBe(7);
    expect(week.tally?.wochenmarkt).toBe(2);
    const month = recentMonths(days, "2026-11-01", 1)[0];
    expect(month.key).toBe("2026-10");
    expect(month.tally?.egal).toBe(1);
  });

  it("names the canteen that led the most days", () => {
    expect(dayLeader(days["2026-10-19"])?.id).toBe("stmuv");
    expect(dayLeader(days["2026-10-22"])?.id).toBe("wochenmarkt");
    const lead = leadingDays(days);
    expect(lead.days).toBe(1);
    expect(winsLine(lead)).toMatch(/an 1 Tag vorn/);
    expect(shareOf(1, 7)).toBe(14);
    expect(thursdayMarket(days)).toEqual({ thursday: 2, other: 0 });
    expect(hourBands({ h7: 1, h11: 3, h16: 2 }).rest).toBe(3);
  });

  it("sorts people by how often they picked", () => {
    const rows = peopleRows({
      Benno: { stmuv: 1, sodexo: 0, bella23: 0, wochenmarkt: 0, egal: 0 },
      Ada: { stmuv: 4, sodexo: 0, bella23: 1, wochenmarkt: 0, egal: 0 },
    });
    expect(rows.map((row) => row.name)).toEqual(["Ada", "Benno"]);
    expect(rows[0].picks[0]).toEqual({ id: "stmuv", n: 4 });
  });
});

describe("tally rules", () => {
  const rules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules;

  it("does not list every round and creates a day only once", () => {
    expect(rules.tallies[".read"]).toBeUndefined();
    expect(rules.tallies.rounds[".read"]).toBeUndefined();
    const round = rules.tallies.rounds.$code;
    expect(round[".read"]).toMatch(/a-z0-9-/);
    const day = round.days.$day;
    expect(day[".write"]).toMatch(/!data\.exists\(\)/);
    expect(day[".write"]).toMatch(/\$day < root\.child\('meta\/voteDay'\)/);
    expect(day[".validate"]).toMatch(/second/);
    expect(day.$field[".validate"]).toMatch(/<= 24/);
    const nick = round.nicks.$nick;
    expect(nick[".write"]).toMatch(/A-Za-z/);
    expect(nick[".validate"]).toMatch(/\+ 24/);
    expect(nick.days.$date[".validate"]).toMatch(/== true/);
  });
});

describe("visit pixel", () => {
  it("counts the board and the alternatives on GoatCounter, not Firebase", () => {
    expect(countPathFor("board")).toBe("/");
    expect(countPathFor("alternativen")).toBe("/alternativen.html");
    expect(countPixelUrl("/", 7)).toBe(
      "https://lunchtime-larry.goatcounter.com/count?p=%2F&rnd=7",
    );
    expect(totalCountUrl()).toBe("https://lunchtime-larry.goatcounter.com/counter/TOTAL.json");
    expect(counterUrl("TOTAL", "week")).toBe(
      "https://lunchtime-larry.goatcounter.com/counter/TOTAL.json?start=week",
    );
    expect(counterUrl("/")).toBe("https://lunchtime-larry.goatcounter.com/counter//.json");
    expect(counterUrl("/alternativen.html")).toBe(
      "https://lunchtime-larry.goatcounter.com/counter//alternativen.html.json",
    );
    expect(countDigits("1.284")).toBe(1284);
    expect(countDigits("0")).toBe(0);
    expect(countDigits("")).toBeNull();
    const index = readFileSync("site/index.html", "utf8");
    const alt = readFileSync("site/alternativen.html", "utf8");
    const list = readFileSync("site/strichliste.html", "utf8");
    expect(index).toContain('data-aufruf="/"');
    expect(alt).toContain('data-aufruf="/alternativen.html"');
    expect(list).not.toContain("/count");
    expect(list).not.toContain("count.js");
    expect(list).toContain("Was gespeichert wird");
    expect(list).toContain("Headcount Harry");
    expect(list).toContain("leisure-larry.svg");
    expect(list).toContain("Deshalb brauchen wir auch keinen Cookie-Banner! Toll oder?");
    expect(list).not.toContain("Tritt einer Runde bei");
    expect(list).toContain("Zurück zu Larry");
    expect(list).toContain("https://lunchtime-larry.goatcounter.com/");
  });

  it("reads the formatted total and stays blank when the counter is off", async () => {
    const ok = await readTotalCount(async () => ({
      ok: true,
      json: async () => ({ count: "1.284" }),
    }));
    expect(ok).toBe("1.284");
    const off = await readTotalCount(async () => ({ ok: false, json: async () => ({}) }));
    expect(off).toBe("");
    const missing = await readCountAt("https://lunchtime-larry.goatcounter.com/counter//alternativen.html.json", async () => ({
      ok: false,
      json: async () => ({ count: "0" }),
    }));
    expect(missing).toBe("0");
  });

  it("uses the singular only for exactly one hit", () => {
    expect(aufrufWord("1")).toBe("Aufruf");
    expect(aufrufWord(1)).toBe("Aufruf");
    expect(aufrufWord("2")).toBe("Aufrufe");
    expect(aufrufWord("0")).toBe("Aufrufe");
    expect(aufrufWord("21")).toBe("Aufrufe");
    expect(aufrufWord("1.284")).toBe("Aufrufe");
  });
});
