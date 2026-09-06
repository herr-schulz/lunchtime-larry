const NICK_KEY = "lunchtime-larry-nick";

export const CANTEEN_IDS = ["stmuv", "sodexo", "bella23"];
export const MAX_VOTERS = 6;

export function berlinDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function berlinWeekday(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(now)
    .toLowerCase();
}

export function isVoteDay(now = new Date()) {
  const day = berlinWeekday(now);
  return day !== "saturday" && day !== "sunday";
}

export function lastVoteDate(now = new Date()) {
  const iso = berlinDate(now);
  const day = berlinWeekday(now);
  const back = day === "saturday" ? 1 : day === "sunday" ? 2 : 0;
  if (!back) return iso;
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date - back)).toISOString().slice(0, 10);
}

export const MAX_NICK = 20;
export const MAX_NICK_WORD = 12;

/** Must stay in sync with database.rules.json nick checks. */
export const NICK_CHAR_RE = /^[A-Za-zÄÖÜäöüß' -]{1,20}$/;
export const NICK_LETTER_RE = /[A-Za-zÄÖÜäöüß]/;

export function normalizeNick(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.slice(0, MAX_NICK_WORD))
    .filter(Boolean)
    .join(" ")
    .slice(0, MAX_NICK);
}

/** True only if the nick would pass Firebase RTDB rules. */
export function isValidNick(value) {
  const nick = normalizeNick(value);
  return Boolean(nick) && NICK_CHAR_RE.test(nick) && NICK_LETTER_RE.test(nick);
}

export function loadNick() {
  try {
    const nick = normalizeNick(localStorage.getItem(NICK_KEY) || "");
    return isValidNick(nick) ? nick : "";
  } catch {
    return "";
  }
}

export function saveNick(nick) {
  const next = normalizeNick(nick);
  if (!isValidNick(next)) {
    try {
      localStorage.removeItem(NICK_KEY);
    } catch {
      /* ignore */
    }
    return "";
  }
  localStorage.setItem(NICK_KEY, next);
  return next;
}

export function countVotes(records) {
  const counts = { stmuv: 0, sodexo: 0, bella23: 0 };
  for (const rec of Object.values(records ?? {})) {
    if (rec?.canteen && Object.hasOwn(counts, rec.canteen)) counts[rec.canteen] += 1;
  }
  return counts;
}

export function nicksFor(records, canteen) {
  return Object.values(records ?? {})
    .filter((rec) => rec?.canteen === canteen)
    .map((rec) => normalizeNick(rec.nick))
    .filter((nick) => isValidNick(nick));
}

export function winnerOf(counts, names) {
  const parts = CANTEEN_IDS.map((id) => counts[id] ?? 0);
  const total = parts.reduce((sum, n) => sum + n, 0);
  if (!total) return { status: "empty" };
  const max = Math.max(...parts);
  const leaders = CANTEEN_IDS.filter((id) => (counts[id] ?? 0) === max);
  if (leaders.length > 1) return { status: "tie" };
  const id = leaders[0];
  return { status: "lead", id, name: names[id] ?? id };
}

export function votesPath(day = berlinDate()) {
  return `votes/${day}`;
}

/** Day keys under `votes/` that are older than the keep-day (ISO YYYY-MM-DD). */
export function staleVoteDays(keys, keepDay) {
  return (keys ?? []).filter(
    (day) =>
      typeof day === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(day) &&
      day < keepDay,
  );
}

export function mySlot(records, uid) {
  if (!uid) return null;
  for (const [slot, rec] of Object.entries(records ?? {})) {
    if (rec?.uid === uid) return slot;
  }
  return null;
}

export function canAcceptVote(records, uid) {
  if (mySlot(records, uid) != null) return true;
  return Object.keys(records ?? {}).length < MAX_VOTERS;
}
