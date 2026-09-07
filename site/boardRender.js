/** Pure HTML builders for the canteen board (no DOM writes). */

import { escapeHtml } from "./dom.js?v=d3d5b527";
import { checkCircleSvg, heartIcon, heartIconFilled, heartIconSolid, settingsIcon } from "./icons.js?v=56a779d4";
import { dishKey, isLiked, joinDishSides, parkedFavorites, phraseDish } from "./likes.js?v=f6717c2c";

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

export function placeAt(ids, canteens) {
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

function sheetPlace(item, canteens) {
  if (item.places?.length) return placeAt(item.places, canteens);
  if (item.onWeek) return "";
  return "nicht auf der Karte";
}

/**
 * @param {Array<{ key?: string, name?: string, label: string, places?: string[], onWeek?: boolean }>} saved
 * @param {Record<string, { name: string }> | null | undefined} canteens
 */
function favSheetHtml(saved, canteens, emptyHint) {
  if (!saved?.length) {
    return emptyHint
      ? `<p class="fav-empty">Noch kein Favorit. Herz am Gericht reicht.</p>`
      : "";
  }
  const rows = saved
    .map((item) => {
      const where = sheetPlace(item, canteens);
      const spoken = where ? `${item.label}, ${where}` : item.label;
      const off = !item.places?.length;
      const place = where
        ? `<span class="fav-row-place${off ? " is-off" : ""}">${escapeHtml(where)}</span>`
        : "";
      return `<li class="fav-row" data-name="${escapeHtml(item.name || "")}" data-key="${escapeHtml(item.key || "")}" aria-label="${escapeHtml(spoken)}">
        <div class="fav-row-copy">
          <span class="fav-row-name">${escapeHtml(item.label)}</span>
          ${place}
        </div>
        <button type="button" class="fav-row-heart" aria-label="${escapeHtml(item.label)} vom Zettel streichen">${heartIconSolid}</button>
      </li>`;
    })
    .join("");
  return `<ul class="fav-sheet-list">${rows}</ul>`;
}

/**
 * @param {object} opts
 * @param {Array<{ key?: string, label: string, canteen?: string, places?: string[] }>} opts.items
 * @param {Array<{ key?: string, name?: string, label: string, places?: string[], onWeek?: boolean }>} [opts.saved]
 * @param {boolean} [opts.sheetOpen]
 * @param {Record<string, { name: string }> | null | undefined} opts.canteens
 */
export function hitsHtml({ items, saved = [], sheetOpen = false, canteens }) {
  const parked = parkedFavorites(saved, items);
  const rows = items
    .map((item) => {
      const places = item.places?.length ? item.places : item.canteen ? [item.canteen] : [];
      const where = placeAt(places, canteens);
      const spoken = where ? `${item.label} ${where}` : item.label;
      const canteen = item.canteen || places[0] || "";
      const placeName = (places.map((id) => canteens?.[id]?.name).filter(Boolean).join(" und ")) || where;
      const place = where
        ? `<span class="fav-row-place">${escapeHtml(where)}</span>`
        : "";
      return `<div class="toast-hit-item" data-name="${escapeHtml(item.name || "")}" data-key="${escapeHtml(item.key || "")}" data-canteen="${escapeHtml(canteen)}" data-label="${escapeHtml(item.label)}" data-place="${escapeHtml(placeName)}">
        <button type="button" class="toast-hit-go" aria-label="${escapeHtml(spoken)}"><span class="fav-row-name">${escapeHtml(item.label)}</span>${place}</button>
        <button type="button" class="fav-row-heart" aria-label="${escapeHtml(item.label)} vom Zettel streichen">${heartIconSolid}</button>
      </div>`;
    })
    .join("");
  return `<div class="toast-head">
      <p class="toast-kicker">${heartIcon}<span>Favoriten-Alarm</span></p>
      <button type="button" class="toast-gear" aria-expanded="${sheetOpen ? "true" : "false"}" aria-controls="fav-sheet" aria-label="Favoriten verwalten">${settingsIcon}</button>
    </div>
    <div class="toast-list">${rows}</div>
    <div id="fav-sheet" class="fav-sheet" ${sheetOpen ? "" : "inert"}>
      <div class="fav-sheet-inner">
      ${favSheetHtml(parked, canteens, !items.length && !parked.length)}
      </div>
    </div>`;
}
