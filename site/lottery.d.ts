export const LOTTERY_ANNOUNCER: string;
export const LOTTERY_JOIN: string;
export const LOTTERY_NEEDS_ROUND: string;

export function canteenNumbers(records: unknown): {
  stmuv: number;
  sodexo: number;
  bella23: number;
  wochenmarkt: number;
  egal: number;
  second: number;
  n: number;
};

export function publicDayTallies(
  days: Record<string, unknown> | null | undefined,
): Record<string, Record<string, number>>;

export function publicPoints(
  node: unknown,
): Array<{ uid: string; nick: string; points: number }>;

export function pointsBoardText(node: unknown): string;

export function publicWinner(node: unknown, now?: Date): string[];

export function buildRoundTally(input?: {
  votes?: Record<string, unknown> | null;
  eats?: Record<string, unknown> | null;
  calendar?: Record<string, { l?: number }> | null;
  now?: Date;
}): {
  days: Record<string, Record<string, number>>;
  points: Record<string, { nick: string; points: number }>;
  winner: { week: string; names: Record<string, true> } | null;
};
