/** Single Larry speech-bubble — toast-like, free drag, gravity snap. */

import { IDLE_TIP } from "./larryLines.js?v=722807d7";

const DOCK_KEY = "lunchtime-larry-corner-dock";
const SIDE_KEY = "lunchtime-larry-corner-side";
const SCROLL_SNAP = 72;

let root = null;
let face = null;
let faceImg = null;
let speech = null;
let bubble = null;
let kickerEl = null;
let lineEl = null;
/** @type {{ kicker?: string, line: string }[]} */
let history = [];
let historyIndex = -1;
let speaking = false;
/** @type {"left" | "right"} */
let side = "right";
/** @type {"top" | "bottom"} */
let edge = "bottom";
let lazySrc = "./lazy-larry.svg";
let laughSrc = "./laughing-larry.svg";
/**
 * @type {{
 *   id: number,
 *   startX: number,
 *   startY: number,
 *   originX: number,
 *   originY: number,
 *   spoke: boolean,
 * } | null}
 */
let drag = null;
let dragged = false;
let scrollY = 0;
let scrollAccum = 0;
let dockLockUntil = 0;
let boundChrome = false;

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/** @param {string | null} value */
function parseDock(value) {
  const match = /^(left|right)-(top|bottom)$/.exec(value || "");
  if (!match) return null;
  return { side: /** @type {"left" | "right"} */ (match[1]), edge: /** @type {"top" | "bottom"} */ (match[2]) };
}

function readDock() {
  try {
    const saved = parseDock(localStorage.getItem(DOCK_KEY));
    if (saved) return saved;
    const legacy = localStorage.getItem(SIDE_KEY);
    if (legacy === "left" || legacy === "right") {
      return { side: /** @type {"left" | "right"} */ (legacy), edge: "bottom" };
    }
  } catch {
    /* private mode */
  }
  return { side: /** @type {"left" | "right"} */ ("right"), edge: /** @type {"top" | "bottom"} */ ("bottom") };
}

function persistDock() {
  try {
    localStorage.setItem(DOCK_KEY, `${side}-${edge}`);
  } catch {
    /* ignore */
  }
}

function pageGutterPx() {
  const raw = (
    getComputedStyle(document.documentElement).getPropertyValue("--page-gutter") || "1rem"
  ).trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 16;
  if (raw.endsWith("rem")) {
    const fs = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return value * (Number.isFinite(fs) ? fs : 16);
  }
  return value;
}

function updateTopInset() {
  if (!root) return;
  const gutter = pageGutterPx();
  const days = document.querySelector(".days");
  const bleed = document.querySelector(".status-bleed");
  const safeBottom = bleed ? bleed.getBoundingClientRect().bottom : 0;
  let top = Math.max(gutter, safeBottom);
  if (days) {
    const rect = days.getBoundingClientRect();
    const inTopBand = rect.bottom > 0 && rect.top < window.innerHeight * 0.4;
    if (inTopBand) top = Math.max(top, rect.bottom + gutter * 0.45);
  }
  root.style.setProperty("--larry-top", `${Math.round(top)}px`);
}

function applyDock() {
  if (!root) return;
  updateTopInset();
  root.dataset.side = side;
  root.dataset.edge = edge;
  root.classList.toggle("is-left", side === "left");
  root.classList.toggle("is-right", side === "right");
  root.classList.toggle("is-top", edge === "top");
  root.classList.toggle("is-bottom", edge === "bottom");
}

/** @param {DOMRect} first */
function flipRootFrom(first) {
  if (!root || prefersReducedMotion()) return;
  const last = root.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  root.classList.add("is-docking");
  root.style.transition = "none";
  root.style.transform = `translate(${dx}px, ${dy}px)`;
  void root.offsetWidth;
  root.style.transition = "";
  root.style.transform = "";
  const clear = () => {
    root?.classList.remove("is-docking");
    root?.removeEventListener("transitionend", onEnd);
  };
  /** @param {TransitionEvent} event */
  const onEnd = (event) => {
    if (event.target === root && event.propertyName === "transform") clear();
  };
  root.addEventListener("transitionend", onEnd);
  window.setTimeout(clear, 520);
}

