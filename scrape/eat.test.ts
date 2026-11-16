import { describe, expect, it } from "vitest";
import {
  gameMains,
  isPlateId,
  plateId,
  playableMembers,
  pointsForDay,
  pastWeeks,
  pointsForWeek,
  weekLeaders,
  weekLine,
  weekSheetDays,
} from "../site/eat.js";

describe("plateId", () => {
  it("keeps canteen mains and drops soup, dessert and the market", () => {
    const mains = gameMains({
      canteens: [
        {
          id: "stmuv",
          dishes: [
            { name: "Rinderbraten mit Knödel", category: "Hauptgericht" },
            { name: "Tomatensuppe", category: "Suppe" },
            { name: "Pudding", category: "Dessert" },
          ],
        },
        { id: "wochenmarkt", dishes: [{ name: "Hendl", category: "Hauptgericht" }] },
        { id: "bella23", dishes: [{ name: "Käsespätzle", category: "Hauptgericht" }] },
      ],
    });
    expect(mains.map((row) => row.id)).toEqual([
      "stmuv:rinderbraten-mit-knoedel",
      "bella23:kaesespaetzle",
    ]);
    expect(isPlateId(plateId("sodexo", "Pasta al Forno"))).toBe(true);
    expect(plateId("wochenmarkt", "Hendl")).toBe("");
  });
});

describe("weekSheetDays", () => {
  it("stops at today during the week and keeps Monday to Friday on the weekend", () => {
    expect(weekSheetDays(new Date("2026-11-04T11:00:00Z"))).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(weekSheetDays(new Date("2026-11-07T11:00:00Z"))).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
  });
});

describe("points", () => {
  const day = {
    a: { uid: "a", nick: "Sven", dish: "stmuv:braten", guesses: { b: "sodexo:pasta", c: "bella23:lachs" } },
    b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: { a: "stmuv:curry" } },
    c: { uid: "c", nick: "Kim", dish: "", guesses: { a: "stmuv:braten" } },
  };

  it("scores a match, ignores your own dish, and skips a missing dish", () => {
    const rows = pointsForDay(day);
    expect(rows.find((row) => row.nick === "Sven")?.points).toBe(1);
    expect(rows.find((row) => row.nick === "Ada")?.points).toBe(0);
    expect(rows.find((row) => row.nick === "Kim")).toBeUndefined();
  });

  it("adds the days of the week into one line", () => {
    const rows = pointsForWeek({ "2026-11-02": day, "2026-11-03": day }, ["2026-11-02", "2026-11-03"]);
    expect(weekLine(rows)).toBe("Diese Woche · Sven 2 · Ada 0");
  });

  it("keeps finished weeks and leaves the one still running", () => {
    const tree = {
      "2026-10-27": day,
      "2026-11-04": day,
    };
    const weeks = pastWeeks(tree, new Date("2026-11-04T11:00:00Z"), 8);
    expect(weeks.map((week) => week.monday)).toEqual(["2026-10-26"]);
    expect(weekLeaders(weeks[0].rows)).toEqual(["Sven"]);
    expect(pastWeeks(tree, new Date("2026-11-07T11:00:00Z"), 1).map((week) => week.monday)).toEqual([
      "2026-11-02",
    ]);
  });

  it("names every person on a tied top score and nobody at zero", () => {
    const tied = {
      a: { uid: "a", nick: "Sven", dish: "stmuv:braten", guesses: { b: "sodexo:pasta" } },
      b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: { a: "stmuv:braten" } },
    };
    expect(weekLeaders(pointsForWeek({ d: tied }, ["d"]))).toEqual(["Ada", "Sven"]);
    expect(weekLeaders(pointsForDay(day).filter((row) => row.nick === "Ada"))).toEqual([]);
  });
});

