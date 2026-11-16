/**
 * Easter egg: if a theme plugin recolors Larry's palette, the page becomes
 * Hacktime Harry with a Matrix rain backdrop. Cosmetic only.
 */

const EXPECTED = {
  paper: [242, 226, 196],
  ink: [28, 20, 14],
  stamp: [196, 69, 45],
  board: [36, 25, 16],
};

/** Euclidean RGB distance that still counts as "our" palette (browser rounding / color-mix). */
const TOLERANCE = 48;
/** How many brand tokens must drift before we flip. */
const DRIFT_NEED = 2;

const TITLE_NORMAL = "Lunchtime Larry — Arabellapark";
const TITLE_HACK = "Hacktime Harry — Arabellapark";
const NAME_NORMAL = "Lunchtime Larry";
const NAME_HACK = "Hacktime Harry";
const LEDE_NORMAL = "Drei Kantinen. Eine Woche. Kein Azure.";
const LEDE_HACK = "Drei Kantinen. Eine Woche. Kein Theme-Plugin.";

const GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01HacktimeHarry日午飯";

let active = false;
let canvas;
let raf = 0;
let columns = [];
let lastCheck = 0;
let saved = null;

function parseColor(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "transparent") return null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i.exec(raw);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function tokenColor(styles, name) {
  return parseColor(styles.getPropertyValue(`--${name}`));
}

/** Returns true when the live palette no longer looks like Lunchtime Larry. */
export function paletteDrifted() {
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  let drifts = 0;

  for (const [name, expected] of Object.entries(EXPECTED)) {
    const live = tokenColor(root, name);
    if (live && distance(live, expected) > TOLERANCE) drifts += 1;
  }

  const bg = parseColor(body.backgroundColor);
  if (bg && distance(bg, EXPECTED.paper) > TOLERANCE) drifts += 1;

  return drifts >= DRIFT_NEED;
}

function brandNodes() {
  return {
    title: document.querySelector(".masthead h1"),
    lede: document.querySelector(".masthead .lede"),
    mascot: document.querySelector(".masthead .mascot"),
  };
}

function rememberCopy() {
  if (saved) return;
  const { title, mascot } = brandNodes();
  saved = {
    title: document.title,
    h1: title?.textContent || NAME_NORMAL,
    alt: mascot?.alt || NAME_NORMAL,
  };
}

function paintLede(lede, hacked) {
  if (!lede) return;
  if (hacked) {
    lede.textContent = LEDE_HACK;
    return;
  }
  lede.replaceChildren();
  lede.append("Drei Kantinen. Eine Woche. ");
  const keep = document.createElement("span");
  keep.className = "lede-keep";
  keep.textContent = "Kein Azure.";
  lede.append(keep);
}

function applyCopy(hacked) {
  rememberCopy();
  const { title, lede, mascot } = brandNodes();
  document.title = hacked ? TITLE_HACK : saved.title || TITLE_NORMAL;
  if (title) title.textContent = hacked ? NAME_HACK : saved.h1;
  paintLede(lede, hacked);
  if (mascot) mascot.alt = hacked ? NAME_HACK : saved.alt;
}

function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.className = "matrix-rain";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  return canvas;
}

function resizeRain() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colW = 16;
  const count = Math.ceil(w / colW);
  columns = Array.from({ length: count }, () => Math.random() * h);
}

function tickRain() {
  if (!active || !canvas) return;
  const ctx = canvas.getContext("2d");
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.fillStyle = "rgba(4, 12, 6, 0.08)";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const colW = 16;
  for (let i = 0; i < columns.length; i += 1) {
    const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const x = i * colW;
    const y = columns[i];
    ctx.fillStyle = i % 7 === 0 ? "#d7ffe0" : "#39ff14";
    ctx.fillText(ch, x, y);
    columns[i] = y > h + Math.random() * 80 ? 0 : y + 14 + Math.random() * 8;
  }
  raf = window.requestAnimationFrame(tickRain);
}

function startRain() {
  ensureCanvas();
  resizeRain();
  if (!raf) raf = window.requestAnimationFrame(tickRain);
}

function stopRain() {
  if (raf) window.cancelAnimationFrame(raf);
  raf = 0;
  canvas?.remove();
  canvas = null;
  columns = [];
}

function setHacked(hacked) {
  if (hacked === active) return;
  active = hacked;
  document.documentElement.classList.toggle("is-hacktime", hacked);
  document.body.classList.toggle("is-hacktime", hacked);
  applyCopy(hacked);
  if (hacked) startRain();
  else stopRain();
}

function check() {
  lastCheck = Date.now();
  try {
    setHacked(paletteDrifted());
  } catch {
    /* ignore */
  }
}

/**
 * Watch computed colors. Theme plugins often mutate styles after load.
 */
export function watchSkin() {
  check();
  window.setInterval(() => {
    if (Date.now() - lastCheck < 400) return;
    check();
  }, 1200);
  window.addEventListener("resize", () => {
    if (active) resizeRain();
  });
  const mo = new MutationObserver(() => {
    lastCheck = 0;
    window.requestAnimationFrame(check);
  });
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  mo.observe(document.head, { childList: true, subtree: true });
  return () => mo.disconnect();
}
