import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { formatDishName } from "../site/boardRender.js";
import { foodWords } from "../site/words.js";
import {
  acceptTranslation,
  fillGlossary,
  type MenuWords,
} from "./glossary.ts";
import { WEEKDAYS, type MenuData } from "./types.ts";

const FIXTURE_KEY = "fixture-key";

const cake = { en: "cake", ru: "торт", fa: "کیک", ar: "كعكة" };
const tomato = { en: "tomato", ru: "помидор", fa: "گوجه", ar: "طماطم" };
const rice = { en: "rice", ru: "рис", fa: "برنج", ar: "أرز" };

function week(canteens: MenuData["days"]["monday"]["canteens"]): MenuData["days"] {
  const days = {} as MenuData["days"];
  for (const day of WEEKDAYS) {
    days[day] = {
      date: "2026-11-23",
      canteens: day === "monday" ? canteens : canteens.map((canteen) => ({ ...canteen, dishes: [] })),
    };
  }
  return days;
}

function menu(): MenuData {
  return {
    weekStart: "2026-11-23",
    scrapedAt: "2026-11-23T10:00:00+01:00",
    sources: {
      stmuv: { status: "ok" },
      sodexo: { status: "stale" },
      bella23: { status: "ok" },
    },
    days: week([
      {
        id: "stmuv",
        dishes: [
          { name: "Kuchen mit Tomate", diet: "unknown" },
          { name: "Kuchen mit Sahne", diet: "unknown" },
        ],
      },
      { id: "sodexo", dishes: [{ name: "Nudel mit Sauce", diet: "unknown" }] },
      { id: "bella23", dishes: [{ name: "Reis", diet: "unknown" }] },
    ]),
  };
}

function knownTomato(): MenuWords {
  return { Tomate: { ...tomato, en: "" } };
}

function reply(text: string) {
  return {
    ok: true,
    json: async () => ({
      responseStatus: 200,
      quotaFinished: false,
      responseData: { translatedText: text },
    }),
  };
}

describe("food words", () => {
  it("splits a dish into words and leaves mit out", () => {
    expect(foodWords("Kuchen mit Tomate")).toEqual(["Kuchen", "Tomate"]);
    expect(foodWords("Kuchen | Sahne / Reis")).toEqual(["Kuchen", "Sahne", "Reis"]);
    expect(foodWords("Kuchen mit Tomate")).not.toContain("mit");
  });

  it("sends only unknown words, and never mit", async () => {
    const calls: Array<{ q: string; pair: string; de: string }> = [];
    const lines: Record<string, string> = {
      "Kuchen|de|en": cake.en,
      "Kuchen|de|ru": cake.ru,
      "Kuchen|de|fa": cake.fa,
      "Kuchen|de|ar": cake.ar,
      "Reis|de|en": rice.en,
      "Reis|de|ru": rice.ru,
      "Reis|de|fa": rice.fa,
      "Reis|de|ar": rice.ar,
    };
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const q = url.searchParams.get("q") || "";
      const pair = url.searchParams.get("langpair") || "";
      calls.push({ q, pair, de: url.searchParams.get("de") || "" });
      if (q === "Sahne") return reply("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY");
      return reply(lines[`${q}|${pair}`] || "");
    };

    const words = await fillGlossary(menu(), knownTomato(), {
      key: FIXTURE_KEY,
      fetchImpl,
    });

    const sent = [...new Set(calls.map((call) => call.q))];
    expect(sent).toEqual(["Kuchen", "Sahne", "Reis"]);
    expect(sent).not.toContain("mit");
    expect(sent).not.toContain("Tomate");
    expect(sent).not.toContain("Nudel");
    expect(sent).not.toContain("Sauce");
    expect(calls.every((call) => !call.q.includes(" "))).toBe(true);
    expect(calls.every((call) => call.q !== "Kuchen mit Tomate")).toBe(true);
    expect(calls.map((call) => call.pair)).toEqual([
      "de|en",
      "de|ru",
      "de|fa",
      "de|ar",
      "de|en",
      "de|ru",
      "de|fa",
      "de|ar",
      "de|en",
      "de|ru",
      "de|fa",
      "de|ar",
    ]);
    expect(calls.every((call) => call.de === FIXTURE_KEY)).toBe(true);
    expect(JSON.stringify(words)).not.toContain(FIXTURE_KEY);
    expect(words.Tomate?.en).toBe("");
    expect(words.Kuchen).toEqual(cake);
    expect(words.Reis).toEqual(rice);
    expect(words.Sahne).toBeUndefined();

    calls.length = 0;
    const again = await fillGlossary(menu(), words, { key: FIXTURE_KEY, fetchImpl });
    expect(calls.map((call) => call.q)).toEqual(["Sahne", "Sahne", "Sahne", "Sahne"]);
    expect(again.Sahne).toBeUndefined();
    expect(again.Kuchen).toEqual(cake);
  });

  it("skips MyMemory when the key is unset and keeps German", async () => {
    const fetchImpl = async () => {
      throw new Error("should not be called");
    };
    const words = await fillGlossary(menu(), knownTomato(), { key: "  ", fetchImpl });
    expect(Object.keys(words)).toEqual(["Tomate"]);
    expect(words.Kuchen).toBeUndefined();
  });
});

