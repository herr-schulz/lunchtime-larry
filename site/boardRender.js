/** Pure HTML builders for the canteen board (no DOM writes). */

import { html, safeUrl } from "./dom.js?v=fef89c0f";
import { checkCircleSvg, heartIcon, heartIconFilled, heartIconSolid, penUnderlineSvg, settingsIcon } from "./icons.js?v=1393df62";
import { dishKey, isLiked, joinDishSides, parkedFavorites, phraseDish } from "./likes.js?v=9db8d9ec";

const DIET = {
  vegan: "vegan",
  veggie: "veggie",
  meat: "Fleisch",
  fish: "Fisch",
};

export function formatDishName(name, canteenId) {
  const { title, sides } = phraseDish(name, { canteen: canteenId });
  const heart = heartIconFilled;
  const titleRow = html`<span class="dish-title"><span class="dish-mark">${title}${penUnderlineSvg()}</span>${heart}</span>`;
  const withSides = joinDishSides(sides);
  if (!withSides) return titleRow;
  return html`${titleRow}<span class="dish-sides">${withSides}</span>`;
}

export function dishRow(dish, index, likes, canteenId) {
  const key = dishKey(dish.name);
  const kept = isLiked(dish.name, likes);
  const diet =
    dish.diet && DIET[dish.diet]
      ? html`<span class="pill ${dish.diet}">${DIET[dish.diet]}</span>`
      : "";
  const category = dish.category
    ? html`<span class="pill">${dish.category}</span>`
    : "";
  const price = dish.price ? html`<span class="price">${dish.price}</span>` : "";
  const spoken = phraseDish(dish.name, { canteen: canteenId }).spoken;
  const label = kept ? `${spoken}, Favorit` : spoken;
  return html`<article class="dish${kept ? " is-liked" : ""}" style="--dish-i:${index}" data-name="${dish.name}" data-key="${key}" role="button" tabindex="0" aria-pressed="${kept}" aria-label="${label}">
    <div class="name">${formatDishName(dish.name, canteenId)}</div>
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
 * @param {boolean} [opts.showVotes]
 * @param {boolean} [opts.weekStale]
 */
export function boardHtml({
  block,
  canteens,
  sources,
  likes,
  votingOpen,
  showVotes = false,
  weekStale = false,
}) {
  const slips = (block?.canteens ?? []).map((canteen, slipIndex) => {
    const meta = canteens[canteen.id];
    const source = sources?.[canteen.id];
    const href = safeUrl(meta?.url);
    let note = "";
    if (source?.status === "stale") {
      note = html`<p class="note">Alter Plan — Larry kam nicht durch. Stand kann veraltet sein.</p>`;
    }
    const empty = !canteen.dishes?.length;
    const body = canteen.dishes?.length
      ? canteen.dishes.map((dish, index) => dishRow(dish, index, likes, canteen.id))
      : html`<p class="note empty-menu"><a class="slip-menu-link" href="${href}" target="_blank" rel="noopener noreferrer">Zur Speisekarte</a> — heute nichts auf dem Zettel.</p>`;
    const pizza =
      canteen.id === "sodexo" && !empty
        ? html`<button type="button" class="pizza" data-pizza>Pizza täglich</button>`
        : "";
    const missStamp = empty
      ? html`<p class="pizza pizza-miss" role="status" aria-label="Speiseplan nicht verfügbar">Heute nix da</p>`
      : "";
    const weekStamp = weekStale
      ? html`<p class="pizza pizza-week" role="status" aria-label="Speiseplan von letzter Woche">Letzte Woche</p>`
      : "";
    const voteBtn = showVotes || votingOpen
      ? html`<button type="button" class="vote-mark" data-vote="${canteen.id}" aria-pressed="false"${votingOpen ? "" : " disabled"}><span class="vote-nicks"></span>${checkCircleSvg()}</button>`
      : "";
    return html`<section class="slip${weekStale ? " is-week-stale" : ""}" style="--slip-i:${slipIndex}" data-canteen="${canteen.id}">
        <div class="slip-head">
          <div>
            <h2>
              <a class="slip-name" href="${href}" target="_blank" rel="noopener noreferrer">${meta?.name}</a>
            </h2>
            <p class="where">${meta?.short}</p>
          </div>
          <div class="slip-aside">
            ${voteBtn}
          </div>
        </div>
        ${note}
        <div class="slip-list${empty ? " is-empty" : ""}">
          ${body}
          ${missStamp}
          ${weekStamp}
          ${pizza}
        </div>
      </section>`;
  });
  return html`${slips}`;
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
      ? html`<p class="fav-empty">Noch kein Favorit. Herz am Gericht reicht.</p>`
      : html``;
  }
  const rows = saved.map((item) => {
    const where = sheetPlace(item, canteens);
    const spoken = where ? `${item.label}, ${where}` : item.label;
    const off = !item.places?.length;
    const place = where
      ? html`<span class="fav-row-place${off ? " is-off" : ""}">${where}</span>`
      : "";
    return html`<li class="fav-row" data-name="${item.name || ""}" data-key="${item.key || ""}" data-canteen="${item.places?.[0] || ""}" aria-label="${spoken}">
        <div class="fav-row-copy">
          <span class="fav-row-name">${item.label}</span>
          ${place}
        </div>
        <button type="button" class="fav-row-heart" aria-label="${item.label} vom Zettel streichen">${heartIconSolid}</button>
      </li>`;
  });
  return html`<ul class="fav-sheet-list">${rows}</ul>`;
}

/**
 * @param {object} opts
 * @param {Array<{ key?: string, label: string, canteen?: string, places?: string[] }>} opts.items
 * @param {Array<{ key?: string, name?: string, label: string, places?: string[], onWeek?: boolean }>} [opts.saved]
 * @param {boolean} [opts.sheetOpen]
 * @param {Record<string, { name: string }> | null | undefined} opts.canteens
 * @param {boolean} [opts.weekStale]
 * @param {{ kicker?: string, line?: string } | null} [opts.staleNote]
 */
export function hitsHtml({
  items,
  saved = [],
  sheetOpen = false,
  canteens,
  weekStale = false,
  staleNote = null,
}) {
  if (weekStale) {
    const kicker = staleNote?.kicker || "Kein neuer Plan";
    const line = staleNote?.line || "Letzter Stand:\u00A0—";
    return html`<div class="toast-head">
      <p class="toast-kicker"><span>${kicker}</span></p>
    </div>
    <p class="toast-stale-copy">${line}</p>`;
  }
  const parked = parkedFavorites(saved, items);
  const rows = items.map((item) => {
    const places = item.places?.length ? item.places : item.canteen ? [item.canteen] : [];
    const where = placeAt(places, canteens);
    const spoken = where ? `${item.label} ${where}` : item.label;
    const canteen = item.canteen || places[0] || "";
    const placeName = (places.map((id) => canteens?.[id]?.name).filter(Boolean).join(" und ")) || where;
    const place = where
      ? html`<span class="fav-row-place">${where}</span>`
      : "";
    return html`<div class="toast-hit-item" data-name="${item.name || ""}" data-key="${item.key || ""}" data-canteen="${canteen}" data-label="${item.label}" data-place="${placeName}">
        <button type="button" class="toast-hit-go" aria-label="${spoken}"><span class="fav-row-name">${item.label}</span>${place}</button>
        <button type="button" class="fav-row-heart" aria-label="${item.label} vom Zettel streichen">${heartIconSolid}</button>
      </div>`;
  });
  return html`<div class="toast-head">
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
