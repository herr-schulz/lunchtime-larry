import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { listMainDishes, pickMainDish, pickSpot } from "../site/dice.js";
import {
  OVERSHOOT_PX,
  REEL_COPIES,
  SPIN_EASE,
  berlinWeekMonday,
  canteenEntries,
  dishEntries,
  isStaleMenuWeek,
  planSpin,
  reelMarkup,
  reelTranslateY,
  shakeDelta,
  spotEntries,
} from "../site/diceReel.js";
import { phraseDish } from "../site/likes.js";

const canteens = {
  sodexo: { name: "Dave B" },
  stmuv: { name: "StMUV" },
  bella23: { name: "Bella 23" },
};

const schnitzel = { name: "Schnitzel mit Pommes", category: "Essen" };
const creme = { name: "Bayerisch Creme", category: "Dessert" };
const soup = { name: "Linsensuppe", category: "Suppe" };
const bella = { name: "Grillhähnchen Kartoffelsalat" };

const block = {
  canteens: [
    { id: "sodexo", dishes: [schnitzel, creme, { name: "Currywurst", category: "Essen" }] },
    { id: "stmuv", dishes: [creme] },
    { id: "bella23", dishes: [bella] },
  ],
};

describe("reel entries", () => {
  it("phrases mains and leaves desserts out", () => {
    const entries = dishEntries(block, canteens);
    expect(entries.map((entry) => entry.label)).toEqual([
      phraseDish(schnitzel.name, { canteen: "sodexo" }).title,
      phraseDish("Currywurst", { canteen: "sodexo" }).title,
      phraseDish(bella.name, { canteen: "bella23" }).title,
    ]);
    expect(entries.map((entry) => entry.hint)).toEqual(["Dave B", "Dave B", "Bella 23"]);
    expect(entries.some((entry) => /dessert|creme/i.test(entry.label))).toBe(false);
  });

  it("spins only canteens that have a main today", () => {
    expect(canteenEntries(block, canteens).map((entry) => entry.label)).toEqual([
      "Dave B",
      "Bella 23",
    ]);
    expect(canteenEntries({ canteens: [{ id: "stmuv", dishes: [creme] }] }, canteens)).toEqual(
      [],
    );
  });

  it("builds one repeated strip, three copies", () => {
    const html = reelMarkup(spotEntries([{ name: "Subway", vibe: "Sandwich" }]), REEL_COPIES);
    const { document } = parseHTML(`<div>${html}</div>`);
    expect(document.querySelectorAll(".reel-row")).toHaveLength(3);
    expect(document.querySelector(".reel-label")?.textContent).toBe("Subway");
  });
});

describe("planSpin", () => {
  it("lands the prechosen index in the center, with a 2px overshoot", () => {
    const length = listMainDishes(block).length;
    const picked = pickMainDish(block, () => 0.99);
    const index = listMainDishes(block).findIndex(
      (item) => item.canteenId === picked?.canteenId && item.dish === picked?.dish,
    );
    const plan = planSpin({ length, index, rowHeight: 40, reduced: false });
    expect(plan.index).toBe(index);
    expect(plan.endY).toBe(reelTranslateY({ length, index, rowHeight: 40 }));
    expect(plan.overshootY).toBe(plan.endY - OVERSHOOT_PX);
    expect(plan.startY).not.toBe(plan.endY);
    expect(plan.easing).toMatch(/^cubic-bezier\(/);
    expect(plan.easing).not.toContain("steps");
    expect(plan.spinMs).toBeGreaterThan(0);
  });

  it("skips travel when motion is reduced", () => {
    const plan = planSpin({ length: 4, index: 2, rowHeight: 40, reduced: true });
    expect(plan.startY).toBe(plan.endY);
    expect(plan.overshootY).toBe(plan.endY);
    expect(plan.spinMs).toBe(0);
  });

  it("picks the spot with the engine before the offset is computed", () => {
    const spots = spotEntries([
      { name: "REWE" },
      { name: "Subway" },
      { name: "Q & Q" },
    ]);
    const picked = pickSpot(spots, () => 0);
    const index = spots.indexOf(picked!);
    const plan = planSpin({ length: spots.length, index, rowHeight: 48, reduced: false });
    expect(plan.index).toBe(0);
    expect(plan.endY).toBe(-((REEL_COPIES - 1) * spots.length - 1) * 48);
  });
});

describe("shake and stale week", () => {
  it("treats a sharp jolt as a shake and ignores the first sample", () => {
    const armed = shakeDelta(null, { x: 0, y: 9.8, z: 0 });
    expect(armed.hit).toBe(false);
    expect(shakeDelta(armed.next, { x: 0, y: 28, z: 0 }).hit).toBe(true);
    expect(shakeDelta(armed.next, { x: 0, y: 11, z: 0 }).hit).toBe(false);
    expect(shakeDelta(armed.next, null).hit).toBe(false);
  });

  it("flags an older Berlin week and keeps the current one", () => {
    expect(berlinWeekMonday(new Date("2026-09-22T12:00:00+02:00"))).toBe("2026-09-21");
    expect(isStaleMenuWeek("2026-09-14", "2026-09-21")).toBe(true);
    expect(isStaleMenuWeek("2026-09-21", "2026-09-21")).toBe(false);
  });
});

describe("dice markup", () => {
  it("puts the board CTA under Was anderes and opens one reel dialog", () => {
    const { document } = parseHTML(readFileSync("site/index.html", "utf8"));
    const wrap = document.querySelector("#escape-wrap");
    const kids = [...(wrap?.children ?? [])].map((node) => node.id);
    expect(kids).toEqual(["escape-link", "dice-open"]);
    const open = document.querySelector("#dice-open");
    expect(open?.textContent).toMatch(/Unentschlossen\?/);
    expect(open?.textContent).toMatch(/Lass Larry entscheiden/);
    expect(open?.textContent).toMatch(/Ein Hauptgericht\. Kein Drama\./);
    const dialog = document.querySelector("#dice-dialog");
    expect(dialog?.querySelectorAll(".reel-strip")).toHaveLength(1);
    expect(dialog?.querySelector("[data-dice-mode='dish']")).toBeTruthy();
    expect(dialog?.querySelector("[data-dice-mode='canteen']")).toBeTruthy();
    expect(dialog?.querySelector(".dice-larry")?.getAttribute("src")).toMatch(/laughing-larry\.svg/);
    expect(dialog?.innerHTML).not.toMatch(/casino-larry/);
  });

  it("replaces the alternatives lede and keeps a spot reel", () => {
    const { document } = parseHTML(readFileSync("site/alternativen.html", "utf8"));
    expect(document.querySelector(".lede")?.textContent?.trim()).toBe(
      "Feste Alternativen um die Ecke, täglich erreichbar.",
    );
    expect(document.querySelector("#dice-dialog .reel-strip")).toBeTruthy();
    expect(document.querySelector("[data-dice-mode]")).toBeNull();
  });
});
