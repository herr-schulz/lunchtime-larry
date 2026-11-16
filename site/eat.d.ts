export type EatSheet = {
  uid: string;
  nick: string;
  dish: string;
  at?: number;
  guesses?: Record<string, string>;
};
export type PointsRow = { uid: string; nick: string; points: number };
export type PastWeek = { monday: string; friday: string; rows: PointsRow[]; leaders: string[] };

export function slugDish(name: string): string;
export function plateId(canteenId: string, name: string): string;
export function isPlateId(value: unknown): boolean;
export function gameMains(
  block: unknown,
): Array<{ id: string; canteenId: string; dish: { name: string; [key: string]: unknown } }>;
export function playableMembers(records: unknown, myUid?: string): Array<{ uid: string; nick: string }>;
export function weekSheetDays(now?: Date): string[];
export function pointsForDay(day: Record<string, EatSheet> | null | undefined): PointsRow[];
export function pointsForWeek(
  daysByDate: Record<string, Record<string, EatSheet>> | null | undefined,
  dates: string[],
): PointsRow[];
export function weekLine(rows: PointsRow[]): string;
export function weekLeaders(rows: PointsRow[]): string[];
export function pastWeeks(
  daysByDate: Record<string, Record<string, EatSheet>> | null | undefined,
  now?: Date,
  limit?: number,
): PastWeek[];
