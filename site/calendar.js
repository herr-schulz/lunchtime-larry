/** Berlin-calendar helpers and weekday labels for the board. */

import { berlinDate, getNow } from "./vote.js?v=9f2d2a21";

export const DAYS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
};

export const DAY_KEYS = Object.keys(DAYS);

/** Monday of the current Berlin week as YYYY-MM-DD. */
export function weekStartBerlin(date = new Date()) {
  const iso = berlinDate(date);
  const [y, m, d] = iso.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = utcNoon.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  utcNoon.setUTCDate(utcNoon.getUTCDate() + delta);
  return utcNoon.toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Europe/Berlin calendar date of a timestamp, or null if missing/invalid. */
export function berlinDayOf(iso) {
  if (!iso) return null;
  const date = new Date(String(iso).includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return berlinDate(date);
}

/**
 * True when menu.scrapedAt falls in this Berlin Monday–Friday window.
 * Saturday/Sunday still use that week's Monday, so a Friday scrape stays
 * fresh through the weekend and goes stale the next Monday.
 */
export function isMenuWeekFresh(scrapedAt, now = new Date()) {
  const scrapedDay = berlinDayOf(scrapedAt);
  if (!scrapedDay) return false;
  const monday = weekStartBerlin(now);
  const friday = addDays(monday, 4);
  return scrapedDay >= monday && scrapedDay <= friday;
}

export function isoWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
}

export function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
    date,
  );
  const when = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
  }).format(date);
  return `<span class="weekday">${weekday}</span><span class="when">${when}</span>`;
}

export function formatStamp(iso) {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Weekday key in Europe/Berlin; weekends map to friday (Freitagsplan). */
export function todayKey() {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(getNow())
    .toLowerCase();
  if (day === "saturday" || day === "sunday") return "friday";
  return day;
}

export function berlinHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "numeric",
      hourCycle: "h23",
    }).format(getNow()),
  );
}

export function watchBerlinMidnight(onRoll) {
  let stamp = berlinDate();
  window.setInterval(() => {
    const next = berlinDate();
    if (next === stamp) return;
    stamp = next;
    onRoll();
  }, 30_000);
}
