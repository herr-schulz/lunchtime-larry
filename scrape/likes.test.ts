import { describe, expect, it } from "vitest";
import {
  alarmLabel,
  dishKey,
  dishLabel,
  displayDishName,
  findLikedDishes,
  isLiked,
  joinDishSides,
  listAllFavorites,
  parkedFavorites,
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
    expect(alarmLabel("Canneloni mit Spinat")).toBe("Canneloni mit Spinat");
    expect(alarmLabel("Spinat Canneloni Al Forno")).toBe("Spinat Canneloni Al Forno");
    expect(alarmLabel("Wirsing Schupfnudeln / Schwammerl / Sauerrahm")).toBe(
      "Wirsing Schupfnudeln mit Schwammerl",
    );
    expect(alarmLabel("Currywurst | Pommes frites | Röstzwiebeln")).toBe("Currywurst");
    expect(
      alarmLabel("Hähnchenragout mit Oliven und Tomate Toskana Kartoffelstampf"),
    ).toBe("Hähnchenragout");
    expect(alarmLabel("Donnerstagschnitzel Bratkartoffen")).toBe(
      "Donnerstagschnitzel Bratkartoffen",
    );
  });

  it("lists every stored like, with a canteen only when it is on today's card", () => {
    const likes = toggleLikeSet(
      "Grillhähnchen Kartoffelsalat",
      toggleLikeSet("Currywurst | Pommes frites", new Set()),
    );
    const days = {
      monday: {
        canteens: [
          { id: "sodexo", dishes: [{ name: "Currywurst | Pommes frites | Röstzwiebeln" }] },
        ],
      },
      tuesday: {
        canteens: [
          { id: "bella23", dishes: [{ name: "Grillhähnchen Kartoffelsalat" }] },
        ],
      },
    };
    const listed = listAllFavorites(likes, days, "monday");
    const curry = listed.find((item) => item.label === "Currywurst");
    const grill = listed.find((item) => item.label === "Grillhähnchen");
    expect(listed).toHaveLength(2);
    expect(curry?.places).toEqual(["sodexo"]);
    expect(curry?.onWeek).toBe(true);
    expect(grill?.places).toEqual([]);
    expect(grill?.onWeek).toBe(true);
  });

  it("keeps parked favorites off the alarm list so today's hits are not doubled", () => {
    const likes = toggleLikeSet(
      "Phantom-Eintopf",
      toggleLikeSet("Currywurst | Pommes frites", new Set()),
    );
    const days = {
      monday: {
        canteens: [
          { id: "sodexo", dishes: [{ name: "Currywurst | Pommes frites | Röstzwiebeln" }] },
        ],
      },
    };
    const found = findLikedDishes(days.monday, likes);
    const saved = listAllFavorites(likes, days, "monday");
    const parked = parkedFavorites(saved, found);
    expect(found.map((item) => item.label)).toEqual(["Currywurst"]);
    expect(parked.map((item) => item.label)).toEqual(["Phantom-eintopf"]);
  });

  it("keeps likes that are not on this week's cards", () => {
    const likes = new Set([dishKey("Phantom-Eintopf")]);
    const listed = listAllFavorites(likes, { monday: { canteens: [] } }, "monday");
    expect(listed).toHaveLength(1);
    expect(listed[0].onWeek).toBe(false);
    expect(listed[0].places).toEqual([]);
    expect(listed[0].label).toBe("Phantom-eintopf");
  });

  it("keeps a stored like on its own dish when another menu item shares a token", () => {
    const likes = toggleLikeSet("Penne / Tomate / Zucchini", new Set());
    const listed = listAllFavorites(
      likes,
      {
        monday: {
          canteens: [
            { id: "stmuv", dishes: [{ name: "Penne / Tomate / Zucchini" }] },
            {
              id: "bella23",
              dishes: [{ name: "Hähnchenragout mit Oliven und Tomate" }],
            },
          ],
        },
      },
      "monday",
    );
    expect(listed).toHaveLength(1);
    expect(listed[0].label).toBe("Penne mit Tomate");
    expect(listed[0].places).toEqual(["stmuv"]);
    expect(listed[0].name).toBe("Penne / Tomate / Zucchini");
    expect(isLiked("Hähnchenragout mit Oliven und Tomate", likes)).toBe(false);
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
    expect(found.map((item) => item.label)).toEqual(["Currywurst", "Grillhähnchen"]);
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

const bella = { canteen: "bella23" };

describe("phraseDish bella23", () => {
  it("keeps a one- or two-word title and peels the rest as mit-sides", () => {
    expect(phraseDish("Grillhähnchen Kartoffelsalat", bella)).toEqual({
      title: "Grillhähnchen",
      sides: ["Kartoffelsalat"],
      spoken: "Grillhähnchen mit Kartoffelsalat",
    });
    expect(phraseDish("Wildpfeffer Apfelpreiselbeeren Semmelknödel", bella)).toEqual({
      title: "Wildpfeffer",
      sides: ["Apfelpreiselbeeren", "Semmelknödel"],
      spoken: "Wildpfeffer mit Apfelpreiselbeeren und Semmelknödel",
    });
    expect(phraseDish("Cordon bleu Bratkartoffeln", bella)).toEqual({
      title: "Cordon bleu",
      sides: ["Bratkartoffeln"],
      spoken: "Cordon bleu mit Bratkartoffeln",
    });
    expect(phraseDish("Buntbarschfilet Letcho Polenta", bella)).toEqual({
      title: "Buntbarschfilet",
      sides: ["Letcho", "Polenta"],
      spoken: "Buntbarschfilet mit Letcho und Polenta",
    });
    expect(phraseDish("Donnerstagschnitzel Bratkartoffen", bella)).toEqual({
      title: "Donnerstagschnitzel",
      sides: ["Bratkartoffen"],
      spoken: "Donnerstagschnitzel mit Bratkartoffen",
    });
  });

  it("keeps two-word titles when the second word is the dish, not a side", () => {
    expect(phraseDish("Linguine Tartofu", bella)).toEqual({
      title: "Linguine Tartofu",
      sides: [],
      spoken: "Linguine Tartofu",
    });
    expect(phraseDish("Kürbis Risotto", bella)).toEqual({
      title: "Kürbis Risotto",
      sides: [],
      spoken: "Kürbis Risotto",
    });
    expect(phraseDish("Freitag Pizza", bella)).toEqual({
      title: "Freitag Pizza",
      sides: [],
      spoken: "Freitag Pizza",
    });
    expect(phraseDish("Süsses oder Saures", bella)).toEqual({
      title: "Süsses oder Saures",
      sides: [],
      spoken: "Süsses oder Saures",
    });
    expect(phraseDish("Spinat Canneloni Al Forno", bella)).toEqual({
      title: "Spinat Canneloni Al Forno",
      sides: [],
      spoken: "Spinat Canneloni Al Forno",
    });
  });

  it("takes two words when the first is weak or the second is the plate", () => {
    expect(phraseDish("Asia Wok Gemüse Kokos Curry Calemar Steak", bella)).toEqual({
      title: "Asia Wok",
      sides: ["Gemüse Kokos Curry Calemar Steak"],
      spoken: "Asia Wok mit Gemüse Kokos Curry Calemar Steak",
    });
    expect(phraseDish("Manta Platte Currywurst Pommes frites", bella)).toEqual({
      title: "Manta Platte",
      sides: ["Currywurst Pommes frites"],
      spoken: "Manta Platte mit Currywurst Pommes frites",
    });
    expect(phraseDish("gebackenes Champignon Kartoffeln Dip", bella)).toEqual({
      title: "gebackenes Champignon",
      sides: ["Kartoffeln", "Dip"],
      spoken: "gebackenes Champignon mit Kartoffeln und Dip",
    });
    expect(
      phraseDish("Wiesen Platte Hähnchen /Spanferkel Kartoffelsalat", bella),
    ).toEqual({
      title: "Wiesen Platte",
      sides: ["Hähnchen", "Spanferkel", "Kartoffelsalat"],
      spoken: "Wiesen Platte mit Hähnchen, Spanferkel und Kartoffelsalat",
    });
    expect(phraseDish("Äpler Nudeln Äpfel -Kraut und Käsesoße", bella)).toEqual({
      title: "Äpler Nudeln",
      sides: ["Äpfel -Kraut", "Käsesoße"],
      spoken: "Äpler Nudeln mit Äpfel -Kraut und Käsesoße",
    });
    expect(phraseDish("gebratener Reis Sojasoße Krispys", bella)).toEqual({
      title: "gebratener Reis",
      sides: ["Sojasoße Krispys"],
      spoken: "gebratener Reis mit Sojasoße Krispys",
    });
    expect(phraseDish("Wies`n Chili Leberkäs Burger", bella)).toEqual({
      title: "Wies`n Chili",
      sides: ["Leberkäs Burger"],
      spoken: "Wies`n Chili mit Leberkäs Burger",
    });
    expect(phraseDish("Kartoffel- Gemüse Auflauf", bella)).toEqual({
      title: "Kartoffel- Gemüse Auflauf",
      sides: [],
      spoken: "Kartoffel- Gemüse Auflauf",
    });
    expect(phraseDish("Donnerstagschnitzel Hirten Corndon bleu", bella)).toEqual({
      title: "Donnerstagschnitzel",
      sides: ["Hirten Corndon bleu"],
      spoken: "Donnerstagschnitzel mit Hirten Corndon bleu",
    });
  });

  it("still peels an explicit mit and leaves auf/an sentences whole", () => {
    expect(phraseDish("Wurzel-Sepp mit Maultasche", bella)).toEqual({
      title: "Wurzel-Sepp",
      sides: ["Maultasche"],
      spoken: "Wurzel-Sepp mit Maultasche",
    });
    expect(phraseDish("Bömischer Kartoffel Eintopf mit Quorn Wurst", bella)).toEqual({
      title: "Bömischer Kartoffel Eintopf",
      sides: ["Quorn Wurst"],
      spoken: "Bömischer Kartoffel Eintopf mit Quorn Wurst",
    });
    expect(phraseDish("Pasta al tartufo mit Sommertrüffel", bella)).toEqual({
      title: "Pasta al tartufo",
      sides: ["Sommertrüffel"],
      spoken: "Pasta al tartufo mit Sommertrüffel",
    });
    expect(phraseDish("Schweinefilet auf Spargel-Risotto", bella).sides).toEqual([]);
    expect(phraseDish("Zanderfilet -Piccata an Tomatennudeln", bella).sides).toEqual([]);
  });
});
