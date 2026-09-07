import { WEEKDAYS, type Dish, type Weekday } from "./types.ts";

const DESSERT = /^dessert$/i;
const THIN_RATIO = 0.4;
const GENERIC_MAIN = /^(suppe|tagessuppe)$/i;

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

function mainNames(dishes: Dish[]): string[] {
  return [
    ...new Set(
      dishes
        .filter((dish) => !isDessert(dish) && !GENERIC_MAIN.test(dish.name))
        .map((dish) => dish.name),
    ),
  ];
}

/** Consecutive weekdays sharing most mains — classic leftover-tab scrape. */
export function mixedWeekdays(
  dishes: Record<Weekday, Dish[]>,
): [Weekday, Weekday] | undefined {
  for (let i = 1; i < WEEKDAYS.length; i++) {
    const prev = mainNames(dishes[WEEKDAYS[i - 1]]);
    const curr = mainNames(dishes[WEEKDAYS[i]]);
    if (prev.length < 2 || curr.length < 2) continue;
    const prevSet = new Set(prev);
    const shared = curr.filter((name) => prevSet.has(name)).length;
    const ratio = shared / Math.min(prev.length, curr.length);
    if (shared >= 2 && ratio >= 0.5) {
      return [WEEKDAYS[i - 1], WEEKDAYS[i]];
    }
  }
  return undefined;
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

  const mixed = mixedWeekdays(dishes);
  if (mixed) {
    return {
      ok: false,
      reason: `Tage vermischt (${mixed[0]} / ${mixed[1]} teilen sich Hauptgerichte)`,
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
