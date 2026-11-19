export const AWAY_KEY: string;
export const TOSS_LINES: readonly string[];

export function nextBerlinMidnight(now?: Date): number;

export function awayStamp(storage: Pick<Storage, "getItem"> | null | undefined): number;

export function larryIsAway(
  storage: Pick<Storage, "getItem"> | null | undefined,
  now?: number,
): boolean;

export const LARRY_WHERE_LABEL: string;
export const LARRY_WHERE_NOTE: string;

export function larryWhereLink(
  storage: Pick<Storage, "getItem"> | null | undefined,
  now?: number,
): { show: boolean; label: string; note: string };

export function applyLarryWhere(
  link: { hidden: boolean; title?: string } | null | undefined,
  storage: Pick<Storage, "getItem"> | null | undefined,
  now?: number,
): { show: boolean; label: string; note: string };

export function showLarryWhere(
  bye:
    | {
        hidden: boolean;
        textContent: string;
        classList?: { add: (name: string) => void };
      }
    | null
    | undefined,
  note?: string,
): string;

export function rememberAway(
  storage: Pick<Storage, "setItem"> | null | undefined,
  now?: Date,
): number;

export function tossLine(random?: () => number): string;

export function droppedInTrash(
  face: { left: number; top: number; width: number; height: number } | null | undefined,
  trash: { left: number; right: number; top: number; bottom: number } | null | undefined,
  slack?: number,
): boolean;

export function dragRelease(drop: {
  fromFace?: boolean;
  dragged?: boolean;
  cancelled?: boolean;
  face?: { left: number; top: number; width: number; height: number } | null;
  trash?: { left: number; right: number; top: number; bottom: number } | null;
}): "snap" | "toss" | "dock";

export function applyTrashDrop(opts: {
  root?: { hidden: boolean; classList: { remove: (...names: string[]) => void } } | null;
  bye?: { hidden: boolean; classList: { add: (name: string) => void } } | null;
  byeLine?: { textContent: string } | null;
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  now?: Date;
  random?: () => number;
  record?: () => void;
}): { line: string; until: number };

export function presentLarry(
  root: { hidden: boolean } | null | undefined,
  storage: Pick<Storage, "getItem"> | null | undefined,
  now?: number,
): boolean;
