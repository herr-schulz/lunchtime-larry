import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

const OG_IMAGE = "https://lunchtime-larry.web.app/og-image.png";

function meta(html: string, attr: "property" | "name", key: string) {
  const { document } = parseHTML(html);
  return document.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") ?? "";
}

describe("open graph share image", () => {
  const pages = ["site/index.html", "site/alternativen.html"] as const;

  for (const page of pages) {
    it(`${page} points at an absolute 1200×630 card`, () => {
      const html = readFileSync(page, "utf8");
      expect(meta(html, "property", "og:title")).toMatch(/\S/);
      expect(meta(html, "property", "og:description")).toMatch(/\S/);
      expect(meta(html, "property", "og:image")).toBe(OG_IMAGE);
      expect(meta(html, "property", "og:image:width")).toBe("1200");
      expect(meta(html, "property", "og:image:height")).toBe("630");
      expect(meta(html, "name", "twitter:card")).toBe("summary_large_image");
      expect(meta(html, "name", "twitter:image")).toBe(OG_IMAGE);

      const share = [
        meta(html, "property", "og:title"),
        meta(html, "property", "og:description"),
        meta(html, "property", "og:image"),
      ].join(" ");
      expect(share).not.toMatch(/\bKW\b/i);
    });
  }

  it("index and alternatives keep their own titles", () => {
    const index = readFileSync("site/index.html", "utf8");
    const alt = readFileSync("site/alternativen.html", "utf8");
    expect(meta(index, "property", "og:title")).toBe("Lunchtime Larry — Arabellapark");
    expect(meta(alt, "property", "og:title")).toBe("Was anderes?! — Lunchtime Larry");
  });

  it("ships a 1200×630 png and leaves it out of the query-cache stamp", () => {
    const png = readFileSync("site/og-image.png");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    const stamp = readFileSync("scripts/stamp-assets.mjs", "utf8");
    expect(stamp).not.toContain("og-image.png");
  });
});
