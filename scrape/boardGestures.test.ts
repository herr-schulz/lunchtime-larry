import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canDaySwipe } from "../site/boardGestures.js";

describe("canDaySwipe", () => {
  it("allows fingers and pens, not a mouse drag", () => {
    expect(canDaySwipe("touch")).toBe(true);
    expect(canDaySwipe("pen")).toBe(true);
    expect(canDaySwipe("mouse")).toBe(false);
    expect(canDaySwipe("")).toBe(false);
  });

  it("gates day changes on pointer type in the board handler", () => {
    const source = readFileSync("site/boardGestures.js", "utf8");
    expect(source).toMatch(/canDaySwipe\(origin\.type\)/);
    expect(source).toMatch(/canDaySwipe\(type\)/);
  });
});
