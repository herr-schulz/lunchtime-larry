/** Berlin-calendar helpers and weekday labels for the board. */

import { berlinDate } from "./vote.js?v=a52b5e64";

export const DAYS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
};

export const DAY_KEYS = Object.keys(DAYS);

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
    .format(new Date())
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
    }).format(new Date()),
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
