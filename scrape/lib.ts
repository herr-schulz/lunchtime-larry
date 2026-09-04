import { WEEKDAYS, type Diet, type Weekday } from "./types.ts";

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

function zoneOffset(date: Date, timeZone: string): string {
  const raw =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const stripped = raw.replace(/^(GMT|UTC)/i, "") || "+00:00";
  const match = stripped.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return "+00:00";
  return `${match[1]}${match[2].padStart(2, "0")}:${match[3] ?? "00"}`;
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
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00${zoneOffset(date, timeZone)}`;
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

const FISH_PARTS = [
  "fisch",
  "zander",
  "scholle",
  "lachs",
  "thunfisch",
  "pangasius",
  "forelle",
  "kabeljau",
  "seelachs",
  "garnelen",
  "scampi",
  "meeresfr",
  "rotbarsch",
  "tilapia",
  "hering",
  "matjes",
  "calamar",
  "tintenfisch",
  "muscheln",
  "dorsch",
  "seezunge",
  "pollack",
  "wolfsbarsch",
  "goldbrasse",
];

const MEAT_PARTS = [
  "fleisch",
  "schwein",
  "hähnchen",
  "hühner",
  "huhn",
  "pute",
  "puten",
  "geflügel",
  "schnitzel",
  "wurst",
  "bacon",
  "burger",
  "schinken",
  "speck",
  "leberkäs",
  "gulasch",
  "ragout",
  "gyros",
  "döner",
  "kebab",
  "bolognese",
  "schaschlik",
  "kötbullar",
  "köttbullar",
  "koettbullar",
  "meatball",
  "hackfleisch",
  "hackbäll",
  "frikadelle",
  "cevapcici",
  "cordon bleu",
  "geschnetzelt",
  "kotelett",
  "entrec",
  "roastbeef",
  "chicken",
  "pork",
  "beef",
  "turkey",
  "salami",
  "minutensteak",
  "haxe",
  "ripperl",
  "rind",
  "kalb",
  "lamm",
  "steak",
];

const MEAT_WORDS = ["ente", "gans", "wild", "hirsch"];

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPart(text: string, parts: string[]): boolean {
  return parts.some((part) => text.includes(part));
}

function hasWord(text: string, words: string[]): boolean {
  return words.some((word) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(word)}(?![\\p{L}\\p{N}])`, "iu").test(text),
  );
}

export function inferDiet(
  text: string,
  extras: { category?: string } = {},
): Diet {
  const t = text.toLowerCase();
  if (t.includes("vegan")) return "vegan";
  if (/^dessert$/i.test(extras.category ?? "")) return "unknown";
  if (t.includes("veggie") || t.includes("vegetar") || t.includes("quorn")) return "veggie";
  if (hasPart(t, FISH_PARTS)) return "fish";
  if (hasPart(t, MEAT_PARTS) || hasWord(t, MEAT_WORDS)) return "meat";
  return "unknown";
}

export function stripDietLabels(name: string): string {
  return cleanText(
    name
      .replace(/\*vegan\*/gi, "")
      .replace(/\bvegan\w*|\bveggie\b|\bvegetarisch\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s/|–—-]+|[\s/|–—-]+$/g, ""),
  );
}
