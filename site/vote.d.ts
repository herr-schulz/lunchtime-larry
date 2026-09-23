export const CANTEEN_IDS: readonly ["stmuv", "sodexo", "bella23"];
export const MARKET_ID: "wochenmarkt";
export const MARKET_NAME: string;
export function voteTargetIds(weekday: string): string[];
export const MAX_VOTERS: 6;
export const MAX_NICK: 20;
export const MAX_NICK_WORD: 12;

export type CanteenId = (typeof CANTEEN_IDS)[number];
export type VoteTargetId = CanteenId | "wochenmarkt";

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
export function ballotDate(now?: Date): string | null;
export function normalizeNick(value: unknown): string;
export function isValidNick(value: unknown): boolean;
export function loadNick(): string;
export function saveNick(nick: string): string;
export function countVotes(
  records: VoteRecords | null | undefined,
): Record<VoteTargetId, number>;
export function nicksFor(
  records: VoteRecords | null | undefined,
  canteen: string,
): string[];
export function winnerOf(
  counts: Partial<Record<VoteTargetId, number>>,
  names: Record<string, string>,
):
  | { status: "empty" }
  | { status: "tie" }
  | { status: "lead"; id: VoteTargetId; name: string };
export const ROUND_ALPHABET: string;
export const MAX_ROUND_CODE: 8;
export function normalizeRoundCode(value: unknown): string;
export function isRoundCode(value: unknown): boolean;
export function generateRoundCode(rng?: () => number): string;
export function loadRoundCode(): string;
export function saveRoundCode(raw: unknown): string;
export function votesPath(day?: string, roundCode?: string | null): string;
export function staleVoteDays(keys: string[], keepDay: string): string[];
export function mySlot(
  records: VoteRecords | null | undefined,
  uid: string | null | undefined,
): string | null;
export function canAcceptVote(
  records: VoteRecords | null | undefined,
  uid: string | null | undefined,
): boolean;

export type VotePhase = "open" | "locked" | "reveal" | "closed";

export function loadVoteOptIn(): boolean;
export function saveVoteOptIn(): void;
export function loadIntroSeen(): boolean;
export function saveIntroSeen(): void;
export function getNow(fallback?: Date): Date;
export function setNowOverride(value: Date | string | null | undefined): Date | null;
export function clearNowOverride(): void;
export function berlinClock(now?: Date): { hour: number; minute: number };
export function votePhase(now?: Date): VotePhase;
export function minutesUntilReveal(now?: Date): number;
export function lockLine(minutesLeft: number): string;
export function roundNicks(records: VoteRecords | null | undefined): string[];
