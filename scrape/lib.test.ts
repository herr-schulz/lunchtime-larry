import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatIsoDateTime,
  inferDiet,
  parseGermanPrice,
  stripDietLabels,
  weekStartBerlin,
} from "./lib.ts";

describe("inferDiet", () => {
  it.each([
    ["Kötbullar / Rahmsauce / Preiselbeeren / Kartoffelpüree", "meat"],
    ["Schaschlikpfanne / Pommes Frites", "meat"],
    ["Penne alla Bolognese", "meat"],
    ["Pasta | Alla Emiliana | Schinken | Erbsen | Champignons", "meat"],
    ["Cordon bleu Bratkartoffeln", "meat"],
    ["Cheeseburger | Bacon | Tomaten | Zwiebel | Pommes", "meat"],
    ["Grillhähnchen Kartoffelsalat", "meat"],
    ["Massamancurry / Huhn / Kartoffel / Erdnuss / Duftreis", "meat"],
    ["Cevapcici von der Pute / Djuvec Reis", "meat"],
    ["Krautwickerl / Schwein / Tomatensauce", "meat"],
    ["Currywurst / hausgemachte Sauce / Pommes Frites", "meat"],
    ["Burger", "meat"],
    ["Schweinefilet auf Spargel-Risotto", "meat"],
    ["Gebackene Schollenfilet / Kartoffelpüree", "fish"],
    ["Pasta | Tomaten Sauce | Thunfisch | Oliven", "fish"],
    ["Gegrillte Pangasiusfilets | Polenta", "fish"],
    ["Zanderfilet -Piccata an Tomatennudeln", "fish"],
    ["Vegane Currywurst / hausgemachte Sauce / Pommes Frites", "vegan"],
    ["Süßkartoffelcurry / Mango / Babyspinat *vegan*", "vegan"],
    ["Bömischer Kartoffel Eintopf mit Quorn Wurst", "veggie"],
    ["veggie Lasagne", "veggie"],
  ] as const)("labels %s as %s", (name, diet) => {
    expect(inferDiet(name)).toBe(diet);
  });

  it("keeps desserts unlabeled unless vegan", () => {
    expect(inferDiet("Bayerisch Creme / Himbeere", { category: "Dessert" })).toBe(
      "unknown",
    );
    expect(inferDiet("Brombeere / Mascarpone / Schokolade", { category: "Dessert" })).toBe(
      "unknown",
    );
    expect(inferDiet("Veganer Schokopudding", { category: "Dessert" })).toBe("vegan");
  });

  it("leaves ambiguous sides and soups unlabeled", () => {
    expect(inferDiet("Champignoncremesuppe")).toBe("unknown");
    expect(inferDiet("Pasta | Zucchini Pesto")).toBe("unknown");
    expect(inferDiet("Arme Ritter / Gewürzkirschen / Schlagsahne")).toBe("unknown");
  });
});

describe("stripDietLabels", () => {
  it("removes vegan markers from the dish name", () => {
    expect(stripDietLabels("Vegane Currywurst / Sauce")).toBe("Currywurst / Sauce");
  });
});

describe("parseGermanPrice", () => {
  it("normalizes a euro price", () => {
    expect(parseGermanPrice("6,90 €")).toBe("6,90 €");
    expect(parseGermanPrice("ab 7.50€")).toBe("7,50 €");
  });
});

describe("formatIsoDateTime", () => {
  it("emits Berlin wall time with a numeric offset", () => {
    expect(formatIsoDateTime(new Date("2026-09-02T13:25:00.000Z"))).toBe(
      "2026-09-02T15:25:00+02:00",
    );
    expect(formatIsoDateTime(new Date("2026-01-15T13:25:00.000Z"))).toBe(
      "2026-01-15T14:25:00+01:00",
    );
  });
});

describe("weekStartBerlin", () => {
  it("returns the Monday of the Berlin week", () => {
    expect(weekStartBerlin(new Date("2026-09-04T10:00:00+02:00"))).toBe("2026-08-31");
  });
});

describe("fixture dishes from a real week still classify", () => {
  it("reads names out of the local menu snapshot when present", () => {
    const menuPath = join(dirname(fileURLToPath(import.meta.url)), "../site/data/menu.json");
    let raw: string;
    try {
      raw = readFileSync(menuPath, "utf8");
    } catch {
      return;
    }
    const menu = JSON.parse(raw) as {
      days: Record<string, { canteens: { dishes: { name: string; diet: string }[] }[] }>;
    };
    const names = Object.values(menu.days).flatMap((day) =>
      day.canteens.flatMap((c) => c.dishes.map((d) => d.name)),
    );
    expect(inferDiet(names.find((n) => n.startsWith("Kötbullar")) ?? "")).toBe("meat");
    expect(inferDiet(names.find((n) => n.startsWith("Schaschlik")) ?? "")).toBe("meat");
  });
});
