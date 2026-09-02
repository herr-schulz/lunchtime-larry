import { mkdir } from "node:fs/promises";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { USER_AGENT } from "./types.ts";

export const SCREENSHOT_DIR = "debug";

export async function launchBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
}> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1440, height: 1800 },
  });
  return { browser, context };
}

export async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

export async function dismissCookies(page: Page): Promise<void> {
  const candidates = [
    "#onetrust-reject-all-handler",
    "#onetrust-accept-btn-handler",
    "#onetrust-pc-btn-handler",
  ];
  for (const selector of candidates) {
    const button = page.locator(selector);
    if (await button.first().isVisible({ timeout: 1500 }).catch(() => false)) {
      await button.first().click({ timeout: 3000 }).catch(() => undefined);
      break;
    }
  }
  await page
    .evaluate(() => {
      document.querySelector("#onetrust-banner-sdk")?.remove();
      document.querySelector("#onetrust-consent-sdk")?.remove();
      document.querySelector(".onetrust-pc-dark-filter")?.remove();
    })
    .catch(() => undefined);
}
