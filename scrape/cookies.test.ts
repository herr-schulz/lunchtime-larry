import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  cookieButtonRank,
  cookieLabelsFromDocument,
  pickCookieButton,
} from "./cookies.ts";

describe("cookieButtonRank", () => {
  it("prefers essential / reject over accept-all", () => {
    expect(cookieButtonRank("Essentielle Cookies")).toBe(1);
    expect(cookieButtonRank("Essenzielle Cookies")).toBe(1);
    expect(cookieButtonRank("Nur notwendige")).toBe(1);
    expect(cookieButtonRank("Reject all")).toBe(1);
    expect(cookieButtonRank("Alle Cookies akzeptieren")).toBe(2);
    expect(cookieButtonRank("Accept all")).toBe(2);
    expect(cookieButtonRank("Akzeptieren")).toBe(3);
  });

  it("never ranks settings / customize", () => {
    expect(cookieButtonRank("Cookie-Einstellungen")).toBeUndefined();
    expect(cookieButtonRank("Customize")).toBeUndefined();
    expect(cookieButtonRank("Manage cookies")).toBeUndefined();
  });
});

describe("pickCookieButton", () => {
  it("picks Everyday essential over accept-all and settings", () => {
    const picked = pickCookieButton([
      { label: "Cookie-Einstellungen" },
      { label: "Essentielle Cookies" },
      { label: "Alle Cookies akzeptieren" },
    ]);
    expect(picked?.label).toBe("Essentielle Cookies");
  });

  it("falls back to accept-all when that is the only consent action", () => {
    expect(
      pickCookieButton([
        { label: "Cookie-Einstellungen" },
        { label: "Alle Cookies akzeptieren" },
      ])?.label,
    ).toBe("Alle Cookies akzeptieren");
  });

  it("returns undefined when nothing looks like consent", () => {
    expect(pickCookieButton([{ label: "Speiseplan" }, { label: "Home" }])).toBeUndefined();
  });
});

describe("cookieLabelsFromDocument", () => {
  it("reads the Everyday / Sodexo privacy dialog buttons", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div role="dialog">
        <h2>Sodexo respektiert Ihre Privatsphäre</h2>
        <button>Cookie-Einstellungen</button>
        <button>Essentielle Cookies</button>
        <button>Alle Cookies akzeptieren</button>
      </div>
    </body></html>`);
    const labels = cookieLabelsFromDocument(document);
    expect(labels).toEqual([
      "Cookie-Einstellungen",
      "Essentielle Cookies",
      "Alle Cookies akzeptieren",
    ]);
    expect(pickCookieButton(labels.map((label) => ({ label })))?.label).toBe(
      "Essentielle Cookies",
    );
  });
});
