const NICK_KEY = "lunchtime-larry-nick";
const ROUND_KEY = "lunchtime-larry-round";
const VOTE_OPT_IN_KEY = "lunchtime-larry-vote-opt-in";
const INTRO_KEY = "lunchtime-larry-intro";

export const CANTEEN_IDS = ["stmuv", "sodexo", "bella23"];
/** Thursday only in the client. Rules accept the slug on any day. */
export const MARKET_ID = "wochenmarkt";
export const MARKET_NAME = "Wochenmarkt";
/** Fine with every spot — presence only, no tally. */
export const EGAL_ID = "egal";
/** Approval ticks per ballot. Must match the optional `second` field in rules. */
export const MAX_PICKS = 2;
/** Seats 0–23 per round per day. Must match database.rules.json `$slot`. */
export const MAX_VOTERS = 24;

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

export function emptyMine() {
  return { picks: [], egal: false };
}

/** Drop empty Firebase array holes so Object.keys never looks like a full round. */
export function voteRecords(val) {
  if (!val || typeof val !== "object") return {};
  const out = {};
  for (const [slot, rec] of Object.entries(val)) {
    if (rec && typeof rec === "object" && rec.uid) out[slot] = rec;
  }
  return out;
}

export function isEgalRecord(rec) {
  return Boolean(rec) && (rec.canteen === EGAL_ID || rec.egal === true);
}

export function picksFromRecord(rec, allowed) {
  if (!rec || isEgalRecord(rec)) return [];
  const allow = allowed ? new Set(allowed) : null;
  const picks = [];
  for (const id of [rec.canteen, rec.second]) {
    if (!id || id === EGAL_ID) continue;
    if (allow && !allow.has(id)) continue;
    if (!picks.includes(id)) picks.push(id);
  }
  return picks;
}

export function mineFromRecord(rec, weekday = berlinWeekday()) {
  if (!rec) return emptyMine();
  if (isEgalRecord(rec)) return { picks: [], egal: true };
  return { picks: picksFromRecord(rec, voteTargetIds(weekday)), egal: false };
}

export function mineHasPick(mine, canteen) {
  return Boolean(mine?.picks?.includes(canteen));
}

export function nextMineForPick(mine, canteen) {
  const current = mine?.egal || !mine?.picks?.length ? emptyMine() : mine;
  if (current.picks.includes(canteen)) {
    return { picks: current.picks.filter((id) => id !== canteen), egal: false };
  }
  if (current.picks.length >= MAX_PICKS) {
    return { picks: [...current.picks.slice(1), canteen], egal: false };
  }
  return { picks: [...current.picks, canteen], egal: false };
}

export function ballotPayload(uid, nick, mine, at) {
  if (mine?.egal) return { uid, nick, canteen: EGAL_ID, at };
  if (!mine?.picks?.length) return null;
  const ballot = { uid, nick, canteen: mine.picks[0], at };
  if (mine.picks[1]) ballot.second = mine.picks[1];
  return ballot;
}

/** One ballot per uid — extra slots from a stuffed session are ignored. */
export function firstRecordsByUid(records) {
  const seen = new Set();
  const out = [];
  for (const rec of Object.values(records ?? {})) {
    if (!rec || typeof rec !== "object") continue;
    const uid = rec.uid;
    if (uid) {
      if (seen.has(uid)) continue;
      seen.add(uid);
    }
    out.push(rec);
  }
  return out;
}

export function stuffedBallots(records) {
  const byUid = new Map();
  for (const rec of Object.values(records ?? {})) {
    const uid = rec?.uid;
    if (!uid) continue;
    const cur = byUid.get(uid) || { picks: 0, nick: rec.nick };
    cur.picks += picksFromRecord(rec).length;
    if (rec.nick) cur.nick = rec.nick;
    byUid.set(uid, cur);
  }
  const stuffed = [];
  for (const [uid, cur] of byUid) {
    if (cur.picks <= MAX_PICKS) continue;
    stuffed.push({ uid, nick: normalizeNick(cur.nick), picks: cur.picks });
  }
  return stuffed;
}

export function countVotes(records) {
  const counts = { stmuv: 0, sodexo: 0, bella23: 0, [MARKET_ID]: 0 };
  for (const rec of firstRecordsByUid(records)) {
    for (const id of picksFromRecord(rec)) {
      if (Object.hasOwn(counts, id)) counts[id] += 1;
    }
  }
  return counts;
}

