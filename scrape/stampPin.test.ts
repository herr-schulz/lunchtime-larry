import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applyStampPin, stampFrame, stampInFlow, stampVisibleAt } from "../site/visits.js";

function baseStampRule(css: string) {
  const start = css.indexOf(".aufruf-stamp {");
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("Aufrufe stamp pin", () => {
  it("is fixed to the viewport and out of normal flow", () => {
    const css = baseStampRule(readFileSync("site/styles.css", "utf8"));
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/position:\s*(relative|static|sticky|absolute)/);
    expect(css).toMatch(/100vw/);

    const narrow = stampFrame(390);
    const wide = stampFrame(1280);
    expect(narrow.position).toBe("fixed");
    expect(narrow.flow).toBe(false);
    expect(stampInFlow(narrow.position)).toBe(false);
    expect(stampInFlow("relative")).toBe(true);
    expect(wide.maxWidth).toBeGreaterThan(narrow.maxWidth);

    const { document } = parseHTML(`<a class="aufruf-stamp" href="./strichliste.html"></a>`);
    const stamp = document.querySelector("a");
    if (!stamp) throw new Error("stamp");
    const hidden = applyStampPin(stamp, { viewWidth: 390, scrollY: 0, mastheadBottom: 240 });
    expect(hidden.position).toBe("fixed");
    expect(hidden.flow).toBe(false);
    expect(stamp.style.position).toBe("fixed");
    expect(stamp.dataset.flow).toBe("out");
    expect(stampInFlow(stamp.style.position)).toBe(false);

    const shown = applyStampPin(stamp, { viewWidth: 1280, scrollY: 900, mastheadBottom: -12 });
    expect(shown.position).toBe("fixed");
    expect(stamp.style.position).toBe("fixed");
    expect(stamp.dataset.flow).toBe("out");
    expect(shown.maxWidth).toBeGreaterThan(hidden.maxWidth);
  });

  it("stays hidden while the top of the board is on screen", () => {
    expect(stampVisibleAt({ scrollY: 0, mastheadBottom: 280 })).toBe(false);
    expect(stampVisibleAt({ scrollY: 20, mastheadBottom: 180 })).toBe(false);
    expect(stampVisibleAt({ scrollY: 640, mastheadBottom: -8 })).toBe(true);
    const css = readFileSync("site/styles.css", "utf8");
    expect(css).toMatch(/\.aufruf-stamp:not\(\.is-showing\)|\.aufruf-stamp \{[^}]*visibility:\s*hidden/);
    expect(css).toMatch(/\.aufruf-stamp\.is-showing \{[^}]*visibility:\s*visible/);
  });
});
