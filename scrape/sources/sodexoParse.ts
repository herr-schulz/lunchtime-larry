import { parseHTML } from "linkedom";
import { inferDiet, parseGermanPrice, stripDietLabels } from "../lib.ts";
import { type Diet, type Dish, type Weekday } from "../types.ts";

export const SKIP_CATEGORIES = /add\s*on|beilage|topping|^pizza$/i;
export const SKIP_NAMES =
  /topping|add\s*on|al gusto|geschlossen|täglich aktualisiert|tages\s*dessert\s*\d/i;
export const UNAVAILABLE = /nicht\s*(verfügbar|im angebot)|ausverkauft|sold\s*out/i;
export const CARD_TITLE = "mat-card-title, .product-name, .product-title, h3, h4";

export function sodexoPrice(text: string): string | undefined {
  const priceMatch = text.match(/(\d+[.,]\d{2})\s*€/) || text.match(/€\s*(\d+[.,]\d{2})/);
  if (!priceMatch || /^0[,.]00$/.test(priceMatch[1])) return undefined;
  return `${priceMatch[1].replace(".", ",")} €`;
}

export type SodexoRaw = {
  name: string;
  price?: string;
  category: string;
  dietHint: string;
};

export function tabToWeekday(label: string): Weekday | undefined {
  const lower = label.toLowerCase();
  if (lower.startsWith("mo")) return "monday";
  if (lower.startsWith("di") || lower.startsWith("tu")) return "tuesday";
  if (lower.startsWith("mi") || lower.startsWith("we")) return "wednesday";
  if (lower.startsWith("do") || lower.startsWith("th")) return "thursday";
  if (lower.startsWith("fr")) return "friday";
  return undefined;
}

export function dishSignature(names: string[]): string {
  return names
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .toSorted()
    .join("\n");
}

export function dedupeDishes(dishes: Dish[]): Dish[] {
  const seen = new Set<string>();
  const out: Dish[] = [];
  for (const dish of dishes) {
    const key = dish.name.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(dish);
  }
  return out;
}

export function mapSodexoDishes(raw: SodexoRaw[]): Dish[] {
  return dedupeDishes(
    raw
      .filter(
        (item) => !SKIP_CATEGORIES.test(item.category) && !SKIP_NAMES.test(item.name),
      )
      .map((item) => {
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
      }),
  );
}

export function activeSodexoRoot(document: ParentNode): ParentNode | null {
  const navPanel = document.querySelector("mat-tab-nav-panel");
  if (navPanel) return navPanel;

  const activeBody = document.querySelector(
    "mat-tab-body.mat-mdc-tab-body-active, .mat-mdc-tab-body-active, .mat-tab-body-active",
  );
  if (activeBody) return activeBody;

  const panels = document.querySelectorAll("[role='tabpanel']");
  for (const panel of panels) {
    if (panel.getAttribute("aria-hidden") === "true") continue;
    if (panel.querySelector(".product-card")) return panel;
  }

  return document.querySelector("app-menu-container") || document;
}

function isVisuallyHidden(card: Element, view: Window & typeof globalThis): boolean {
  const buried = card.closest("[aria-hidden='true'], [hidden]");
  if (buried && buried !== card) return true;
  if (typeof view.getComputedStyle !== "function") return false;
  const style = view.getComputedStyle(card);
  if (style.display === "none" || style.visibility === "hidden") return true;
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
  const root = activeSodexoRoot(document);
  if (!root) return out;

  for (const category of root.querySelectorAll("app-category")) {
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
        (card.querySelector(CARD_TITLE)?.textContent || "")
          .replace(/\s+/g, " ")
          .trim() || text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
      if (!name || skipNameRe.test(name)) continue;
      out.push({
        name,
        price: sodexoPrice(text),
        category: categoryName,
        dietHint: text,
      });
    }
  }

  for (const card of root.querySelectorAll(".product-card")) {
    if (card.closest("app-category")) continue;
    if (win && isVisuallyHidden(card, win)) continue;
    const text = (card.textContent || "").replace(/\s+/g, " ").trim();
    if (unavailableRe.test(text)) continue;
    const className = String(card.getAttribute("class") || "").toLowerCase();
    if (className.match(/sold|unavailable|disabled|out-of-stock/)) continue;
    const name =
      (card.querySelector(CARD_TITLE)?.textContent || "")
        .replace(/\s+/g, " ")
        .trim() || text.replace(/\d+[.,]\d{2}\s*€.*/, "").trim();
    if (!name || skipNameRe.test(name)) continue;
    out.push({
      name,
      price: sodexoPrice(text),
      category: "",
      dietHint: text,
    });
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
