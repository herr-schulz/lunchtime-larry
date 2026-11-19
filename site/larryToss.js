/** Throw Larry in the bin. He stays gone until the next Europe/Berlin day. */

import { berlinClock, berlinDate } from "./vote.js?v=9cf92e86";

export const AWAY_KEY = "lunchtime-larry-away";

export const TOSS_LINES = ["bin schon weg", "ab jetzt halt ich den rand"];

/**
 * First instant the Berlin calendar date changes.
 * Same day boundary as the rest of the board (not a rolling hour window).
 * @param {Date} [now]
 */
export function nextBerlinMidnight(now = new Date()) {
  const day = berlinDate(now);
  const { hour, minute } = berlinClock(now);
  const elapsed = hour * 60 + minute;
  let hi = now.getTime() + (24 * 60 - elapsed) * 60 * 1000 + 90 * 1000;
  let guard = 0;
  while (berlinDate(new Date(hi)) === day && guard < 4) {
    hi += 2 * 60 * 60 * 1000;
    guard += 1;
  }
  let lo = now.getTime();
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (berlinDate(new Date(mid)) === day) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** @param {Pick<Storage, "getItem"> | null | undefined} storage */
export function awayStamp(storage) {
  try {
    const n = Number(storage?.getItem?.(AWAY_KEY) || "");
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {number} [now]
 */
export function larryIsAway(storage, now = Date.now()) {
  return awayStamp(storage) > now;
}

export const LARRY_WHERE_LABEL = "Wo ist Larry?";

/** No separate page. He stays in the bin until the next Berlin day. */
export const LARRY_WHERE_NOTE = "Larry ist bis morgen im Eimer.";

/**
 * Footer link while the away stamp is still in the future.
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {number} [now]
 */
export function larryWhereLink(storage, now = Date.now()) {
  return {
    show: larryIsAway(storage, now),
    label: LARRY_WHERE_LABEL,
    note: LARRY_WHERE_NOTE,
  };
}

/**
 * @param {{ hidden: boolean, title?: string } | null | undefined} link
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {number} [now]
 */
export function applyLarryWhere(link, storage, now = Date.now()) {
  const state = larryWhereLink(storage, now);
  if (link) {
    link.hidden = !state.show;
    link.title = state.note;
  }
  return state;
}

/**
 * Reuse the goodbye line. There is nowhere else to send him.
 * @param {{ hidden: boolean, textContent: string, classList?: { add: (name: string) => void } } | null | undefined} bye
 * @param {string} [note]
 */
export function showLarryWhere(bye, note = LARRY_WHERE_NOTE) {
  if (bye) {
    bye.textContent = note;
    bye.hidden = false;
    bye.classList?.add("is-live");
  }
  return note;
}

/**
 * @param {Pick<Storage, "setItem"> | null | undefined} storage
 * @param {Date} [now]
 */
export function rememberAway(storage, now = new Date()) {
  const until = nextBerlinMidnight(now);
  try {
    storage?.setItem?.(AWAY_KEY, String(until));
  } catch {
    /* private mode: still hide him for this view */
  }
  return until;
}

/** @param {() => number} [random] */
export function tossLine(random = Math.random) {
  const index = Math.floor(random() * TOSS_LINES.length) % TOSS_LINES.length;
  return TOSS_LINES[index];
}

/**
 * Face center inside the bin, with a little slack so the drop is not pixel-perfect.
 * @param {{ left: number, top: number, width: number, height: number }} face
 * @param {{ left: number, right: number, top: number, bottom: number }} trash
 * @param {number} [slack]
 */
export function droppedInTrash(face, trash, slack = 28) {
  if (!face || !trash) return false;
  const cx = face.left + face.width / 2;
  const cy = face.top + face.height / 2;
  return (
    cx >= trash.left - slack &&
    cx <= trash.right + slack &&
    cy >= trash.top - slack &&
    cy <= trash.bottom + slack
  );
}

/**
 * @param {{
 *   fromFace?: boolean,
 *   dragged?: boolean,
 *   cancelled?: boolean,
 *   face?: { left: number, top: number, width: number, height: number } | null,
 *   trash?: { left: number, right: number, top: number, bottom: number } | null,
 * }} drop
 * @returns {"snap" | "toss" | "dock"}
 */
export function dragRelease(drop) {
  if (drop.cancelled || !drop.dragged) return "snap";
  if (drop.fromFace && drop.face && drop.trash && droppedInTrash(drop.face, drop.trash)) return "toss";
  return "dock";
}

/**
 * Hide Larry, show the short goodbye, and remember the throw.
 * A later call with the same storage keeps him hidden until `until`.
 * @param {{
 *   root?: { hidden: boolean, classList: { remove: (...names: string[]) => void } } | null,
 *   bye?: { hidden: boolean, classList: { add: (name: string) => void } } | null,
 *   byeLine?: { textContent: string } | null,
 *   storage?: Pick<Storage, "getItem" | "setItem"> | null,
 *   now?: Date,
 *   random?: () => number,
 *   record?: () => void,
 * }} opts
 */
export function applyTrashDrop(opts) {
  const line = tossLine(opts.random);
  const until = rememberAway(opts.storage, opts.now);
  opts.root?.classList.remove("is-live", "is-dragging", "is-speaking", "is-parked", "is-docking");
  if (opts.root) opts.root.hidden = true;
  if (opts.byeLine) opts.byeLine.textContent = line;
  if (opts.bye) {
    opts.bye.hidden = false;
    opts.bye.classList.add("is-live");
  }
  try {
    opts.record?.();
  } catch {
    /* the count can fail; he still stays gone */
  }
  return { line, until };
}

/**
 * After a reload: hide him when the away stamp is still in the future.
 * @param {{ hidden: boolean } | null | undefined} root
 * @param {Pick<Storage, "getItem"> | null | undefined} storage
 * @param {number} [now]
 */
export function presentLarry(root, storage, now = Date.now()) {
  if (!larryIsAway(storage, now)) return true;
  if (root) root.hidden = true;
  return false;
}
