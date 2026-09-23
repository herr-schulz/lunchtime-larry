const NICK_KEY = "lunchtime-larry-nick";
const ROUND_KEY = "lunchtime-larry-round";
const VOTE_OPT_IN_KEY = "lunchtime-larry-vote-opt-in";
const INTRO_KEY = "lunchtime-larry-intro";

export const CANTEEN_IDS = ["stmuv", "sodexo", "bella23"];
/** Thursday only in the client. Rules accept the slug on any day. */
export const MARKET_ID = "wochenmarkt";
export const MARKET_NAME = "Wochenmarkt";
export const MAX_VOTERS = 6;

/** Localhost preview only — freezes Berlin clock for phase checks. */
let nowOverride = null;

export function setNowOverride(value) {
  if (value == null) {
    nowOverride = null;
    return null;
  }
  const next = value instanceof Date ? value : new Date(value);
  nowOverride = Number.isNaN(next.getTime()) ? null : next;
  return nowOverride;
}

export function clearNowOverride() {
  nowOverride = null;
}

export function getNow(fallback = new Date()) {
  return nowOverride ?? fallback;
}

export function voteTargetIds(weekday) {
  return weekday === "thursday" ? [...CANTEEN_IDS, MARKET_ID] : [...CANTEEN_IDS];
}

export function berlinDate(now = getNow()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function berlinWeekday(now = getNow()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(now)
    .toLowerCase();
}

export function isVoteDay(now = getNow()) {
  const day = berlinWeekday(now);
  return day !== "saturday" && day !== "sunday";
}

export function lastVoteDate(now = getNow()) {
  const iso = berlinDate(now);
  const day = berlinWeekday(now);
  const back = day === "saturday" ? 1 : day === "sunday" ? 2 : 0;
  if (!back) return iso;
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date - back)).toISOString().slice(0, 10);
}

/** Ballot day in Europe/Berlin, or null when voting is closed (weekend). */
export function ballotDate(now = getNow()) {
  return isVoteDay(now) ? berlinDate(now) : null;
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
  const counts = { stmuv: 0, sodexo: 0, bella23: 0, [MARKET_ID]: 0 };
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
  const ids = [...CANTEEN_IDS, MARKET_ID];
  const parts = ids.map((id) => counts[id] ?? 0);
  const total = parts.reduce((sum, n) => sum + n, 0);
  if (!total) return { status: "empty" };
  const max = Math.max(...parts);
  const leaders = ids.filter((id) => (counts[id] ?? 0) === max);
  if (leaders.length > 1) return { status: "tie" };
  const id = leaders[0];
  return { status: "lead", id, name: names[id] ?? id };
}

/** No 0/O/1/l — a generated code stays readable when someone types it back. */
export const ROUND_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export const MAX_ROUND_CODE = 8;
const DATE_SLUG_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Team name or code → Firebase slug. `AI Team` and `ai-team` meet.
 * A calendar date is never a slug (that path used to be the house round).
 */
export function normalizeRoundCode(value) {
  const slug = String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length < 2 || slug.length > MAX_ROUND_CODE) return "";
  if (DATE_SLUG_RE.test(slug)) return "";
  return slug;
}

export function isRoundCode(value) {
  const raw = String(value ?? "");
  const slug = normalizeRoundCode(raw);
  return Boolean(slug) && slug === raw;
}

/** Five shareable characters. `rng` is injectable for tests. */
export function generateRoundCode(rng = Math.random) {
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    const index = Math.min(
      ROUND_ALPHABET.length - 1,
      Math.max(0, Math.floor(Number(rng()) * ROUND_ALPHABET.length)),
    );
    code += ROUND_ALPHABET[index];
  }
  return code;
}

export function loadRoundCode() {
  try {
    const code = localStorage.getItem(ROUND_KEY) || "";
    return isRoundCode(code) ? code : "";
  } catch {
    return "";
  }
}

export function saveRoundCode(raw) {
  const code = normalizeRoundCode(raw);
  try {
    if (!code) localStorage.removeItem(ROUND_KEY);
    else localStorage.setItem(ROUND_KEY, code);
  } catch {
    /* private mode */
  }
  return code;
}

/**
 * Ballots live only at `votes/{slug}/{day}`. No slug, no path — never `votes/{day}`.
 */
export function votesPath(day = berlinDate(), roundCode = "") {
  const code = isRoundCode(roundCode) ? roundCode : normalizeRoundCode(roundCode);
  if (!code) return "";
  return `votes/${code}/${day}`;
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

export function loadVoteOptIn() {
  try {
    return localStorage.getItem(VOTE_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveVoteOptIn() {
  try {
    localStorage.setItem(VOTE_OPT_IN_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function loadIntroSeen() {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveIntroSeen() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Berlin hour and minute. Rules stay timezone-blind; the lock is client-side. */
export function berlinClock(now = getNow()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: pick("hour"), minute: pick("minute") };
}

/**
 * Weekday ballot phases in Europe/Berlin.
 * `open` before 11:55, `locked` until 12:00, `reveal` after, `closed` on the weekend.
 */
export function votePhase(now = getNow()) {
  if (!isVoteDay(now)) return "closed";
  const { hour, minute } = berlinClock(now);
  const mins = hour * 60 + minute;
  if (mins < 11 * 60 + 55) return "open";
  if (mins < 12 * 60) return "locked";
  return "reveal";
}

/** Whole minutes from now until 12:00 Berlin. */
export function minutesUntilReveal(now = getNow()) {
  const { hour, minute } = berlinClock(now);
  return Math.max(0, 12 * 60 - (hour * 60 + minute));
}

export function lockLine(minutesLeft) {
  if (minutesLeft <= 1) return "Noch eine Minute.";
  return `Noch ${minutesLeft} Minuten.`;
}

/** Nicknames in today's round, no canteen. */
export function roundNicks(records) {
  const seen = new Set();
  const names = [];
  for (const rec of Object.values(records ?? {})) {
    const nick = normalizeNick(rec?.nick);
    const key = nick.toLocaleLowerCase("de-DE");
    if (!isValidNick(nick) || seen.has(key)) continue;
    seen.add(key);
    names.push(nick);
  }
  return names;
}
