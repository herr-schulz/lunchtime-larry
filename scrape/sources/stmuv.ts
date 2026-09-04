import type { Page } from "playwright";
import { screenshot } from "../browser.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";
import { parseStmuvHtml } from "./stmuvParse.ts";

export async function scrapeStmuv(
  page: Page,
): Promise<Record<Weekday, Dish[]>> {
  await page.goto(CANTEENS.stmuv.url, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.locator("#table tbody tr").first().waitFor({ timeout: 20_000 });

  const mapped = parseStmuvHtml(await page.content());
  const dishCount = WEEKDAYS.reduce((n, d) => n + mapped[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "stmuv-empty");
    throw new Error("StMUV-Tabelle ohne Gerichte");
  }

  return mapped;
}
