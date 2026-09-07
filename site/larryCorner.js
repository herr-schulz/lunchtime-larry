/** Single Larry speech-bubble — toast-like, free drag, gravity snap. */

import { IDLE_TIP } from "./larryLines.js?v=2732cc18";

const SIDE_KEY = "lunchtime-larry-corner-side";

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

  try {
    const saved = localStorage.getItem(SIDE_KEY);
    if (saved === "left" || saved === "right") side = saved;
  } catch {
    /* private mode */
  }
  applySide();
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
  return root;
}

function applySide() {
  if (!root) return;
  root.dataset.side = side;
  root.classList.toggle("is-left", side === "left");
  root.classList.toggle("is-right", side === "right");
}

function persistSide() {
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    /* ignore */
  }
}

function setFace(open) {
  if (!faceImg) return;
  const next = open ? laughSrc : lazySrc;
  if (faceImg.getAttribute("src") !== next) faceImg.setAttribute("src", next);
}

function showLive() {
  if (!root) return;
  root.hidden = false;
  requestAnimationFrame(() => {
    root?.classList.add("is-live");
  });
}

function hideAway() {
  if (!root) return;
  root.classList.remove("is-live", "is-speaking", "is-dragging", "is-parked");
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
}

function paint(msg) {
  if (!kickerEl || !lineEl || !speech) return;
  kickerEl.textContent = msg.kicker || "";
  kickerEl.hidden = !msg.kicker;
  lineEl.textContent = msg.line || "";
  speech.hidden = false;
  root?.classList.remove("is-parked");
  setFace(true);
  showLive();
  root?.classList.remove("is-speaking");
  void root?.offsetWidth;
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
    face.style.left = `${Math.min(maxX, Math.max(4, moveX))}px`;
    face.style.top = `${Math.min(maxY, Math.max(4, moveY))}px`;
  });

  face.addEventListener("pointerup", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const wasDrag = dragged;
    const spoke = drag.spoke;
    drag = null;
    root?.classList.remove("is-dragging");

    if (!wasDrag) {
      clearFaceOffset();
      onFaceTap();
      return;
    }

    const mid = window.innerWidth / 2;
    const faceMid = (parseFloat(face.style.left) || 0) + face.offsetWidth / 2;
    side = faceMid < mid ? "left" : "right";
    applySide();
    persistSide();
    clearFaceOffset();

    if (spoke && history.length) {
      const msg = history[historyIndex] || history[history.length - 1];
      paint(msg);
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
