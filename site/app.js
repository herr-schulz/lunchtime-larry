import CANTEENS from "./canteens.json" with { type: "json" };
import {
  berlinHour,
  DAY_KEYS,
  formatDate,
  formatStamp,
  isoWeek,
  todayKey,
  watchBerlinMidnight,
} from "./calendar.js?v=e17d5bbb";
import { bindBoardGestures as wireBoardGestures } from "./boardGestures.js?v=687394ac";
import { boardHtml, hitsHtml } from "./boardRender.js?v=4a03b930";
import {
  alarmLabel,
  dishKey,
  displayDishName,
  findLikedDishes,
  isLiked,
  listAllFavorites,
  toggleLikeSet,
} from "./likes.js?v=f6717c2c";
import { bindLarryCorner, sayLarry } from "./larryCorner.js?v=72bfbecd";
import {
  favoritePoint,
  favoriteToday,
  leisureMode as leisureLine,
  likeAck,
  menuFreshNote,
  pizzaDaily,
  unlikeAck,
  voteFull,
  voteOffline,
  winnerLead,
  winnerTie,
} from "./larryLines.js?v=d6e94011";
import { LOCATIONS } from "./locations.js?v=87fbb02b";
import { loadMenu } from "./menuFetch.js?v=99f0e614";
import {
  berlinWeekday,
  isVoteDay,
  lastVoteDate,
  loadNick,
  nicksFor,
  normalizeNick,
  saveNick,
  winnerOf,
} from "./vote.js?v=1af723a0";
import {
  ensureVoteUser,
  listenVotes,
  toggleVote,
} from "./voteClient.js?v=795efc02";

const LIKES_KEY = "lunchtime-larry-likes";
const WEEKEND_NOTE_KEY = "lunchtime-larry-weekend-note";

const board = document.querySelector("#board");
const notices = document.querySelector("#notices");
const banner = document.querySelector("#banner");
const hits = document.querySelector("#hits");
const empty = document.querySelector("#empty");
const dayDate = document.querySelector("#day-date");
const marketBanner = document.querySelector("#market-banner");
const escapeWrap = document.querySelector("#escape-wrap");
const escapeSub = document.querySelector(".escape-sub");
const daysNav = document.querySelector(".days");
const kwEl = document.querySelector("#kw");
const stamp = document.querySelector("#stamp");
const nickEdit = document.querySelector("#nick-edit");
const nickDialog = document.querySelector("#nick-dialog");
const nickForm = document.querySelector("#nick-form");
const nickInput = document.querySelector("#nick-input");
const nickCancel = document.querySelector("#nick-cancel");
const weekendDialog = document.querySelector("#weekend-dialog");
const mascot = document.querySelector(".masthead .mascot");

let enterTimer;
let currentDay = "monday";
let likes = loadLikes();
let voteState = {
  counts: { stmuv: 0, sodexo: 0, bella23: 0 },
  records: {},
  mine: null,
  uid: null,
};
let lastWinnerKey = "";
let leisureMode = false;
let justLikedKey = "";
let menuData = null;
const announcedFavHits = new Set();


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

function votingOpen() {
  return currentDay === todayKey();
}

/** Menu freshness → Larry corner (not under nav). */
function larryMenuNote(data) {
  const issues = Object.entries(data.sources || {}).filter(([, src]) =>
    ["error", "stale"].includes(src.status),
  );
  const scraped = data.scrapedAt ? new Date(data.scrapedAt) : null;
  const old =
    scraped && !Number.isNaN(scraped.getTime())
      ? Date.now() - scraped.getTime() > 3 * 24 * 60 * 60 * 1000
      : false;
  return menuFreshNote({
    old,
    issueNames: issues.map(([id]) => CANTEENS[id]?.name ?? id),
    hour: berlinHour(),
    weekday: berlinWeekday(),
  });
}