/** @param {DOMRect} rect */
function settleFaceFrom(rect) {
  if (!face || prefersReducedMotion()) return;
  const last = face.getBoundingClientRect();
  const dx = rect.left - last.left;
  const dy = rect.top - last.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  root?.classList.add("is-settling");
  face.style.transition = "none";
  face.style.transform = `translate(${dx}px, ${dy}px)`;
  void face.offsetWidth;
  face.style.transition = "";
  face.style.transform = "";
  const clear = () => {
    root?.classList.remove("is-settling");
    face?.removeEventListener("transitionend", onEnd);
  };
  /** @param {TransitionEvent} event */
  const onEnd = (event) => {
    if (event.target === face && event.propertyName === "transform") clear();
  };
  face.addEventListener("transitionend", onEnd);
  window.setTimeout(clear, 520);
}

/** @param {"top" | "bottom"} next */
function setEdge(next, persist = true) {
  if (next === edge) return;
  const first =
    root?.classList.contains("is-live") && !root.hidden ? root.getBoundingClientRect() : null;
  edge = next;
  applyDock();
  if (persist) persistDock();
  if (first) flipRootFrom(first);
  dockLockUntil = Date.now() + 480;
}

/** @param {"left" | "right"} next */
function previewSide(next) {
  if (next === side || !root) return;
  side = next;
  root.dataset.side = side;
  root.classList.toggle("is-left", side === "left");
  root.classList.toggle("is-right", side === "right");
}

function onPageScroll() {
  updateTopInset();
  if (!root || root.hidden || drag || Date.now() < dockLockUntil) return;
  const y = Math.max(0, window.scrollY);
  const dy = y - scrollY;
  scrollY = y;
  if (Math.abs(dy) < 1) return;
  if (scrollAccum !== 0 && Math.sign(dy) !== Math.sign(scrollAccum)) {
    scrollAccum = dy;
  } else {
    scrollAccum += dy;
  }
  if (scrollAccum > SCROLL_SNAP && edge === "bottom") {
    scrollAccum = 0;
    setEdge("top");
  } else if (scrollAccum < -SCROLL_SNAP && edge === "top") {
    scrollAccum = 0;
    setEdge("bottom");
  }
}

function ensureDom() {
  if (root) return root;
  root = document.querySelector("#larry-corner");
  if (!root) return null;
  face = root.querySelector(".larry-face");
  faceImg = root.querySelector(".larry-face-img");
  speech = root.querySelector(".larry-speech");
  bubble = root.querySelector(".larry-bubble");
  kickerEl = root.querySelector(".larry-kicker");
  lineEl = root.querySelector(".larry-line");

  if (faceImg) {
    lazySrc = faceImg.dataset.lazy || lazySrc;
    laughSrc = faceImg.dataset.laugh || faceImg.getAttribute("src") || laughSrc;
  }

  const dock = readDock();
  side = dock.side;
  edge = dock.edge;
  applyDock();
  setFace(false);
  hideAway();

  root.querySelector(".larry-dismiss")?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideBubble();
  });
  bubble?.addEventListener("click", () => {
    hideBubble();
  });
  bindFaceDrag();
  if (!boundChrome) {
    boundChrome = true;
    scrollY = Math.max(0, window.scrollY);
    window.addEventListener("scroll", onPageScroll, { passive: true });
    window.addEventListener("resize", updateTopInset);
    window.visualViewport?.addEventListener("resize", updateTopInset);
  }
  return root;
}

function setFace(open) {
  if (!faceImg) return;
  const next = open ? laughSrc : lazySrc;
  if (faceImg.getAttribute("src") !== next) faceImg.setAttribute("src", next);
}

function showLive() {
  if (!root) return;
  root.hidden = false;
  updateTopInset();
  requestAnimationFrame(() => {
    root?.classList.add("is-live");
  });
}

function hideAway() {
  if (!root) return;
  root.classList.remove("is-live", "is-speaking", "is-dragging", "is-parked", "is-docking", "is-settling");
  root.hidden = true;
  clearFaceOffset();
  speaking = false;
}

function clearFaceOffset() {
  if (!face) return;
  face.style.position = "";
  face.style.left = "";
  face.style.top = "";
  face.style.right = "";
  face.style.bottom = "";
  face.style.transform = "";
  face.style.zIndex = "";
  face.style.transition = "";
}

