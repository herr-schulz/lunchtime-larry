import { describe, expect, it } from "vitest";
import { menuFreshNote, nextLookLine, unlikeAck } from "../site/larryLines.js";

describe("nextLookLine", () => {
  it("promises 10 o'clock after the 8:30 slot", () => {
    expect(nextLookLine(8, "monday")).toContain("10 Uhr");
    expect(nextLookLine(9, "wednesday")).toContain("10 Uhr");
  });

  it("promises 11:30 after 10", () => {
    expect(nextLookLine(10, "monday")).toContain("11:30");
    expect(nextLookLine(11, "wednesday")).toContain("11:30");
  });

  it("gives up after noon on a crawl day", () => {
    expect(nextLookLine(12, "monday")).toMatch(/hakt/);
  });

  it("does not promise extra looks on other weekdays", () => {
    expect(nextLookLine(8, "tuesday")).toMatch(/hakt/);
    expect(nextLookLine(9, "friday")).toMatch(/hakt/);
  });
});

describe("menuFreshNote", () => {
  it("names a broken canteen and the next look on monday morning", () => {
    const note = menuFreshNote({
      issueNames: ["Dave B"],
      hour: 8,
      weekday: "monday",
    });
    expect(note?.line).toContain("Dave B");
    expect(note?.line).toContain("10 Uhr");
  });

  it("uses the stuck line after noon", () => {
    const note = menuFreshNote({
      issueNames: ["Dave B"],
      hour: 12,
      weekday: "monday",
    });
    expect(note?.line).toContain("Dave B");
    expect(note?.line).toMatch(/nicht mehr durch/);
    expect(note?.line).not.toContain("11:30");
  });

  it("stays quiet when every source is fine", () => {
    expect(
      menuFreshNote({ issueNames: [], hour: 8, weekday: "monday" }),
    ).toBeNull();
  });
});

describe("unlikeAck", () => {
  it("mentions the dish that left the list", () => {
    const note = unlikeAck("Currywurst");
    expect(note.kicker).toBe("Gestrichen");
    expect(note.line).toContain("Currywurst");
  });
});
