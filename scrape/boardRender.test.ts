import { describe, expect, it } from "vitest";
import { boardHtml, hitsHtml } from "../site/boardRender.js";
import { weekStaleHitsNote } from "../site/larryLines.js";

/** `html\`…\`` may return a String object under the Trusted Types tinyfill. */
function markup(value: unknown) {
  return String(value);
}

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
    const out = markup(html);
    expect(out.match(/Letzte Woche/g)?.length).toBe(3);
    expect(out.match(/is-week-stale/g)?.length).toBe(3);
    expect(out).toContain("Linsensuppe");
    expect(out).toContain("Penne Tomate");
    expect(out).toContain("Schnitzel");
    expect(out).not.toContain("ghost");
  });

  it("points an empty slip at the canteen page", () => {
    const out = markup(
      boardHtml({
        block: {
          canteens: [{ id: "bella23", dishes: [] }],
        },
        canteens,
        sources: { bella23: { status: "ok" } },
        likes: new Set(),
        votingOpen: false,
      }),
    );
    expect(out).toContain("Zur Speisekarte");
    expect(out).toContain("https://example.test/bella");
    expect(out).toContain("Heute nix da");
    expect(out).toContain("heute nichts auf dem Zettel");
    expect(out).not.toContain("Stempel trocken");
  });

  it("keeps the in-window source-stale slip note next to the week stamp", () => {
    const out = markup(
      boardHtml({
        block: {
          canteens: [{ id: "stmuv", dishes: [{ name: "Gulasch" }] }],
        },
        canteens,
        sources: { stmuv: { status: "stale" } },
        likes: new Set(),
        votingOpen: false,
        weekStale: true,
      }),
    );
    expect(out).toContain("Alter Plan — Larry kam nicht durch");
    expect(out).toContain("Letzte Woche");
    expect(out).toContain("Gulasch");
  });
});

describe("hitsHtml week-stale", () => {
  it("swaps the favorites alarm for the last stand, without the long crawl copy", () => {
    const out = markup(
      hitsHtml({
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
      }),
    );
    expect(out).toContain("Kein neuer Plan");
    expect(out).toContain("Letzter Stand");
    expect(out).toMatch(/Fr\.,\s18\.\sSept\.,\s11:27/);
    expect(out).not.toContain("Für diese Woche");
    expect(out).not.toContain("Montags und mittwochs");
    expect(out).not.toMatch(/Favorit/);
    expect(out).not.toContain("toast-gear");
    expect(out).not.toContain("fav-row-heart");
    expect(out).not.toContain("fav-sheet");
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("10 Uhr");
    expect(out).not.toContain("11:30");
    expect(out).not.toMatch(/Dienstag|Donnerstag/);
    expect(out).not.toContain("Currywurst");
  });
});
