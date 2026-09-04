import { describe, expect, it } from "vitest";
import {
  berlinDate,
  berlinWeekday,
  canAcceptVote,
  countVotes,
  isVoteDay,
  lastVoteDate,
  MAX_VOTERS,
  normalizeNick,
  nicksFor,
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

describe("votesPath", () => {
  it("nests ballots under the Berlin date", () => {
    expect(votesPath("2026-09-04")).toBe("votes/2026-09-04");
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
