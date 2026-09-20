export type DiceDish = {
  name?: string;
  category?: string;
  [key: string]: unknown;
};

export type DiceCanteen = {
  id?: string;
  dishes?: DiceDish[] | null;
};

export type DayBlock = {
  canteens?: DiceCanteen[] | null;
} | null | undefined;

export type PickedMain = {
  canteenId: string | undefined;
  dish: DiceDish;
};

export function isMainDish(dish: unknown): boolean;

export function listMainDishes(block: DayBlock): PickedMain[];

export function pickMainDish(block: DayBlock, rng?: () => number): PickedMain | null;

export function pickSpot<T>(
  locations: readonly T[] | null | undefined,
  rng?: () => number,
): T | null;
