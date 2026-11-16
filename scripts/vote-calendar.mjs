/**
 * Europe/Berlin day bounds for `calendar/{YYYY-MM-DD}` =
 * { s, e, l, w } (epoch ms; e exclusive; l = 11:55 lock; w = weekday).
 * Rules only accept a new `meta/voteDay` while the server clock sits inside its bounds,
 * and ballots / plates only while `w` and `now < l`.
 *
 *   node scripts/vote-calendar.mjs 2026 2035 calendar.json
 *   firebase database:set /calendar calendar.json --confirm
 */

import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  weekday: "short",
});

/** Berlin midnight never falls in a DST gap, so it is UTC 22:00 or 23:00 of the day before. */
export function berlinMidnight(iso) {
  const [year, month, date] = iso.split("-").map(Number);
  for (const hours of [1, 2]) {
    const t = Date.UTC(year, month - 1, date) - hours * 3600000;
    if (DAY_FMT.format(t) === iso && HOUR_FMT.format(t) === "00:00") return t;
  }
  throw new Error(`no Berlin midnight for ${iso}`);
}

/** Instant when Europe/Berlin shows `hour:minute` on `iso`. */
export function berlinWallTime(iso, hour, minute = 0) {
  const start = berlinMidnight(iso);
  const want = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  for (let ms = start; ms < start + 36 * 3600000; ms += 60000) {
    if (DAY_FMT.format(ms) === iso && HOUR_FMT.format(ms) === want) return ms;
  }
  throw new Error(`no Berlin ${want} for ${iso}`);
}

export function nextIso(iso) {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + 1)).toISOString().slice(0, 10);
}

export function isWeekday(iso) {
  const noon = berlinWallTime(iso, 12, 0);
  const day = WEEKDAY_FMT.format(noon);
  return day !== "Sat" && day !== "Sun";
}

export function dayBounds(iso) {
  return {
    s: berlinMidnight(iso),
    e: berlinMidnight(nextIso(iso)),
    l: berlinWallTime(iso, 11, 55),
    w: isWeekday(iso),
  };
}

export function voteCalendar(fromYear, toYear) {
  const out = {};
  for (let iso = `${fromYear}-01-01`; iso < `${toYear + 1}-01-01`; iso = nextIso(iso)) {
    out[iso] = dayBounds(iso);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const from = Number(process.argv[2] ?? new Date().getUTCFullYear());
  const to = Number(process.argv[3] ?? from + 9);
  const out = process.argv[4] ?? "calendar.json";
  await writeFile(out, `${JSON.stringify(voteCalendar(from, to))}\n`, "utf8");
  console.log(`wrote ${out}`);
}
