/** Fold a finished ballot day into a few integers. No page views live here. */

import {
  berlinClock,
  firstRecordsByUid,
  isEgalRecord,
  isValidNick,
  normalizeNick,
  picksFromRecord,
} from "./vote.js?v=857e7e26";

export const TALLY_FIELDS = ["stmuv", "sodexo", "bella23", "wochenmarkt", "egal", "second", "n"];
export const NICK_FIELDS = ["stmuv", "sodexo", "bella23", "wochenmarkt", "egal"];
export const BAR_FIELDS = ["stmuv", "sodexo", "bella23", "wochenmarkt"];

export const TALLY_NAMES = {
  stmuv: "StMUV",
  sodexo: "Dave B",
  bella23: "Bella 23",
  wochenmarkt: "Markt",
  egal: "Egal",
};

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function cap(value) {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  return Math.min(24, Math.floor(n));
}

export function emptyTally() {
  return { stmuv: 0, sodexo: 0, bella23: 0, wochenmarkt: 0, egal: 0, second: 0, n: 0 };
}

export function emptyNick() {
  return { stmuv: 0, sodexo: 0, bella23: 0, wochenmarkt: 0, egal: 0 };
}

function hourKey(at) {
  if (typeof at !== "number" || !Number.isFinite(at)) return "";
  let { hour } = berlinClock(new Date(at));
  if (hour === 24) hour = 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "";
  return `h${hour}`;
}

/** One object per closed day. Canteen fields count every pick, `n` counts people. */
export function foldDay(records) {
  const tally = emptyTally();
  /** @type {Record<string, number>} */
  const hours = {};
  for (const rec of firstRecordsByUid(records)) {
    if (tally.n >= 24) break;
    tally.n += 1;
    if (isEgalRecord(rec)) {
      tally.egal += 1;
    } else {
      const picks = picksFromRecord(rec);
      if (picks[0] && Object.hasOwn(tally, picks[0])) tally[picks[0]] += 1;
      if (picks[1] && Object.hasOwn(tally, picks[1])) {
        tally[picks[1]] += 1;
        tally.second += 1;
      }
    }
    const key = hourKey(rec?.at);
    if (key) hours[key] = (hours[key] || 0) + 1;
  }
  for (const field of TALLY_FIELDS) tally[field] = cap(tally[field]);
  for (const key of Object.keys(hours)) hours[key] = cap(hours[key]);
  return { ...tally, ...hours };
}

/** Per displayed nick, for the closed day. Invalid nicks are dropped. */
export function foldNicks(records) {
  /** @type {Record<string, ReturnType<typeof emptyNick>>} */
  const out = {};
  for (const rec of firstRecordsByUid(records)) {
    const nick = normalizeNick(rec?.nick);
    if (!isValidNick(nick)) continue;
    const row = out[nick] || emptyNick();
    if (isEgalRecord(rec)) row.egal += 1;
    else {
      for (const id of picksFromRecord(rec)) {
        if (Object.hasOwn(row, id)) row[id] += 1;
      }
    }
    out[nick] = row;
  }
  for (const row of Object.values(out)) {
    for (const field of NICK_FIELDS) row[field] = cap(row[field]);
  }
  return out;
}

/**
 * Add one closed day onto a nick row. The same day twice does not add again.
 * @param {Record<string, unknown> | null | undefined} current
 * @param {Record<string, number>} delta
 * @param {string} day
 */
