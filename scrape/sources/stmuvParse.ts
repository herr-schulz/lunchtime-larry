import { parseHTML } from "linkedom";
import { inferDiet, parseGermanPrice, stripDietLabels } from "../lib.ts";
import { WEEKDAYS, type Dish, type Weekday } from "../types.ts";

const WEEKDAY_KEYS = WEEKDAYS;

function emptyDays(): Record<
  Weekday,
  { name: string; price?: string; headerPrice?: string; category: string; veganIcon: boolean }[]
> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };
}

export function parseStmuvHtml(html: string): Record<Weekday, Dish[]> {
  const wrapped = html.includes("<html")
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`;
  const { document } = parseHTML(wrapped);

  const result = emptyDays();
  const rows = [...document.querySelectorAll("#table tbody tr")];
  for (const row of rows) {
    const cells = [...row.querySelectorAll(":scope > td")];
    if (cells.length < 6) continue;
    const header = cells[0];
    const category = (header.querySelector(".column-header")?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    const headerPrice = header.textContent?.match(/(\d+[.,]\d{2})\s*€/)?.[1];

    for (let i = 0; i < 5; i++) {
      const cell = cells[i + 1];
      const nameEl = cell.querySelector(".suppe, .menue");
      const name = (nameEl?.textContent || "").replace(/\s+/g, " ").trim();
      if (!name) continue;
      const cellPrice = cell.querySelector("span")?.textContent || "";
      const veganIcon = Boolean(cell.querySelector('img[src*="vegan"]'));
      result[WEEKDAY_KEYS[i]].push({
        name,
        price: cellPrice,
        headerPrice: headerPrice ? `${headerPrice.replace(".", ",")} €` : undefined,
        category,
        veganIcon,
      });
    }
  }

  const desserts = [...document.querySelectorAll(".dessert strong")]
    .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
    .filter((t) => t && !/wochendessert/i.test(t));

  const mapped = Object.fromEntries(
    WEEKDAYS.map((day) => [
      day,
      result[day].map((raw) => {
        const price =
          parseGermanPrice(raw.price || "") ||
          parseGermanPrice(raw.name) ||
          raw.headerPrice;
        let diet = inferDiet(raw.name, { category: raw.category });
        if (raw.veganIcon) diet = "vegan";
        return {
          name: stripDietLabels(raw.name.replace(/\d+[.,]\d{2}\s*€/g, "")),
          price,
          diet,
          category: raw.category,
        } satisfies Dish;
      }),
    ]),
  ) as Record<Weekday, Dish[]>;

  const dessertDishes: Dish[] = desserts.map((line) => ({
    name: stripDietLabels(line.replace(/\d+[.,]\d{2}\s*€/g, "")),
    price: parseGermanPrice(line),
    diet: inferDiet(line, { category: "Dessert" }),
    category: "Dessert",
  }));

  if (dessertDishes.length) {
    for (const day of WEEKDAYS) mapped[day].push(...dessertDishes);
  }

  return mapped;
}
