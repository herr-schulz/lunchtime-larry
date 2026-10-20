const DESSERT = /dessert/i;
const SOUP = /suppe/i;

function dishText(dish) {
  const name = String(dish?.name ?? "").replace(/\s+/g, " ").trim();
  const category = String(dish?.category ?? "");
  return { name, category };
}

/**
 * @param {{ name?: string, category?: string } | null | undefined} dish
 */
export function isDessertDish(dish) {
  if (dish == null || typeof dish !== "object") return false;
  const { name, category } = dishText(dish);
  return DESSERT.test(category) || DESSERT.test(name);
}

/**
 * @param {{ name?: string, category?: string } | null | undefined} dish
 */
export function isSoupDish(dish) {
  if (dish == null || typeof dish !== "object") return false;
  const { name } = dishText(dish);
  if (!name) return false;
  const { category } = dishText(dish);
  return SOUP.test(category) || SOUP.test(name);
}

/**
 * True for a real Hauptgericht — not soup, dessert, or an empty ghost.
 * @param {{ name?: string, category?: string } | null | undefined} dish
 */
export function isMainDish(dish) {
  if (dish == null || typeof dish !== "object") return false;
  const { name } = dishText(dish);
  if (!name) return false;
  return !isDessertDish(dish) && !isSoupDish(dish);
}

/**
 * Flatten today's pickable mains — soups and desserts stay off this list.
 * @param {{ canteens?: Array<{ id?: string, dishes?: Array<{ name?: string, category?: string }> | null }> } | null | undefined} block
 */
export function listMainDishes(block) {
  const found = [];
  for (const canteen of block?.canteens ?? []) {
    for (const dish of canteen?.dishes ?? []) {
      if (!isMainDish(dish)) continue;
      found.push({ canteenId: canteen.id, dish });
    }
  }
  return found;
}

/**
 * Reel rows: mains plus desserts for filler. Soups never appear.
 * @param {{ canteens?: Array<{ id?: string, dishes?: Array<{ name?: string, category?: string }> | null }> } | null | undefined} block
 */
export function listReelDishes(block) {
  const found = [];
  for (const canteen of block?.canteens ?? []) {
    for (const dish of canteen?.dishes ?? []) {
      const { name } = dishText(dish);
      if (!name || isSoupDish(dish)) continue;
      found.push({
        canteenId: canteen.id,
        dish,
        pickable: isMainDish(dish),
      });
    }
  }
  return found;
}

/** @param {() => number} rng */
function pickIndex(length, rng) {
  if (length <= 0) return -1;
  const roll = Number(rng());
  const unit = Number.isFinite(roll) ? roll : 0;
  return Math.min(length - 1, Math.max(0, Math.floor(unit * length)));
}

/**
 * Uniform pick among today's mains, or `null` if none.
 * @param {{ canteens?: Array<{ id?: string, dishes?: Array<{ name?: string, category?: string }> | null }> } | null | undefined} block
 * @param {() => number} [rng]
 */
export function pickMainDish(block, rng = Math.random) {
  const mains = listMainDishes(block);
  if (!mains.length) return null;
  return mains[pickIndex(mains.length, rng)] ?? null;
}

/**
 * Uniform pick from a locations array (the shape of `LOCATIONS`), or `null` if empty.
 * Pass the array in — do not import `locations.js` here (it paints the DOM on load).
 * @template T
 * @param {T[] | null | undefined} locations
 * @param {() => number} [rng]
 * @returns {T | null}
 */
export function pickSpot(locations, rng = Math.random) {
  const spots = Array.isArray(locations) ? locations : [];
  if (!spots.length) return null;
  return spots[pickIndex(spots.length, rng)] ?? null;
}
