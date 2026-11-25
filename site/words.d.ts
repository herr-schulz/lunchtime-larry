import type { SafeHtml } from "./dom.js";

export const BRAND: {
  de: string;
  en: string;
  ru: string;
  fa: string;
  ar: string;
};

export type GlossRow = {
  en?: string;
  ru?: string;
  fa?: string;
  ar?: string;
};

export type GlossContext = {
  lang?: string;
  words?: Record<string, GlossRow | undefined> | null;
};

export function isMit(word: string): boolean;
export function wordKey(word: string): string;
export function splitParts(text: string): Array<{ kind: string; text: string }>;
export function foodWords(name: string): string[];
export function lookupWord(
  words: Record<string, GlossRow | undefined> | null | undefined,
  word: string,
): GlossRow | undefined;
export function shownWord(word: string, gloss?: GlossContext | null): string;
export function plainWords(text: string, gloss?: GlossContext | null): string;
export function renderWords(text: string, gloss?: GlossContext | null): SafeHtml;
export function renderSides(sides: string[] | null | undefined, gloss?: GlossContext | null): SafeHtml;
export function readLang(): string;
export function writeLang(lang: string): void;
export function brandName(lang: string): string;
export function paintMasthead(title: HTMLElement | null | undefined): void;
