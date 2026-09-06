import { describe, expect, it } from "vitest";
import { isLikelyOpenToday } from "../site/locations.js";

describe("isLikelyOpenToday", () => {
  it("treats täglich and Mo–So as always open", () => {
    expect(isLikelyOpenToday("täglich ab 11:30", "sunday")).toBe(true);
    expect(isLikelyOpenToday("Mo–So 9–22", "saturday")).toBe(true);
  });

  it("respects weekday ranges", () => {
    expect(isLikelyOpenToday("Mo–Fr 8–19", "monday")).toBe(true);
    expect(isLikelyOpenToday("Mo–Fr 8–19", "saturday")).toBe(false);
    expect(isLikelyOpenToday("Di–Fr 11:30–14:30", "monday")).toBe(false);
    expect(isLikelyOpenToday("Di–Fr 11:30–14:30", "tuesday")).toBe(true);
  });
});
