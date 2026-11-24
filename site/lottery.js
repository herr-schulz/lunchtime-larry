/** Larrys Lunch Lottery. The board reads a server tally. It does not fold dish slips. */

import { pointsForWeek, weekLeaders, weekSheetDays } from "./eat.js";
import {
  berlinWeekday,
  firstRecordsByUid,
  isEgalRecord,
  isValidNick,
  normalizeNick,
  picksFromRecord,
} from "./vote.js";

export const LOTTERY_ANNOUNCER =
  "Willkommen bei Larrys Lunch Lottery! Jeden Tag gibt es eine neue Lunch Lottery! Die Regeln sind einfach! 1. Wähle das Gericht, welches du heute am liebsten essen möchtest! 2. Tippe, was deine Kollegen essen wollen! Ziehe dafür den Stempel auf ein beliebiges Gericht! 3. Für jeden richtigen Tipp erhältst du einen Punkt! Der Gewinner erhält ein Veto für den nächsten Kantinenbesuch!";

export const LOTTERY_JOIN =
  "Die nächste Lottery läuft am nächsten Werktag bis 11:55 (Europe/Berlin). Mitmachen heißt, auf dem Wochenplan einen Sitz nehmen, solange die Abstimmung offen ist, und hier vor 11:55 das eigene Gericht setzen und die Stempel ziehen. Nach 11:55 ist zu.";

export const LOTTERY_NEEDS_ROUND = "Das Spiel gibt es in der Runde.";

const DAY_FIELDS = ["stmuv", "sodexo", "bella23", "wochenmarkt", "egal", "second", "n"];

function cap(value) {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  return Math.min(24, Math.floor(n));
}

/** Same canteen counts as foldDay, without names, hours, uids or dishes. */
export function canteenNumbers(records) {
  const tally = { stmuv: 0, sodexo: 0, bella23: 0, wochenmarkt: 0, egal: 0, second: 0, n: 0 };
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
  }
  for (const field of DAY_FIELDS) tally[field] = cap(tally[field]);
  return tally;
}

/** Drop anything that is not a canteen count. A nick or a dish on the node stays off the page. */
export function publicDayTallies(days) {
  const out = {};
  if (!days || typeof days !== "object" || Array.isArray(days)) return out;
  for (const [day, tally] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !tally || typeof tally !== "object") continue;
    const row = {};
    for (const field of DAY_FIELDS) {
      const n = Number(tally[field]);
      row[field] = Number.isFinite(n) && n > 0 ? Math.min(24, Math.floor(n)) : 0;
    }
    if (row.n) out[day] = row;
  }
  return out;
}

/** Nick and points only. A dish or canteen on the same node is ignored. */
export function publicPoints(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return [];
  const rows = [];
  for (const [uid, row] of Object.entries(node)) {
    if (!uid || !row || typeof row !== "object") continue;
    const nick = normalizeNick(row.nick);
    const points = row.points;
    if (!isValidNick(nick)) continue;
    if (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > 200) continue;
    rows.push({ uid, nick, points });
  }
  rows.sort(
    (a, b) => b.points - a.points || a.nick.localeCompare(b.nick, "de") || a.uid.localeCompare(b.uid),
  );
  return rows;
}

export function pointsBoardText(node) {
  const rows = publicPoints(node);
  if (!rows.length) return "";
  return rows.map((row) => `${row.nick} ${row.points}`).join(" · ");
}

/** Names from the server crown. Before Saturday, and without this week's node, nobody. */
export function publicWinner(node, now = new Date()) {
  const at = now instanceof Date ? now : new Date(now);
  const day = berlinWeekday(at);
  if (day !== "saturday" && day !== "sunday") return [];
  if (!node || typeof node !== "object") return [];
  const monday = weekSheetDays(at)[0];
  if (node.week !== monday) return [];
  const names = node.names;
  if (!names || typeof names !== "object" || Array.isArray(names)) return [];
  const out = [];
  for (const [name, flag] of Object.entries(names)) {
    if (flag !== true) continue;
    const nick = normalizeNick(name);
    if (!isValidNick(nick) || nick !== name) continue;
    out.push(nick);
  }
  out.sort((a, b) => a.localeCompare(b, "de"));
  return out;
}

/**
 * What the admin run writes. Closed days only.
 * Points are nick and points for this lunch week. Winner only on the weekend.
 * @param {{ votes?: object, eats?: object, calendar?: object, now?: Date }} input
 */
export function buildRoundTally({ votes, eats, calendar, now = new Date() } = {}) {
  const at = now instanceof Date ? now : new Date(now);
  const nowMs = at.getTime();
  const closed = new Set();
  for (const [day, bounds] of Object.entries(calendar || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (typeof bounds?.l !== "number" || bounds.l > nowMs) continue;
    closed.add(day);
  }
  const days = {};
  const voteTree = votes && typeof votes === "object" ? votes : {};
  for (const day of closed) {
    const records = voteTree[day];
    if (!records || typeof records !== "object") continue;
    const numbers = canteenNumbers(records);
    if (numbers.n > 0) days[day] = numbers;
  }
  const week = weekSheetDays(at).filter((day) => closed.has(day));
  const eatTree = eats && typeof eats === "object" ? eats : {};
  const byDate = {};
  for (const day of week) {
    if (eatTree[day] && typeof eatTree[day] === "object") byDate[day] = eatTree[day];
  }
  const rows = pointsForWeek(byDate, week);
  const points = {};
  for (const row of rows) points[row.uid] = { nick: row.nick, points: row.points };
  const weekday = berlinWeekday(at);
  const crown = weekday === "saturday" || weekday === "sunday";
  let winner = null;
  if (crown) {
    const names = weekLeaders(rows);
    if (names.length) {
      const flags = {};
      for (const name of names) flags[name] = true;
      winner = { week: weekSheetDays(at)[0], names: flags };
    }
  }
  return { days, points, winner };
}
