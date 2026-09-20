import type { Page } from "playwright";
import { dismissCookies, screenshot } from "../browser.ts";
import { cleanText, isoWeek, weekdayDates, weekStartBerlin } from "../lib.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";
import {
  CARD_TITLE,
  POSTED_PRICE,
  SKIP_CATEGORIES,
  SKIP_NAMES,
  UNAVAILABLE,
  mapSodexoDishes,
  parseCalendarWeekLabel,
  tabMatchesIsoDate,
  tabToWeekday,
  type SodexoRaw,
} from "./sodexoParse.ts";

type DayTab = { weekday: Weekday; href: string; label: string };

const WEEK_SELECT = "mat-select";
const WEEK_OPTION = "mat-option, [role='option']";

async function pinSodexoCalendarWeek(page: Page, weekStart: string): Promise<void> {
  const target = isoWeek(weekStart);
  const combo = page.locator(WEEK_SELECT).filter({ hasText: /\b(?:CW|KW):/i }).first();
  await combo.waitFor({ timeout: 15_000 });

  const shown = parseCalendarWeekLabel(await combo.innerText());
  if (shown !== target) {
    await combo.click();
    const option = page.locator(WEEK_OPTION).filter({
      hasText: new RegExp(`(?:CW|KW):\\s*${target}\\b`, "i"),
    });
    if ((await option.count()) === 0) {
      await screenshot(page, "sodexo-wrong-week");
      throw new Error(
        `Sodexo: Kalenderwoche ${target} nicht im Dropdown (steht auf ${shown ?? "?"})`,
      );
    }
    await option.first().click();
  }

  const dates = weekdayDates(weekStart);
  try {
    await page.waitForFunction(
      ({ monday, expectedWeek }) => {
        const select = [...document.querySelectorAll("mat-select")].find((el) =>
          /\b(?:CW|KW):/i.test(el.textContent || ""),
        );
        const label = (select?.textContent || "").replace(/\s+/g, " ");
        const weekMatch = label.match(/\b(?:CW|KW):\s*(\d{1,2})\b/i);
        if (!weekMatch || Number(weekMatch[1]) !== expectedWeek) return false;
        const firstTab = document.querySelector(
          "app-menu-container a.mdc-tab, app-menu-container .mdc-tab",
        );
        const text = (firstTab?.textContent || "").replace(/\s+/g, " ");
        const match = text.match(/(\d{1,2})\.(\d{1,2})/);
        if (!match) return false;
        const parts = monday.split("-").map(Number);
        const month = parts[1];
        const day = parts[2];
        return Number(match[1]) === day && Number(match[2]) === month;
      },
      { monday: dates.monday, expectedWeek: target },
      { timeout: 15_000 },
    );
  } catch (error) {
    await screenshot(page, "sodexo-wrong-week");
    throw new Error(
      `Sodexo: Tabs gehören nicht zu KW ${target} / ${dates.monday} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

export async function scrapeSodexo(
  page: Page,
): Promise<Record<Weekday, Dish[]>> {
  const weekStart = weekStartBerlin();
  await page.goto(CANTEENS.sodexo.url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await dismissCookies(page);
  await page.locator("app-category, .product-card, mat-select").first().waitFor({ timeout: 25_000 });
  await dismissCookies(page);
  await pinSodexoCalendarWeek(page, weekStart);

  const tabs = page.locator("app-menu-container a.mdc-tab, app-menu-container .mdc-tab");
  const tabCount = await tabs.count();
  if (tabCount === 0) {
    await screenshot(page, "sodexo-no-tabs");
    throw new Error("Sodexo: keine Wochentags-Tabs gefunden");
  }

  const dayTabs: DayTab[] = [];
  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const label = cleanText((await tab.innerText()) || "");
    const weekday = tabToWeekday(label);
    const href = await tab.getAttribute("href");
    if (!weekday || !href) continue;
    dayTabs.push({ weekday, href, label });
  }
  if (dayTabs.length === 0) {
    await screenshot(page, "sodexo-no-days");
    throw new Error("Sodexo: Wochentags-Tabs ohne Datum-Links");
  }

  const expectedDates = weekdayDates(weekStart);
  const mismatched = dayTabs.filter(
    (day) => !tabMatchesIsoDate(day.label, expectedDates[day.weekday]),
  );
  if (mismatched.length) {
    await screenshot(page, "sodexo-wrong-week");
    const detail = mismatched
      .map((day) => `${day.label} ≠ ${expectedDates[day.weekday]}`)
      .join("; ");
    throw new Error(`Sodexo: Tages-Tabs passen nicht zur Berlin-Woche ${weekStart} (${detail})`);
  }

  const byDay = Object.fromEntries(WEEKDAYS.map((d) => [d, [] as Dish[]])) as Record<
    Weekday,
    Dish[]
  >;

  let previousSig = "";

  for (const day of dayTabs) {
    const url = new URL(day.href, page.url()).href;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await dismissCookies(page);
    await page.locator(".product-card").first().waitFor({ timeout: 25_000 });

    await page.evaluate(() => {
      const store = window as Window & {
        __larrySodexoSig?: string;
        __larrySodexoHits?: number;
      };
      store.__larrySodexoSig = "";
      store.__larrySodexoHits = 0;
    });

    try {
      await page.waitForFunction(
        ({ expected, previousSig: prior, titleSel }) => {
          const active = document.querySelector(
            "app-menu-container .mdc-tab--active, app-menu-container .mdc-tab[aria-selected='true']",
          );
          const activeLabel = (active?.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (expected && !activeLabel.startsWith(expected)) return false;

          const root =
            document.querySelector("mat-tab-nav-panel") ||
            document.querySelector(
              "mat-tab-body.mat-mdc-tab-body-active, .mat-mdc-tab-body-active, .mat-tab-body-active",
            ) ||
            document.querySelector("app-menu-container");
          if (!root) return false;

          const names: string[] = [];
          for (const card of root.querySelectorAll(".product-card")) {
            const style = getComputedStyle(card);
            if (style.display === "none" || style.visibility === "hidden") continue;
            if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
            const name = (
              card.querySelector(titleSel)?.textContent ||
              card.textContent ||
              ""
            )
              .replace(/\s+/g, " ")
              .trim();
            if (name) names.push(name);
          }
          if (names.length === 0) return false;
          const sig = names.slice().sort().join("\n");
          if (prior && sig === prior) return false;

          const store = window as Window & {
            __larrySodexoSig?: string;
            __larrySodexoHits?: number;
          };
          if (store.__larrySodexoSig === sig) {
            store.__larrySodexoHits = (store.__larrySodexoHits || 0) + 1;
          } else {
            store.__larrySodexoSig = sig;
            store.__larrySodexoHits = 1;
          }
          return store.__larrySodexoHits >= 3;
        },
        {
          expected: day.label.slice(0, 2).toLowerCase(),
          previousSig,
          titleSel: CARD_TITLE,
        },
        { timeout: 15_000, polling: 150 },
      );
    } catch (error) {
      await screenshot(page, `sodexo-tab-${day.weekday}`);
      throw new Error(
        `Sodexo: Tab ${day.label} hat den Inhalt nicht gewechselt (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    const { dishes, sig } = await page.evaluate(
      ({ skipCat, skipName, unavailable, titleSel, postedPrice }) => {
        const skipCatRe = new RegExp(skipCat, "i");
        const skipNameRe = new RegExp(skipName, "i");
        const unavailableRe = new RegExp(unavailable, "i");
        const out: SodexoRaw[] = [];
        const root =
          document.querySelector("mat-tab-nav-panel") ||
          document.querySelector(
            "mat-tab-body.mat-mdc-tab-body-active, .mat-mdc-tab-body-active, .mat-tab-body-active",
          ) ||
          document.querySelector("app-menu-container");
        if (!root) return { dishes: out, sig: "" };

        const names: string[] = [];
        for (const card of root.querySelectorAll(".product-card")) {
          const style = getComputedStyle(card);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
          const name = (card.querySelector(titleSel)?.textContent || "")
            .replace(/\s+/g, " ")
            .trim();
          if (name) names.push(name);
        }

        for (const category of root.querySelectorAll("app-category")) {
          const heading = category.querySelector("h2, h3, h4, h5");
          const categoryName = (heading?.textContent || "").replace(/\s+/g, " ").trim();
          if (skipCatRe.test(categoryName)) continue;

          for (const card of category.querySelectorAll(".product-card")) {
            const style = getComputedStyle(card);
            const text = (card.textContent || "").replace(/\s+/g, " ").trim();
            if (style.display === "none" || style.visibility === "hidden") continue;
            if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
            if (style.filter.includes("grayscale")) continue;
            if (unavailableRe.test(text)) continue;
            if (card.className.toLowerCase().match(/sold|unavailable|disabled|out-of-stock/)) {
              continue;
            }

            const name =
              (card.querySelector(titleSel)?.textContent || "").replace(/\s+/g, " ").trim() ||
              text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
            if (!name || skipNameRe.test(name)) continue;
            const priceMatch =
              text.match(/(\d+[.,]\d{2})\s*€/) || text.match(/€\s*(\d+[.,]\d{2})/);
            out.push({
              name,
              price: !priceMatch
                ? undefined
                : /^0[,.]00$/.test(priceMatch[1])
                  ? postedPrice
                  : `${priceMatch[1].replace(".", ",")} €`,
              category: categoryName,
              dietHint: text,
            });
          }
        }

        for (const card of root.querySelectorAll(".product-card")) {
          if (card.closest("app-category")) continue;
          const style = getComputedStyle(card);
          const text = (card.textContent || "").replace(/\s+/g, " ").trim();
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
          if (style.filter.includes("grayscale")) continue;
          if (unavailableRe.test(text)) continue;
          if (card.className.toLowerCase().match(/sold|unavailable|disabled|out-of-stock/)) {
            continue;
          }
          const name =
            (card.querySelector(titleSel)?.textContent || "").replace(/\s+/g, " ").trim() ||
            text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
          if (!name || skipNameRe.test(name)) continue;
          const priceMatch =
            text.match(/(\d+[.,]\d{2})\s*€/) || text.match(/€\s*(\d+[.,]\d{2})/);
          out.push({
            name,
            price: !priceMatch
              ? undefined
              : /^0[,.]00$/.test(priceMatch[1])
                ? postedPrice
                : `${priceMatch[1].replace(".", ",")} €`,
            category: "",
            dietHint: text,
          });
        }
        return { dishes: out, sig: names.slice().sort().join("\n") };
      },
      {
        skipCat: SKIP_CATEGORIES.source,
        skipName: SKIP_NAMES.source,
        unavailable: UNAVAILABLE.source,
        titleSel: CARD_TITLE,
        postedPrice: POSTED_PRICE,
      },
    );

    byDay[day.weekday] = mapSodexoDishes(dishes);
    previousSig = sig;
  }

  const dishCount = WEEKDAYS.reduce((n, d) => n + byDay[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "sodexo-empty");
    throw new Error("Sodexo: keine Gerichte nach Filter (Add-ons/Pizza entfernt)");
  }

  return byDay;
}
