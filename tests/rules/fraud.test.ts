import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { dayBounds, nextIso } from "../../scripts/vote-calendar.mjs";
import { berlinDate } from "../../site/vote.js";

/** Fixed 64-hex round key for tests (not derived — rules only check the shape). */
const CODE = "a".repeat(64);
const ALICE = "alice000000000000000000000AA";
const BOB = "bob00000000000000000000000BB";
const MALLORY = "mallory0000000000000000000MM";

const today = berlinDate(new Date());
const tomorrow = nextIso(today);
const yesterday = (() => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
})();

let env: RulesTestEnvironment;

function db(uid?: string, claims?: Record<string, unknown>) {
  if (!uid) return env.unauthenticatedContext().database();
  return env.authenticatedContext(uid, claims).database();
}

function ballot(uid: string, nick: string, canteen = "stmuv") {
  return { uid, nick, canteen, at: Date.now() };
}

function hist(nick: string, canteen = "stmuv", second?: string) {
  return { nick, canteen, ...(second ? { second } : {}) };
}

function claim(uid: string, slot: number, nick: string, day = today, canteen = "stmuv") {
  return {
    [`votes/${CODE}/${day}/${slot}`]: ballot(uid, nick, canteen),
    [`seats/${CODE}/${day}/${uid}`]: String(slot),
    [`present/${CODE}/${day}/${uid}`]: nick,
    [`history/${CODE}/${day}/${uid}`]: hist(nick, canteen),
    [`rounds/${CODE}/names/${nick.toLowerCase()}`]: uid,
  };
}

function sheet(uid: string, nick: string, dish = "stmuv:braten", guesses?: Record<string, string>) {
  return { uid, nick, dish, at: Date.now(), ...(guesses ? { guesses } : {}) };
}

function eatsPath(uid: string, day = today) {
  return `eats/${CODE}/${day}/${uid}`;
}

/** Force calendar lock into the future so writes stay open during the test. */
function openDay(iso: string) {
  const bounds = dayBounds(iso);
  return { ...bounds, l: Date.now() + 3_600_000, w: true };
}

/** Force calendar lock into the past so reads open and writes close. */
function lockedDay(iso: string) {
  const bounds = dayBounds(iso);
  return { ...bounds, l: Date.now() - 60_000, w: true };
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-larry",
    database: { rules: readFileSync("database.rules.json", "utf8"), host: "127.0.0.1", port: 9000 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().update({
      [`calendar/${yesterday}`]: lockedDay(yesterday),
      [`calendar/${today}`]: openDay(today),
      [`calendar/${tomorrow}`]: dayBounds(tomorrow),
      "calendar/2099-01-01": dayBounds("2099-01-01"),
      "meta/voteDay": today,
      "vault/1": "flag-one-token",
      "vault/2": "flag-two-token",
      "vault/3": "flag-three-tok",
      "vault/4": "flag-four-token",
      "config/features": { scoreSource: "scores", vetoOverride: false, rev: "rev-token", epoch: "2026-02-30" },
      ...claim(ALICE, 0, "Alice"),
      ...claim(BOB, 1, "Bob"),
      [`votes/${CODE}/${yesterday}/0`]: ballot(BOB, "Bob"),
      [`seats/${CODE}/${yesterday}/${BOB}`]: "0",
      [`present/${CODE}/${yesterday}/${BOB}`]: "Bob",
      [`history/${CODE}/${yesterday}/${BOB}`]: hist("Bob"),
      [`rounds/${CODE}/names/bob`]: BOB,
      [eatsPath(BOB, yesterday)]: sheet(BOB, "Bob"),
      [eatsPath(BOB)]: sheet(BOB, "Bob", "sodexo:pasta", { [ALICE]: "stmuv:braten" }),
    });
  });
});

describe("meta/voteDay follows the server clock", () => {
  it("advances to today from yesterday", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref("meta/voteDay").set(yesterday));
    await assertSucceeds(db(MALLORY).ref("meta/voteDay").set(today));
  });

  it("refuses tomorrow and anonymous visitors", async () => {
    await assertFails(db(MALLORY).ref("meta/voteDay").set(tomorrow));
    await assertFails(db().ref("meta/voteDay").set(today));
  });
});

describe("votes: one seat, present, history, reserved nick", () => {
  it("takes a free slot with seat, present and history", async () => {
    await assertSucceeds(
      db(MALLORY).ref().update({
        [`rounds/${CODE}/names/mallory`]: MALLORY,
        ...claim(MALLORY, 2, "Mallory"),
      }),
    );
  });

  it("refuses a ballot without present/history/seat", async () => {
    await assertSucceeds(db(MALLORY).ref(`rounds/${CODE}/names/mallory`).set(MALLORY));
    await assertFails(db(MALLORY).ref(`votes/${CODE}/${today}/2`).set(ballot(MALLORY, "Mallory")));
  });

  it("refuses someone else's nick reservation", async () => {
    await assertFails(db(MALLORY).ref(`rounds/${CODE}/names/alice`).set(MALLORY));
    await assertFails(
      db(MALLORY).ref().update({
        [`rounds/${CODE}/names/alice`]: MALLORY,
        ...claim(MALLORY, 2, "Alice"),
      }),
    );
  });

  it("refuses a second slot for the same uid", async () => {
    await assertSucceeds(
      db(MALLORY).ref().update({
        [`rounds/${CODE}/names/mallory`]: MALLORY,
        ...claim(MALLORY, 2, "Mallory"),
      }),
    );
    await assertFails(
      db(MALLORY).ref().update({
        ...claim(MALLORY, 3, "Mallory"),
      }),
    );
  });
});