function whole(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function mergeNickTotals(current, delta, day) {
  const prev = current && typeof current === "object" ? current : {};
  const seen = { ...(prev.days && typeof prev.days === "object" ? prev.days : {}) };
  const counts = emptyNick();
  for (const field of NICK_FIELDS) counts[field] = whole(prev[field]);
  if (seen[day]) return { ...counts, days: seen };
  for (const field of NICK_FIELDS) counts[field] += cap(delta?.[field]);
  seen[day] = true;
  return { ...counts, days: seen };
}

export function addTally(into, extra) {
  const next = { ...into };
  for (const field of TALLY_FIELDS) next[field] = (next[field] || 0) + (extra?.[field] || 0);
  if (!extra) return next;
  for (const [key, value] of Object.entries(extra)) {
    if (!/^h(?:[0-9]|1[0-9]|2[0-3])$/.test(key)) continue;
    next[key] = (next[key] || 0) + (Number(value) || 0);
  }
  return next;
}

export function sumTallies(days) {
  let total = emptyTally();
  for (const tally of Object.values(days || {})) total = addTally(total, tally);
  return total;
}

function parts(iso) {
  const [year, month, date] = String(iso).split("-").map(Number);
  return { year, month, date };
}

export function shiftIso(iso, days) {
  const { year, month, date } = parts(iso);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return next.toISOString().slice(0, 10);
}

export function weekdayIndex(iso) {
  const { year, month, date } = parts(iso);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

export function dayLabel(iso) {
  const { month, date } = parts(iso);
  return `${WEEKDAYS[weekdayIndex(iso)]} ${date}.${month}.`;
}

/** Monday of the ISO week that contains `iso`, as YYYY-MM-DD. */
export function weekStart(iso) {
  const { year, month, date } = parts(iso);
  const cursor = new Date(Date.UTC(year, month - 1, date));
  const day = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() - (day - 1));
  return cursor.toISOString().slice(0, 10);
}

export function isoWeekKey(iso) {
  const start = weekStart(iso);
  const { year, month, date } = parts(start);
  const cursor = new Date(Date.UTC(year, month - 1, date));
  cursor.setUTCDate(cursor.getUTCDate() + 3);
  const weekYear = cursor.getUTCFullYear();
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1 = new Date(jan4);
  week1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const week = Math.round((cursor - week1) / 86400000 / 7) + 1;
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function rowFrom(key, label, tally) {
  return { key, label, tally: tally?.n ? tally : null };
}

/** Last `count` calendar days ending yesterday, gaps included. */
export function recentDays(days, today, count = 14) {
  const end = shiftIso(today, -1);
  const rows = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const iso = shiftIso(end, -i);
    rows.push(rowFrom(iso, dayLabel(iso), days?.[iso]));
  }
  return rows;
}

export function recentWeeks(days, today, count = 12) {
  const end = weekStart(shiftIso(today, -1));
  const rows = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = shiftIso(end, -7 * i);
    const key = isoWeekKey(start);
    let tally = emptyTally();
    let any = false;
    for (let d = 0; d < 7; d += 1) {
      const iso = shiftIso(start, d);
      if (!days?.[iso]) continue;
      tally = addTally(tally, days[iso]);
      any = true;
    }
    const week = key.slice(6);
    rows.push(rowFrom(key, `KW ${Number(week)}`, any ? tally : null));
  }
  return rows;
}

export function recentMonths(days, today, count = 12) {
  const end = shiftIso(today, -1).slice(0, 7);
  const [year, month] = end.split("-").map(Number);
  const rows = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(Date.UTC(year, month - 1 - i, 1));
    const key = cursor.toISOString().slice(0, 7);
    let tally = emptyTally();
    let any = false;
    for (const [iso, day] of Object.entries(days || {})) {
      if (!iso.startsWith(key)) continue;
      tally = addTally(tally, day);
      any = true;
    }
    const label = `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
    rows.push(rowFrom(key, label, any ? tally : null));
  }
  return rows;
}

export function dayLeader(tally) {
  if (!tally?.n) return null;
  let max = 0;
  for (const id of BAR_FIELDS) max = Math.max(max, tally[id] || 0);
  if (!max) return null;
  const leaders = BAR_FIELDS.filter((id) => (tally[id] || 0) === max);
  if (leaders.length !== 1) return null;
  return { id: leaders[0], count: max };
}

export function leadingDays(days) {
  const wins = { stmuv: 0, sodexo: 0, bella23: 0, wochenmarkt: 0 };
  for (const tally of Object.values(days || {})) {
    const lead = dayLeader(tally);
    if (lead) wins[lead.id] += 1;
  }
  const max = Math.max(...Object.values(wins));
  const ids = BAR_FIELDS.filter((id) => wins[id] === max && max > 0);
  return { wins, ids, days: max };
}

export function shareOf(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export function thursdayMarket(days) {
  let thursday = 0;
  let other = 0;
  for (const [iso, tally] of Object.entries(days || {})) {
    const picks = tally?.wochenmarkt || 0;
    if (weekdayIndex(iso) === 4) thursday += picks;
    else other += picks;
  }
  return { thursday, other };
}

/** Hours 8–15 as bars. Everything else is one remainder. */
export function hourBands(tally) {
  const shown = [];
  for (let hour = 8; hour <= 15; hour += 1) {
    shown.push({ hour, n: tally?.[`h${hour}`] || 0 });
  }
  let rest = 0;
  for (let hour = 0; hour <= 23; hour += 1) {
    if (hour >= 8 && hour <= 15) continue;
    rest += tally?.[`h${hour}`] || 0;
  }
  return { shown, rest };
}

export function peopleRows(nicks) {
  const rows = [];
  for (const [name, counts] of Object.entries(nicks || {})) {
    if (!counts || typeof counts !== "object") continue;
    const total = NICK_FIELDS.reduce((sum, id) => sum + (counts[id] || 0), 0);
    if (!total) continue;
    const picks = NICK_FIELDS.filter((id) => counts[id] > 0).sort(
      (a, b) => counts[b] - counts[a] || a.localeCompare(b, "de"),
    );
    rows.push({
      name,
      total,
      picks: picks.map((id) => ({ id, n: counts[id] })),
    });
  }
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "de"));
  return rows;
}

export function winsLine(lead) {
  if (!lead?.ids?.length) return "Noch kein Tag mit einer Kantine vorn.";
  const names = lead.ids.map((id) => TALLY_NAMES[id]).join(" und ");
  const dayWord = lead.days === 1 ? "Tag" : "Tagen";
  return `${names} an ${lead.days} ${dayWord} vorn.`;
}
