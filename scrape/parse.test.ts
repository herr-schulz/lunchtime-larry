import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseBella23Html } from "./sources/bella23Parse.ts";
import { parseSodexoMenuHtml, tabToWeekday } from "./sources/sodexoParse.ts";
import { parseStmuvHtml } from "./sources/stmuvParse.ts";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function load(name: string): string {
  return readFileSync(join(fixtures, name), "utf8");
}

describe("parseStmuvHtml", () => {
  const menu = parseStmuvHtml(load("stmuv.html"));

  it("reads weekday cells and vegan icons", () => {
    expect(menu.monday[0]).toMatchObject({
      name: "Blumenkohl",
      diet: "vegan",
      category: "Suppe",
      price: "1,30 €",
    });
    expect(menu.monday.some((d) => d.name.startsWith("Kötbullar"))).toBe(true);
    expect(menu.monday.find((d) => d.name.startsWith("Kötbullar"))?.diet).toBe("meat");
    expect(menu.monday.find((d) => d.name.startsWith("Schaschlik"))?.diet).toBe("meat");
  });

  it("clones weekly desserts onto every weekday and leaves them unlabeled", () => {
    for (const day of Object.values(menu)) {
      const dessert = day.find((d) => d.category === "Dessert");
      expect(dessert?.name).toMatch(/Bayerisch Creme/);
      expect(dessert?.diet).toBe("unknown");
    }
    expect(menu.monday.some((d) => /wochendessert/i.test(d.name))).toBe(false);
  });

  it("labels fish and bolognese from later weekdays", () => {
    expect(menu.friday.find((d) => /Schollenfilet/.test(d.name))?.diet).toBe("fish");
    expect(menu.wednesday.find((d) => /Bolognese/.test(d.name))?.diet).toBe("meat");
  });
});

describe("parseBella23Html", () => {
  const menu = parseBella23Html(load("bella23.html"));

  it("walks Elementor columns into weekday dishes", () => {
    expect(menu.monday.map((d) => d.name)).toEqual([
      "Spinat Canneloni Al Forno",
      "Grillhähnchen Kartoffelsalat",
    ]);
    expect(menu.monday[0].diet).toBe("veggie");
    expect(menu.monday[1].diet).toBe("meat");
    expect(menu.monday[0].price).toBe("7,35 €");
  });

  it("keeps tagesgericht, fish labels, and skips aushang pizza", () => {
    expect(menu.wednesday.find((d) => /Zander/.test(d.name))?.diet).toBe("fish");
    expect(menu.wednesday.find((d) => d.name === "Burger")).toMatchObject({
      category: "Tagesgericht",
      price: "siehe Aushang",
      diet: "meat",
    });
    expect(menu.friday.some((d) => /siehe aushang/i.test(d.name))).toBe(false);
  });
});

describe("parseSodexoMenuHtml", () => {
  const dishes = parseSodexoMenuHtml(load("sodexo.html"));

  it("keeps mains, maps InGreen, and drops pizza plus sold-out cards", () => {
    const names = dishes.map((d) => d.name);
    expect(names).toContain("Currywurst | Pommes frites | Röstzwiebeln");
    expect(names).toContain("Couscous | Auberginen | Tomaten");
    expect(names.some((n) => /Margherita/.test(n))).toBe(false);
    expect(names.some((n) => /Sold Out/.test(n))).toBe(false);
    expect(dishes.find((d) => /Couscous/.test(d.name))?.diet).toBe("veggie");
    expect(dishes.find((d) => /Schinken/.test(d.name))?.diet).toBe("meat");
    expect(dishes.find((d) => d.name === "Bayerisch Creme")).toMatchObject({
      category: "Dessert",
      diet: "unknown",
    });
  });
});

describe("tabToWeekday", () => {
  it("maps German tab labels", () => {
    expect(tabToWeekday("Montag 01.09")).toBe("monday");
    expect(tabToWeekday("Fr")).toBe("friday");
    expect(tabToWeekday("So")).toBeUndefined();
  });
});
