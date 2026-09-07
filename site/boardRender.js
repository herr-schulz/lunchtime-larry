/** Pure HTML builders for the canteen board (no DOM writes). */

import { escapeHtml } from "./dom.js?v=55e28ecf";
import { checkCircleSvg, heartIcon, heartIconFilled } from "./icons.js?v=bef72b85";
import { dishKey, displayDishName, isLiked } from "./likes.js?v=d4839ba3";

const DIET = {
  vegan: "vegan",
  veggie: "veggie",
  meat: "Fleisch",
  fish: "Fisch",
};

const GHOST_LINES = [
  "Küche schweigt.",
  "Stempel trocken.",
  "Heute nichts auf dem Zettel.",
  "Herd aus. Pause.",
];

export function ghostLine(seed) {
  const index =
    Math.abs([...String(seed)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) %
    GHOST_LINES.length;
  return GHOST_LINES[index];
}

export function formatDishName(name) {
  const shown = displayDishName(name);
  const parts = shown
    .split(/\s*[|/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const heart = heartIconFilled;
  if (parts.length <= 1) return `${escapeHtml(parts[0] || shown)}${heart}`;
  const sep = '<span class="sep" aria-hidden="true"></span>';
  const first = `${escapeHtml(parts[0])}${heart}`;
  return [first, ...parts.slice(1).map((part) => escapeHtml(part))].join(sep);
}

export function dishRow(dish, index, likes) {
  const key = dishKey(dish.name);
  const kept = isLiked(dish.name, likes);
  const diet =
    dish.diet && DIET[dish.diet]
      ? `<span class="pill ${dish.diet}">${DIET[dish.diet]}</span>`
      : "";
  const category = dish.category
    ? `<span class="pill">${dish.category}</span>`
    : "";
  const price = dish.price ? `<span class="price">${dish.price}</span>` : "";
  const shown = displayDishName(dish.name);
  const label = kept ? `${shown}, Favorit` : shown;
  return `<article class="dish${kept ? " is-liked" : ""}" style="--dish-i:${index}" data-name="${escapeHtml(dish.name)}" data-key="${escapeHtml(key)}" role="button" tabindex="0" aria-pressed="${kept}" aria-label="${escapeHtml(label)}">
    <div class="name">${formatDishName(dish.name)}</div>
    ${price}
    <div class="meta">${category}${diet}</div>
  </article>`;
}

/**
 * @param {object} opts
 * @param {object | null | undefined} opts.block
 * @param {Record<string, { name: string, short: string, url: string }>} opts.canteens
 * @param {Record<string, { status?: string }> | null | undefined} opts.sources
 * @param {Set<string>} opts.likes
 * @param {boolean} opts.votingOpen
 */
export function boardHtml({ block, canteens, sources, likes, votingOpen }) {
  return (block?.canteens ?? [])
    .map((canteen, slipIndex) => {
      const meta = canteens[canteen.id];
      const source = sources?.[canteen.id];
      let note = "";
      if (source?.status === "stale") {
        note = `<p class="note">Alter Plan — Larry kam nicht durch. Stand kann veraltet sein.</p>`;
      }
      const missing = source?.status === "error" && !canteen.dishes?.length;
      const body = canteen.dishes?.length
        ? canteen.dishes.map((dish, index) => dishRow(dish, index, likes)).join("")
        : missing
          ? ""
          : `<p class="ghost">${escapeHtml(ghostLine(canteen.id))}</p>`;
      const pizza =
        canteen.id === "sodexo" && !missing
          ? `<button type="button" class="pizza" data-pizza>Pizza täglich</button>`
          : "";
      const missStamp = missing
        ? `<p class="pizza pizza-miss" role="status" aria-label="Speiseplan nicht verfügbar">Heute nix da</p>`
        : "";
      const voteBtn = votingOpen
        ? `<button type="button" class="vote-mark" data-vote="${canteen.id}" aria-pressed="false"><span class="vote-nicks"></span>${checkCircleSvg()}</button>`
        : "";
      return `<section class="slip" style="--slip-i:${slipIndex}" data-canteen="${canteen.id}">
        <div class="slip-head">
          <div>
            <h2>
              <a class="slip-name" href="${meta.url}" target="_blank" rel="noopener noreferrer">${meta.name}</a>
            </h2>
            <p class="where">${meta.short}</p>
          </div>
          <div class="slip-aside">
            ${voteBtn}
          </div>
        </div>
        ${note}
        <div class="slip-list${missing ? " is-empty" : ""}">
          ${body}
          ${missStamp}
          ${pizza}
        </div>
      </section>`;
    })
    .join("");
}

function placeNames(ids, canteens) {
  const names = (ids ?? []).map((id) => canteens?.[id]?.name).filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} und ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`;
}

/**
 * @param {Array<{ key?: string, label: string, canteen?: string, places?: string[] }>} items
 * @param {Record<string, { name: string }> | null | undefined} canteens
 */
export function hitsHtml(items, canteens) {
  const rows = items
    .map((item) => {
      const places = item.places?.length ? item.places : item.canteen ? [item.canteen] : [];
      const where = placeNames(places, canteens);
      const text = where ? `${item.label} bei ${where}` : item.label;
      const canteen = item.canteen || places[0] || "";
      return `<button type="button" class="toast-hit-item" data-key="${escapeHtml(item.key || "")}" data-canteen="${escapeHtml(canteen)}" data-label="${escapeHtml(item.label)}" data-place="${escapeHtml(where)}">${escapeHtml(text)}</button>`;
    })
    .join("");
  return `<p class="toast-kicker">${heartIcon}<span>Favoriten-Alarm</span></p><div class="toast-list">${rows}</div>`;
}
