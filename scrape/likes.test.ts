import { describe, expect, it } from "vitest";
import {
  alarmLabel,
  dishKey,
  dishLabel,
  displayDishName,
  findLikedDishes,
  isLiked,
  joinDishSides,
  phraseDish,
  toggleLikeSet,
} from "../site/likes.js";

describe("displayDishName", () => {
  it("strips pasta-station prefixes", () => {
    expect(
      displayDishName(
        "Bei Pasta-Station: Gemüsepfanne | Drillinge | Romanesco | Möhren",
      ),
    ).toBe("Gemüsepfanne | Drillinge | Romanesco | Möhren");
  });

  it("rewrites Dave B daily-dessert boilerplate", () => {
    expect(displayDishName("Tages Dessert 1 Täglich aktualisiert")).toBe("Tagesdessert");
    expect(displayDishName("Panna Cotta Tages Dessert 1 Täglich aktualisiert")).toBe(
      "Panna Cotta",
    );
  });
});

describe("dishKey", () => {
  it("uses the head of a long composed dish name", () => {
    expect(dishKey("Kötbullar / Rahmsauce / Preiselbeeren / Kartoffelpüree")).toBe(
      "kötbullar",
    );
    expect(dishKey("Kötbullar / Kartoffelpüree")).toBe("kötbullar");
  });

  it("keeps short heads attached to the rest of the name", () => {
    expect(dishKey("Pasta | Alla Emiliana | Schinken")).toBe(
      "pasta alla emiliana schinken",
    );
    expect(dishKey("Burger")).toBe("burger");
  });

  it("strips vegan markers and station prefixes", () => {
    expect(dishKey("Vegane Currywurst / hausgemachte Sauce")).toBe("currywurst");
    expect(dishKey("Bei Pasta-Station: Gemüsepfanne | Drillinge")).toBe("gemüsepfanne");
  });
});

describe("cross-canteen likes", () => {
  it("treats Currywurst as the same dish at Dave B and StMUV", () => {
    const likes = new Set([dishKey("Currywurst | Pommes frites | Röstzwiebeln")]);
    expect(isLiked("Currywurst / hausgemachte Sauce / Pommes Frites", likes)).toBe(true);
    expect(isLiked("Vegane Currywurst / Pommes Frites", likes)).toBe(true);
    expect(isLiked("Gemüsepfanne / Dip", likes)).toBe(false);
  });

  it("lists unique favorite labels for a day", () => {
    const likes = toggleLikeSet("Currywurst | Pommes frites", new Set());
    const found = findLikedDishes(
      {
        canteens: [
          { id: "sodexo", dishes: [{ name: "Currywurst | Pommes frites | Röstzwiebeln" }] },
          { id: "stmuv", dishes: [{ name: "Currywurst / hausgemachte Sauce" }] },
          { id: "bella23", dishes: [{ name: "Grillhähnchen Kartoffelsalat" }] },
        ],
      },
      likes,
    );
    expect(found.map((item) => item.label)).toEqual(["Currywurst"]);
  });

  it("title-cases labels after cleaning", () => {
    expect(dishLabel("Bei Pasta-Station: Gemüsepfanne | Drillinge")).toBe("Gemüsepfanne");
    expect(dishLabel("Vegane Currywurst / Pommes")).toBe("Currywurst");
    expect(dishLabel("Tages Dessert 1 Täglich aktualisiert")).toBe("Tagesdessert");
  });

  it("uses the dish title without sides, except pasta keeps the first ingredient", () => {
    expect(alarmLabel("Penne / Tomate / Zucchini")).toBe("Penne mit Tomate");
    expect(alarmLabel("Rigatoni mit Pastinake und Pilze")).toBe("Rigatoni mit Pastinake");
    expect(alarmLabel("Pasta | Tomatensauce | Mozzarella")).toBe("Pasta mit Tomatensauce");
    expect(alarmLabel("Currywurst | Pommes frites | Röstzwiebeln")).toBe("Currywurst");
    expect(
      alarmLabel("Hähnchenragout mit Oliven und Tomate Toskana Kartoffelstampf"),
    ).toBe("Hähnchenragout");
    expect(alarmLabel("Donnerstagschnitzel Bratkartoffen")).toBe(
      "Donnerstagschnitzel Bratkartoffen",
    );
  });

  it("collects every canteen that serves a liked dish", () => {
    const likes = toggleLikeSet("Currywurst | Pommes frites", new Set());
    const found = findLikedDishes(
      {
        canteens: [
          { id: "sodexo", dishes: [{ name: "Currywurst | Pommes frites | Röstzwiebeln" }] },
          { id: "stmuv", dishes: [{ name: "Currywurst / hausgemachte Sauce" }] },
        ],
      },
      likes,
    );
    expect(found).toHaveLength(1);
    expect(found[0].places).toEqual(["sodexo", "stmuv"]);
  });

  it("lists several favorites in one day", () => {
    const likes = toggleLikeSet(
      "Grillhähnchen Kartoffelsalat",
      toggleLikeSet("Currywurst | Pommes frites", new Set()),
    );
    const found = findLikedDishes(
      {
        canteens: [
          { id: "sodexo", dishes: [{ name: "Currywurst | Pommes frites | Röstzwiebeln" }] },
          { id: "bella23", dishes: [{ name: "Grillhähnchen Kartoffelsalat" }] },
        ],
      },
      likes,
    );
    expect(found.map((item) => item.label)).toEqual(["Currywurst", "Grillhähnchen Kartoffelsalat"]);
  });
});

