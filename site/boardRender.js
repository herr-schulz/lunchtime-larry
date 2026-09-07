/** Pure HTML builders for the canteen board (no DOM writes). */

import { escapeHtml } from "./dom.js?v=d3d5b527";
import { checkCircleSvg, heartIcon, heartIconFilled } from "./icons.js?v=bef72b85";
import { dishKey, isLiked, joinDishSides, phraseDish } from "./likes.js?v=045195a5";

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
  const { title, sides } = phraseDish(name);
  const heart = heartIconFilled;
  const titleRow = `<span class="dish-title">${escapeHtml(title)}${heart}</span>`;
  const withSides = joinDishSides(sides);
  if (!withSides) return titleRow;
  return `${titleRow}<span class="dish-sides">${escapeHtml(withSides)}</span>`;
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
  const spoken = phraseDish(dish.name).spoken;
  const label = kept ? `${spoken}, Favorit` : spoken;
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

function placeAt(ids, canteens) {
  const bits = [];
  for (const id of ids ?? []) {
    const name = canteens?.[id]?.name;
    if (!name) continue;
    bits.push(`${id === "stmuv" ? "im" : "bei"} ${name}`);
  }
  if (!bits.length) return "";
  if (bits.length === 1) return bits[0];
  if (bits.length === 2) return `${bits[0]} und ${bits[1]}`;
  return `${bits.slice(0, -1).join(", ")} und ${bits.at(-1)}`;
}

/**
 * @param {Array<{ key?: string, label: string, canteen?: string, places?: string[] }>} items
 * @param {Record<string, { name: string }> | null | undefined} canteens
 */
export function hitsHtml(items, canteens) {
  const rows = items
    .map((item) => {
      const places = item.places?.length ? item.places : item.canteen ? [item.canteen] : [];
      const where = placeAt(places, canteens);
      const spoken = where ? `${item.label} ${where}` : item.label;
      const canteen = item.canteen || places[0] || "";
      const placeName = (places.map((id) => canteens?.[id]?.name).filter(Boolean).join(" und ")) || where;
      return `<button type="button" class="toast-hit-item" data-key="${escapeHtml(item.key || "")}" data-canteen="${escapeHtml(canteen)}" data-label="${escapeHtml(item.label)}" data-place="${escapeHtml(placeName)}" aria-label="${escapeHtml(spoken)}">${escapeHtml(spoken)}</button>`;
    })
    .join("");
  return `<p class="toast-kicker">${heartIcon}<span>Favoriten-Alarm</span></p><div class="toast-list">${rows}</div>`;
}
