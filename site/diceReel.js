import { listMainDishes } from "./dice.js?v=b5a71252";
import { escapeHtml } from "./dom.js?v=d3d5b527";
import { dishKey, phraseDish } from "./likes.js?v=9db8d9ec";
import { berlinDate } from "./vote.js?v=0b6f336e";

export const REEL_COPIES = 3;
export const OVERSHOOT_PX = 2;
export const SPIN_MS = 2200;
export const SNAP_MS = 160;
export const SPIN_EASE = "cubic-bezier(0.12, 0.62, 0.08, 1)";
export const SNAP_EASE = "cubic-bezier(0.22, 0.8, 0.28, 1)";
export const SHAKE_DELTA = 15;

/** Monday of the Berlin calendar week, `YYYY-MM-DD`. */
export function berlinWeekMonday(now = new Date()) {
  const [year, month, day] = berlinDate(now).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (weekday - 1));
  return date.toISOString().slice(0, 10);
}

/** Menu from an earlier Berlin week. Same week is fresh, even on Monday. */
export function isStaleMenuWeek(weekStart, monday) {
  if (!weekStart || !monday) return false;
  return String(weekStart) < String(monday);
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * @param {number | null} previous
 * @param {{ x?: number, y?: number, z?: number } | null | undefined} acceleration
 */
export function shakeDelta(previous, acceleration) {
  const x = acceleration?.x;
  const y = acceleration?.y;
  const z = acceleration?.z;
  if (![x, y, z].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return { next: previous, hit: false };
  }
  const mag = Math.hypot(x, y, z);
  if (previous == null) return { next: mag, hit: false };
  return { next: mag, hit: Math.abs(mag - previous) >= SHAKE_DELTA };
}

/**
 * Today's mains, phrased. Desserts never appear.
 * @param {Parameters<typeof listMainDishes>[0]} block
 * @param {Record<string, { name?: string }>} canteens
 */
export function dishEntries(block, canteens) {
  return listMainDishes(block).map(({ canteenId, dish }) => ({
    kind: "dish",
    label: phraseDish(dish.name, { canteen: canteenId }).title,
    hint: canteens?.[canteenId]?.name || "",
    canteenId,
    key: dishKey(dish.name),
  }));
}

/** Canteens that still have a main today, in first-seen order. */
export function canteenEntries(block, canteens) {
  /** @type {string[]} */
  const ids = [];
  for (const { canteenId } of listMainDishes(block)) {
    if (!canteenId || ids.includes(canteenId)) continue;
    ids.push(canteenId);
  }
  return ids.map((canteenId) => ({
    kind: "canteen",
    label: canteens?.[canteenId]?.name || canteenId,
    hint: "",
    canteenId,
    key: canteenId,
  }));
}

/** @param {Array<{ name?: string, vibe?: string }> | null | undefined} locations */
export function spotEntries(locations) {
  return (Array.isArray(locations) ? locations : []).map((spot) => ({
    kind: "spot",
    label: String(spot?.name || ""),
    hint: String(spot?.vibe || ""),
    key: String(spot?.name || ""),
  }));
}

export function reelMarkup(entries, copies = REEL_COPIES) {
  if (!entries?.length) {
    return `<div class="reel-row is-empty"><span class="reel-label">Nichts auf dem Zettel.</span></div>`;
  }
  const rows = [];
  for (let copy = 0; copy < copies; copy += 1) {
    entries.forEach((entry, index) => {
      rows.push(
        `<div class="reel-row" data-copy="${copy}" data-index="${index}"><span class="reel-label">${escapeHtml(entry.label)}</span></div>`,
      );
    });
  }
  return rows.join("");
}

/** translateY that parks `index` of the given copy in the center row. */
export function reelTranslateY({
  length,
  index,
  copies = REEL_COPIES,
  rowHeight,
  center = 1,
}) {
  if (length <= 0 || rowHeight <= 0) return 0;
  const safe = Math.min(length - 1, Math.max(0, index));
  const landing = (copies - 1) * length + safe;
  return -((landing - center) * rowHeight);
}

/**
 * Index is an input. The offsets only describe how to ease onto that row.
 * Reduced motion skips travel and overshoot.
 */
export function planSpin({
  length,
  index,
  copies = REEL_COPIES,
  rowHeight,
  reduced = false,
}) {
  const endY = reelTranslateY({ length, index, copies, rowHeight });
  const startY = reduced
    ? endY
    : reelTranslateY({ length, index: 0, copies: 1, rowHeight });
  return {
    index: length <= 0 ? 0 : Math.min(length - 1, Math.max(0, index)),
    startY,
    endY,
    overshootY: endY - (reduced ? 0 : OVERSHOOT_PX),
    reduced,
    spinMs: reduced ? 0 : SPIN_MS,
    snapMs: reduced ? 0 : SNAP_MS,
    easing: SPIN_EASE,
  };
}

/**
 * One ticket dialog, one strip. `pick` runs before any motion.
 * @param {object} opts
 * @param {HTMLElement | null} opts.openButton
 * @param {HTMLDialogElement | null} opts.dialog
 * @param {(mode: string) => Array<{ label: string, hint?: string, kind?: string, key?: string, canteenId?: string }>} opts.getEntries
 * @param {(mode: string) => { index: number, entry: { label: string, hint?: string, kind?: string, key?: string, canteenId?: string } } | null} opts.pick
 * @param {(entry: { label: string, hint?: string, kind?: string, key?: string, canteenId?: string }) => void} [opts.onShow]
 * @param {boolean} [opts.showStale]
 * @param {boolean} [opts.modes]
 */
export function mountDice({
  openButton,
  dialog,
  getEntries,
  pick,
  onShow,
  showStale = false,
  modes = false,
}) {
  if (!openButton || !dialog) return;
  const strip = dialog.querySelector(".reel-strip");
  const hint = dialog.querySelector(".reel-hint");
  const live = dialog.querySelector(".reel-live");
  const stale = dialog.querySelector(".dice-stale");
  const go = dialog.querySelector("[data-dice='go']");
  const again = dialog.querySelector("[data-dice='again']");
  const show = dialog.querySelector("[data-dice='show']");
  const tabs = [...dialog.querySelectorAll("[data-dice-mode]")];
  if (!strip || !go) return;

  let mode = "dish";
  let spinning = false;
  /** @type {{ label: string, hint?: string, kind?: string, key?: string, canteenId?: string } | null} */
  let last = null;
  /** @type {number | null} */
  let shakeMag = null;
  /** @type {number} */
  let rowHeight = 44;

  if (stale) stale.hidden = !showStale;
  if (!modes) {
    for (const tab of tabs) tab.hidden = true;
  }

  function measure() {
    const row = strip.querySelector(".reel-row");
    const height = row?.getBoundingClientRect().height ?? 0;
    if (height > 0) rowHeight = height;
    return rowHeight;
  }

  function paint(parkIndex = 0) {
    const entries = getEntries(mode) ?? [];
    strip.innerHTML = reelMarkup(entries);
    const y = reelTranslateY({
      length: entries.length,
      index: parkIndex,
      copies: entries.length ? 1 : REEL_COPIES,
      rowHeight: measure(),
    });
    strip.style.transform = `translateY(${y}px)`;
    go.disabled = entries.length === 0;
    if (live) {
      live.textContent = entries.length ? "" : "Nichts auf dem Zettel.";
    }
  }

  function showResult(entry) {
    last = entry;
    if (hint) {
      const place = entry.kind === "dish" ? entry.hint || "" : "";
      hint.hidden = !place;
      hint.textContent = place;
    }
    if (live) {
      live.textContent = entry.hint ? `${entry.label}. ${entry.hint}.` : entry.label;
    }
    go.hidden = true;
    if (again) again.hidden = false;
    if (show) show.hidden = false;
  }

  async function spin() {
    if (spinning || !dialog.open) return;
    const entries = getEntries(mode) ?? [];
    const picked = entries.length ? pick(mode) : null;
    if (!picked || picked.index < 0 || !picked.entry) return;
    const plan = planSpin({
      length: entries.length,
      index: picked.index,
      rowHeight: measure(),
      reduced: prefersReducedMotion(),
    });
    spinning = true;
    go.hidden = true;
    if (again) again.hidden = true;
    if (show) show.hidden = true;
    if (hint) hint.hidden = true;
    strip.classList.remove("is-fast");

    if (plan.reduced || typeof strip.animate !== "function") {
      strip.style.transform = `translateY(${plan.endY}px)`;
    } else {
      strip.style.transform = `translateY(${plan.startY}px)`;
      strip.classList.add("is-fast");
      const blurOff = window.setTimeout(
        () => strip.classList.remove("is-fast"),
        plan.spinMs * 0.38,
      );
      const travel = strip.animate(
        [
          { transform: `translateY(${plan.startY}px)` },
          { transform: `translateY(${plan.overshootY}px)` },
        ],
        { duration: plan.spinMs, easing: plan.easing, fill: "forwards" },
      );
      try {
        await travel.finished;
      } catch {
        /* dialog closed */
      }
      window.clearTimeout(blurOff);
      strip.classList.remove("is-fast");
      if (!dialog.open) {
        spinning = false;
        return;
      }
      const snap = strip.animate(
        [
          { transform: `translateY(${plan.overshootY}px)` },
          { transform: `translateY(${plan.endY}px)` },
        ],
        { duration: plan.snapMs, easing: SNAP_EASE, fill: "forwards" },
      );
      try {
        await snap.finished;
      } catch {
        /* dialog closed */
      }
      strip.style.transform = `translateY(${plan.endY}px)`;
    }

    spinning = false;
    if (!dialog.open) return;
    showResult(picked.entry);
  }

  function onMotion(event) {
    if (!dialog.open || spinning) return;
    const sample = shakeDelta(shakeMag, event.accelerationIncludingGravity);
    shakeMag = sample.next;
    if (sample.hit) spin();
  }

  openButton.addEventListener("click", () => {
    const motion = window.DeviceMotionEvent;
    const ask =
      motion && typeof motion.requestPermission === "function"
        ? motion.requestPermission()
        : Promise.resolve();
    Promise.resolve(ask)
      .catch(() => {})
      .then(() => {
        mode = "dish";
        for (const tab of tabs) {
          tab.setAttribute("aria-selected", String(tab.dataset.diceMode === mode));
        }
        last = null;
        if (again) again.hidden = true;
        if (show) show.hidden = true;
        if (hint) hint.hidden = true;
        go.hidden = false;
        if (!dialog.open) dialog.showModal();
        paint(0);
        window.addEventListener("devicemotion", onMotion);
      });
  });

  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      if (spinning) return;
      mode = tab.dataset.diceMode || "dish";
      for (const other of tabs) {
        other.setAttribute("aria-selected", String(other === tab));
      }
      last = null;
      if (again) again.hidden = true;
      if (show) show.hidden = true;
      if (hint) hint.hidden = true;
      go.hidden = false;
      paint(0);
    });
  }

  go.addEventListener("click", () => spin());
  again?.addEventListener("click", () => spin());
  show?.addEventListener("click", () => {
    const entry = last;
    dialog.close();
    if (entry && onShow) onShow(entry);
  });

  dialog.addEventListener("close", () => {
    window.removeEventListener("devicemotion", onMotion);
    strip.getAnimations?.().forEach((anim) => anim.cancel());
    strip.classList.remove("is-fast");
    spinning = false;
    shakeMag = null;
  });
}
