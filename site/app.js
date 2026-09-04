import CANTEENS from "./canteens.json" with { type: "json" };
import { alertIcon, heartIcon, heartIconFilled } from "./icons.js";
import {
  dishKey,
  displayDishName,
  findLikedDishes,
  isLiked,
  toggleLikeSet,
} from "./likes.js";

const DAYS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
};

const DAY_KEYS = Object.keys(DAYS);

const DIET = {
  vegan: "vegan",
  veggie: "veggie",
  meat: "Fleisch",
  fish: "Fisch",
};

const LIKES_KEY = "lunchtime-larry-likes";

const board = document.querySelector("#board");
const notices = document.querySelector("#notices");
const banner = document.querySelector("#banner");
const hits = document.querySelector("#hits");
const empty = document.querySelector("#empty");
const dayDate = document.querySelector("#day-date");
const marketBanner = document.querySelector("#market-banner");
const escapeWrap = document.querySelector("#escape-wrap");
const daysNav = document.querySelector(".days");
const kwEl = document.querySelector("#kw");
const stamp = document.querySelector("#stamp");

const LIVE_MENU =
  "https://herr-schulz.github.io/lunchtime-larry/data/menu.json";

let enterTimer;
let currentDay = "monday";
let likes = loadLikes();

function loadLikes() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIKES_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveLikes() {
  localStorage.setItem(LIKES_KEY, JSON.stringify([...likes]));
}

function isoWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
}

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
    date,
  );
  const when = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
  }).format(date);
  return `<span class="weekday">${weekday}</span><span class="when">${when}</span>`;
}

