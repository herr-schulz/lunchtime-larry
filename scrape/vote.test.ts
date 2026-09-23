import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ballotDate,
  berlinDate,
  canAcceptVote,
  countVotes,
  isValidNick,
  lastVoteDate,
  MAX_VOTERS,
  normalizeNick,
  generateRoundCode,
  nicksFor,
  normalizeRoundCode,
  ROUND_ALPHABET,
  staleVoteDays,
  lockLine,
  minutesUntilReveal,
  roundNicks,
  votePhase,
  voteTargetIds,
  votesPath,
  winnerOf,
} from "../site/vote.js";
import { parseHTML } from "linkedom";

describe("berlinDate", () => {
  it("returns an ISO calendar date in Europe/Berlin", () => {
    expect(berlinDate(new Date("2026-09-04T22:30:00Z"))).toBe("2026-09-05");
    expect(berlinDate(new Date("2026-09-04T10:00:00Z"))).toBe("2026-09-04");
  });
});

describe("lastVoteDate", () => {
  it("keeps the Berlin weekday", () => {
    expect(lastVoteDate(new Date("2026-09-04T12:00:00+02:00"))).toBe("2026-09-04");
  });

  it("rewinds the weekend to Friday", () => {
    expect(lastVoteDate(new Date("2026-09-05T12:00:00+02:00"))).toBe("2026-09-04");
    expect(lastVoteDate(new Date("2026-09-06T12:00:00+02:00"))).toBe("2026-09-04");
  });
});

describe("ballotDate", () => {
  it("uses Berlin today on a vote day", () => {
    expect(ballotDate(new Date("2026-09-04T12:00:00+02:00"))).toBe("2026-09-04");
  });

  it("is closed on the weekend", () => {
    expect(ballotDate(new Date("2026-09-05T12:00:00+02:00"))).toBe(null);
    expect(ballotDate(new Date("2026-09-06T12:00:00+02:00"))).toBe(null);
  });
});

describe("countVotes", () => {
  it("ignores unknown canteens and counts the rest", () => {
    expect(
      countVotes({
        a: { canteen: "sodexo" },
        b: { canteen: "sodexo" },
        c: { canteen: "stmuv" },
        d: { canteen: "pizza" },
      }),
    ).toEqual({ stmuv: 1, sodexo: 2, bella23: 0, wochenmarkt: 0 });
  });
});

describe("winnerOf", () => {
  const names = { stmuv: "StMUV", sodexo: "Dave B", bella23: "Bella 23" };

  it("names a unique leader", () => {
    expect(winnerOf({ stmuv: 1, sodexo: 4, bella23: 2 }, names)).toEqual({
      status: "lead",
      id: "sodexo",
      name: "Dave B",
    });
  });

  it("calls a tie when the top score is shared", () => {
    expect(winnerOf({ stmuv: 2, sodexo: 2, bella23: 0 }, names)).toEqual({
      status: "tie",
    });
  });

  it("has an empty state", () => {
    expect(winnerOf({ stmuv: 0, sodexo: 0, bella23: 0 }, names)).toEqual({
      status: "empty",
    });
  });
});

describe("nicksFor", () => {
  it("lists names for one canteen", () => {
    expect(
      nicksFor(
        {
          0: { uid: "a", nick: "Sven", canteen: "stmuv" },
          1: { uid: "b", nick: "Alex", canteen: "sodexo" },
          2: { uid: "c", nick: "Mira", canteen: "stmuv" },
        },
        "stmuv",
      ),
    ).toEqual(["Sven", "Mira"]);
  });
});

describe("normalizeNick", () => {
  it("trims and strips digits", () => {
    expect(normalizeNick("  Sven  ")).toBe("Sven");
    expect(normalizeNick("sven2")).toBe("sven");
  });

  it("caps overall length and long words", () => {
    expect(normalizeNick("x".repeat(40)).length).toBe(12);
    expect(normalizeNick("Wabbelwackelarmigerwindhosekamer")).toBe(
      "Wabbelwackel",
    );
  });
});

