import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const yaml = readFileSync(new URL("../.github/workflows/scrape.yml", import.meta.url), "utf8");
const dispatch = readFileSync(new URL("../scripts/dispatch-scrape.sh", import.meta.url), "utf8");

type Slot = { cron: string; timezone: string };

function scheduleSlots(source: string): Slot[] {
  const onBlock = source.split(/\njobs:/)[0] ?? source;
  const slots: Slot[] = [];
  const re = /- cron: ["']([^"']+)["']\n {6}timezone: ["']([^"']+)["']/g;
  for (const match of onBlock.matchAll(re)) {
    slots.push({ cron: match[1], timezone: match[2] });
  }
  return slots;
}

describe("scrape triggers", () => {
  const slots = scheduleSlots(yaml);

  it("keeps GitHub schedule as a single Berlin 07:44 weekday backup, not on the hour", () => {
    expect(slots).toEqual([{ cron: "44 7 * * 1-5", timezone: "Europe/Berlin" }]);
  });

  it("accepts workflow_dispatch and repository_dispatch scrape kicks", () => {
    expect(yaml).toMatch(/^\s+workflow_dispatch:/m);
    expect(yaml).toMatch(/repository_dispatch:\n\s+types: \[scrape\]/);
    expect(yaml).toMatch("github.event_name == 'repository_dispatch'");
  });

  it("points the external kick at workflow_dispatch on main", () => {
    expect(dispatch).toContain(
      "https://api.github.com/repos/herr-schulz/lunchtime-larry/actions/workflows/scrape.yml/dispatches",
    );
    expect(dispatch).toContain(`{"ref":"main"}`);
  });
});
