import type { Page } from "playwright";
import { screenshot } from "../browser.ts";
import { CANTEENS, WEEKDAYS, type Dish, type Weekday } from "../types.ts";
import { parseBella23Html } from "./bella23Parse.ts";

export async function scrapeBella23(
  page: Page,
): Promise<Record<Weekday, Dish[]>> {
  await page.goto(CANTEENS.bella23.url, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.locator("#wochenkarte").waitFor({ timeout: 20_000 });

  const byDay = parseBella23Html(await page.content());
  const dishCount = WEEKDAYS.reduce((n, d) => n + byDay[d].length, 0);
  if (dishCount === 0) {
    await screenshot(page, "bella23-empty");
    throw new Error("Bella 23: Wochenkarte ohne Gerichte");
  }

  return byDay;
}
