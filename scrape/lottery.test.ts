import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { foldDay } from "../site/tally.js";
import {
  LOTTERY_ANNOUNCER,
  LOTTERY_JOIN,
  LOTTERY_NEEDS_ROUND,
  buildRoundTally,
  canteenNumbers,
  pointsBoardText,
  publicDayTallies,
  publicWinner,
} from "../site/lottery.js";
import { paintHeuteDabei } from "../site/voteMarks.js";

const eats = {
  "2026-11-02": {
    a: {
      uid: "a",
      nick: "Sven",
      dish: "stmuv:braten",
      guesses: { b: "sodexo:pasta" },
    },
    b: {
      uid: "b",
      nick: "Ada",
      dish: "sodexo:pasta",
      guesses: { a: "stmuv:braten" },
    },
  },
  "2026-11-03": {
    a: {
      uid: "a",
      nick: "Sven",
      dish: "stmuv:braten",
      guesses: { b: "sodexo:pasta" },
    },
    b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: {} },
  },
};

const votes = {
  "2026-11-02": {
    0: { uid: "a", nick: "Sven", canteen: "stmuv", at: 1 },
    1: { uid: "b", nick: "Ada", canteen: "egal", egal: true, at: 1 },
  },
};

const calendar = {
  "2026-11-02": { l: 1 },
  "2026-11-03": { l: 1 },
  "2026-11-04": { l: Date.parse("2026-11-04T10:55:00Z") },
  "2026-11-05": { l: Date.parse("2026-11-05T10:55:00Z") },
  "2026-11-06": { l: Date.parse("2026-11-06T10:55:00Z") },
};

describe("lottery copy", () => {
  it("puts the announcer in the popup and under the closed sign", () => {
    const html = readFileSync("site/wer-isst-was.html", "utf8");
    expect(html.split(LOTTERY_ANNOUNCER).length - 1).toBe(2);
    expect(html).toContain('class="closed-sign">Geschlossen');
    expect(html).toContain(LOTTERY_JOIN);
    expect(html).toContain("11:55 (Europe/Berlin)");
    expect(html).toContain('id="lottery-closed"');
    const page = readFileSync("site/eatPage.js", "utf8");
    expect(page).toContain("closedBlock.hidden = !(inRound && closed)");
    expect(page).toContain("LOTTERY_NEEDS_ROUND");
    expect(LOTTERY_NEEDS_ROUND).toBe("Das Spiel gibt es in der Runde.");
    expect(page).not.toContain("pointsForWeek");
    expect(page).not.toContain("syncBadge");
  });
});

describe("points board", () => {
  it("shows nick and points and drops a dish that arrived on the same node", () => {
    const text = pointsBoardText({
      a: { nick: "Sven", points: 2, dish: "stmuv:braten", canteen: "sodexo", guesses: { b: "bella23:lachs" } },
      b: { nick: "Ada", points: 0 },
    });
    expect(text).toBe("Sven 2 · Ada 0");
    expect(text).not.toMatch(/braten|pasta|lachs|stmuv|sodexo|bella23|dish|canteen|guesses/);
  });
});

describe("presence line", () => {
  it("shows who is here and not which canteen they picked", () => {
    const { document } = parseHTML(`<!doctype html><button id="heute-dabei" hidden></button>`);
    const el = document.querySelector<HTMLElement>("#heute-dabei");
    paintHeuteDabei(el, {
      result: { status: "empty" },
      reveal: true,
      online: { ada: true },
      records: {
        0: { uid: "ada", nick: "Ada", canteen: "sodexo" },
        1: { uid: "sven", nick: "Sven", canteen: "stmuv" },
      },
    });
    expect(el?.textContent).toBe("Heute dabei · Ada · Sven");
    expect(el?.querySelectorAll(".live-dot")).toHaveLength(1);
    expect(el?.textContent).not.toMatch(/sodexo|stmuv/);
  });
});

