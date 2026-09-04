import { parseHTML } from "linkedom";
import { cleanText, inferDiet, parseGermanPrice, stripDietLabels } from "../lib.ts";
import { WEEKDAYS, type Diet, type Dish, type Weekday } from "../types.ts";

const DAY_HEAD = /^(montag|dienstag|mittwoch|donnerstag|freitag)\b/i;
const DIET_ONLY =
  /^(vegan|veggie|vegetarisch|fleisch|fisch|geflügel|schwein|rind|huhn|pute)(\s*\/\s*(vegan|veggie|vegetarisch|fleisch|fisch|geflügel|schwein|rind))?$/i;
const SKIP_DISH = /pizza siehe aushang|änderungen vorbehalten/i;

export function weekdayFromHeading(text: string): Weekday | undefined {
  const key = text.toLowerCase().match(DAY_HEAD)?.[1];
  switch (key) {
    case "montag":
      return "monday";
    case "dienstag":
      return "tuesday";
    case "mittwoch":
      return "wednesday";
    case "donnerstag":
      return "thursday";
    case "freitag":
      return "friday";
    default:
      return undefined;
  }
}

export function dietFromLabel(text: string): Diet | undefined {
  const t = text.toLowerCase();
  if (t.includes("vegan")) return "vegan";
  if (t.includes("veggie") || t.includes("vegetar")) return "veggie";
  if (t.includes("fisch")) return "fish";
  if (
    t.includes("fleisch") ||
    t.includes("schwein") ||
    t.includes("geflügel") ||
    t.includes("huhn") ||
    t.includes("rind") ||
    t.includes("pute")
  ) {
    return "meat";
  }
  return undefined;
}

type NodeSnap = { tag: string; text: string };

export function parseBellaColumns(columns: NodeSnap[][]): Record<Weekday, Dish[]> {
  const byDay = Object.fromEntries(WEEKDAYS.map((d) => [d, [] as Dish[]])) as Record<
    Weekday,
    Dish[]
  >;

  for (const nodes of columns) {
    let weekday: Weekday | undefined;
    let current: { name: string; diet: Diet; price?: string; category?: string } | undefined;

    const flush = () => {
      if (!weekday || !current?.name || SKIP_DISH.test(current.name)) {
        current = undefined;
        return;
      }
      byDay[weekday].push({
        name: stripDietLabels(current.name),
        price: current.price,
        diet: current.diet === "unknown" ? inferDiet(current.name) : current.diet,
        category: current.category,
      });
      current = undefined;
    };

    for (const node of nodes) {
      const text = cleanText(node.text);
      if (!text) continue;

      if (node.tag === "h3") {
        flush();
        weekday = weekdayFromHeading(text);
        continue;
      }

      if (DIET_ONLY.test(text)) {
        if (current) current.diet = dietFromLabel(text) ?? current.diet;
        else if (weekday && byDay[weekday].length) {
          const last = byDay[weekday][byDay[weekday].length - 1];
          last.diet = dietFromLabel(text) ?? last.diet;
        }
        continue;
      }

      const price = parseGermanPrice(text);
      if (price || /siehe aushang/i.test(text)) {
        if (current) current.price = price || "siehe Aushang";
        continue;
      }

      if (/^tagesgericht$/i.test(text)) {
        flush();
        current = { name: "", diet: "unknown", category: "Tagesgericht" };
        continue;
      }

      if (node.tag === "h6" || (current?.category === "Tagesgericht" && !current.name)) {
        if (current?.name) flush();
        current = {
          name: text,
          diet: inferDiet(text),
          category: current?.category,
        };
      }
    }
    flush();
  }

  return byDay;
}

export function parseBella23Html(html: string): Record<Weekday, Dish[]> {
  const wrapped = html.includes("<html")
    ? html
    : `<!DOCTYPE html><html><body>${html}</body></html>`;
  const { document } = parseHTML(wrapped);
  const root = document.querySelector("#wochenkarte");
  if (!root) return parseBellaColumns([]);

  const headings = [...root.querySelectorAll("h3")].filter((h) =>
    /^(montag|dienstag|mittwoch|donnerstag|freitag)/i.test((h.textContent || "").trim()),
  );
  const columns = headings.map((h3) => {
    const column = h3.closest(".e-con") || h3.parentElement?.parentElement;
    const nodes = column
      ? [...column.querySelectorAll("h3, h6, .elementor-widget-text-editor p")]
      : [];
    return nodes.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
    }));
  });

  return parseBellaColumns(columns);
}
