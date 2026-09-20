export const DAYS: Record<string, string>;
export const DAY_KEYS: string[];

export function weekStartBerlin(date?: Date): string;
export function addDays(isoDate: string, days: number): string;
export function berlinDayOf(iso?: string | null): string | null;
export function isMenuWeekFresh(scrapedAt?: string | null, now?: Date): boolean;
export function isoWeek(isoDate: string): number;
export function formatDate(iso: string): string;
export function formatStamp(iso?: string | null): string;
export function todayKey(): string;
export function berlinHour(): number;
export function watchBerlinMidnight(onRoll: () => void): void;
