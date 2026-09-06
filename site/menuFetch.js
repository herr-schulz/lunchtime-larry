/** Fetch weekly menu JSON (local → Firebase → GitHub Pages). */

const LIVE_MENU =
  "https://herr-schulz.github.io/lunchtime-larry/data/menu.json";
const FIREBASE_MENU = "https://lunchtime-larry.web.app/data/menu.json";

export async function loadMenu() {
  try {
    const local = await fetch("./data/menu.json", { cache: "no-store" });
    if (local.ok) return local.json();
  } catch {
    /* file:// or missing local copy */
  }
  for (const url of [FIREBASE_MENU, LIVE_MENU]) {
    try {
      const live = await fetch(url, { cache: "no-store" });
      if (live.ok) return live.json();
    } catch {
      /* try next */
    }
  }
  throw new Error("missing");
}
