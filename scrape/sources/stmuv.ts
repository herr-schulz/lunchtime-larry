import type { Page } from "playwright";
import {
  inferDiet,
  parseGermanPrice,
  stripDietLabels,
  type Weekday,
} from "../lib.ts";
import type { Dish } from "../types.ts";
import { WEEKDAYS } from "../types.ts";
import { CANTEENS } from "../types.ts";
import { screenshot } from "../browser.ts";

export async function scrapeStmuv(
  page: Page,
): Promise<Record<Weekday, Dish[]>> {
  await page.goto(CANTEENS.stmuv.url, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.locator("#table tbody tr").first().waitFor({ timeout: 20_000 });

  const days = await page.evaluate(() => {
    const weekdayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
    const result: Record<(typeof weekdayKeys)[number], { name: string; price?: string; category: string; veganIcon: boolean }[]> =
      {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
      };

    const rows = [...document.querySelectorAll("#table tbody tr")];
    for (const row of rows) {
      const cells = [...row.querySelectorAll(":scope > td")];
      if (cells.length < 6) continue;
      const header = cells[0];
      const category = (header.querySelector(".column-header")?.textContent || "").replace(/\s+/g, " ").trim();
      const headerPrice = header.textContent?.match(/(\d+[.,]\d{2})\s*€/)?.[1];

      for (let i = 0; i < 5; i++) {
        const cell = cells[i + 1];
        const nameEl = cell.querySelector(".suppe, .menue");
        const name = (nameEl?.textContent || "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        const cellPrice = cell.querySelector("span")?.textContent || "";
        const veganIcon = Boolean(cell.querySelector('img[src*="vegan"]'));
        result[weekdayKeys[i]].push({
          name,
          price: cellPrice || (headerPrice ? `${headerPrice} €` : undefined),
          category,
          veganIcon,
        });
      }
    }

    const desserts = [...document.querySelectorAll(".dessert strong")]
      .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => t && !/wochendessert/i.test(t));

    return { result, desserts };
  });

  const mapped = Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      days.result[day].map((raw) => {
        const price = parseGermanPrice(raw.price || "") || parseGermanPrice(raw.name);
        let diet = inferDiet(raw.name);
        if (raw.veganIcon) diet = "vegan";
        return {
          name: stripDietLabels(raw.name.replace(/\d+[.,]\d{2}\s*€/g, "")),
          price,
          diet,
          category: raw.category,
        } satisfies Dish;
      }),
    ]),
  ) as Record<Weekday, Dish[]>;

  const desserts: Dish[] = days.desserts.map((line) => ({
    name: stripDietLabels(line.replace(/\d+[.,]\d{2}\s*€/g, "")),
    price: parseGermanPrice(line),
    diet: inferDiet(line),
    category: "Dessert",
  }));

  if (desserts.length) {
    for (const day of WEEKDAYS) mapped[day].push(...desserts);
  }

  const dishCount = WEEKDAYS.reduce((n, d) => n + mapped[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "stmuv-empty");
    throw new Error("StMUV-Tabelle ohne Gerichte");
  }

  return mapped;
}
