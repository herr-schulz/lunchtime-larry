import { parseHTML } from "linkedom";
import { inferDiet, parseGermanPrice, stripDietLabels } from "../lib.ts";
import { type Diet, type Dish, type Weekday } from "../types.ts";

export const SKIP_CATEGORIES = /add\s*on|beilage|topping|^pizza$/i;
export const SKIP_NAMES = /topping|add\s*on|al gusto|geschlossen/i;
export const UNAVAILABLE = /nicht\s*(verfügbar|im angebot)|ausverkauft|sold\s*out/i;

export type SodexoRaw = {
  name: string;
  price?: string;
  category: string;
  dietHint: string;
};

export function tabToWeekday(label: string): Weekday | undefined {
  const lower = label.toLowerCase();
  if (lower.startsWith("mo")) return "monday";
  if (lower.startsWith("di")) return "tuesday";
  if (lower.startsWith("mi")) return "wednesday";
  if (lower.startsWith("do")) return "thursday";
  if (lower.startsWith("fr")) return "friday";
  return undefined;
}

export function mapSodexoDishes(raw: SodexoRaw[]): Dish[] {
  return raw.map((item) => {
    const category = /dessert/i.test(item.category) ? "Dessert" : item.category;
    let diet: Diet = inferDiet(`${item.name} ${item.dietHint} ${item.category}`, {
      category,
    });
    if (/ingreen/i.test(item.category) && diet === "unknown") diet = "veggie";
    return {
      name: stripDietLabels(item.name),
      price: item.price || parseGermanPrice(item.name),
      diet,
      category,
    };
  });
}

function isVisuallyHidden(card: Element, view: Window & typeof globalThis): boolean {
  if (typeof view.getComputedStyle !== "function") return false;
  const style = view.getComputedStyle(card);
  const opacity = style.opacity;
  if (opacity !== "" && Number.isFinite(Number(opacity)) && Number(opacity) < 0.7) {
    return true;
  }
  return (style.filter || "").includes("grayscale");
}

export function collectSodexoCards(
  document: Document,
  view?: Window & typeof globalThis,
): SodexoRaw[] {
  const skipCatRe = SKIP_CATEGORIES;
  const skipNameRe = SKIP_NAMES;
  const unavailableRe = UNAVAILABLE;
  const out: SodexoRaw[] = [];
  const win = view ?? (document.defaultView as (Window & typeof globalThis) | null);

  for (const category of document.querySelectorAll("app-category")) {
    const heading = category.querySelector("h2, h3, h4, h5");
    const categoryName = (heading?.textContent || "").replace(/\s+/g, " ").trim();
    if (skipCatRe.test(categoryName)) continue;

    for (const card of category.querySelectorAll(".product-card")) {
      if (win && isVisuallyHidden(card, win)) continue;
      const text = (card.textContent || "").replace(/\s+/g, " ").trim();
      if (unavailableRe.test(text)) continue;
      const className = String(card.getAttribute("class") || "").toLowerCase();
      if (className.match(/sold|unavailable|disabled|out-of-stock/)) continue;

      const name =
        (card.querySelector("mat-card-title, .product-name, h3, h4")?.textContent || "")
          .replace(/\s+/g, " ")
          .trim() || text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
      if (!name || skipNameRe.test(name) || skipNameRe.test(categoryName)) continue;

      const priceMatch = text.match(/(\d+[.,]\d{2})\s*€/);
      if (priceMatch && /^0[,.]00$/.test(priceMatch[1])) continue;
      out.push({
        name,
        price: priceMatch ? `${priceMatch[1].replace(".", ",")} €` : undefined,
        category: categoryName,
        dietHint: text,
      });
    }
  }
  return out;
}

export function parseSodexoMenuHtml(html: string): Dish[] {
  const wrapped = html.includes("<html")
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`;
  const { document, window } = parseHTML(wrapped);
  return mapSodexoDishes(
    collectSodexoCards(document as unknown as Document, window as unknown as Window & typeof globalThis),
  );
}