function syncNotices() {
  if (!notices) return;
  notices.hidden = !(hits && !hits.hidden);
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
  const saved = listAllFavorites(likes, data.days, day);
  if (!found.length) {
    hits.hidden = true;
    hits.innerHTML = "";
    hits.classList.remove("is-sheet-open");
    syncNotices();
    return;
  }
  const sheetOpen = hits.classList.contains("is-sheet-open");
  const html = hitsHtml({ items: found, saved, sheetOpen, canteens: CANTEENS });
  const changed = hits.hidden || hits.innerHTML !== html;
  const gearFocus = document.activeElement?.closest?.(".toast-gear");
  hits.hidden = false;
  hits.innerHTML = html;
  hits.classList.toggle("is-sheet-open", sheetOpen);
  syncNotices();
  if (gearFocus) hits.querySelector(".toast-gear")?.focus();
  if (changed && !sheetOpen) popToast(hits);
}

function toggleFavSheet() {
  if (!hits || hits.hidden) return;
  const open = !hits.classList.contains("is-sheet-open");
  hits.classList.toggle("is-sheet-open", open);
  const gear = hits.querySelector(".toast-gear");
  const sheet = hits.querySelector("#fav-sheet");
  gear?.setAttribute("aria-expanded", String(open));
  if (sheet) sheet.inert = !open;
}

function syncDishHearts() {
  if (!board) return;
  for (const dish of board.querySelectorAll(".dish[data-name]")) {
    applyLikeState(dish, isLiked(dish.dataset.name, likes));
  }
}

function unlikeFavorite(name) {
  if (!name || !isLiked(name, likes)) return;
  hapticPulse();
  likes = toggleLikeSet(name, likes);
  saveLikes();
  syncDishHearts();
  if (menuData) renderHits(menuData, currentDay);
  sayLarry(unlikeAck(alarmLabel(name)));
}

function chromeOffset() {
  const switcher = document.querySelector(".day-switch");
  if (!switcher) return 16;
  const rect = switcher.getBoundingClientRect();
  if (rect.bottom > 0 && rect.top < window.innerHeight * 0.5) {
    return Math.round(rect.bottom + 10);
  }
  return 16;
}

function scrollToFavorite(canteen, key) {
  if (!board || !key) return false;
  const slip = canteen ? board.querySelector(`.slip[data-canteen="${canteen}"]`) : board;
  const dish =
    slip?.querySelector(`.dish[data-key="${CSS.escape(key)}"]`) ||
    board.querySelector(`.dish[data-key="${CSS.escape(key)}"]`);
  if (!dish) return false;
  const offset = chromeOffset();
  dish.style.scrollMarginTop = `${offset}px`;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  dish.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start", inline: "nearest" });
  dish.classList.remove("is-pointed");
  void dish.offsetWidth;
  dish.classList.add("is-pointed");
  window.setTimeout(() => dish.classList.remove("is-pointed"), 1200);
  return true;
}

