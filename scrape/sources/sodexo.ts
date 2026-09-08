import type { Page } from "playwright";
import { dismissCookies, screenshot } from "../browser.ts";
import { cleanText } from "../lib.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";
import {
  CARD_TITLE,
  POSTED_PRICE,
  SKIP_CATEGORIES,
  SKIP_NAMES,
  UNAVAILABLE,
  mapSodexoDishes,
  tabToWeekday,
  type SodexoRaw,
} from "./sodexoParse.ts";

type DayTab = { weekday: Weekday; href: string; label: string };

export async function scrapeSodexo(
  page: Page,
): Promise<Record<Weekday, Dish[]>> {
  await page.goto(CANTEENS.sodexo.url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await dismissCookies(page);
  await page.locator("app-category, .product-card").first().waitFor({ timeout: 25_000 });
  await dismissCookies(page);

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
