const WEAK_WORDS = new Set([
  "pasta",
  "sauce",
  "soße",
  "pommes",
  "frites",
  "salat",
  "reis",
  "suppe",
  "tomate",
  "tomaten",
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

function peelMit(text) {
  const match = String(text).match(/^(.*?)\s+mit\s+(.+)$/i);
  if (!match) return null;
  const title = match[1].trim();
  const rest = match[2].trim();
  if (title.length < 2 || !rest) return null;
  return { title, rest };
}

/** @param {string[]} sides */
export function joinDishSides(sides) {
  const parts = (sides ?? []).map((side) => String(side).trim()).filter(Boolean);
  if (!parts.length) return "";
  const lead = parts[0].replace(/^mit\s+/i, "");
  if (parts.length === 1) return `mit ${lead}`;
  if (parts.length === 2) return `mit ${lead} und ${parts[1]}`;
  return `mit ${lead}, ${parts.slice(1, -1).join(", ")} und ${parts.at(-1)}`;
}

/**
 * Frozen dish phrasing: list separators and one "mit" peel. No extra rules.
 * @param {string} name
 * @returns {{ title: string, sides: string[], spoken: string }}
 */
export function phraseDish(name) {
  const shown = displayDishName(name);
  const listParts = shown
    .split(/\s*[|/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  /** @type {string} */
  let title = listParts[0] || shown;
  /** @type {string[]} */
  let sides = listParts.slice(1);

  if (listParts.length > 1) {
    const peeled = peelMit(title);
    if (peeled) {
      title = peeled.title;
      sides = [peeled.rest, ...sides];
    }
  } else if (!/\b(auf|an|von)\b/i.test(shown)) {
    const peeled = peelMit(shown);
    if (peeled) {
      title = peeled.title;
      sides = [peeled.rest];
    }
  }

  const withSides = joinDishSides(sides);
  return {
    title,
    sides,
    spoken: withSides ? `${title} ${withSides}` : title,
  };
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

const PASTA_TYPES = new Set([
  "agnolotti",
  "bandnudeln",
  "bucatini",
  "canneloni",
  "cannelloni",
  "cavatappi",
  "conchiglie",
  "ditalini",
  "farfalle",
  "fettuccine",
  "fusilli",
  "garganelli",
  "gemelli",
  "gnocchi",
  "hörnchen",
  "hornnudeln",
  "knöpfle",
  "lasagna",
  "lasagne",
  "linguine",
  "macaroni",
  "maccheroni",
  "makkaroni",
  "nudel",
  "nudeln",
  "orecchiette",
  "orzo",
  "paccheri",
  "pappardelle",
  "pasta",
  "penne",
  "ravioli",
  "rigatoni",
  "rotini",
  "schupfnudeln",
  "spaghetti",
  "spaghettini",
  "spaetzle",
  "spätzle",
  "tagliatelle",
  "tagliolini",
  "tortellini",
  "trofie",
  "ziti",
]);

function wordLooksLikePasta(word) {
  if (PASTA_TYPES.has(word)) return true;
  return [...PASTA_TYPES].some((pasta) => pasta.length >= 6 && word.includes(pasta));
}

function isPastaTitle(title) {
  const words = String(title)
    .toLowerCase()
    .replace(/[^a-zäöüß\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  return words.some(wordLooksLikePasta);
}

function firstIngredient(sides) {
  const raw = String(sides?.[0] || "")
    .replace(/^mit\s+/i, "")
    .trim();
  if (!raw) return "";
  return raw.split(/\s*,\s*|\s+und\s+/i)[0]?.trim() || "";
}

/** Compact alarm label: dish title, plus first side when the title is a pasta. */
export function alarmLabel(name) {
  const { title, sides } = phraseDish(name);
  const headed = titleCase(title);
  if (!isPastaTitle(title)) return headed;
  const lead = firstIngredient(sides);
  return lead ? `${headed} mit ${titleCase(lead)}` : headed;
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
  const indexByMark = new Map();
  for (const canteen of dayBlock?.canteens ?? []) {
    for (const dish of canteen.dishes ?? []) {
      if (!isLiked(dish.name, likes)) continue;
      const key = dishKey(dish.name);
      const mark = significantTokens(key)[0] || key;
      const existing = indexByMark.get(mark);
      if (existing != null) {
        const item = found[existing];
        if (canteen.id && !item.places.includes(canteen.id)) {
          item.places.push(canteen.id);
        }
        continue;
      }
      indexByMark.set(mark, found.length);
      found.push({
        key,
        name: dish.name,
        label: alarmLabel(dish.name),
        canteen: canteen.id,
        places: canteen.id ? [canteen.id] : [],
      });
    }
  }
  return found;
}

/**
 * Every stored like, not only today's hits.
 * `places` is set only when the dish is on the selected day's card.
 * @param {Set<string>} likes
 * @param {Record<string, { canteens?: Array<{ id?: string, dishes?: Array<{ name: string }> }> }> | null | undefined} days
 * @param {string} todayDay
 */
export function listAllFavorites(likes, days, todayDay) {
  const items = [];
  for (const like of likes) {
    let exactName = "";
    let fuzzyName = "";
    const exactPlaces = [];
    const fuzzyPlaces = [];
    let onWeek = false;
    for (const [dayKey, block] of Object.entries(days || {})) {
      for (const canteen of block?.canteens ?? []) {
        for (const dish of canteen.dishes ?? []) {
          const exact = dishKey(dish.name) === like;
          if (!exact && !isLiked(dish.name, new Set([like]))) continue;
          onWeek = true;
          if (exact) {
            if (dayKey === todayDay) exactName = dish.name;
            else if (!exactName) exactName = dish.name;
            if (dayKey === todayDay && canteen.id && !exactPlaces.includes(canteen.id)) {
              exactPlaces.push(canteen.id);
            }
          } else {
            if (!fuzzyName) fuzzyName = dish.name;
            if (dayKey === todayDay && canteen.id && !fuzzyPlaces.includes(canteen.id)) {
              fuzzyPlaces.push(canteen.id);
            }
          }
        }
      }
    }
    const name = exactName || fuzzyName || like;
    const places = exactName ? exactPlaces : fuzzyPlaces;
    items.push({
      key: like,
      name,
      label: alarmLabel(name),
      places,
      onWeek,
    });
  }
  return items.toSorted((a, b) => {
    const aOn = a.places.length > 0 ? 0 : 1;
    const bOn = b.places.length > 0 ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    return a.label.localeCompare(b.label, "de");
  });
}

/**
 * Likes that are not already shown as today's alarm hits.
 * @template {{ key?: string, name?: string, places?: string[] }} T
 * @param {T[]} saved
 * @param {Array<{ key?: string, name?: string }>} found
 * @returns {T[]}
 */
export function parkedFavorites(saved, found) {
  if (!saved?.length) return [];
  if (!found?.length) return [...saved];
  const today = new Set();
  for (const hit of found) {
    if (hit.key) today.add(hit.key);
    if (hit.name) today.add(dishKey(hit.name));
  }
  return saved.filter((item) => {
    if (item.places?.length) return false;
    if (item.key && today.has(item.key)) return false;
    if (item.name && today.has(dishKey(item.name))) return false;
    return true;
  });
}