describe("server tally", () => {
  it("folds canteen counts the way foldDay does, without the clock", () => {
    const numbers = canteenNumbers(votes["2026-11-02"]);
    const folded = foldDay(votes["2026-11-02"]);
    expect(numbers).toEqual({
      stmuv: folded.stmuv,
      sodexo: folded.sodexo,
      bella23: folded.bella23,
      wochenmarkt: folded.wochenmarkt,
      egal: folded.egal,
      second: folded.second,
      n: folded.n,
    });
    expect(numbers).not.toHaveProperty("h8");
  });

  it("writes nick and points for closed days and crowns on Saturday", () => {
    const built = buildRoundTally({
      votes,
      eats,
      calendar,
      now: new Date("2026-11-07T12:00:00+01:00"),
    });
    expect(built.points.a).toEqual({ nick: "Sven", points: 2 });
    expect(built.points.b).toEqual({ nick: "Ada", points: 1 });
    expect(Object.keys(built.points.a).sort()).toEqual(["nick", "points"]);
    expect(JSON.stringify(built.points)).not.toMatch(/braten|pasta|stmuv:|sodexo:/);
    expect(built.days["2026-11-02"]).toEqual({
      stmuv: 1,
      sodexo: 0,
      bella23: 0,
      wochenmarkt: 0,
      egal: 1,
      second: 0,
      n: 2,
    });
    expect(built.winner?.names).toEqual({ Sven: true });
    expect(JSON.stringify(built.winner)).not.toMatch(/braten|stmuv|points/);
    expect(publicWinner(built.winner, new Date("2026-11-07T12:00:00+01:00"))).toEqual(["Sven"]);
    expect(publicWinner(built.winner, new Date("2026-11-04T10:00:00+01:00"))).toEqual([]);
  });

  it("does not crown before Saturday, on a tie shares, and skips a zero", () => {
    const midweek = buildRoundTally({
      votes,
      eats,
      calendar,
      now: new Date("2026-11-04T10:00:00+01:00"),
    });
    expect(midweek.winner).toBeNull();
    expect(midweek.points.a.points).toBe(2);

    const tiedEats = {
      "2026-11-02": {
        a: { uid: "a", nick: "Sven", dish: "stmuv:braten", guesses: { b: "sodexo:pasta" } },
        b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: { a: "stmuv:braten" } },
      },
    };
    const tied = buildRoundTally({
      votes,
      eats: tiedEats,
      calendar,
      now: new Date("2026-11-07T12:00:00+01:00"),
    });
    expect(publicWinner(tied.winner, new Date("2026-11-07T12:00:00+01:00")).sort()).toEqual(["Ada", "Sven"]);

    const none = buildRoundTally({
      votes,
      eats: {
        "2026-11-02": {
          a: { uid: "a", nick: "Sven", dish: "stmuv:braten", guesses: { b: "bella23:falsch" } },
          b: { uid: "b", nick: "Ada", dish: "sodexo:pasta", guesses: { a: "bella23:falsch" } },
        },
      },
      calendar,
      now: new Date("2026-11-07T12:00:00+01:00"),
    });
    expect(none.points.a.points).toBe(0);
    expect(none.winner).toBeNull();
  });

  it("strips names and dishes out of a day tally", () => {
    const days = publicDayTallies({
      "2026-11-02": {
        stmuv: 2,
        n: 3,
        nick: "Sven",
        dish: "stmuv:braten",
        h10: 3,
      },
    });
    expect(days["2026-11-02"]).toEqual({
      stmuv: 2,
      sodexo: 0,
      bella23: 0,
      wochenmarkt: 0,
      egal: 0,
      second: 0,
      n: 3,
    });
    expect(JSON.stringify(days)).not.toMatch(/Sven|braten|h10/);
  });
});

describe("shell", () => {
  it("bumps the shell cache with the tally", () => {
    expect(readFileSync("site/version.json", "utf8")).toContain('"build": "60"');
    expect(readFileSync("site/sw.js", "utf8")).toContain("larry-shell-v60");
    expect(readFileSync("site/updateShell.js", "utf8")).toContain('SHELL_BUILD = "60"');
  });
});
