import { appendFile } from "node:fs/promises";
import { formatIsoDate, weekStartBerlin } from "./lib.ts";
import {
  CANTEENS,
  USER_AGENT,
  type CanteenId,
  type MenuData,
} from "./types.ts";

const PREV_MENU_URL =
  process.env.PREV_MENU_URL ??
  "https://herr-schulz.github.io/lunchtime-larry/data/menu.json";

export type PreviousMenu = Pick<
  MenuData,
  "weekStart" | "lastSuccessAt" | "sources"
>;

export type ScrapeDecision = {
  needed: boolean;
  reason: string;
};

export function isoDatePart(value: string | undefined): string | undefined {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

/** 0 Sun … 6 Sat in Europe/Berlin. */
export function berlinWeekday(date: Date): number {
  const berlinDate = formatIsoDate(date);
  const [y, m, d] = berlinDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

function sourcesOk(sources: PreviousMenu["sources"] | undefined): boolean {
  if (!sources) return false;
  return (Object.keys(CANTEENS) as CanteenId[]).every(
    (id) => sources[id]?.status === "ok",
  );
}

export function shouldScrape(
  now: Date,
  previous: PreviousMenu | undefined,
  opts: { force?: boolean } = {},
): ScrapeDecision {
  if (opts.force) return { needed: true, reason: "forced" };

  const weekStart = weekStartBerlin(now);
  if (!previous) return { needed: true, reason: "no previous menu" };
  if (previous.weekStart !== weekStart) {
    return { needed: true, reason: "live menu is from another week" };
  }
  if (!sourcesOk(previous.sources)) {
    return { needed: true, reason: "a source is error or stale" };
  }

  const today = formatIsoDate(now);
  const lastDay = isoDatePart(previous.lastSuccessAt);
  if (lastDay === today) {
    return { needed: false, reason: "already scraped today" };
  }
  return { needed: true, reason: "menu may have changed since yesterday" };
}

async function loadPrevious(): Promise<PreviousMenu | undefined> {
  try {
    const response = await fetch(PREV_MENU_URL, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!response.ok) return undefined;
    return (await response.json()) as MenuData;
  } catch {
    return undefined;
  }
}

async function main() {
  const force =
    process.env.FORCE_SCRAPE === "1" ||
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
  const decision = shouldScrape(new Date(), await loadPrevious(), { force });
  console.log(`${decision.needed ? "scrape" : "skip"}: ${decision.reason}`);
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    await appendFile(output, `needed=${decision.needed ? "true" : "false"}\n`);
  }
}

if (!process.env.VITEST) {
  await main();
}
