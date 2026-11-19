import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { berlinDate } from "../site/vote.js";
import {
  TOSS_LINES,
  applyTrashDrop,
  dragRelease,
  droppedInTrash,
  larryIsAway,
  nextBerlinMidnight,
  presentLarry,
  tossLine,
} from "../site/larryToss.js";

function memory() {
  const bag = new Map<string, string>();
  return {
    getItem: (key: string) => (bag.has(key) ? bag.get(key)! : null),
    setItem: (key: string, value: string) => {
      bag.set(key, value);
    },
  };
}

function corner() {
  const { document } = parseHTML(`<div id="larry-corner"></div><p id="larry-bye" hidden></p>`);
  const root = document.querySelector("#larry-corner") as HTMLElement | null;
  const bye = document.querySelector("#larry-bye") as HTMLElement | null;
  if (!root || !bye) throw new Error("dom");
  root.hidden = false;
  return { root, bye };
}

describe("Larry trash drop", () => {
  it("hides him, records a throw, and keeps him gone across a reload until the next Berlin day", () => {
    const storage = memory();
    const now = new Date("2026-11-19T15:04:00+01:00");
    let throws = 0;
    const { root, bye } = corner();

    const drop = applyTrashDrop({
      root,
      bye,
      byeLine: bye,
      storage,
      now,
      random: () => 0,
      record: () => {
        throws += 1;
      },
    });

    expect(TOSS_LINES).toEqual(["bin schon weg", "ab jetzt halt ich den rand"]);
    expect(drop.line).toBe("bin schon weg");
    expect(bye.textContent).toBe("bin schon weg");
    expect(bye.hidden).toBe(false);
    expect(root.hidden).toBe(true);
    expect(throws).toBe(1);
    expect(berlinDate(new Date(drop.until))).toBe("2026-11-20");
    expect(berlinDate(new Date(drop.until - 1500))).toBe("2026-11-19");

    const reloaded = corner();
    expect(presentLarry(reloaded.root, storage, now.getTime() + 60_000)).toBe(false);
    expect(reloaded.root.hidden).toBe(true);
    expect(larryIsAway(storage, Date.parse("2026-11-19T23:30:00+01:00"))).toBe(true);

    const morning = Date.parse("2026-11-20T08:15:00+01:00");
    const back = corner();
    expect(presentLarry(back.root, storage, morning)).toBe(true);
    expect(back.root.hidden).toBe(false);
    expect(larryIsAway(storage, morning)).toBe(false);
  });

  it("picks the other line and only tosses a face dropped on the bin", () => {
    expect(tossLine(() => 0.99)).toBe("ab jetzt halt ich den rand");
    const trash = { left: 140, right: 260, top: 640, bottom: 760 };
    const face = { left: 170, top: 660, width: 64, height: 64 };
    expect(droppedInTrash(face, trash)).toBe(true);
    expect(dragRelease({ fromFace: true, dragged: true, face, trash })).toBe("toss");
    expect(dragRelease({ fromFace: false, dragged: true, face, trash })).toBe("dock");
    expect(dragRelease({ fromFace: true, dragged: true, face: { left: 8, top: 8, width: 40, height: 40 }, trash })).toBe(
      "dock",
    );
    expect(dragRelease({ fromFace: true, dragged: false, face, trash })).toBe("snap");
    expect(dragRelease({ fromFace: true, dragged: true, cancelled: true, face, trash })).toBe("snap");

    const cornerSrc = readFileSync("site/larryCorner.js", "utf8");
    expect(cornerSrc).toContain("dragRelease");
    expect(cornerSrc).toContain("applyTrashDrop");
    expect(cornerSrc).toContain("presentLarry");
    expect(cornerSrc).toContain("incrementTosses");
  });

  it("uses the Berlin midnight after a summer evening and a short spring day", () => {
    const summer = nextBerlinMidnight(new Date("2026-07-15T22:10:00+02:00"));
    expect(berlinDate(new Date(summer))).toBe("2026-07-16");
    expect(berlinDate(new Date(summer - 1500))).toBe("2026-07-15");

    const spring = nextBerlinMidnight(new Date("2026-03-29T01:30:00+01:00"));
    expect(berlinDate(new Date(spring))).toBe("2026-03-30");
    expect(berlinDate(new Date(spring - 1500))).toBe("2026-03-29");
  });
});

describe("toss counter rules", () => {
  const rules = JSON.parse(readFileSync("database.rules.json", "utf8")).rules as {
    vault: { ".read": boolean; ".write": boolean };
    votes: { $key: { $child: { ".read": string; ".write": string } } };
    tosses: { n: { ".read": boolean; ".write": string }; $other: { ".read": boolean; ".write": boolean } };
  };

  it("increments a public count and leaves the vault and the ballots closed", () => {
    expect(rules.vault[".read"]).toBe(false);
    expect(rules.vault[".write"]).toBe(false);
    expect(rules.votes.$key.$child[".read"]).toMatch(/auth != null/);
    expect(rules.votes.$key.$child[".write"]).toMatch(/auth != null/);
    expect(rules.votes.$key.$child[".read"]).not.toBe(true);
    expect(rules.tosses.n[".read"]).toBe(true);
    expect(rules.tosses.n[".write"]).toMatch(/auth != null/);
    expect(rules.tosses.n[".write"]).toMatch(/newData\.val\(\) == data\.val\(\) \+ 1/);
    expect(rules.tosses.n[".write"]).toMatch(/!data\.exists\(\) && newData\.val\(\) == 1/);
    expect(rules.tosses.$other[".read"]).toBe(false);
    expect(rules.tosses.$other[".write"]).toBe(false);
    const page = readFileSync("site/strichliste.js", "utf8");
    expect(page).toContain("readTosses");
    expect(page).toContain("Im Eimer");
    expect(page).not.toContain("votes/");
  });
});