describe("peek until lock, then reveal", () => {
  it("hides foreign ballots and eats before lock", async () => {
    await assertFails(db(MALLORY).ref(`votes/${CODE}/${today}`).get());
    await assertFails(db(MALLORY).ref(`eats/${CODE}/${today}`).get());
    await assertSucceeds(db(ALICE).ref(`votes/${CODE}/${today}/0`).get());
    await assertSucceeds(db(ALICE).ref(`present/${CODE}/${today}`).get());
  });

  it("reveals everything after lock and freezes writes", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref(`calendar/${today}`).set(lockedDay(today)),
    );
    await assertSucceeds(db(MALLORY).ref(`votes/${CODE}/${today}`).get());
    await assertSucceeds(db(MALLORY).ref(`eats/${CODE}/${today}`).get());
    await assertFails(
      db(MALLORY).ref().update({
        [`rounds/${CODE}/names/mallory`]: MALLORY,
        ...claim(MALLORY, 2, "Mallory"),
      }),
    );
    await assertFails(db(BOB).ref(eatsPath(BOB)).set(sheet(BOB, "Bob", "stmuv:other")));
  });
});

describe("eats need a ballot and refuse foreign writes", () => {
  it("lets a seated voter write their own sheet", async () => {
    await assertSucceeds(db(ALICE).ref(eatsPath(ALICE)).set(sheet(ALICE, "Alice")));
  });

  it("refuses a sheet without a seat and foreign dishes", async () => {
    await assertSucceeds(db(MALLORY).ref(`rounds/${CODE}/names/mallory`).set(MALLORY));
    await assertFails(db(MALLORY).ref(eatsPath(MALLORY)).set(sheet(MALLORY, "Mallory")));
    await assertFails(db(MALLORY).ref(eatsPath(ALICE)).set(sheet(ALICE, "Alice")));
  });

  it("throttles rapid rewrites", async () => {
    await assertSucceeds(db(ALICE).ref(eatsPath(ALICE)).set(sheet(ALICE, "Alice")));
    await assertFails(db(ALICE).ref(eatsPath(ALICE)).set(sheet(ALICE, "Alice", "sodexo:pasta")));
  });
});

describe("directory, tallies, decoys, vault", () => {
  it("keeps directory desk-only", async () => {
    await assertFails(db(ALICE).ref("tallies/directory").get());
    await assertSucceeds(db(ALICE, { desk: true }).ref("tallies/directory").get());
  });

  it("rejects writes to legacy tallies", async () => {
    await assertFails(db(ALICE).ref(`tallies/rounds/${CODE}/days/${yesterday}`).set({ n: 1 }));
    await assertFails(db(ALICE).ref(`tallies/rounds/${CODE}/nicks/Alice`).set({ stmuv: 1 }));
  });

  it("allows own scores and veto once", async () => {
    await assertSucceeds(
      db(ALICE).ref(`scores/${CODE}/${ALICE}`).set({ points: 3, week: today }),
    );
    await assertFails(db(ALICE).ref(`scores/${CODE}/${BOB}`).set({ points: 9, week: today }));
    await assertSucceeds(
      db(ALICE).ref(`ops/veto/${CODE}/${ALICE}`).set({ at: Date.now(), reason: "test" }),
    );
    await assertFails(
      db(ALICE).ref(`ops/veto/${CODE}/${ALICE}`).set({ at: Date.now(), reason: "again" }),
    );
  });

  it("keeps vault secret and accepts only real flags", async () => {
    await assertFails(db(ALICE).ref("vault").get());
    await assertFails(db(ALICE).ref("vault/1").get());
    await assertFails(db(ALICE).ref(`hunt/${ALICE}/1`).set("wrong-flag"));
    await assertSucceeds(db(ALICE).ref(`hunt/${ALICE}/1`).set("flag-one-token"));
    await assertSucceeds(db(BOB).ref("hunt").get());
  });

  it("lets a user read and delete only their own move ticket", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.database().ref(`moves/${ALICE}`).set({ code: "abcdefghij" }),
    );
    await assertSucceeds(db(ALICE).ref(`moves/${ALICE}`).get());
    await assertFails(db(BOB).ref(`moves/${ALICE}`).get());
    await assertFails(db(ALICE).ref(`moves/${ALICE}`).set({ code: "hijackedxx" }));
    await assertSucceeds(db(ALICE).ref(`moves/${ALICE}`).remove());
  });
});

describe("auth required to read", () => {
  it("blocks anonymous reads of votes, eats and present", async () => {
    await assertFails(db().ref(`present/${CODE}/${today}`).get());
    await assertFails(db().ref(`votes/${CODE}/${today}/0`).get());
    await assertFails(db().ref(eatsPath(BOB)).get());
  });
});