export function nicksFor(records, canteen) {
  return firstRecordsByUid(records)
    .filter((rec) => mineHasPick(mineFromRecord(rec), canteen))
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

/**
 * Line under the weekday. After 12:00 the destination stays put;
 * before that it's just who is in.
 * @param {{ status?: string, name?: string } | null | undefined} result
 * @param {string[]} names
 * @param {boolean} reveal
 */
export function heuteDabeiLine(result, names, reveal) {
  const people = (names ?? []).filter(Boolean);
  const who = people.length ? people.join(" · ") : "";
  if (reveal && result?.status === "lead" && result.name) {
    return who ? `Heute ${result.name} · ${who}` : `Heute ${result.name}`;
  }
  if (reveal && result?.status === "tie") {
    return who ? `Heute unentschieden · ${who}` : "Heute unentschieden";
  }
  return who ? `Heute dabei · ${who}` : "";
}

/** No 0/O/1/l — a generated code stays readable when someone types it back. */
export const ROUND_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
/** New rounds: 10 random chars. Legacy short codes still normalize for the silent move. */
export const MAX_ROUND_CODE = 14;
export const ROUND_CODE_LEN = 10;
export const ROUND_KEY_RE = /^[a-f0-9]{64}$/;
const DATE_SLUG_RE = /^\d{4}-\d{2}-\d{2}$/;
const ROUND_KEY_CACHE = "lunchtime-larry-round-key";
const ROUND_SALT = "lunchtime-larry-round-v1";
const PBKDF2_ITERS = 600_000;

/**
 * Shareable round code → localStorage form.
 * Accepts 8–14 random chars (new) and short legacy team slugs for migration tickets.
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

/** Ten shareable characters. `rng` is injectable for tests. */
export function generateRoundCode(rng = Math.random) {
  let code = "";
  for (let i = 0; i < ROUND_CODE_LEN; i += 1) {
    const index = Math.min(
      ROUND_ALPHABET.length - 1,
      Math.max(0, Math.floor(Number(rng()) * ROUND_ALPHABET.length)),
    );
    code += ROUND_ALPHABET[index];
  }
  return code;
}

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PBKDF2-SHA256 → 64 hex chars. Used as every RTDB path segment for a round. */
export async function deriveRoundKey(code) {
  const normalized = normalizeRoundCode(code);
  if (!normalized) return "";
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(normalized), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(ROUND_SALT), iterations: PBKDF2_ITERS },
    base,
    256,
  );
  return bytesToHex(bits);
}

export function loadRoundKeyCache(code) {
  try {
    const raw = localStorage.getItem(ROUND_KEY_CACHE) || "";
    const [storedCode, key] = raw.split("|");
    if (storedCode === code && ROUND_KEY_RE.test(key || "")) return key;
  } catch {
    /* private mode */
  }
  return "";
}

export function saveRoundKeyCache(code, key) {
  if (!normalizeRoundCode(code) || !ROUND_KEY_RE.test(key)) return;
  try {
    localStorage.setItem(ROUND_KEY_CACHE, `${code}|${key}`);
  } catch {
    /* private mode */
  }
}

export async function roundKeyFor(code = loadRoundCode()) {
  const normalized = normalizeRoundCode(code);
  if (!normalized) return "";
  const cached = loadRoundKeyCache(normalized);
  if (cached) return cached;
  const key = await deriveRoundKey(normalized);
  saveRoundKeyCache(normalized, key);
  return key;
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
    if (!code) {
      localStorage.removeItem(ROUND_KEY);
      localStorage.removeItem(ROUND_KEY_CACHE);
    } else localStorage.setItem(ROUND_KEY, code);
  } catch {
    /* private mode */
  }
  return code;
}

/**
 * Ballots live only at `votes/{roundKey}/{day}`. No key, no path.
 * Pass an already-derived roundKey (64 hex) or a plaintext code (derived by the caller).
 */
export function votesPath(day = berlinDate(), roundKey = "") {
  const key = ROUND_KEY_RE.test(String(roundKey || ""))
    ? String(roundKey)
    : "";
  if (!key) return "";
  return `votes/${key}/${day}`;
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

export function occupiedSeatCount(records) {
  return Object.keys(voteRecords(records)).length;
}

export function canAcceptVote(records, uid) {
  if (mySlot(records, uid) != null) return true;
  return occupiedSeatCount(records) < MAX_VOTERS;
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
 * `open` before 11:55; from 11:55 writing is closed and results are revealed.
 * `locked` stays as a synonym of reveal for older UI hooks that still check it.
 */
export function votePhase(now = getNow()) {
  if (!isVoteDay(now)) return "closed";
  const { hour, minute } = berlinClock(now);
  const mins = hour * 60 + minute;
  if (mins < 11 * 60 + 55) return "open";
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
