import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const yaml = readFileSync(new URL("../.github/workflows/scrape.yml", import.meta.url), "utf8");

type Slot = { cron: string; timezone: string };

function scheduleSlots(source: string): Slot[] {
  const onBlock = source.split(/\njobs:/)[0] ?? source;
  const slots: Slot[] = [];
  const re =
    /- cron: ["']([^"']+)["']\n {6}timezone: ["']([^"']+)["']/g;
  for (const match of onBlock.matchAll(re)) {
    slots.push({ cron: match[1], timezone: match[2] });
  }
  return slots;
}

function fields(cron: string): string[] {
  const parts = cron.trim().split(/\s+/);
  expect(parts, cron).toHaveLength(5);
  return parts;
}

function expandList(field: string): number[] {
  const values: number[] = [];
  for (const part of field.split(",")) {
    if (part === "*") continue;
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let n = start; n <= end; n++) values.push(n);
    } else {
      values.push(Number(part));
    }
  }
  return values;
}

function covers(slot: Slot, hour: number, weekday: number): boolean {
  const [, hours, , , dow] = fields(slot.cron);
  const hourOk = hours === "*" || expandList(hours).includes(hour);
  const dayOk = dow === "*" || expandList(dow).includes(weekday);
  return hourOk && dayOk;
}

describe("scrape.yml schedule", () => {
  const slots = scheduleSlots(yaml);

  it("declares POSIX cron slots with Europe/Berlin (GitHub timezone field)", () => {
    expect(slots.length).toBeGreaterThanOrEqual(3);
    for (const slot of slots) {
      expect(slot.timezone).toBe("Europe/Berlin");
      expect(fields(slot.cron)).toHaveLength(5);
    }
  });

  it("avoids minute 0 because GitHub drops jobs at the start of the hour", () => {
    for (const slot of slots) {
      const minutes = expandList(fields(slot.cron)[0]);
      expect(minutes.length).toBeGreaterThan(0);
      expect(minutes).not.toContain(0);
    }
  });

  it("fires Monday 08:17 and 09:17 Berlin, plus a 14:17 same-day retry", () => {
    const monday = 1;
    expect(slots.some((slot) => covers(slot, 8, monday))).toBe(true);
    expect(slots.some((slot) => covers(slot, 9, monday))).toBe(true);
    expect(slots.some((slot) => covers(slot, 14, monday))).toBe(true);
  });
});
