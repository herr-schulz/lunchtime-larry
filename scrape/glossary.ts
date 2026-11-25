/**
 * MyMemory for unknown food words. Called only from the scrape.
 * The key stays in the environment and is never written or logged.
 */

import { foodWords, isMit, wordKey } from "../site/words.js";
import { WEEKDAYS, type Gloss, type MenuData } from "./types.ts";

const PAIRS = ["en", "ru", "fa", "ar"] as const;
const ENDPOINT = "https://api.mymemory.translated.net/get";

type TranslateResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

export type TranslateFetch = (input: URL) => Promise<TranslateResponse>;

export type MenuWords = Record<string, Gloss>;

type MenuSlice = {
  sources?: MenuData["sources"];
  days?: Partial<MenuData["days"]>;
};

export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Empty when the reply is blank, too long, an error, or a quota warning. */
export function acceptTranslation(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const body = payload as Record<string, unknown>;
  if (body.quotaFinished === true) return "";
  const status = body.responseStatus;
  if (typeof status === "number" && status !== 200) return "";
  const details = typeof body.responseDetails === "string" ? body.responseDetails : "";
  if (/quota|warning|invalid|limit/i.test(details)) return "";
  const data = body.responseData;
  if (!data || typeof data !== "object") return "";
  const raw = (data as Record<string, unknown>).translatedText;
  if (typeof raw !== "string") return "";
  const text = raw.trim();
  if (!text) return "";
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID EMAIL|YOU USED ALL AVAILABLE/i.test(text)) {
    return "";
  }
  if (utf8Size(text) > 500) return "";
  return text;
}

export function sanitizeWords(table: unknown): MenuWords {
  if (!table || typeof table !== "object") return {};
  const out: MenuWords = {};
  for (const [name, row] of Object.entries(table as Record<string, unknown>)) {
    const word = name.trim();
    if (!word || isMit(word) || !row || typeof row !== "object") continue;
    const source = row as Record<string, unknown>;
    const gloss: Gloss = { en: "", ru: "", fa: "", ar: "" };
    for (const lang of PAIRS) {
      const text = source[lang];
      gloss[lang] = typeof text === "string" ? text.trim() : "";
    }
    out[word] = gloss;
  }
  return out;
}

/** Words from canteens scraped this run. A stale fallback adds nothing. */
export function freshFoodWords(menu: MenuSlice): string[] {
  const seen = new Map<string, string>();
  for (const day of WEEKDAYS) {
    const block = menu.days?.[day];
    if (!block) continue;
    for (const canteen of block.canteens ?? []) {
      if (menu.sources?.[canteen.id]?.status !== "ok") continue;
      for (const dish of canteen.dishes ?? []) {
        for (const word of foodWords(dish?.name || "")) {
          if (isMit(word)) continue;
          const key = wordKey(word);
          if (!key || seen.has(key)) continue;
          seen.set(key, word);
        }
      }
    }
  }
  return [...seen.values()];
}

function knownKeys(table: MenuWords): Set<string> {
  return new Set(Object.keys(table).map((name) => wordKey(name)));
}

async function onePair(
  word: string,
  lang: (typeof PAIRS)[number],
  key: string,
  fetchImpl: TranslateFetch,
): Promise<string> {
  if (utf8Size(word) > 500) return "";
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", word);
  url.searchParams.set("langpair", `de|${lang}`);
  url.searchParams.set("de", key);
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return "";
    return acceptTranslation(await response.json());
  } catch {
    return "";
  }
}

export async function translateWord(
  word: string,
  key: string,
  fetchImpl: TranslateFetch,
): Promise<Gloss | null> {
  if (!key || isMit(word)) return null;
  const gloss: Gloss = { en: "", ru: "", fa: "", ar: "" };
  let any = false;
  for (const lang of PAIRS) {
    const text = await onePair(word, lang, key, fetchImpl);
    gloss[lang] = text;
    if (text) any = true;
  }
  return any ? gloss : null;
}

/**
 * Carry the previous table forward. Ask only for words that are not in it.
 * No key: skip the calls and leave new words in German.
 */
export async function fillGlossary(
  menu: MenuSlice,
  previous: unknown,
  opts: { key?: string; fetchImpl?: TranslateFetch } = {},
): Promise<MenuWords> {
  const kept = sanitizeWords(previous);
  const key = (opts.key ?? process.env.MYMEMORY_KEY ?? "").trim();
  const known = knownKeys(kept);
  const pending = freshFoodWords(menu).filter((word) => !known.has(wordKey(word)));
  if (!key || !pending.length) return kept;
  const fetchImpl = opts.fetchImpl ?? ((input) => fetch(input));
  for (const word of pending) {
    const gloss = await translateWord(word, key, fetchImpl);
    if (gloss) kept[word] = gloss;
  }
  return kept;
}
