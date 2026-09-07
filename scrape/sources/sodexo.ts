import type { Page } from "playwright";
import { dismissCookies, screenshot } from "../browser.ts";
import { cleanText } from "../lib.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";
import {
  SKIP_CATEGORIES,
  SKIP_NAMES,
  UNAVAILABLE,
  mapSodexoDishes,
  tabToWeekday,
  type SodexoRaw,
} from "./sodexoParse.ts";

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

  const byDay = Object.fromEntries(WEEKDAYS.map((d) => [d, [] as Dish[]])) as Record<
    Weekday,
    Dish[]
  >;

  let previousSig = "";

  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const label = cleanText((await tab.innerText()) || "");
    const weekday = tabToWeekday(label);
    if (!weekday) continue;

    await tab.click();
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
        ({ expected, previousSig: prior }) => {
          const active = document.querySelector(
            "app-menu-container .mdc-tab--active, app-menu-container .mdc-tab[aria-selected='true']",
          );
          const activeLabel = (active?.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          if (!activeLabel.startsWith(expected)) return false;

          const panel = document.querySelector(
            "mat-tab-body.mat-mdc-tab-body-active, .mat-mdc-tab-body-active, .mat-tab-body-active",
          );
          const visible = document.querySelector(
            "[role='tabpanel']:not([aria-hidden='true'])",
          );
          const bodies = document.querySelectorAll("mat-tab-body, [role='tabpanel']");
          const root =
            panel || visible || (bodies.length > 1 ? null : document.querySelector("app-menu-container"));
          if (!root) return false;

          const names: string[] = [];
          for (const card of root.querySelectorAll(".product-card")) {
            const hidden = card.closest("[aria-hidden='true'], [hidden]");
            if (hidden && hidden !== root) continue;
            const style = getComputedStyle(card);
            if (style.display === "none" || style.visibility === "hidden") continue;
            if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
            const name = (
              card.querySelector("mat-card-title, .product-name, h3, h4")?.textContent || ""
            )
              .replace(/\s+/g, " ")
              .trim();
            if (name) names.push(name);
          }
          if (names.length === 0) return false;
          const sig = names.toSorted().join("\n");
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
        { expected: label.slice(0, 2).toLowerCase(), previousSig },
        { timeout: 15_000, polling: 150 },
      );
    } catch (error) {
      await screenshot(page, `sodexo-tab-${weekday}`);
      throw new Error(
        `Sodexo: Tab ${label} hat den Inhalt nicht gewechselt (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    const { dishes, sig } = await page.evaluate(
      ({ skipCat, skipName, unavailable }) => {
        const skipCatRe = new RegExp(skipCat, "i");
        const skipNameRe = new RegExp(skipName, "i");
        const unavailableRe = new RegExp(unavailable, "i");
        const out: SodexoRaw[] = [];
        const panel = document.querySelector(
          "mat-tab-body.mat-mdc-tab-body-active, .mat-mdc-tab-body-active, .mat-tab-body-active",
        );
        const visible = document.querySelector(
          "[role='tabpanel']:not([aria-hidden='true'])",
        );
        const bodies = document.querySelectorAll("mat-tab-body, [role='tabpanel']");
        const root =
          panel || visible || (bodies.length > 1 ? null : document.querySelector("app-menu-container"));
        if (!root) return { dishes: out, sig: "" };

        const names: string[] = [];
        for (const card of root.querySelectorAll(".product-card")) {
          const hidden = card.closest("[aria-hidden='true'], [hidden]");
          if (hidden && hidden !== root) continue;
          const style = getComputedStyle(card);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (style.opacity !== "" && Number(style.opacity) < 0.7) continue;
          const name = (
            card.querySelector("mat-card-title, .product-name, h3, h4")?.textContent || ""
          )
            .replace(/\s+/g, " ")
            .trim();
          if (name) names.push(name);
        }

        for (const category of root.querySelectorAll("app-category")) {
          const heading = category.querySelector("h2, h3, h4, h5");
          const categoryName = (heading?.textContent || "").replace(/\s+/g, " ").trim();
          if (skipCatRe.test(categoryName)) continue;

          for (const card of category.querySelectorAll(".product-card")) {
            const buried = card.closest("[aria-hidden='true'], [hidden]");
            if (buried && buried !== root) continue;
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
              (card.querySelector("mat-card-title, .product-name, h3, h4")?.textContent || "")
                .replace(/\s+/g, " ")
                .trim() || text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
            if (!name || skipNameRe.test(name) || skipNameRe.test(categoryName)) continue;

            const priceMatch = text.match(/(\d+[.,]\d{2})\s*€/);
            if (priceMatch && /^0[,.]00$/.test(priceMatch[1])) continue;
            out.push({
              name,
              price: priceMatch ? `${priceMatch[1].replace(".", ",")} €` : undefined,
              category: categoryName,
              dietHint: text,
            });
          }
        }
        return { dishes: out, sig: names.toSorted().join("\n") };
      },
      {
        skipCat: SKIP_CATEGORIES.source,
        skipName: SKIP_NAMES.source,
        unavailable: UNAVAILABLE.source,
      },
    );

    byDay[weekday] = mapSodexoDishes(dishes);
    previousSig = sig;
  }

  const dishCount = WEEKDAYS.reduce((n, d) => n + byDay[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "sodexo-empty");
    throw new Error("Sodexo: keine Gerichte nach Filter (Add-ons/Pizza entfernt)");
  }

  return byDay;
}
