import { describe, expect, it } from "vitest";
import { assessSource, countMains } from "./sanity.ts";
import { WEEKDAYS, type Dish, type Weekday } from "./types.ts";

function days(fill: (day: Weekday) => Dish[]): Record<Weekday, Dish[]> {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, fill(day)])) as Record<
    Weekday,
    Dish[]
  >;
}

const schnitzel = (n: number): Dish[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Schnitzel ${i}`,
    diet: "meat" as const,
    category: "Essen",
  }));

const dessert: Dish = { name: "Creme", diet: "unknown", category: "Dessert" };

describe("assessSource", () => {
  it("accepts a normal week", () => {
    const dishes = days(() => schnitzel(3));
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
    const dishes = days((day) => (day === "friday" ? [] : schnitzel(2)));
    expect(assessSource(dishes)).toEqual({ ok: true });
  });

  it("rejects two empty weekdays", () => {
    const dishes = days((day) =>
      day === "monday" || day === "tuesday" ? [] : schnitzel(2),
    );
    expect(assessSource(dishes)).toMatchObject({ ok: false });
  });

  it("rejects a sudden drop versus last week", () => {
    const previous = days(() => schnitzel(4));
    const current = days(() => schnitzel(1));
    expect(assessSource(current, previous)).toMatchObject({ ok: false });
  });
});
