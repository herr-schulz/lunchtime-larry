const WEAK_WORDS = new Set([
  "pasta",
  "sauce",
  "soße",
  "pommes",
  "frites",
  "salat",
  "reis",
  "suppe",
  "dessert",
  "tagesdessert",
  "station",
  "beilage",
  "topping",
  "dip",
  "mit",
  "und",
  "auf",
  "vom",
  "gebackene",
  "gebratene",
  "gegrillte",
  "hausgemachte",
  "frische",
]);

export function displayDishName(name) {
  let text = String(name).replace(/\s+/g, " ").trim();
  text = text.replace(
    /^(bei(\s+der)?|an\s+der)\s+[\p{L}0-9&+\- ]{1,40}station:\s*/iu,
    "",
  );
  text = text.replace(/\btages[\s-]*dessert(?:\s*\d+)?\b/gi, "");
  text = text.replace(/\btäglich\s+aktualisiert\b/gi, "");
  text = text.replace(/^[\s:–—.|/-]+|[\s:–—.|/-]+$/g, "");
  text = text.replace(/\s+/g, " ").trim();
  return text || "Tagesdessert";
}

function titleCase(text) {
  return text.replace(/(^|[\s/-])(\S+)/g, (_, sep, word) => {
    if (word.length <= 1) return sep + word;
    return (
      sep +
      word.charAt(0).toLocaleUpperCase("de-DE") +
      word.slice(1)
    );
  });
}

/** Stable key so Currywurst matches across canteens and weeks. */
export function dishKey(name) {
  const cleaned = displayDishName(name)
    .toLowerCase()
    .replace(/\*vegan\*/g, "")
    .replace(/\b(vegan\w*|veggie|vegetarisch)\b/g, "")
    .replace(/\d+[.,]\d{2}\s*€/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const head =
    cleaned
      .split(/\s*[|/]\s*/)
      .map((part) => part.trim())
      .find(Boolean) ?? cleaned;
  const words = head.split(" ").filter((word) => word.length > 2);
  if (head.length >= 6 || words.length >= 2) return head;
  return cleaned.replace(/\s*[|/]\s*/g, " ").trim() || head;
}

export function dishLabel(name) {
  const cleaned = displayDishName(name)
    .replace(/\*vegan\*/gi, "")
    .replace(/\b(vegan\w*|veggie|vegetarisch)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const display = cleaned || displayDishName(name);
  const parts = display
    .split(/\s*[|/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const head = parts[0] || display;
  const words = head.split(" ").filter((word) => word.length > 2);
  const shown =
    head.length >= 6 || words.length >= 2 ? head : parts.slice(0, 2).join(" ");
  return titleCase(shown || display);
}

function significantTokens(key) {
  return key
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zäöüß]/g, ""))
    .filter((word) => word.length >= 6 && !WEAK_WORDS.has(word));
}

export function isLiked(name, likes) {
  const key = dishKey(name);
  if (likes.has(key)) return true;
  const tokens = significantTokens(key);
  if (!tokens.length) return false;
  for (const like of likes) {
    const other = significantTokens(like);
    if (tokens.some((token) => other.includes(token))) return true;
  }
  return false;
}

export function toggleLikeSet(name, likes) {
  const next = new Set(likes);
  if (isLiked(name, next)) {
    for (const like of [...next]) {
      if (isLiked(name, new Set([like]))) next.delete(like);
    }
  } else {
    next.add(dishKey(name));
  }
  return next;
}

export function findLikedDishes(dayBlock, likes) {
  const found = [];
  const seen = new Set();
  for (const canteen of dayBlock?.canteens ?? []) {
    for (const dish of canteen.dishes ?? []) {
      if (!isLiked(dish.name, likes)) continue;
      const key = dishKey(dish.name);
      const mark = significantTokens(key)[0] || key;
      if (seen.has(mark)) continue;
      seen.add(mark);
      found.push({
        key,
        name: dish.name,
        label: dishLabel(dish.name),
      });
    }
  }
  return found;
}
