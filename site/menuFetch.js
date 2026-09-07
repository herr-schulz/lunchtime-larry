/** Fetch weekly menu JSON; keep the newest among local, Firebase, and GitHub Pages. */

const LIVE_MENU =
  "https://herr-schulz.github.io/lunchtime-larry/data/menu.json";
const FIREBASE_MENU = "https://lunchtime-larry.web.app/data/menu.json";

export function pickFreshestMenu(menus) {
  let best;
  for (const menu of menus) {
    if (!menu || typeof menu !== "object" || !menu.weekStart) continue;
    if (!best) {
      best = menu;
      continue;
    }
    if (menu.weekStart > best.weekStart) {
      best = menu;
      continue;
    }
    if (
      menu.weekStart === best.weekStart &&
      (menu.scrapedAt || "") > (best.scrapedAt || "")
    ) {
      best = menu;
    }
  }
  return best;
}

async function readMenu(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function loadMenu() {
  const best = pickFreshestMenu(
    await Promise.all([
      readMenu("./data/menu.json"),
      readMenu(FIREBASE_MENU),
      readMenu(LIVE_MENU),
    ]),
  );
  if (!best) throw new Error("missing");
  return best;
}
