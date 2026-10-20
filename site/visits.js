/** Page views live at GoatCounter. This file never talks to Firebase. */

export const COUNT_ORIGIN = "https://lunchtime-larry.goatcounter.com";

/** Stable paths so Hosting and GitHub Pages share one tally. */
export function countPathFor(page) {
  if (page === "alternativen") return "/alternativen.html";
  return "/";
}

export function countPixelUrl(path, rnd = Date.now()) {
  const query = new URLSearchParams({ p: path, rnd: String(rnd) });
  return `${COUNT_ORIGIN}/count?${query}`;
}

export function totalCountUrl() {
  return `${COUNT_ORIGIN}/counter/TOTAL.json`;
}

/** Public counter. `TOTAL` is the site sum. A path keeps its leading slash. */
export function counterUrl(path, start = "") {
  const base =
    path === "TOTAL"
      ? `${COUNT_ORIGIN}/counter/TOTAL.json`
      : `${COUNT_ORIGIN}/counter/${path.startsWith("/") ? path : `/${path}`}.json`;
  if (!start) return base;
  return `${base}?start=${encodeURIComponent(start)}`;
}

/** Digits only, so grouped totals like 1.284 stay one number. */
export function countDigits(count) {
  const digits = String(count ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** One hit is singular. Grouped totals such as 1.284 stay plural. */
export function aufrufWord(count) {
  const digits = String(count).replace(/\D/g, "");
  return digits === "1" ? "Aufruf" : "Aufrufe";
}

function countText(count) {
  if (typeof count === "number" && Number.isFinite(count)) return String(count);
  if (typeof count === "string" && count.trim()) return count.trim();
  return "";
}

/** Reads one public total. A missing path still returns "0" when GoatCounter says so. */
export async function readCountAt(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, { cache: "no-store", credentials: "omit" });
  let data = null;
  try {
    data = await response.json();
  } catch {
    return "";
  }
  return countText(data?.count);
}

export async function readTotalCount(fetchImpl = fetch) {
  return readCountAt(totalCountUrl(), fetchImpl);
}

export function mountVisits(root = document) {
  const stamp = root.querySelector("[data-aufruf]");
  if (!stamp) return;
  const tilt = (-16 + Math.random() * 10).toFixed(1);
  stamp.style.setProperty("--aufruf-tilt", `${tilt}deg`);
  const path = stamp.getAttribute("data-aufruf") || "/";
  const pixel = document.createElement("img");
  pixel.className = "aufruf-pixel";
  pixel.alt = "";
  pixel.width = 1;
  pixel.height = 1;
  pixel.referrerPolicy = "no-referrer";
  pixel.setAttribute("aria-hidden", "true");
  pixel.src = countPixelUrl(path);
  stamp.append(pixel);
  const out = stamp.querySelector("[data-aufruf-count]");
  if (!out) return;
  readTotalCount()
    .then((count) => {
        if (!count) return;
      out.textContent = count;
      const label = stamp.querySelector(".aufruf-label");
      if (label) label.textContent = aufrufWord(count);
    })
    .catch(() => {
      /* Stem stays blank. The board does not depend on the counter. */
    });
}

if (typeof document !== "undefined") mountVisits(document);
