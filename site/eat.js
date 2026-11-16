/** Wer isst was? — dishes, the week's days, and points. No network. */

import { listMainDishes } from "./dice.js";
import { dishKey } from "./likes.js";
import {
  berlinDate,
  berlinWeekday,
  CANTEEN_IDS,
  firstRecordsByUid,
  isValidNick,
  normalizeNick,
} from "./vote.js";

const PLATE_RE = /^(stmuv|sodexo|bella23):[a-z0-9-]{1,40}$/;
const WEEK_INDEX = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

export function slugDish(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** `stmuv:rinderbraten` — stable enough for the rules, short enough for a stamp. */
export function plateId(canteenId, name) {
  if (!CANTEEN_IDS.includes(canteenId)) return "";
  const slug = slugDish(dishKey(name));
  if (!slug) return "";
  return `${canteenId}:${slug}`;
}

export function isPlateId(value) {
  return PLATE_RE.test(String(value || ""));
}

/** Main dishes from the three canteens. Markt, soups and desserts stay off. */
export function gameMains(block) {
  const seen = new Set();
  const out = [];
  for (const row of listMainDishes(block)) {
    if (!CANTEEN_IDS.includes(row.canteenId)) continue;
    const id = plateId(row.canteenId, row.dish?.name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, canteenId: row.canteenId, dish: row.dish });
  }
  return out;
}

/** Everyone with a ballot today, except you. */
export function playableMembers(records, myUid = "") {
  const seen = new Set();
  const out = [];
  for (const rec of firstRecordsByUid(records)) {
    const uid = String(rec?.uid || "");
    const nick = normalizeNick(rec?.nick);
    if (!uid || uid === myUid || !isValidNick(nick) || seen.has(uid)) continue;
    seen.add(uid);
    out.push({ uid, nick });
  }
  return out;
}

/**
 * Monday through Friday of the lunch week.
 * On the weekend that is the week that just ended.
 * Mid-week it stops at today, so Thursday does not score early.
 */
export function weekSheetDays(now = new Date()) {
  const iso = berlinDate(now);
  const index = WEEK_INDEX[berlinWeekday(now)] ?? 0;
  const [year, month, date] = iso.split("-").map(Number);
  const monday = Date.UTC(year, month - 1, date - index);
  const last = index >= 5 ? 4 : Math.min(4, index);
  const days = [];
  for (let i = 0; i <= last; i += 1) {
    days.push(new Date(monday + i * 86400000).toISOString().slice(0, 10));
  }
  return days;
}

/** The node key is the uid the rules checked. A sheet whose `uid` field disagrees is dropped. */
function sheetsOf(day) {
  if (!day || typeof day !== "object" || Array.isArray(day)) return [];
  return Object.entries(day).filter(([key, sheet]) => sheet?.uid === key);
}

/** One point per other person whose dish matches. Your own dish never scores. Rows are per uid. */
export function pointsForDay(day) {
  const byUid = new Map();
  for (const [uid, sheet] of sheetsOf(day)) {
    if (!isPlateId(sheet.dish)) continue;
    byUid.set(uid, sheet);
  }
  const rows = [];
  for (const [uid, sheet] of byUid) {
    const nick = normalizeNick(sheet.nick);
    if (!isValidNick(nick)) continue;
    const guesses = sheet.guesses && typeof sheet.guesses === "object" ? sheet.guesses : {};
    let points = 0;
    for (const [who, guess] of Object.entries(guesses)) {
      if (who === uid || !isPlateId(guess)) continue;
      const other = byUid.get(who);
      if (other && other.dish === guess) points += 1;
    }
    rows.push({ uid, nick, points });
  }
  return rows;
}

/** Two people both called Sven stay two rows. The latest day's nick is shown. */
export function pointsForWeek(daysByDate, dates) {
  const merged = new Map();
  for (const date of dates || []) {
    for (const row of pointsForDay(daysByDate?.[date])) {
      const cur = merged.get(row.uid) || { uid: row.uid, nick: row.nick, points: 0 };
      cur.nick = row.nick;
      cur.points += row.points;
      merged.set(row.uid, cur);
    }
  }
  return [...merged.values()].sort(
    (a, b) => b.points - a.points || a.nick.localeCompare(b.nick, "de") || a.uid.localeCompare(b.uid),
  );
}

export function weekLine(rows) {
  if (!rows?.length) return "";
  return `Diese Woche · ${rows.map((row) => `${row.nick} ${row.points}`).join(" · ")}`;
}

/** Names sharing the top score. Zero points crown nobody. */
export function weekLeaders(rows) {
  const top = Math.max(0, ...(rows || []).map((row) => row.points || 0));
  if (!top) return [];
  return rows.filter((row) => row.points === top).map((row) => row.nick);
}

/**
 * Finished Monday-to-Friday weeks, newest first.
 * The week still in progress stays off this list until Saturday.
 */
export function pastWeeks(daysByDate, now = new Date(), limit = 8) {
  const iso = berlinDate(now);
  const index = WEEK_INDEX[berlinWeekday(now)] ?? 0;
  const [year, month, date] = iso.split("-").map(Number);
  const thisMonday = Date.UTC(year, month - 1, date - index);
  const start = index >= 5 ? 0 : 1;
  const weeks = [];
  for (let i = start; weeks.length < limit && i < start + 52; i += 1) {
    const monday = thisMonday - i * 7 * 86400000;
    const days = [];
    for (let d = 0; d < 5; d += 1) {
      days.push(new Date(monday + d * 86400000).toISOString().slice(0, 10));
    }
    const rows = pointsForWeek(daysByDate, days);
    if (!rows.length) continue;
    weeks.push({ monday: days[0], friday: days[4], rows, leaders: weekLeaders(rows) });
  }
  return weeks;
}
