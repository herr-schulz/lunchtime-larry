import type { Browser, BrowserContext, Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import {
  COOKIE_KNOWN_SELECTORS,
  COOKIE_OVERLAY_LOCATOR,
  pickCookieButton,
} from "./cookies.ts";
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

/** Auto-click consent banners whenever they appear (Everyday, OneTrust, …). */
export async function armCookieDismiss(page: Page): Promise<void> {
  await page.addLocatorHandler(page.locator(COOKIE_OVERLAY_LOCATOR), async () => {
    await dismissCookies(page);
  });
}

export async function newScrapingPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await armCookieDismiss(page);
  return page;
}

export async function dismissCookies(page: Page): Promise<void> {
  for (const selector of COOKIE_KNOWN_SELECTORS) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3000 }).catch(() => undefined);
      return;
    }
  }

  const labels = await page
    .evaluate(() => {
      const nodes = document.querySelectorAll(
        "button, [role='button'], input[type='button'], input[type='submit']",
      );
      return [...nodes].map((node) => {
        const el = node as HTMLElement & { value?: string };
        return (el.innerText || el.textContent || el.value || "").replace(/\s+/g, " ").trim();
      });
    })
    .catch(() => [] as string[]);

  const picked = pickCookieButton(labels.map((label) => ({ label })));
  if (picked?.label) {
    const named = page.getByRole("button", { name: picked.label, exact: true });
    if (await named.first().isVisible({ timeout: 800 }).catch(() => false)) {
      await named.first().click({ timeout: 3000 }).catch(() => undefined);
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