describe("phraseDish", () => {
  it("turns slash lists into a title and mit-line", () => {
    expect(phraseDish("Nuss-Nougatpudding | Vanillesauce | Mandeln")).toEqual({
      title: "Nuss-Nougatpudding",
      sides: ["Vanillesauce", "Mandeln"],
      spoken: "Nuss-Nougatpudding mit Vanillesauce und Mandeln",
    });
    expect(phraseDish("Currywurst / hausgemachte Sauce / Pommes Frites")).toEqual({
      title: "Currywurst",
      sides: ["hausgemachte Sauce", "Pommes Frites"],
      spoken: "Currywurst mit hausgemachte Sauce und Pommes Frites",
    });
  });

  it("peels mit from a Bella title and from a listed head", () => {
    expect(phraseDish("Bömischer Kartoffel Eintopf mit Quorn Wurst")).toEqual({
      title: "Bömischer Kartoffel Eintopf",
      sides: ["Quorn Wurst"],
      spoken: "Bömischer Kartoffel Eintopf mit Quorn Wurst",
    });
    expect(phraseDish("Nuss-Nougatpudding mit Vanillesauce | Mandeln")).toEqual({
      title: "Nuss-Nougatpudding",
      sides: ["Vanillesauce", "Mandeln"],
      spoken: "Nuss-Nougatpudding mit Vanillesauce und Mandeln",
    });
    expect(phraseDish("Nuss-Nougatpudding Mit Vanillesauce")).toEqual({
      title: "Nuss-Nougatpudding",
      sides: ["Vanillesauce"],
      spoken: "Nuss-Nougatpudding mit Vanillesauce",
    });
  });

  it("leaves auf/an/von sentences and jammed titles alone", () => {
    expect(phraseDish("Schweinefilet auf Spargel-Risotto").sides).toEqual([]);
    expect(phraseDish("Zanderfilet -Piccata an Tomatennudeln").sides).toEqual([]);
    expect(phraseDish("Cordon bleu Bratkartoffeln")).toEqual({
      title: "Cordon bleu Bratkartoffeln",
      sides: [],
      spoken: "Cordon bleu Bratkartoffeln",
    });
  });

  it("still splits a list when the head contains von", () => {
    expect(phraseDish("Cevapcici von der Pute / Djuvec Reis")).toEqual({
      title: "Cevapcici von der Pute",
      sides: ["Djuvec Reis"],
      spoken: "Cevapcici von der Pute mit Djuvec Reis",
    });
  });

  it("joins three or more sides with commas and und", () => {
    expect(joinDishSides(["Tomate", "Zucchini", "Rosmarin", "Thymian"])).toBe(
      "mit Tomate, Zucchini, Rosmarin und Thymian",
    );
  });
});