describe("isValidNick", () => {
  it("requires a letter and rejects filler-only names", () => {
    expect(isValidNick("Sven")).toBe(true);
    expect(isValidNick("Mary-Jane")).toBe(true);
    expect(isValidNick("---")).toBe(false);
    expect(isValidNick("   ")).toBe(false);
    expect(isValidNick("sven2")).toBe(true);
    expect(isValidNick("")).toBe(false);
  });
});

describe("round slug", () => {
  it("meets AI-Team and ai-team in one slug", () => {
    expect(normalizeRoundCode("AI-Team")).toBe("ai-team");
    expect(normalizeRoundCode("AI Team")).toBe("ai-team");
    expect(normalizeRoundCode("ai-team")).toBe("ai-team");
    expect(normalizeRoundCode("kantine")).toBe("kantine");
    expect(normalizeRoundCode("mittags4")).toBe("mittags4");
  });

  it("rejects a date, a single character, and firebase punctuation", () => {
    expect(normalizeRoundCode("2026-09-22")).toBe("");
    expect(normalizeRoundCode("a")).toBe("");
    expect(normalizeRoundCode("foo.bar")).toBe("foobar");
    expect(normalizeRoundCode("a$b#c")).toBe("abc");
  });

  it("rolls five characters without 0, O, 1, or l", () => {
    expect(ROUND_ALPHABET).not.toMatch(/[01lo]/);
    expect(generateRoundCode(() => 0)).toBe("aaaaa");
    expect(generateRoundCode(() => 0.999)).toHaveLength(5);
    expect(generateRoundCode(() => 0.999)).toMatch(
      new RegExp(`^[${ROUND_ALPHABET}]{5}$`),
    );
  });
});

describe("votesPath", () => {
  it("never falls back to the bare day", () => {
    expect(votesPath("2026-09-04")).toBe("");
    expect(votesPath("2026-09-04", "")).toBe("");
    expect(votesPath("2026-09-22", "2026-09-22")).toBe("");
  });

  it("nests both spellings of a team under the same day", () => {
    const thursday = new Date("2026-09-03T12:00:00+02:00");
    expect(ballotDate(thursday)).toBe("2026-09-03");
    expect(votesPath("2026-09-04", "AI-Team")).toBe("votes/ai-team/2026-09-04");
    expect(votesPath("2026-09-04", "ai-team")).toBe("votes/ai-team/2026-09-04");
    expect(votesPath(berlinDate(thursday), generateRoundCode(() => 0))).toBe(
      "votes/aaaaa/2026-09-03",
    );
  });
});

describe("thursday market", () => {
  it("offers the market only on Thursday", () => {
    expect(voteTargetIds("thursday")).toEqual([
      "stmuv",
      "sodexo",
      "bella23",
      "wochenmarkt",
    ]);
    for (const day of ["monday", "tuesday", "wednesday", "friday"]) {
      expect(voteTargetIds(day)).toEqual(["stmuv", "sodexo", "bella23"]);
    }
  });

  it("can crown the market instead of falling back to a canteen", () => {
    const names = {
      stmuv: "StMUV",
      sodexo: "Dave B",
      bella23: "Bella 23",
      wochenmarkt: "Wochenmarkt",
    };
    expect(
      countVotes({
        a: { canteen: "wochenmarkt" },
        b: { canteen: "wochenmarkt" },
        c: { canteen: "stmuv" },
      }),
    ).toMatchObject({ wochenmarkt: 2, stmuv: 1 });
    expect(
      winnerOf({ stmuv: 1, sodexo: 0, bella23: 0, wochenmarkt: 3 }, names),
    ).toEqual({ status: "lead", id: "wochenmarkt", name: "Wochenmarkt" });
    expect(
      winnerOf({ stmuv: 2, sodexo: 0, bella23: 0, wochenmarkt: 2 }, names),
    ).toEqual({ status: "tie" });
  });

  it("keeps the mark beside the Thursday banner, not inside the link", () => {
    const { document } = parseHTML(readFileSync("site/index.html", "utf8"));
    const mark = document.querySelector("#market-vote");
    expect(mark?.getAttribute("data-vote")).toBe("wochenmarkt");
    expect(mark?.closest("a")).toBeNull();
    expect(mark?.closest("#market-row")).toBeTruthy();
    const rules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules;
    expect(rules.votes.$key.$child.$slot[".validate"]).toMatch(/wochenmarkt/);
    const client = readFileSync("site/voteClient.js", "utf8");
    expect(client).toMatch(/voteTargetIds\(berlinWeekday\(\)\)/);
  });
});

