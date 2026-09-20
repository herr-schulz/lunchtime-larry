import { describe, expect, it } from "vitest";
import { boardHtml, hitsHtml } from "../site/boardRender.js";
import { weekStaleHitsNote } from "../site/larryLines.js";

const canteens = {
  stmuv: { name: "StMUV", short: "Kantine", url: "https://example.test/stmuv" },
  sodexo: { name: "Dave B", short: "Bistro", url: "https://example.test/dave" },
  bella23: { name: "Bella 23", short: "Bistro", url: "https://example.test/bella" },
};

describe("boardHtml week-stale", () => {
  it("stamps every slip and keeps the dishes", () => {
    const html = boardHtml({
      block: {
        canteens: [
          { id: "stmuv", dishes: [{ name: "Linsensuppe" }] },
          { id: "sodexo", dishes: [{ name: "Penne Tomate" }] },
          { id: "bella23", dishes: [{ name: "Schnitzel" }] },
        ],
      },
      canteens,
      sources: {
        stmuv: { status: "ok" },
        sodexo: { status: "ok" },
        bella23: { status: "ok" },
      },
      likes: new Set(),
      votingOpen: false,
      weekStale: true,
    });
    expect(html.match(/Letzte Woche/g)?.length).toBe(3);
    expect(html.match(/is-week-stale/g)?.length).toBe(3);
    expect(html).toContain("Linsensuppe");
    expect(html).toContain("Penne Tomate");
    expect(html).toContain("Schnitzel");
    expect(html).not.toContain("ghost");
  });

  it("keeps the in-window source-stale slip note next to the week stamp", () => {
    const html = boardHtml({
      block: {
        canteens: [{ id: "stmuv", dishes: [{ name: "Gulasch" }] }],
      },
      canteens,
      sources: { stmuv: { status: "stale" } },
      likes: new Set(),
      votingOpen: false,
      weekStale: true,
    });
    expect(html).toContain("Alter Plan — Larry kam nicht durch");
    expect(html).toContain("Letzte Woche");
    expect(html).toContain("Gulasch");
  });
});

describe("hitsHtml week-stale", () => {
  it("swaps the favorites alarm for crawl-day copy without hearts or times", () => {
    const html = hitsHtml({
      items: [
        {
          key: "currywurst",
          name: "Currywurst",
          label: "Currywurst",
          canteen: "sodexo",
        },
      ],
      saved: [{ key: "currywurst", name: "Currywurst", label: "Currywurst" }],
      canteens,
      weekStale: true,
      staleNote: weekStaleHitsNote("Fr., 18. Sept., 11:27"),
    });
    expect(html).toContain("Kein neuer Plan");
    expect(html).toContain("Für diese Woche");
    expect(html).toContain("Letzter Stand");
    expect(html).toContain("Montags und mittwochs");
    expect(html).not.toMatch(/Favorit/);
    expect(html).not.toContain("toast-gear");
    expect(html).not.toContain("fav-row-heart");
    expect(html).not.toContain("fav-sheet");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("10 Uhr");
    expect(html).not.toContain("11:30");
    expect(html).not.toMatch(/Dienstag|Donnerstag/);
    expect(html).not.toContain("Currywurst");
  });
});