describe("acceptTranslation", () => {
  it("drops an empty reply, a quota warning, and a reply over 500 bytes", () => {
    expect(acceptTranslation({ responseStatus: 200, responseData: { translatedText: "  " } })).toBe("");
    expect(
      acceptTranslation({
        responseStatus: 200,
        quotaFinished: true,
        responseData: { translatedText: "cake" },
      }),
    ).toBe("");
    expect(
      acceptTranslation({
        responseStatus: 429,
        responseData: { translatedText: "cake" },
      }),
    ).toBe("");
    expect(acceptTranslation({ responseStatus: 200, responseData: { translatedText: "x".repeat(501) } })).toBe("");
    expect(acceptTranslation({ responseStatus: 200, responseData: { translatedText: "cake" } })).toBe("cake");
  });
});

function textOf(markup: unknown) {
  const { document } = parseHTML(`<div>${String(markup)}</div>`);
  return document;
}

describe("dish words on the slip", () => {
  const words = { Kuchen: cake, Tomate: { ...tomato, en: "" } };

  it("falls back to the German word when a translation is missing", () => {
    const document = textOf(formatDishName("Kuchen mit Tomate", "sodexo", { lang: "en", words }));
    const shown = [...document.querySelectorAll(".food-text")].map((node) => node.textContent);
    expect(shown).toEqual(["cake"]);
    expect(document.querySelector(".dish-sides")?.textContent).toContain("Tomate");
    expect(document.querySelector(".dish-sides .food-word")).toBeNull();
    expect(document.querySelector(".dish-sides .food-gloss")).toBeNull();
  });

  it("puts the hover line on that one word", () => {
    const english = textOf(
      formatDishName("Kuchen mit Tomate", "sodexo", {
        lang: "en",
        words: { Kuchen: cake, Tomate: tomato },
      }),
    );
    const lines = [...english.querySelectorAll(".food-word")].map((node) => ({
      word: node.querySelector(".food-text")?.textContent,
      line: node.querySelector(".food-gloss")?.textContent,
    }));
    expect(lines).toEqual([
      { word: "cake", line: "Kuchen" },
      { word: "tomato", line: "Tomate" },
    ]);
    expect(lines.every((item) => item.line && !item.line.includes(" "))).toBe(true);
    expect(english.querySelector(".food-gloss")?.textContent).not.toContain("mit");
    expect(english.querySelector(".dish-sides")?.textContent?.startsWith("mit ")).toBe(true);
    expect(english.querySelector(".food-word .food-text")?.textContent).not.toContain("Tomate");

    const german = textOf(
      formatDishName("Kuchen mit Tomate", "sodexo", {
        lang: "de",
        words: { Kuchen: cake, Tomate: tomato },
      }),
    );
    const kuchen = german.querySelector(".food-word");
    const gloss = kuchen?.querySelector(".food-gloss");
    expect(kuchen?.querySelector(".food-text")?.textContent).toBe("Kuchen");
    expect(gloss?.textContent).toContain("EN");
    expect(gloss?.textContent).toContain("cake");
    expect(gloss?.textContent).not.toContain("tomato");
    expect(gloss?.textContent).not.toContain("Tomate");
    expect(gloss?.textContent).not.toContain("mit");
    expect(kuchen?.getAttribute("dir")).toBeNull();
    expect(german.querySelector(".dish-title")?.getAttribute("dir")).toBeNull();
    expect(gloss?.querySelector("bdi[dir='rtl'][lang='fa']")?.textContent).toBe(cake.fa);

    const persian = textOf(
      formatDishName("Kuchen", "sodexo", { lang: "fa", words: { Kuchen: cake } }),
    );
    const word = persian.querySelector(".food-word");
    expect(word?.getAttribute("dir")).toBe("rtl");
    expect(word?.querySelector(".food-gloss")?.getAttribute("dir")).toBe("ltr");
    expect(word?.querySelector(".food-gloss")?.textContent).toBe("Kuchen");
    expect(persian.querySelector(".dish-title")?.getAttribute("dir")).toBeNull();
  });
});
