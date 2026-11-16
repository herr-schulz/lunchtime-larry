import { describe, expect, it } from "vitest";
import { escapeHtml, html, safeUrl } from "../site/dom.js";
import { boardHtml, hitsHtml } from "../site/boardRender.js";

const XSS = [
  `<img src=x onerror=alert(1)>`,
  `"><svg onload=alert(1)>`,
  `' onmouseover=alert(1) `,
  `Sven<script>alert(1)</script>`,
];

function assertSafeMarkup(markup: string) {
  expect(markup).not.toMatch(/<img\b/i);
  expect(markup).not.toMatch(/<svg\b[^>]*\bonload\b/i);
  expect(markup).not.toMatch(/<script\b/i);
  expect(markup).not.toContain("javascript:");
}

describe("escapeHtml and safeUrl", () => {
  it("escapes apostrophes and brackets", () => {
    expect(escapeHtml(`O'Brien <b>`)).toBe("O&#39;Brien &lt;b&gt;");
  });

  it("only allows https urls", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("http://insecure.example")).toBe("#");
  });
});

describe("html template", () => {
  it("escapes interpolations but keeps nested html", () => {
    const nested = html`<em>ok</em>`;
    const out = String(html`<p>${XSS[0]}${nested}</p>`);
    expect(out).toContain("&lt;img");
    expect(out).toContain("<em>ok</em>");
    assertSafeMarkup(out);
  });
});

describe("board render sinks", () => {
  it("does not emit executable markup from hostile dish names", () => {
    const canteens = {
      stmuv: { name: XSS[0], short: XSS[1], url: "javascript:alert(1)" },
      sodexo: { name: "Dave", short: "x", url: "https://example.com" },
      bella23: { name: "Bella", short: "y", url: "https://example.com" },
    };
    const block = {
      canteens: [
        {
          id: "stmuv",
          dishes: [{ name: XSS[2], price: XSS[3], diet: "vegan", category: "Haupt" }],
        },
        { id: "sodexo", dishes: [] },
        { id: "bella23", dishes: [] },
      ],
    };
    const markup = String(
      boardHtml({
        block,
        canteens,
        sources: {},
        likes: new Set(),
        votingOpen: false,
      }),
    );
    expect(markup.length).toBeGreaterThan(0);
    assertSafeMarkup(markup);
    expect(markup).toContain('href="#"');
    expect(markup).toContain("&lt;img");
  });

  it("escapes hit labels", () => {
    const markup = String(
      hitsHtml({
        items: [{ name: XSS[0], label: XSS[0], key: "x", canteen: "stmuv", places: ["stmuv"] }],
        saved: [],
        canteens: { stmuv: { name: "StMUV" } },
      }),
    );
    assertSafeMarkup(markup);
    expect(markup).toContain("&lt;img");
  });
});
