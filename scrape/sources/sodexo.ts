import type { Page } from "playwright";
import { dismissCookies, screenshot } from "../browser.ts";
import { cleanText, inferDiet, parseGermanPrice, stripDietLabels } from "../lib.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";

const SKIP_CATEGORIES = /add\s*on|beilage|topping|^pizza$/i;
const SKIP_NAMES = /topping|add\s*on|al gusto|geschlossen/i;
const UNAVAILABLE = /nicht\s*(verfügbar|im angebot)|ausverkauft|sold\s*out/i;

function tabToWeekday(label: string): Weekday | undefined {
  const lower = label.toLowerCase();
  if (lower.startsWith("mo")) return "monday";
  if (lower.startsWith("di")) return "tuesday";
  if (lower.startsWith("mi")) return "wednesday";
  if (lower.startsWith("do")) return "thursday";
  if (lower.startsWith("fr")) return "friday";
  return undefined;
}

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

  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const label = cleanText((await tab.innerText()) || "");
    const weekday = tabToWeekday(label);
    if (!weekday) continue;

    await tab.click();
    await page.waitForTimeout(800);
    await page.locator(".product-card").first().waitFor({ timeout: 12_000 });

    const dishes = await page.evaluate(
      ({ skipCat, skipName, unavailable }) => {
        const skipCatRe = new RegExp(skipCat, "i");
        const skipNameRe = new RegExp(skipName, "i");
        const unavailableRe = new RegExp(unavailable, "i");
        const out: { name: string; price?: string; category: string; dietHint: string }[] = [];

        for (const category of document.querySelectorAll("app-category")) {
          const heading = category.querySelector("h2, h3, h4, h5");
          const categoryName = (heading?.textContent || "").replace(/\s+/g, " ").trim();
          if (skipCatRe.test(categoryName)) continue;

          for (const card of category.querySelectorAll(".product-card")) {
            const style = getComputedStyle(card);
            const text = (card.textContent || "").replace(/\s+/g, " ").trim();
            if (Number(style.opacity) < 0.7) continue;
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
        return out;
      },
      {
        skipCat: SKIP_CATEGORIES.source,
        skipName: SKIP_NAMES.source,
        unavailable: UNAVAILABLE.source,
      },
    );

    byDay[weekday] = dishes.map((raw) => {
      let diet = inferDiet(`${raw.name} ${raw.dietHint} ${raw.category}`);
      if (/ingreen/i.test(raw.category) && diet === "unknown") diet = "veggie";
      const category = /dessert/i.test(raw.category) ? "Dessert" : raw.category;
      return {
        name: stripDietLabels(raw.name),
        price: raw.price || parseGermanPrice(raw.name),
        diet,
        category,
      };
    });
  }

  const dishCount = WEEKDAYS.reduce((n, d) => n + byDay[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "sodexo-empty");
    throw new Error("Sodexo: keine Gerichte nach Filter (Add-ons/Pizza entfernt)");
  }

  return byDay;
}
