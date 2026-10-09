import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cacheNameFor,
  isStaleShell,
  remoteBuildFrom,
  shouldBypassCache,
  staleShellCopy,
} from "../site/updateShell.js";

describe("stale shell", () => {
  it("flags a newer build without advertising a seat count", () => {
    expect(isStaleShell("44", "45")).toBe(true);
    expect(isStaleShell("44", "44")).toBe(false);
    expect(isStaleShell("44", "")).toBe(false);
    expect(remoteBuildFrom({ build: "45" })).toBe("45");
    expect(staleShellCopy().line).not.toMatch(/\d/);
    expect(staleShellCopy().action).toBe("Neu laden");
  });

  it("bypasses HTML, the worker, and version.json so a cache cannot stick", () => {
    expect(cacheNameFor("44")).toBe("larry-shell-v44");
    expect(shouldBypassCache("/version.json")).toBe(true);
    expect(shouldBypassCache("/lunchtime-larry/version.json")).toBe(true);
    expect(shouldBypassCache("/sw.js")).toBe(true);
    expect(shouldBypassCache("/index.html")).toBe(true);
    expect(shouldBypassCache("/lunchtime-larry/")).toBe(true);
    expect(shouldBypassCache("/vote.js")).toBe(false);
  });

  it("puts the reload toast on the board", () => {
    const html = readFileSync("site/index.html", "utf8");
    expect(html).toContain('id="update-reload"');
    expect(html).toContain("Alter Zettel");
  });
});
