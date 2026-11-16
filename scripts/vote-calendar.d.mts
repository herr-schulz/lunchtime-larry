export type DayBounds = { s: number; e: number; l: number; w: boolean };
export function berlinMidnight(iso: string): number;
export function berlinWallTime(iso: string, hour: number, minute?: number): number;
export function nextIso(iso: string): string;
export function isWeekday(iso: string): boolean;
export function dayBounds(iso: string): DayBounds;
export function voteCalendar(fromYear: number, toYear: number): Record<string, DayBounds>;
