export const IDLE_TIP: { kicker: string; line: string };

export function nextLookLine(hour: number, weekday: string): string;

export function menuFreshNote(opts?: {
  old?: boolean;
  issueNames?: string[];
  hour?: number;
  weekday?: string;
}): { kicker: string; line: string } | null;

export function winnerLead(name: string): { kicker: string; line: string };
export function winnerTie(): { kicker: string; line: string };
export function voteFull(): { kicker: string; line: string };
export function voteOffline(): { kicker: string; line: string };
export function likeAck(label: string): { kicker: string; line: string };
export function unlikeAck(label: string): { kicker: string; line: string };
export function favoriteToday(
  label: string,
  place: string,
): { kicker: string; line: string };
export function pizzaDaily(): { kicker: string; line: string };
export function leisureMode(): { kicker: string; line: string };