function formatStamp(iso) {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function todayKey() {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(new Date())
    .toLowerCase();
  if (day === "saturday" || day === "sunday") return "friday";
  return day;
}

function bannerText(data) {
  const issues = Object.entries(data.sources || {}).filter(([, src]) =>
    ["error", "stale"].includes(src.status),
  );
  if (!issues.length) return "";
  if (issues.every(([, src]) => src.status === "error") && issues.length === 3) {
    const last = data.lastSuccessAt ? formatStamp(data.lastSuccessAt) : null;
    return last
      ? `Heute kein frischer Speiseplan. Letzter Stand: ${last}.`
      : "Heute kein frischer Speiseplan — der Crawl ist fehlgeschlagen.";
  }
  return issues
    .map(([id, src]) => {
      const name = CANTEENS[id]?.name ?? id;
      if (src.status === "stale") {
        return `${name}: letzter bekannter Plan (Aktualisierung fehlgeschlagen).`;
      }
      return `${name}: Speiseplan gerade nicht geladen.`;
    })
    .join(" ");
}

function formatDishName(name) {
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

function dishRow(dish, index) {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function syncNotices() {
  if (!notices) return;
  const open = Boolean(
    (banner && !banner.hidden) || (hits && !hits.hidden),
  );
  notices.hidden = !open;
}

function popToast(toast) {
  if (!toast || toast.hidden) return;
  toast.classList.remove("is-popping");
  void toast.offsetWidth;
  toast.classList.add("is-popping");
}

function renderHits(data, day) {
  if (!hits) return;
  const found = findLikedDishes(data.days?.[day], likes);
  if (!found.length) {
    hits.hidden = true;
    hits.innerHTML = "";
    syncNotices();
    return;
  }
  const html = `<p class="toast-kicker">${heartIcon}<span>Favoriten-Alarm</span></p><p class="toast-list">${found.map((item) => escapeHtml(item.label)).join(" · ")}</p>`;
  const changed = hits.hidden || hits.innerHTML !== html;
  hits.hidden = false;
  hits.innerHTML = html;
  syncNotices();
  if (changed) popToast(hits);
}

function renderDay(data, day) {
  const block = data.days[day];
  dayDate.innerHTML = block ? formatDate(block.date) : "";
  marketBanner.hidden = day !== "thursday";
  board.innerHTML = (block?.canteens ?? [])
    .map((canteen, slipIndex) => {
      const meta = CANTEENS[canteen.id];
      const source = data.sources?.[canteen.id];
      const pizza =
        canteen.id === "sodexo" ? `<span class="pizza">Pizza täglich</span>` : "";
      let note = "";
      if (source?.status === "error") {
        note = `<p class="note">Speiseplan gerade nicht geladen.</p>`;
      } else if (source?.status === "stale") {
        note = `<p class="note">Letzter bekannter Plan — Aktualisierung fehlgeschlagen.</p>`;
      }
      const body = canteen.dishes?.length
        ? canteen.dishes.map((dish, index) => dishRow(dish, index)).join("")
        : source?.status === "error"
          ? ""
          : `<p class="ghost">Heute nichts eingetragen.</p>`;
      return `<section class="slip" style="--slip-i:${slipIndex}">
        <div class="slip-head">
          <div>
            <h2>
              <a class="slip-name" href="${meta.url}" target="_blank" rel="noopener noreferrer">${meta.name}</a>
            </h2>
            <p class="where">${meta.short}</p>
          </div>
          ${pizza}
        </div>
        ${note}
        ${body}
      </section>`;
    })
    .join("");
  renderHits(data, day);
}

function updateDayIndicator(day, { instant = false } = {}) {
  if (!daysNav) return;
  const index = Math.max(0, DAY_KEYS.indexOf(day));
  if (instant) daysNav.classList.remove("is-ready");
  daysNav.style.setProperty("--tab", String(index));
  if (instant) {
    void daysNav.offsetWidth;
    daysNav.classList.add("is-ready");
  } else {
    daysNav.classList.add("is-ready");
  }
}

function playEnterAnimation() {
  board.classList.remove("is-entering");
  dayDate.classList.remove("is-entering");
  if (marketBanner) marketBanner.classList.remove("is-entering");
  window.clearTimeout(enterTimer);
  void board.offsetWidth;
  board.classList.add("is-entering");
  dayDate.classList.add("is-entering");
  if (marketBanner && !marketBanner.hidden) {
    marketBanner.classList.add("is-entering");
  }
  enterTimer = window.setTimeout(() => {
    board.classList.remove("is-entering");
    dayDate.classList.remove("is-entering");
    if (marketBanner) marketBanner.classList.remove("is-entering");
  }, 900);
}

function tabButtons() {
  return [...document.querySelectorAll(".days [role='tab']")];
}

function syncTabs(day) {
  for (const button of tabButtons()) {
    const selected = button.dataset.day === day;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  if (board) board.setAttribute("aria-labelledby", `tab-${day}`);
}

function selectDay(data, day, { instantIndicator = false } = {}) {
  currentDay = day;
  syncTabs(day);
  updateDayIndicator(day, { instant: instantIndicator });
  renderDay(data, day);
  playEnterAnimation();
}

function bindDayNav(data) {
  if (!daysNav) return;
  daysNav.addEventListener("click", (event) => {
    const button = event.target.closest("[role='tab']");
    if (!button?.dataset.day) return;
    selectDay(data, button.dataset.day);
  });
  daysNav.addEventListener("keydown", (event) => {
    const buttons = tabButtons();
    const current = document.activeElement;
    const index = buttons.indexOf(current);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (index + 1) % buttons.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (index - 1 + buttons.length) % buttons.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = buttons.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const day = buttons[next].dataset.day;
    selectDay(data, day);
    buttons[next].focus();
  });
}

function applyLikeState(dish, on) {
  const shown = displayDishName(dish.dataset.name || "");
  dish.classList.toggle("is-liked", on);
  dish.setAttribute("aria-pressed", String(on));
  dish.setAttribute("aria-label", on ? `${shown}, Favorit` : shown);
}

function toggleDishLike(data, dish) {
  const name = dish.dataset.name;
  if (!name) return;
  likes = toggleLikeSet(name, likes);
  saveLikes();
  const on = isLiked(name, likes);
  applyLikeState(dish, on);
  for (const other of board.querySelectorAll(".dish[data-name]")) {
    if (other === dish) continue;
    applyLikeState(other, isLiked(other.dataset.name, likes));
  }
  renderHits(data, currentDay);
}

function bindBoardGestures(data) {
  if (!board) return;
  let origin = null;
  let swiped = false;
  let lastTap = null;

  board.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a")) return;
    origin = { x: event.clientX, y: event.clientY, id: event.pointerId, type: event.pointerType };
    swiped = false;
  });
  board.addEventListener("pointermove", (event) => {
    if (!origin || origin.id !== event.pointerId) return;
    if (Math.abs(event.clientX - origin.x) > 28) swiped = true;
  });
  board.addEventListener("pointerup", (event) => {
    if (!origin || origin.id !== event.pointerId) return;
    const { x, y, type } = origin;
    origin = null;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (swiped || (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.4)) {
      lastTap = null;
      const index = DAY_KEYS.indexOf(currentDay);
      const next = dx < 0 ? index + 1 : index - 1;
      if (next >= 0 && next < DAY_KEYS.length) selectDay(data, DAY_KEYS[next]);
      return;
    }
    const dish = event.target.closest(".dish");
    if (!dish || event.target.closest("a")) return;
    if (type === "touch") {
      const now = performance.now();
      if (lastTap && lastTap.key === dish.dataset.key && now - lastTap.t < 340) {
        lastTap = null;
        toggleDishLike(data, dish);
      } else {
        lastTap = { key: dish.dataset.key, t: now };
      }
      return;
    }
    toggleDishLike(data, dish);
  });
  board.addEventListener("pointercancel", () => {
    origin = null;
    lastTap = null;
  });
  board.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a")) return;
    const dish = event.target.closest(".dish");
    if (!dish || event.target !== dish) return;
    event.preventDefault();
    toggleDishLike(data, dish);
  });
}

async function loadMenu() {
  try {
    const local = await fetch("./data/menu.json", { cache: "no-store" });
    if (local.ok) return local.json();
  } catch {
    /* file:// or missing local copy */
  }
  const live = await fetch(LIVE_MENU, { cache: "no-store" });
  if (!live.ok) throw new Error("missing");
  return live.json();
}

try {
  const data = await loadMenu();
  kwEl.textContent = isoWeek(data.weekStart);
  stamp.textContent = `Stand: ${formatStamp(data.scrapedAt)}`;
  const message = bannerText(data);
  if (message) {
    banner.hidden = false;
    banner.innerHTML = `<p class="toast-kicker">${alertIcon}<span>Hinweis</span></p><p class="toast-list">${escapeHtml(message)}</p>`;
  }
  syncNotices();
  popToast(banner);
  board.hidden = false;
  escapeWrap.hidden = false;
  const start = todayKey();
  selectDay(data, start, { instantIndicator: true });
  bindDayNav(data);
  bindBoardGestures(data);
} catch {
  empty.hidden = false;
  stamp.textContent = "Stand: noch kein Crawl";
  const fallback = todayKey();
  syncTabs(DAY_KEYS.includes(fallback) ? fallback : "monday");
}