function bindHits() {
  hits?.addEventListener("click", (event) => {
    if (event.target.closest(".toast-gear")) {
      toggleFavSheet();
      return;
    }
    const heart = event.target.closest(".fav-row-heart");
    if (heart) {
      const row = heart.closest("[data-name]");
      unlikeFavorite(row?.dataset.name || "");
      return;
    }
    const item = event.target.closest(".toast-hit-item");
    if (!item) return;
    const key = item.dataset.key || "";
    const canteen = item.dataset.canteen || "";
    const label = item.dataset.label || "";
    const place = item.dataset.place || "der Kantine";
    scrollToFavorite(canteen, key);
    if (label) sayLarry(favoritePoint(label, place));
  });

  /** @type {{ x: number, y: number, id: number, row: HTMLElement } | null} */
  let swipe = null;
  hits?.addEventListener("pointerdown", (event) => {
    const row = event.target.closest(".fav-row");
    if (!row || event.target.closest(".fav-row-heart")) return;
    if (!hits.classList.contains("is-sheet-open")) return;
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId, row };
  });
  hits?.addEventListener("pointermove", (event) => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dy) > Math.abs(dx) + 6) {
      swipe.row.style.transform = "";
      swipe.row.style.opacity = "";
      swipe = null;
      return;
    }
    if (Math.abs(dx) > 8) {
      swipe.row.style.transform = `translateX(${dx}px)`;
      swipe.row.style.opacity = String(Math.max(0.28, 1 - Math.abs(dx) / 170));
    }
  });
  const endSwipe = (event) => {
    if (!swipe || (event && swipe.id !== event.pointerId)) return;
    const dx = event ? event.clientX - swipe.x : 0;
    const row = swipe.row;
    const name = row.dataset.name || "";
    swipe = null;
    row.style.transform = "";
    row.style.opacity = "";
    if (Math.abs(dx) >= 56) unlikeFavorite(name);
  };
  hits?.addEventListener("pointerup", endSwipe);
  hits?.addEventListener("pointercancel", () => {
    if (!swipe) return;
    swipe.row.style.transform = "";
    swipe.row.style.opacity = "";
    swipe = null;
  });
}

function renderDay(data, day) {
  const block = data.days[day];
  dayDate.innerHTML = block ? formatDate(block.date) : "";
  marketBanner.hidden = day !== "thursday";
  board.innerHTML = boardHtml({
    block,
    canteens: CANTEENS,
    sources: data.sources,
    likes,
    votingOpen: votingOpen(),
  });
  renderHits(data, day);
  applyVoteUi();
  maybeWeekendBoardHint(day);
  maybeAnnounceFavoriteOnMenu(data, day);
}

