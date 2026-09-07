import { describe, expect, it } from "vitest";
import { assessSource, countMains } from "./sanity.ts";
import { WEEKDAYS, type Dish, type Weekday } from "./types.ts";

function days(fill: (day: Weekday) => Dish[]): Record<Weekday, Dish[]> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, fill(day)])) as Record<
    Weekday,
    Dish[]
  >;
}

const schnitzel = (n: number, tag = ""): Dish[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Schnitzel ${tag}${i}`,
    diet: "meat" as const,
    category: "Essen",
  }));

const dessert: Dish = { name: "Creme", diet: "unknown", category: "Dessert" };

describe("assessSource", () => {
  it("accepts a normal week", () => {
    const dishes = days((day) => schnitzel(3, `${day}-`));
    expect(assessSource(dishes)).toEqual({ ok: true });
    expect(countMains(dishes)).toBe(15);
  });

  it("rejects dessert-only results", () => {
    const dishes = days(() => [dessert]);
    expect(assessSource(dishes)).toMatchObject({ ok: false });
  });

  it("rejects an empty week", () => {
    const dishes = days(() => []);
    expect(assessSource(dishes)).toMatchObject({ ok: false });
  });

  it("allows a single empty weekday (holiday)", () => {
    const dishes = days((day) => (day === "friday" ? [] : schnitzel(2, `${day}-`)));
    expect(assessSource(dishes)).toEqual({ ok: true });
  });

  it("rejects two empty weekdays", () => {
    const dishes = days((day) =>
      day === "monday" || day === "tuesday" ? [] : schnitzel(2, `${day}-`),
    );
    expect(assessSource(dishes)).toMatchObject({ ok: false });
  });

  it("rejects a sudden drop versus last week", () => {
    const previous = days(() => schnitzel(4));
    const current = days(() => schnitzel(1));
    expect(assessSource(current, previous)).toMatchObject({ ok: false });
  });

  it("rejects leftover-tab mixes like the Dave B scrape", () => {
    const dish = (name: string): Dish => ({
      name,
      diet: "meat",
      category: "OMG",
    });
    const dishes = days((day) => {
      if (day === "monday") {
        return [
          dish("Suppe"),
          dish("Griechisches Hähnchengyros"),
          dish("Indisches Kartoffelcurry"),
          dish("Pasta | Tomatensauce-Mozzarella"),
        ];
      }
      if (day === "tuesday") {
        return [
          dish("Pasta | Tomatensauce-Mozzarella"),
          dish("Suppe"),
          dish("Griechisches Hähnchengyros"),
          dish("Indisches Kartoffelcurry"),
        ];
      }
      return schnitzel(2, `${day}-`);
    });
    expect(assessSource(dishes)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/vermischt/),
    });
  });

  it("allows consecutive days that only share a generic soup", () => {
    const dishes = days((day) => {
      if (day === "monday") {
        return [
          { name: "Suppe", diet: "unknown", category: "Suppe" },
          { name: "Gyros", diet: "meat", category: "OMG" },
          { name: "Kartoffelcurry", diet: "veggie", category: "InGreen" },
        ];
      }
      if (day === "tuesday") {
        return [
          { name: "Suppe", diet: "unknown", category: "Suppe" },
          { name: "Hähnchencurry", diet: "meat", category: "OMG" },
          { name: "Polenta", diet: "veggie", category: "InGreen" },
        ];
      }
      return schnitzel(2, `${day}-`);
    });
    expect(assessSource(dishes)).toEqual({ ok: true });
  });
});
