export const CANTEEN_IDS: readonly ["stmuv", "sodexo", "bella23"];
export const MAX_VOTERS: 6;
export const MAX_NICK: 20;
export const MAX_NICK_WORD: 12;

export type CanteenId = (typeof CANTEEN_IDS)[number];

export type VoteRecord = {
  uid?: string;
  nick?: string;
  canteen?: CanteenId | string;
  at?: number;
};

export type VoteRecords = Record<string, VoteRecord | undefined | null>;

export function berlinDate(now?: Date): string;
export function berlinWeekday(now?: Date): string;
export function isVoteDay(now?: Date): boolean;
export function lastVoteDate(now?: Date): string;
export function normalizeNick(value: unknown): string;
export function loadNick(): string;
export function saveNick(nick: string): string;
export function countVotes(
  records: VoteRecords | null | undefined,
): Record<CanteenId, number>;
export function nicksFor(
  records: VoteRecords | null | undefined,
  canteen: string,
): string[];
export function winnerOf(
  counts: Partial<Record<CanteenId, number>>,
  names: Record<string, string>,
):
  | { status: "empty" }
  | { status: "tie" }
  | { status: "lead"; id: CanteenId; name: string };
export function votesPath(day?: string): string;
export function mySlot(
  records: VoteRecords | null | undefined,
  uid: string | null | undefined,
): string | null;
export function canAcceptVote(
  records: VoteRecords | null | undefined,
  uid: string | null | undefined,
): boolean;
