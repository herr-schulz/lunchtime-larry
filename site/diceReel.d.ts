import type { DayBlock } from "./dice.js";

export const REEL_COPIES: 3;
export const OVERSHOOT_PX: 2;
export const SPIN_MS: 2200;
export const SNAP_MS: 160;
export const SPIN_EASE: string;
export const SNAP_EASE: string;
export const SHAKE_DELTA: 15;

export type ReelEntry = {
  kind: string;
  label: string;
  hint: string;
  key: string;
  canteenId?: string;
};

export function berlinWeekMonday(now?: Date): string;

export function isStaleMenuWeek(
  weekStart: string | null | undefined,
  monday: string | null | undefined,
): boolean;

export function prefersReducedMotion(): boolean;

export function shakeDelta(
  previous: number | null,
  acceleration: { x?: number; y?: number; z?: number } | null | undefined,
): { next: number | null; hit: boolean };

export function dishEntries(
  block: DayBlock,
  canteens: Record<string, { name?: string } | undefined>,
): ReelEntry[];

export function canteenEntries(
  block: DayBlock,
  canteens: Record<string, { name?: string } | undefined>,
): ReelEntry[];

export function spotEntries(
  locations: ReadonlyArray<{ name?: string; vibe?: string }> | null | undefined,
): ReelEntry[];

export function reelMarkup(
  entries: ReadonlyArray<{ label: string }> | null | undefined,
  copies?: number,
): string;

export function reelTranslateY(opts: {
  length: number;
  index: number;
  copies?: number;
  rowHeight: number;
  center?: number;
}): number;

export function planSpin(opts: {
  length: number;
  index: number;
  copies?: number;
  rowHeight: number;
  reduced?: boolean;
}): {
  index: number;
  startY: number;
  endY: number;
  overshootY: number;
  reduced: boolean;
  spinMs: number;
  snapMs: number;
  easing: string;
};