function maybeWeekendBoardHint(day) {
  if (!dayDate) return;
  const weekend = !isVoteDay();
  dayDate.classList.toggle("is-weekend", weekend && day === "friday");
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

function replayCheck(el) {
  if (!el) return;
  el.classList.remove("is-drawn");
  void el.offsetWidth;
  el.classList.add("is-drawn");
}

function applyVoteUi() {
  const open = votingOpen();
  const names = Object.fromEntries(
    Object.entries(CANTEENS).map(([id, meta]) => [id, meta.name]),
  );
  const result = winnerOf(voteState.counts, names);
  for (const slip of board.querySelectorAll(".slip[data-canteen]")) {
    const id = slip.dataset.canteen;
    const mine = open && voteState.mine === id;
    const nickList = nicksFor(voteState.records, id);
    slip.classList.toggle("is-voted", mine);
    slip.classList.toggle(
      "is-leading",
      open && result.status === "lead" && result.id === id,
    );
    const mark = slip.querySelector(".vote-mark");
    if (!mark) continue;
    mark.hidden = !open;
    mark.setAttribute("aria-pressed", String(mine));
    const label = nickList.length
      ? nickList.join(" · ")
      : mine
        ? "Deine Stimme"
        : "Hierhin";
    mark.setAttribute("aria-label", label);
    const nicks = mark.querySelector(".vote-nicks");
    if (nicks) nicks.textContent = nickList.join(" · ");
    if (mine) {
      if (!mark.classList.contains("is-drawn")) replayCheck(mark);
    } else {
      mark.classList.remove("is-drawn");
    }
  }
  maybeAnnounceWinner(result, open);
}

function voteTotal() {
  return Object.values(voteState.counts).reduce((sum, n) => sum + (n || 0), 0);
}

function winnerStorageKey() {
  return `lunchtime-larry-winner-${lastVoteDate()}`;
}

function maybeAnnounceWinner(result, open) {
  if (!open) return;
  if (voteTotal() < 3) return;
  if (berlinHour() < 12) return;
  if (result.status !== "lead" && result.status !== "tie") return;

  const key =
    result.status === "lead" ? `lead:${result.id}` : "tie";
  try {
    if (localStorage.getItem(winnerStorageKey()) === key) return;
    localStorage.setItem(winnerStorageKey(), key);
  } catch {
    if (lastWinnerKey === key) return;
    lastWinnerKey = key;
  }

  if (result.status === "lead") {
    sayLarry(winnerLead(result.name));
  } else {
    sayLarry(winnerTie());
  }
}

function syncNickButton() {
  if (!nickEdit) return;
  const nick = loadNick();
  if (!nick) {
    nickEdit.hidden = true;
    nickEdit.textContent = "";
    return;
  }
  nickEdit.hidden = false;
  nickEdit.textContent = `Spitzname: ${nick}`;
}

function askNick() {
  if (!nickDialog || !nickInput) return Promise.resolve("");
  nickInput.value = loadNick();
  nickDialog.showModal();
  // Defer focus so iOS lays out the modal before the keyboard opens.
  requestAnimationFrame(() => {
    nickInput.focus({ preventScroll: true });
  });
  return new Promise((resolve) => {
    const onClose = () => {
      nickDialog.removeEventListener("close", onClose);
      resolve(nickDialog.returnValue === "ok" ? saveNick(nickInput.value) : "");
    };
    nickDialog.addEventListener("close", onClose, { once: true });
  });
}

async function handleVote(canteen) {
  if (!votingOpen()) return;
  let nick = loadNick();
  if (!nick) {
    nick = await askNick();
    if (!nick) return;
    syncNickButton();
  }
  try {
    voteState.mine = await toggleVote(
      canteen,
      voteState.mine,
      voteState.records,
    );
  } catch (err) {
    console.warn(err);
    const msg = String(err?.message || err);
    if (msg.includes("full")) {
      sayLarry(voteFull());
    } else {
      sayLarry(voteOffline());
    }
  }
}

function maybeWeekendNote() {
  if (isVoteDay() || !weekendDialog) return;
  const key = lastVoteDate();
  try {
    if (localStorage.getItem(WEEKEND_NOTE_KEY) === key) return;
  } catch {
    /* private mode */
  }
  weekendDialog.showModal();
  weekendDialog.focus({ preventScroll: true });
  weekendDialog.addEventListener(
    "close",
    () => {
      try {
        localStorage.setItem(WEEKEND_NOTE_KEY, key);
      } catch {
        /* ignore */
      }
    },
    { once: true },
  );
}

function bindNickUi() {
  nickInput?.addEventListener("input", () => {
    const cleaned = normalizeNick(nickInput.value);
    if (nickInput.value !== cleaned) nickInput.value = cleaned;
  });
  nickForm?.addEventListener("submit", () => {
    nickDialog.returnValue = "ok";
  });
  nickCancel?.addEventListener("click", () => {
    nickDialog.close("cancel");
  });
  nickEdit?.addEventListener("click", async () => {
    const nick = await askNick();
    if (nick) syncNickButton();
  });
}

function applyLikeState(dish, on) {
  const shown = displayDishName(dish.dataset.name || "");
  dish.classList.toggle("is-liked", on);
  dish.setAttribute("aria-pressed", String(on));
  dish.setAttribute("aria-label", on ? `${shown}, Favorit` : shown);
}

function hapticPulse() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate?.(16);
  } catch {
    /* desktop / iOS Safari ignore vibrate */
  }
}

function toggleDishLike(data, dish) {
  const name = dish.dataset.name;
  if (!name) return;
  hapticPulse();
  const wasLiked = isLiked(name, likes);
  likes = toggleLikeSet(name, likes);
  saveLikes();
  const on = isLiked(name, likes);
  applyLikeState(dish, on);
  syncDishHearts();
  renderHits(data, currentDay);
  if (on && !wasLiked) {
    const key = dishKey(name);
    const label = alarmLabel(name);
    justLikedKey = key;
    sayLarry(likeAck(label));
    window.setTimeout(() => {
      if (justLikedKey === key) justLikedKey = "";
    }, 800);
  } else if (wasLiked && !on) {
    sayLarry(unlikeAck(alarmLabel(name)));
  }
}