describe("points belong to uids, not names", () => {
  it("keeps two people with the same name apart", () => {
    const day = {
      u1: { uid: "u1", nick: "Sven", dish: "stmuv:braten", guesses: { u3: "bella23:lachs" } },
      u2: { uid: "u2", nick: "sven", dish: "sodexo:pasta", guesses: { u3: "stmuv:falsch" } },
      u3: { uid: "u3", nick: "Ada", dish: "bella23:lachs", guesses: {} },
    };
    const rows = pointsForDay(day);
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.uid === "u1")?.points).toBe(1);
    expect(rows.find((row) => row.uid === "u2")?.points).toBe(0);
    const week = pointsForWeek({ d1: day, d2: day }, ["d1", "d2"]);
    expect(week.map((row) => [row.uid, row.points])).toEqual([
      ["u1", 2],
      ["u3", 0],
      ["u2", 0],
    ]);
  });

  it("ignores a sheet stored under someone else's key", () => {
    const day = {
      u1: { uid: "u1", nick: "Sven", dish: "stmuv:braten", guesses: {} },
      u2: { uid: "u1", nick: "Sven", dish: "sodexo:pasta", guesses: { u3: "bella23:lachs" } },
      u3: { uid: "u3", nick: "Ada", dish: "bella23:lachs", guesses: { u1: "stmuv:braten" } },
    };
    const rows = pointsForDay(day);
    expect(rows.map((row) => row.uid).sort()).toEqual(["u1", "u3"]);
    expect(rows.find((row) => row.uid === "u1")?.points).toBe(0);
    expect(rows.find((row) => row.uid === "u3")?.points).toBe(1);
  });

  it("follows a rename within the week as one row", () => {
    const week = pointsForWeek(
      {
        d1: {
          u1: { uid: "u1", nick: "Sven", dish: "stmuv:a", guesses: { u2: "sodexo:b" } },
          u2: { uid: "u2", nick: "Ada", dish: "sodexo:b", guesses: {} },
        },
        d2: {
          u1: { uid: "u1", nick: "Svenni", dish: "stmuv:a", guesses: { u2: "sodexo:b" } },
          u2: { uid: "u2", nick: "Ada", dish: "sodexo:b", guesses: {} },
        },
      },
      ["d1", "d2"],
    );
    expect(week.find((row) => row.uid === "u1")).toEqual({ uid: "u1", nick: "Svenni", points: 2 });
  });
});

describe("vote calendar", () => {
  it("bounds Berlin days, 23 and 25 hours around the clock changes", async () => {
    const { dayBounds, voteCalendar } = await import("../scripts/vote-calendar.mjs");
    const nov = dayBounds("2026-11-14");
    expect(nov.s).toBe(Date.parse("2026-11-13T23:00:00Z"));
    expect(nov.e).toBe(Date.parse("2026-11-14T23:00:00Z"));
    expect(nov.l).toBe(Date.parse("2026-11-14T10:55:00Z"));
    expect(nov.w).toBe(false);
    const spring = dayBounds("2026-03-29");
    const autumn = dayBounds("2026-10-25");
    expect(spring.e - spring.s).toBe(23 * 3600000);
    expect(autumn.e - autumn.s).toBe(25 * 3600000);
    expect(dayBounds("2026-11-16").w).toBe(true);
    const year = voteCalendar(2028, 2028);
    expect(Object.keys(year)).toHaveLength(366);
    expect(year["2028-12-31"].e).toBe(Date.parse("2028-12-31T23:00:00Z"));
  });
});

describe("playableMembers", () => {
  it("drops you and keeps the rest of the round", () => {
    expect(
      playableMembers(
        {
          0: { uid: "aaaa", nick: "Sven", canteen: "stmuv" },
          1: { uid: "bbbb", nick: "Ada", canteen: "egal" },
        },
        "aaaa",
      ),
    ).toEqual([{ uid: "bbbb", nick: "Ada" }]);
  });
});

describe("hostile scoring payloads", () => {
  it("ignores self-tips, bad types, unknown fields and forged uid fields", () => {
    const day = {
      a: {
        uid: "a",
        nick: "Sven",
        dish: "stmuv:braten",
        guesses: { a: "stmuv:braten", b: "sodexo:pasta", x: "1", "": "stmuv:braten" },
      },
      b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: { a: "stmuv:braten" } },
      spoof: { uid: "a", nick: "Sven", dish: "bella23:lachs", guesses: { b: "sodexo:pasta" } },
    };
    const rows = pointsForDay(day as never);
    expect(rows.map((row) => [row.uid, row.points])).toEqual([
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("never reads a scores decoy tree", () => {
    const eats = {
      d: {
        a: { uid: "a", nick: "Sven", dish: "stmuv:braten", guesses: { b: "sodexo:pasta" } },
        b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: {} },
      },
    };
    const scores = { a: { points: 99, week: "2026-11-02" } };
    expect(pointsForWeek(eats, ["d"]).find((row) => row.uid === "a")?.points).toBe(1);
    expect(pointsForWeek(scores as never, ["d"])).toEqual([]);
  });
});
