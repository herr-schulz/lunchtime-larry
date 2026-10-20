import type { VoteRecords } from "./vote.d.ts";

export const TALLY_FIELDS: readonly ["stmuv", "sodexo", "bella23", "wochenmarkt", "egal", "second", "n"];
export const NICK_FIELDS: readonly ["stmuv", "sodexo", "bella23", "wochenmarkt", "egal"];
export const BAR_FIELDS: readonly ["stmuv", "sodexo", "bella23", "wochenmarkt"];
export const TALLY_NAMES: Record<string, string>;

export type Tally = {
  stmuv: number;
  sodexo: number;
  bella23: number;
  wochenmarkt: number;
  egal: number;
  second: number;
  n: number;
  [hour: string]: number;
};

export type NickCounts = {
  stmuv: number;
  sodexo: number;
  bella23: number;
  wochenmarkt: number;
  egal: number;
  days?: Record<string, boolean>;
};

export type TallyRow = { key: string; label: string; tally: Tally | null };

export function emptyTally(): Tally;
export function emptyNick(): Omit<NickCounts, "days">;
export function foldDay(records: VoteRecords | null | undefined): Tally;
export function foldNicks(records: VoteRecords | null | undefined): Record<string, Omit<NickCounts, "days">>;
export function mergeNickTotals(
  current: Record<string, unknown> | null | undefined,
  delta: Record<string, number>,
  day: string,
): NickCounts;
export function addTally(into: Tally, extra: Partial<Tally> | null | undefined): Tally;
export function sumTallies(days: Record<string, Partial<Tally>> | null | undefined): Tally;
export function shiftIso(iso: string, days: number): string;
export function weekdayIndex(iso: string): number;
export function dayLabel(iso: string): string;
export function weekStart(iso: string): string;
export function isoWeekKey(iso: string): string;
export function recentDays(days: Record<string, Tally> | null | undefined, today: string, count?: number): TallyRow[];
export function recentWeeks(days: Record<string, Tally> | null | undefined, today: string, count?: number): TallyRow[];
export function recentMonths(days: Record<string, Tally> | null | undefined, today: string, count?: number): TallyRow[];
export function dayLeader(tally: Partial<Tally> | null | undefined): { id: string; count: number } | null;
export function leadingDays(days: Record<string, Tally> | null | undefined): {
  wins: Record<string, number>;
  ids: string[];
  days: number;
};
export function shareOf(part: number, whole: number): number;
export function thursdayMarket(days: Record<string, Partial<Tally>> | null | undefined): {
  thursday: number;
  other: number;
};
export function hourBands(tally: Partial<Tally> | null | undefined): {
  shown: { hour: number; n: number }[];
  rest: number;
};
export function peopleRows(nicks: Record<string, Partial<NickCounts>> | null | undefined): {
  name: string;
  total: number;
  picks: { id: string; n: number }[];
}[];
export function winsLine(lead: { ids?: string[]; days?: number } | null | undefined): string;
