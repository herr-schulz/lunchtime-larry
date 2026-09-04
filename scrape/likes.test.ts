import { describe, expect, it } from "vitest";
import {
  dishKey,
  dishLabel,
  displayDishName,
  findLikedDishes,
  isLiked,
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
