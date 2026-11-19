import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { applyStampPin, stampFrame, stampInFlow, stampVisibleAt } from "../site/visits.js";

function baseStampRule(css: string) {
  const start = css.search(/(?:^|\n)\.aufruf-stamp \{/);
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf("}", start);
  return css.slice(start, end);
}

describe("Aufrufe stamp in the footer", () => {
  it("sits in the footer row and is not fixed to the viewport", () => {
    const css = readFileSync("site/styles.css", "utf8");
    const rule = baseStampRule(css);
    expect(rule).toMatch(/position:\s*relative/);
    expect(rule).not.toMatch(/position:\s*fixed/);
    expect(rule).not.toMatch(/position:\s*sticky/);
    expect(css).not.toMatch(/\.aufruf-stamp[^{]*\{[^}]*position:\s*fixed/);
    expect(css).not.toMatch(/\.aufruf-stamp[^{]*\{[^}]*position:\s*sticky/);
    expect(rule).not.toMatch(/visibility:\s*hidden/);
    expect(css).not.toMatch(/\.aufruf-stamp\.is-showing/);
    expect(css).not.toMatch(/body:has\(\.aufruf-stamp\)/);

    const index = parseHTML(readFileSync("site/index.html", "utf8")).document;
    const footer = index.querySelector("footer.colophon");
    const stamp = footer?.querySelector(":scope > .colophon-band > .aufruf-stamp");
    expect(stamp).toBeTruthy();
    expect(stamp?.getAttribute("href")).toBe("./strichliste.html");
    expect(footer?.querySelector("#stamp")?.textContent).toMatch(/Stand:/);
    expect(footer?.querySelector("#nick-edit")).toBeTruthy();
    expect(index.querySelector("body > .aufruf-stamp")).toBeNull();
    expect(stamp?.hasAttribute("tabindex")).toBe(false);
    expect(stamp?.getAttribute("aria-hidden")).toBeNull();

    const alt = parseHTML(readFileSync("site/alternativen.html", "utf8")).document;
    expect(alt.querySelector("footer.colophon .aufruf-stamp")).toBeTruthy();
    expect(alt.querySelector("body > .aufruf-stamp")).toBeNull();

    const narrow = stampFrame(390);
    const wide = stampFrame(1280);
    expect(narrow.position).toBe("relative");
    expect(narrow.flow).toBe(true);
    expect(stampInFlow(narrow.position)).toBe(true);
    expect(stampInFlow("fixed")).toBe(false);
    expect(stampInFlow("sticky")).toBe(false);
    expect(wide.maxWidth).toBeGreaterThan(narrow.maxWidth);

    const node = stamp as HTMLElement;
    const atTop = applyStampPin(node, { viewWidth: 390, scrollY: 0, mastheadBottom: 240 });
    expect(atTop.position).toBe("relative");
    expect(atTop.flow).toBe(true);
    expect(atTop.showing).toBe(true);
    expect(node.style.position).toBe("relative");
    expect(node.dataset.flow).toBe("in");
    expect(stampInFlow(node.style.position)).toBe(true);

    const scrolled = applyStampPin(node, { viewWidth: 1280, scrollY: 900, mastheadBottom: -12 });
    expect(scrolled.position).toBe("relative");
    expect(node.style.position).toBe("relative");
    expect(scrolled.showing).toBe(true);
    expect(scrolled.maxWidth).toBeGreaterThan(atTop.maxWidth);
  });

  it("stays in the footer while the masthead is on screen", () => {
    expect(stampVisibleAt({ scrollY: 0, mastheadBottom: 280 })).toBe(true);
    expect(stampVisibleAt({ scrollY: 20, mastheadBottom: 180 })).toBe(true);
    expect(stampVisibleAt({ scrollY: 640, mastheadBottom: -8 })).toBe(true);
    const src = readFileSync("site/visits.js", "utf8");
    expect(src).not.toMatch(/addEventListener\("scroll"/);
    expect(src).not.toMatch(/mastheadBottom/);
  });
});
