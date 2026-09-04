import { mkdir, writeFile } from "node:fs/promises";
import { launchBrowser, screenshot } from "./browser.ts";
import { formatIsoDateTime, weekStartBerlin, weekdayDates } from "./lib.ts";
import { assessSource } from "./sanity.ts";
import { scrapeBella23 } from "./sources/bella23.ts";
import { scrapeSodexo } from "./sources/sodexo.ts";
import { scrapeStmuv } from "./sources/stmuv.ts";
import {
  CANTEENS,
  WEEKDAYS,
  type CanteenId,
  type Dish,
  type MenuData,
  type SourceMeta,
  type Weekday,
} from "./types.ts";

const PREV_MENU_URL =
  process.env.PREV_MENU_URL ??
  "https://herr-schulz.github.io/lunchtime-larry/data/menu.json";
const OUT_FILE = "site/data/menu.json";

type SourceResult =
  | { id: CanteenId; ok: true; dishes: Record<Weekday, Dish[]> }
  | { id: CanteenId; ok: false; error: string };

async function loadPrevious(): Promise<MenuData | undefined> {
  try {
    const response = await fetch(PREV_MENU_URL, {
      headers: { "user-agent": "LunchtimeLarry/1.0" },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as MenuData;
  } catch {
    return undefined;
  }
}

function emptyDays(weekStart: string): MenuData["days"] {
  const dates = weekdayDates(weekStart);
  const days = {} as MenuData["days"];
  for (const day of WEEKDAYS) {
    days[day] = {
      date: dates[day],
      canteens: (Object.keys(CANTEENS) as CanteenId[]).map((id) => ({
        id,
        dishes: [],
      })),
    };
  }
  return days;
}

function dishesFor(
  days: MenuData["days"],
  id: CanteenId,
): Record<Weekday, Dish[]> {
  return Object.fromEntries(
    WEEKDAYS.map((day) => {
      const found = days[day].canteens.find((c) => c.id === id);
      return [day, found?.dishes ?? []];
    }),
  ) as Record<Weekday, Dish[]>;
}

async function main() {
  const scrapedAt = formatIsoDateTime(new Date());
  const weekStart = weekStartBerlin();
  const previous = await loadPrevious();

  const { browser, context } = await launchBrowser();
  const results: SourceResult[] = [];

  const jobs: {
    id: CanteenId;
    run: (page: Awaited<ReturnType<typeof context.newPage>>) => Promise<Record<Weekday, Dish[]>>;
  }[] = [
    { id: "stmuv", run: scrapeStmuv },
    { id: "sodexo", run: scrapeSodexo },
    { id: "bella23", run: scrapeBella23 },
  ];

  for (const job of jobs) {
    const page = await context.newPage();
    try {
      const dishes = await job.run(page);
      const previousDishes = previous ? dishesFor(previous.days, job.id) : undefined;
      const health = assessSource(dishes, previousDishes);
      if (!health.ok) {
        throw new Error(health.reason);
      }
      results.push({ id: job.id, ok: true, dishes });
      console.log(`ok ${job.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await screenshot(page, `${job.id}-error`).catch(() => undefined);
      results.push({ id: job.id, ok: false, error: message });
      console.error(`fail ${job.id}:`, message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const sources = {} as Record<CanteenId, SourceMeta>;
  const mergedDishes = {} as Record<CanteenId, Record<Weekday, Dish[]>>;

  for (const result of results) {
    if (result.ok) {
      sources[result.id] = { status: "ok", scrapedAt };
      mergedDishes[result.id] = result.dishes;
      continue;
    }

    const sameWeek = previous?.weekStart === weekStart;
    const fallback = previous ? dishesFor(previous.days, result.id) : undefined;
    const hasFallback = fallback && WEEKDAYS.some((d) => fallback[d].length > 0);

    if (sameWeek && hasFallback && fallback) {
      sources[result.id] = {
        status: "stale",
        error: result.error,
        scrapedAt: previous?.sources[result.id]?.scrapedAt,
      };
      mergedDishes[result.id] = fallback;
    } else {
      sources[result.id] = { status: "error", error: result.error };
      mergedDishes[result.id] = Object.fromEntries(
        WEEKDAYS.map((d) => [d, [] as Dish[]]),
      ) as Record<Weekday, Dish[]>;
    }
  }

  const anyOk = results.some((r) => r.ok);
  const menu: MenuData = {
    weekStart,
    scrapedAt,
    lastSuccessAt: anyOk
      ? scrapedAt
      : previous?.lastSuccessAt ?? previous?.scrapedAt,
    sources,
    days: emptyDays(weekStart),
  };

  for (const day of WEEKDAYS) {
    menu.days[day].canteens = (Object.keys(CANTEENS) as CanteenId[]).map((id) => ({
      id,
      dishes: mergedDishes[id][day],
    }));
  }

  await mkdir("site/data", { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT_FILE} week ${weekStart}`);

  if (!anyOk) {
    console.error("all sources failed — page will show error banners");
  }
}

await main();