function paint(msg, { pop = true } = {}) {
  if (!kickerEl || !lineEl || !speech) return;
  kickerEl.textContent = msg.kicker || "";
  kickerEl.hidden = !msg.kicker;
  lineEl.textContent = msg.line || "";
  speech.hidden = false;
  root?.classList.remove("is-parked");
  setFace(true);
  showLive();
  if (pop) {
    root?.classList.remove("is-speaking");
    void root?.offsetWidth;
  }
  root?.classList.add("is-speaking");
  speaking = true;
}

/** Dismiss bubble; keep face parked (lazy) if history exists. */
function hideBubble() {
  if (!speech) return;
  speech.hidden = true;
  root?.classList.remove("is-speaking");
  speaking = false;
  setFace(false);
  if (history.length) {
    root?.classList.add("is-parked");
    showLive();
    return;
  }
  hideAway();
}

function onFaceTap() {
  ensureDom();
  if (!history.length) {
    history = [IDLE_TIP];
    historyIndex = 0;
    paint(IDLE_TIP);
    return;
  }
  if (!speaking) {
    historyIndex = history.length - 1;
    paint(history[historyIndex]);
    return;
  }
  historyIndex = (historyIndex - 1 + history.length) % history.length;
  paint(history[historyIndex]);
}

function bindFaceDrag() {
  if (!face) return;

  face.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    dragged = false;
    const rect = face.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      spoke: Boolean(speaking && speech && !speech.hidden),
    };
    root?.classList.add("is-dragging");
    face.setPointerCapture?.(event.pointerId);
  });

  face.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId || !face) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!dragged && Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

    if (!dragged) {
      dragged = true;
      face.style.position = "fixed";
      face.style.left = `${drag.originX}px`;
      face.style.top = `${drag.originY}px`;
      face.style.right = "auto";
      face.style.bottom = "auto";
      face.style.zIndex = "30";
      if (speech) speech.hidden = true;
      root?.classList.remove("is-speaking", "is-parked");
      speaking = false;
      setFace(false);
    }

    const moveX = drag.originX + dx;
    const moveY = drag.originY + dy;
    const maxX = window.innerWidth - face.offsetWidth - 4;
    const maxY = window.innerHeight - face.offsetHeight - 4;
    const left = Math.min(maxX, Math.max(4, moveX));
    const top = Math.min(maxY, Math.max(4, moveY));
    face.style.left = `${left}px`;
    face.style.top = `${top}px`;
    previewSide(left + face.offsetWidth / 2 < window.innerWidth / 2 ? "left" : "right");
  });

  face.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const wasDrag = dragged;
    const spoke = drag.spoke;
    const faceRect = face?.getBoundingClientRect();
    drag = null;
    root?.classList.remove("is-dragging");

    if (!wasDrag) {
      clearFaceOffset();
      onFaceTap();
      return;
    }

    if (faceRect) {
      const faceMidX = faceRect.left + faceRect.width / 2;
      const faceMidY = faceRect.top + faceRect.height / 2;
      side = faceMidX < window.innerWidth / 2 ? "left" : "right";
      edge = faceMidY < window.innerHeight / 2 ? "top" : "bottom";
    }
    applyDock();
    persistDock();
    clearFaceOffset();
    if (faceRect) settleFaceFrom(faceRect);
    dockLockUntil = Date.now() + 480;
    scrollAccum = 0;

    if (spoke && history.length) {
      const msg = history[historyIndex] || history[history.length - 1];
      paint(msg, { pop: false });
    } else if (history.length) {
      setFace(false);
      root?.classList.add("is-parked");
      showLive();
    }
  });

  face.addEventListener("pointercancel", () => {
    drag = null;
    dragged = false;
    root?.classList.remove("is-dragging");
    clearFaceOffset();
    applyDock();
    if (history.length) {
      setFace(false);
      root?.classList.add("is-parked");
      showLive();
    }
  });
}

/**
 * Show or replace the single bubble. Does not stack. Stays until dismiss.
 * @param {{ kicker?: string, line: string }} msg
 */
export function sayLarry(msg) {
  if (!msg?.line) return;
  ensureDom();
  const next = { kicker: msg.kicker || "", line: msg.line };
  const last = history[history.length - 1];
  if (last && last.kicker === next.kicker && last.line === next.line) {
    if (!speaking) {
      historyIndex = history.length - 1;
      paint(next);
    }
    return;
  }
  history.push(next);
  if (history.length > 12) history.shift();
  historyIndex = history.length - 1;
  paint(next);
}

export function bindLarryCorner() {
  ensureDom();
}