function maybeAnnounceFavoriteOnMenu(data, day) {
  const found = findLikedDishes(data.days?.[day], likes);
  for (const item of found) {
    if (!item.canteen) continue;
    if (item.key === justLikedKey) continue;
    const stampKey = `${day}:${item.key}`;
    if (announcedFavHits.has(stampKey)) continue;
    announcedFavHits.add(stampKey);
    const places = (item.places?.length ? item.places : [item.canteen]).filter(Boolean);
    const names = places.map((id) => CANTEENS[id]?.name).filter(Boolean);
    const place =
      names.length === 2
        ? `${names[0]} und ${names[1]}`
        : names.length > 2
          ? `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`
          : names[0] || "der Kantine";
    sayLarry(favoriteToday(item.label, place));
    return;
  }
}

function bindBoardGestures(data) {
  wireBoardGestures({
    board,
    dayKeys: DAY_KEYS,
    getDay: () => currentDay,
    selectDay: (day) => selectDay(data, day),
    toggleDishLike: (dish) => toggleDishLike(data, dish),
    votingOpen,
    onVote: (canteen) => handleVote(canteen),
    onPizzaHold: () => sayLarry(pizzaDaily()),
  });
}

function bindMascotEgg() {
  if (!mascot) return;
  let taps = 0;
  let reset = 0;
  mascot.style.cursor = "pointer";
  mascot.addEventListener("click", () => {
    window.clearTimeout(reset);
    taps += 1;
    reset = window.setTimeout(() => {
      taps = 0;
    }, 1400);
    if (taps < 5) return;
    taps = 0;
    if (leisureMode) return;
    leisureMode = true;
    const src = mascot.getAttribute("src") || "";
    mascot.setAttribute("src", src.includes("leisure") ? src : "./leisure-larry.svg");
    const kicker = document.querySelector(".masthead .kicker");
    if (kicker && !kicker.dataset.leisure) {
      kicker.dataset.leisure = "1";
      kicker.textContent = `${kicker.textContent} · Feierabend`;
    }
    sayLarry(leisureLine());
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    /* file:// or blocked */
  });
}

try {
  bindLarryCorner();
  bindHits();
  registerServiceWorker();
  const data = await loadMenu();
  menuData = data;
  kwEl.textContent = isoWeek(data.weekStart);
  stamp.textContent = `Stand: ${formatStamp(data.scrapedAt)}`;
  if (escapeSub) {
    escapeSub.textContent = `${LOCATIONS.length} Spots · ein paar Minuten zu Fuß`;
  }
  const note = larryMenuNote(data);
  if (note) sayLarry(note);
  if (banner) banner.hidden = true;
  syncNotices();
  board.hidden = false;
  escapeWrap.hidden = false;
  const start = todayKey();
  selectDay(data, start, { instantIndicator: true });
  bindDayNav(data);
  bindBoardGestures(data);
  bindNickUi();
  bindMascotEgg();
  syncNickButton();
  maybeWeekendNote();
  const onVotes = (next) => {
    voteState = next;
    applyVoteUi();
  };
  const startVotes = async () => {
    try {
      if (loadNick()) await ensureVoteUser();
    } catch {
      /* offline or missing database */
    }
    listenVotes(onVotes);
  };
  startVotes();
  watchBerlinMidnight(() => {
    const day = todayKey();
    if (currentDay !== day) selectDay(data, day, { instantIndicator: true });
    else applyVoteUi();
    startVotes();
  });
} catch {
  empty.hidden = false;
  stamp.textContent = "Stand: noch kein Crawl";
  const fallback = todayKey();
  syncTabs(DAY_KEYS.includes(fallback) ? fallback : "monday");
  bindLarryCorner();
  bindHits();
  bindMascotEgg();
  const miss = menuFreshNote({
    old: true,
    hour: berlinHour(),
    weekday: berlinWeekday(),
  });
  if (miss) sayLarry(miss);
}
