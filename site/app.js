import CANTEENS from "./canteens.json" with { type: "json" };
import {
  berlinHour,
  DAY_KEYS,
  formatDate,
  formatStamp,
  isoWeek,
  todayKey,
  watchBerlinMidnight,
} from "./calendar.js?v=90d9b728";
import { bindBoardGestures as wireBoardGestures } from "./boardGestures.js?v=c641e16a";
import { boardHtml, hitsHtml } from "./boardRender.js?v=7d89d54b";
import {
  dishKey,
  dishLabel,
  displayDishName,
  findLikedDishes,
  isLiked,
  toggleLikeSet,
} from "./likes.js?v=2839e39f";
import { bindLarryCorner, sayLarry } from "./larryCorner.js?v=0d0bfddd";
import {
  favoriteToday,
  leisureMode as leisureLine,
  likeAck,
  menuFreshNote,
  pizzaDaily,
  voteFull,
  voteOffline,
  winnerLead,
  winnerTie,
} from "./larryLines.js?v=1769de5f";
import { LOCATIONS } from "./locations.js?v=cb8d289e";
import { loadMenu } from "./menuFetch.js?v=64fd5683";
import {
  isVoteDay,
  lastVoteDate,
  loadNick,
  nicksFor,
  normalizeNick,
  saveNick,
  winnerOf,
} from "./vote.js?v=a52b5e64";
import {
  ensureVoteUser,
  listenVotes,
  toggleVote,
} from "./voteClient.js?v=b2f9ffc6";

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
  if (!found.length) {
    hits.hidden = true;
    hits.innerHTML = "";
    syncNotices();
    return;
  }
  const html = hitsHtml(found);
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
  for (const other of board.querySelectorAll(".dish[data-name]")) {
    if (other === dish) continue;
    applyLikeState(other, isLiked(other.dataset.name, likes));
  }
  renderHits(data, currentDay);
  if (on && !wasLiked) {
    const key = dishKey(name);
    const label = dishLabel(name);
    justLikedKey = key;
    sayLarry(likeAck(label));
    window.setTimeout(() => {
      if (justLikedKey === key) justLikedKey = "";
    }, 800);
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
    const place = CANTEENS[item.canteen]?.name ?? "der Kantine";
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
  registerServiceWorker();
  const data = await loadMenu();
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
  bindMascotEgg();
}
