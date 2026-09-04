import { WEEKDAYS, type Dish, type Weekday } from "./types.ts";

const DESSERT = /^dessert$/i;
const THIN_RATIO = 0.4;

export function isDessert(dish: Dish): boolean {
  return DESSERT.test(dish.category ?? "");
}

export function countMains(dishes: Record<Weekday, Dish[]>): number {
  return WEEKDAYS.reduce(
    (n, day) => n + dishes[day].filter((dish) => !isDessert(dish)).length,
    0,
  );
}

export function emptyWeekdays(dishes: Record<Weekday, Dish[]>): Weekday[] {
  return WEEKDAYS.filter((day) => dishes[day].length === 0);
}

export function assessSource(
  dishes: Record<Weekday, Dish[]>,
  previous?: Record<Weekday, Dish[]>,
): { ok: true } | { ok: false; reason: string } {
  const mains = countMains(dishes);
  if (mains === 0) {
    return { ok: false, reason: "keine Hauptgerichte (leer oder nur Desserts)" };
  }

  const empty = emptyWeekdays(dishes);
  if (empty.length >= 2) {
    return {
      ok: false,
      reason: `${empty.length} Werktage ohne Gerichte (${empty.join(", ")})`,
    };
  }

  if (previous) {
    const prevMains = countMains(previous);
    if (prevMains >= 5 && mains < prevMains * THIN_RATIO) {
      return {
        ok: false,
        reason: `zu wenig Gerichte (${mains} vs. ${prevMains} in der Vorwoche)`,
      };
    }
  }

  return { ok: true };
}