describe("round rules", () => {
  const rules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules;

  it("writes ballots only under a slug, never on a bare date", () => {
    expect(rules.votes[".read"]).toBeUndefined();
    const key = rules.votes.$key;
    expect(key.$child.$slot[".write"]).toMatch(/a-z0-9-/);
    expect(key.$child.$slot[".write"]).toMatch(/!\$key\.matches/);
    expect(key.$child.$slot[".write"]).toMatch(/\[0-5\]/);
    expect(key.$child.$slot[".write"]).toMatch(/auth\.uid/);
    expect(key.$child[".write"]).not.toMatch(/\$key == root\.child\('meta\/voteDay'\)/);
    expect(key[".write"]).toMatch(/!newData\.exists\(\)/);
    expect(key.$child[".write"]).toMatch(/\$child < root\.child\('meta\/voteDay'\)/);
  });
});

describe("staleVoteDays", () => {
  it("keeps only the active day and drops older ISO keys", () => {
    expect(
      staleVoteDays(["2026-09-05", "2026-09-04", "2026-09-01", "meta"], "2026-09-05"),
    ).toEqual(["2026-09-04", "2026-09-01"]);
  });

  it("does not keep Friday as the weekend purge day", () => {
    const sunday = new Date("2026-09-06T12:00:00+02:00");
    expect(lastVoteDate(sunday)).toBe("2026-09-04");
    expect(berlinDate(sunday)).toBe("2026-09-06");
  });

  it("treats Friday as stale when keep-day is Sunday", () => {
    const sunday = "2026-09-06";
    expect(berlinDate(new Date("2026-09-06T12:00:00+02:00"))).toBe(sunday);
    expect(staleVoteDays(["2026-09-06", "2026-09-04", "2026-09-01"], sunday)).toEqual([
      "2026-09-04",
      "2026-09-01",
    ]);
  });
});

describe("canAcceptVote", () => {
  const six = Object.fromEntries(
    Array.from({ length: MAX_VOTERS }, (_, i) => [
      String(i),
      { uid: `uid${i}`, nick: `n${i}`, canteen: "sodexo", at: 1 },
    ]),
  );

  it("lets an existing voter change or withdraw", () => {
    expect(canAcceptVote(six, "uid0")).toBe(true);
  });

  it("blocks a seventh person", () => {
    expect(canAcceptVote(six, "uid99")).toBe(false);
    expect(canAcceptVote(six, null)).toBe(false);
  });

  it("accepts a new ballot while seats remain", () => {
    const five = Object.fromEntries(Object.entries(six).slice(0, 5));
    expect(canAcceptVote(five, "uid99")).toBe(true);
  });
});

describe("votePhase", () => {
  const at = (clock: string) => new Date(`2026-09-22T${clock}:00+02:00`);

  it("stays open until 11:55, locks, then reveals at noon", () => {
    expect(votePhase(at("11:54"))).toBe("open");
    expect(votePhase(at("11:55"))).toBe("locked");
    expect(votePhase(at("11:59"))).toBe("locked");
    expect(votePhase(at("12:00"))).toBe("reveal");
  });

  it("closes on the weekend", () => {
    expect(votePhase(new Date("2026-09-26T11:00:00+02:00"))).toBe("closed");
  });

  it("counts down to noon in whole minutes", () => {
    expect(minutesUntilReveal(at("11:56"))).toBe(4);
    expect(lockLine(4)).toBe("Noch 4 Minuten.");
    expect(lockLine(1)).toBe("Noch eine Minute.");
  });
});

describe("roundNicks", () => {
  it("lists nicknames without their canteen", () => {
    expect(
      roundNicks({
        0: { nick: "Sven", canteen: "stmuv" },
        1: { nick: "Alex", canteen: "sodexo" },
        2: { nick: "Sven", canteen: "bella23" },
      }),
    ).toEqual(["Sven", "Alex"]);
  });
});
