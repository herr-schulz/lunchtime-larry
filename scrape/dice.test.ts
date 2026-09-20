import { describe, expect, it } from "vitest";
import {
  isMainDish,
  listMainDishes,
  pickMainDish,
  pickSpot,
} from "../site/dice.js";
import { LOCATIONS } from "../site/locations.js";

const schnitzel = { name: "Schnitzel", diet: "meat", category: "Essen" };
const creme = { name: "Bayerisch Creme", diet: "unknown", category: "Dessert" };
const soup = { name: "Suppe", diet: "unknown", category: "Suppe" };

describe("isMainDish", () => {
  it("accepts a normal main", () => {
    expect(isMainDish(schnitzel)).toBe(true);
    expect(isMainDish(soup)).toBe(true);
  });

  it("rejects dessert categories like sanity.ts", () => {
    expect(isMainDish(creme)).toBe(false);
    expect(isMainDish({ name: "Panna Cotta", category: "dessert" })).toBe(false);
  });

  it("rejects dessert-looking names from the parsers", () => {
    expect(
      isMainDish({
        name: "Tages Dessert 1 Täglich aktualisiert",
        category: "Essen",
      }),
    ).toBe(false);
    expect(isMainDish({ name: "Wochendessert", category: "Essen" })).toBe(false);
    expect(
      isMainDish({ name: "Panna Cotta Tages Dessert 1 Täglich aktualisiert" }),
    ).toBe(false);
  });

  it("treats empty or missing dishes as not mains", () => {
    expect(isMainDish(null)).toBe(false);
    expect(isMainDish(undefined)).toBe(false);
    expect(isMainDish({})).toBe(false);
    expect(isMainDish({ name: "" })).toBe(false);
    expect(isMainDish({ name: "   " })).toBe(false);
  });
});

describe("listMainDishes", () => {
  const block = {
    canteens: [
      { id: "sodexo", dishes: [schnitzel, creme] },
      { id: "stmuv", dishes: [soup, { name: "   " }] },
      { id: "bella23", dishes: [{ name: "Grillhähnchen Kartoffelsalat" }] },
    ],
  };

  it("flattens mains with canteen id and skips desserts plus ghosts", () => {
    expect(listMainDishes(block)).toEqual([
      { canteenId: "sodexo", dish: schnitzel },
      { canteenId: "stmuv", dish: soup },
      {
        canteenId: "bella23",
        dish: { name: "Grillhähnchen Kartoffelsalat" },
      },
    ]);
  });

  it("returns an empty list when the block is empty", () => {
    expect(listMainDishes(null)).toEqual([]);
    expect(listMainDishes({})).toEqual([]);
    expect(listMainDishes({ canteens: [{ id: "sodexo", dishes: [creme] }] })).toEqual(
      [],
    );
  });
});

describe("pickMainDish", () => {
  const block = {
    canteens: [
      { id: "sodexo", dishes: [schnitzel, creme] },
      { id: "stmuv", dishes: [soup] },
    ],
  };

  it("picks uniformly among mains with an injected rng", () => {
    expect(pickMainDish(block, () => 0)).toEqual({
      canteenId: "sodexo",
      dish: schnitzel,
    });
    expect(pickMainDish(block, () => 0.99)).toEqual({
      canteenId: "stmuv",
      dish: soup,
    });
  });

  it("returns null when there are no mains", () => {
    expect(pickMainDish({ canteens: [{ id: "sodexo", dishes: [creme] }] })).toBeNull();
    expect(pickMainDish(null)).toBeNull();
  });
});

describe("pickSpot", () => {
  it("picks uniformly from the given array", () => {
    const spots = [{ name: "REWE" }, { name: "Subway" }, { name: "Q & Q" }];
    expect(pickSpot(spots, () => 0)?.name).toBe("REWE");
    expect(pickSpot(spots, () => 0.5)?.name).toBe("Subway");
    expect(pickSpot(spots, () => 0.99)?.name).toBe("Q & Q");
  });

  it("returns null when the list is empty", () => {
    expect(pickSpot([])).toBeNull();
    expect(pickSpot(null)).toBeNull();
    expect(pickSpot(undefined)).toBeNull();
  });

  it("accepts the locations.js LOCATIONS array without dice importing that file", () => {
    const spot = pickSpot(LOCATIONS, () => 0);
    expect(spot?.name).toBe(LOCATIONS[0].name);
    expect(spot).toBe(LOCATIONS[0]);
  });
});
