import { WEEKDAYS, type Weekday } from "./types.ts";

const BERLIN = "Europe/Berlin";

export function nowBerlin(): Date {
  return new Date();
}

export function formatIsoDate(date: Date, timeZone = BERLIN): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatIsoDateTime(date: Date, timeZone = BERLIN): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00`;
}

/** Monday of the current Berlin week as YYYY-MM-DD. */
export function weekStartBerlin(date = nowBerlin()): string {
  const berlinDate = formatIsoDate(date);
  const [y, m, d] = berlinDate.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = utcNoon.getUTCDay(); // 0 Sun … 6 Sat
  const delta = weekday === 0 ? -6 : 1 - weekday;
  utcNoon.setUTCDate(utcNoon.getUTCDate() + delta);
  return utcNoon.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayDates(weekStart: string): Record<Weekday, string> {
  return Object.fromEntries(
    WEEKDAYS.map((day, i) => [day, addDays(weekStart, i)]),
  ) as Record<Weekday, string>;
}

export function parseGermanPrice(text: string): string | undefined {
  const match = text.replace(/\s/g, " ").match(/(\d+[.,]\d{2})\s*€?/);
  return match ? `${match[1].replace(".", ",")} €` : undefined;
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function inferDiet(text: string): "vegan" | "veggie" | "meat" | "fish" | "unknown" {
  const t = text.toLowerCase();
  if (/\bvegan\b/.test(t)) return "vegan";
  if (/\bveggie\b|\bvegetar/.test(t)) return "veggie";
  if (/\bfisch\b|\bzander\b|\bscholle|\blachs\b|\bthunfisch\b|\bpangasius/.test(t)) {
    return "fish";
  }
  if (
    /\bfleisch\b|\bschwein\b|\brind\b|\bhuhn|\bhähnchen|\bpute\b|\bgeflügel|\bschnitzel|\bwurst|\bcurrywurst|\bbacon|\bburger/.test(
      t,
    )
  ) {
    return "meat";
  }
  return "unknown";
}

export function stripDietLabels(name: string): string {
  return cleanText(
    name
      .replace(/\*vegan\*/gi, "")
      .replace(/\b(vegan|veggie|vegetarisch)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s/|–—-]+|[\s/|–—-]+$/g, ""),
  );
}
