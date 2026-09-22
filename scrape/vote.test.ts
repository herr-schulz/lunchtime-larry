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
  nicksFor,
  staleVoteDays,
  lockLine,
  minutesUntilReveal,
  roundNicks,
  votePhase,
  votesPath,
  winnerOf,
} from "../site/vote.js";

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
    ).toEqual({ stmuv: 1, sodexo: 2, bella23: 0 });
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

describe("votesPath", () => {
  it("nests ballots under the Berlin date", () => {
    expect(votesPath("2026-09-04")).toBe("votes/2026-09-04");
  });

  it("builds the weekday ballot path from berlinDate", () => {
    const thursday = new Date("2026-09-03T12:00:00+02:00");
    expect(ballotDate(thursday)).toBe("2026-09-03");
    expect(votesPath(berlinDate(thursday))).toBe("votes/2026-09-03");
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
