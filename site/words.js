/** Food-word glossary and the masthead language. MyMemory is never called from here. */

import { html } from "./dom.js?v=d78812b6";
import { displayDishName } from "./likes.js?v=16f9871b";

const LANGS = ["de", "en", "ru", "fa", "ar"];
const GLOSS_LANGS = ["en", "ru", "fa", "ar"];
const RTL = new Set(["fa", "ar"]);
const LANG_KEY = "larry-lang";
const TAGS = { en: "EN", ru: "RU", fa: "FA", ar: "AR" };

export const BRAND = {
  de: "Lunchtime Larry",
  en: "Lunchtime Larry",
  ru: "Обеденный Олег",
  fa: "ناهارِ نوید",
  ar: "غداء غسان",
};

const WORD_RE = /[\p{L}\p{M}](?:[\p{L}\p{M}]|['’-](?=[\p{L}\p{M}]))*/gu;

export function isMit(word) {
  return /^mit$/iu.test(String(word || ""));
}

export function wordKey(word) {
  return String(word || "").toLocaleLowerCase("de-DE");
}

/** Letter-words from the slip, with separators and „mit“ left as gaps. */
export function splitParts(text) {
  const source = String(text ?? "");
  const parts = [];
  const re = new RegExp(WORD_RE.source, "gu");
  let last = 0;
  for (const match of source.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "gap", text: source.slice(last, index) });
    const word = match[0];
    parts.push({ kind: isMit(word) ? "mit" : "word", text: word });
    last = index + word.length;
  }
  if (last < source.length) parts.push({ kind: "gap", text: source.slice(last) });
  return parts;
}

/** Food words as they stand on the slip. „mit“, „|“ and „/“ are not keys. */
export function foodWords(name) {
  const words = [];
  for (const part of splitParts(displayDishName(name))) {
    if (part.kind === "word") words.push(part.text);
  }
  return words;
}

function asGloss(gloss) {
  return {
    lang: LANGS.includes(gloss?.lang) ? gloss.lang : "de",
    words: gloss?.words && typeof gloss.words === "object" ? gloss.words : {},
  };
}

export function lookupWord(words, word) {
  if (!words || !word) return undefined;
  if (words[word] && typeof words[word] === "object") return words[word];
  const key = wordKey(word);
  for (const [name, row] of Object.entries(words)) {
    if (wordKey(name) === key && row && typeof row === "object") return row;
  }
  return undefined;
}

function cell(row, lang) {
  const text = row?.[lang];
  return typeof text === "string" ? text.trim() : "";
}

export function shownWord(word, gloss) {
  const { lang, words } = asGloss(gloss);
  if (lang === "de" || isMit(word)) return word;
  const text = cell(lookupWord(words, word), lang);
  return text || word;
}

export function plainWords(text, gloss) {
  return splitParts(text)
    .map((part) => (part.kind === "word" ? shownWord(part.text, gloss) : part.text))
    .join("");
}

function germanGloss(word, words) {
  const row = lookupWord(words, word);
  const bits = [];
  for (const lang of GLOSS_LANGS) {
    const text = cell(row, lang);
    if (!text) continue;
    const tag = TAGS[lang];
    bits.push(
      RTL.has(lang)
        ? html`<span class="food-gloss-bit"><span class="food-gloss-tag">${tag}</span> <bdi dir="rtl" lang="${lang}">${text}</bdi></span>`
        : html`<span class="food-gloss-bit"><span class="food-gloss-tag">${tag}</span> ${text}</span>`,
    );
  }
  if (!bits.length) return null;
  return html`<span class="food-gloss" dir="ltr">${bits}</span>`;
}

function wordSpan(word, gloss) {
  const { lang, words } = asGloss(gloss);
  if (isMit(word)) return word;
  if (lang === "de") {
    const line = germanGloss(word, words);
    if (!line) return word;
    return html`<span class="food-word" lang="de" tabindex="0"><span class="food-text">${word}</span>${line}</span>`;
  }
  const text = cell(lookupWord(words, word), lang);
  if (!text) return word;
  const line = html`<span class="food-gloss" dir="ltr" lang="de">${word}</span>`;
  if (RTL.has(lang)) {
    return html`<span class="food-word" lang="${lang}" dir="rtl" tabindex="0"><span class="food-text">${text}</span>${line}</span>`;
  }
  return html`<span class="food-word" lang="${lang}" tabindex="0"><span class="food-text">${text}</span>${line}</span>`;
}

/** One slip phrase: each food word on its own, „mit“ left in German. */
export function renderWords(text, gloss) {
  return html`${splitParts(text).map((part) => (part.kind === "word" ? wordSpan(part.text, gloss) : part.text))}`;
}

/** Same join as `joinDishSides`, with each side's words translated. */
export function renderSides(sides, gloss) {
  const parts = (sides ?? []).map((side) => String(side).trim()).filter(Boolean);
  if (!parts.length) return html``;
  const chunks = parts.map((part, index) =>
    renderWords(index === 0 ? part.replace(/^mit\s+/iu, "") : part, gloss),
  );
  if (chunks.length === 1) return html`mit ${chunks[0]}`;
  if (chunks.length === 2) return html`mit ${chunks[0]} und ${chunks[1]}`;
  const bits = [html`mit ${chunks[0]}`];
  for (const chunk of chunks.slice(1, -1)) bits.push(html`, ${chunk}`);
  bits.push(html` und ${chunks.at(-1)}`);
  return html`${bits}`;
}

export function readLang() {
  try {
    const raw = localStorage.getItem(LANG_KEY) || "";
    return LANGS.includes(raw) ? raw : "de";
  } catch {
    return "de";
  }
}

export function writeLang(lang) {
  if (!LANGS.includes(lang)) return;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode */
  }
}

export function brandName(lang) {
  return BRAND[LANGS.includes(lang) ? lang : "de"];
}

/** The masthead title only. The board stays left to right. */
export function paintMasthead(title) {
  if (!title) return;
  const lang = readLang();
  title.textContent = brandName(lang);
  title.lang = lang;
  if (RTL.has(lang)) title.dir = "rtl";
  else title.removeAttribute("dir");
}
