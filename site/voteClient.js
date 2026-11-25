import { isPlateId } from "./eat.js?v=4c1eats1";
import {
  berlinDate,
  ballotPayload,
  berlinWeekday,
  countVotes,
  emptyMine,
  isValidNick,
  isVoteDay,
  loadNick,
  loadRoundCode,
  MARKET_ID,
  MAX_VOTERS,
  mineFromRecord,
  mySlot,
  nextMineForPick,
  normalizeNick,
  normalizeRoundCode,
  ROUND_KEY_RE,
  roundKeyFor,
  saveRoundCode,
  staleVoteDays,
  votePhase,
  voteRecords,
  voteTargetIds,
  votesPath,
} from "./vote.js?v=9cf92e86";
import { stateFromPresent } from "./voteMarks.js?v=8dec05e5";
import config from "./firebase.json?v=8c4496a6" with { type: "json" };

const FIREBASE_VER = "11.10.0";
const APPCHECK_SITE_KEY = "RECAPTCHA_ENTERPRISE_SITE_KEY";
const UID_RE = /^[A-Za-z0-9]{16,128}$/;

let appReady = null;
let uid = null;
let unsub = null;
let eatUnsub = null;
let presentUnsub = null;
let lotteryUnsub = null;
let listenGen = 0;
let eatGen = 0;
let presentGen = 0;
let lotteryGen = 0;
let purgeOnce = null;
let featuresCache = null;
let serverOffset = 0;

function isDevHost() {
  const host = location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function activeRoundKey() {
  const key = await roundKeyFor(loadRoundCode());
  if (!ROUND_KEY_RE.test(key)) throw new Error("round");
  return key;
}

function dayVotesPath(key, day = berlinDate()) {
  const path = votesPath(day, key);
  if (!path) throw new Error("round");
  return path;
}

function seatsPath(day, key) {
  const votes = votesPath(day, key);
  return votes ? `seats/${votes.slice("votes/".length)}` : "";
}

function presentPath(day, key) {
  return `present/${key}/${day}`;
}

function historyPath(day, key, id) {
  return `history/${key}/${day}/${id}`;
}

function assertVoteDay() {
  if (!isVoteDay()) throw new Error("closed");
}

function assertBallotOpen() {
  assertVoteDay();
  if (votePhase() !== "open") throw new Error("locked");
}

function assertCanteen(canteen) {
  if (!voteTargetIds(berlinWeekday()).includes(canteen)) throw new Error("canteen");
}

async function firebase() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}`;
  const [
    { initializeApp },
    { getAuth, onAuthStateChanged, signInAnonymously },
    { getDatabase, get, onDisconnect, onValue, ref, remove, set, update },
    appCheckMod,
  ] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-database.js`),
    import(`${base}/firebase-app-check.js`),
  ]);
  const app = initializeApp(config);
  try {
    if (isDevHost()) {
      const debug = localStorage.getItem("larry-appcheck-debug") || "";
      if (debug) {
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = debug;
        appCheckMod.initializeAppCheck(app, {
          provider: new appCheckMod.ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY),
          isTokenAutoRefreshEnabled: true,
        });
      }
    } else if (APPCHECK_SITE_KEY && !APPCHECK_SITE_KEY.includes("SITE_KEY")) {
      appCheckMod.initializeAppCheck(app, {
        provider: new appCheckMod.ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch {
    /* App Check optional until the site key is wired */
  }
  const auth = getAuth(app);
  const db = getDatabase(app);
  try {
    const offsetSnap = await get(ref(db, ".info/serverTimeOffset"));
    serverOffset = Number(offsetSnap.val()) || 0;
  } catch {
    serverOffset = 0;
  }
  return {
    auth,
    db,
    get,
    onAuthStateChanged,
    onDisconnect,
    onValue,
    ref,
    remove,
    set,
    signInAnonymously,
    update,
  };
}

function ensureApp() {
  if (!appReady) appReady = firebase();
  return appReady;
}

export function serverNow() {
  return Date.now() + serverOffset;
}

export async function ensureVoteUser() {
  const { auth, onAuthStateChanged, signInAnonymously } = await ensureApp();
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
    await applyMoveTicket(uid);
    return uid;
  }
  await signInAnonymously(auth);
  uid = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) return;
        stop();
        resolve(user.uid);
      },
      reject,
    );
  });
  await applyMoveTicket(uid);
  return uid;
}

/** Silent round move: uid-bound ticket overwrites localStorage once. */
async function applyMoveTicket(id) {
  try {
    const { db, get, ref, remove } = await ensureApp();
    const snap = await get(ref(db, `moves/${id}`));
    const code = normalizeRoundCode(snap.val()?.code);
    if (!code) return;
    const current = loadRoundCode();
    if (current !== code) {
      saveRoundCode(code);
      await roundKeyFor(code);
    }
    await remove(ref(db, `moves/${id}`));
  } catch {
    /* no ticket / offline */
  }
}

export async function reserveNick(nick = loadNick()) {
  const name = normalizeNick(nick);
  if (!isValidNick(name)) throw new Error("nick");
  const id = await ensureVoteUser();
  const key = await activeRoundKey();
  const { db, get, ref, set } = await ensureApp();
  const path = `rounds/${key}/names/${name.toLowerCase()}`;
  const snap = await get(ref(db, path));
  const owner = snap.val();
  if (owner && owner !== id) throw new Error("taken");
  if (!owner) await set(ref(db, path), id);
  return name;
}

export async function loadFeatures() {
  if (featuresCache) return featuresCache;
  try {
    await ensureVoteUser();
    const { db, get, ref } = await ensureApp();
    const snap = await get(ref(db, "config/features"));
    featuresCache = snap.val() || { scoreSource: "scores", vetoOverride: false };
  } catch {
    featuresCache = { scoreSource: "scores", vetoOverride: false };
  }
  return featuresCache;
}

export async function syncBadge(points, week) {
  const code = loadRoundCode();
  if (!code || typeof points !== "number") return;
  try {
    const id = await ensureVoteUser();
    const key = await activeRoundKey();
    const { db, ref, set } = await ensureApp();
    await set(ref(db, `scores/${key}/${id}`), {
      points: Math.max(0, Math.min(200, Math.floor(points))),
      week: String(week || berlinDate()),
    });
  } catch {
    /* badge is optional */
  }
}

export async function readBadge() {
  try {
    const id = await ensureVoteUser();
    const key = await activeRoundKey();
    const { db, get, ref } = await ensureApp();
    return (await get(ref(db, `scores/${key}/${id}`))).val() || null;
  } catch {
    return null;
  }
}

export async function requestVeto(reason = "override") {
  const features = await loadFeatures();
  if (!features?.vetoOverride) return false;
  const id = await ensureVoteUser();
  const key = await activeRoundKey();
  const { db, ref, set } = await ensureApp();
  await set(ref(db, `ops/veto/${key}/${id}`), {
    at: Date.now(),
    reason: String(reason || "override").slice(0, 32),
  });
  return true;
}

/**
 * Advance meta/voteDay. Old days are deleted only inside the joined round.
 */
export async function purgeStaleVotes() {
  if (!purgeOnce) {
    purgeOnce = advanceVoteDay().catch(() => {
      purgeOnce = null;
    });
  }
  await purgeActiveRound();
  return purgeOnce;
}

async function advanceVoteDay() {
  await ensureVoteUser();
  const keep = berlinDate();
  const { db, get, ref, set } = await ensureApp();
  const metaRef = ref(db, "meta/voteDay");
  const metaSnap = await get(metaRef);
  const current = metaSnap.val();
  if (!current || keep > current) {
    await set(metaRef, keep);
  }
}

/** ISO days ending at `keep`, newest first — used when parent list reads are denied. */
function recentIsoDays(keep, count = 21) {
  const [year, month, date] = String(keep || "")
    .split("-")
    .map(Number);
  if (!year || !month || !date) return [];
  const days = [];
  for (let i = 0; i < count; i += 1) {
    days.push(new Date(Date.UTC(year, month - 1, date - i)).toISOString().slice(0, 10));
  }
  return days;
}

async function purgeActiveRound() {
  const code = loadRoundCode();
  if (!code) return;
  try {
    await ensureVoteUser();
    const key = await activeRoundKey();
    const keep = berlinDate();
    const { db, ref, remove } = await ensureApp();
    for (const day of staleVoteDays(recentIsoDays(keep, 21), keep)) {
      await remove(ref(db, votesPath(day, key))).catch(() => {});
      await remove(ref(db, seatsPath(day, key))).catch(() => {});
      await remove(ref(db, presentPath(day, key))).catch(() => {});
      await remove(ref(db, `history/${key}/${day}`)).catch(() => {});
    }
  } catch {
    /* offline / rules */
  }
}

/** Own ballot via seat (works before lock). Falls back to in-memory records after reveal. */
async function loadOwnBallot(id, key, records = {}) {
  const { db, get, ref } = await ensureApp();
  const day = berlinDate();
  const seatPath = `${seatsPath(day, key)}/${id}`;
  try {
    const seat = (await get(ref(db, seatPath))).val();
    if (typeof seat === "string") {
      const own = (await get(ref(db, `${dayVotesPath(key, day)}/${seat}`))).val();
      if (own?.uid === id) {
        return { slot: seat, mine: mineFromRecord(own), records: { [seat]: own } };
      }
      return { slot: seat, mine: emptyMine(), records: {} };
    }
  } catch {
    /* pre-lock race / offline */
  }
  const fresh = voteRecords(records);
  const slot = mySlot(fresh, id);
  return { slot, mine: mineFromRecord(slot != null ? fresh[slot] : null), records: fresh };
}

export function stopListening() {
  listenGen += 1;
  unsub?.();
  unsub = null;
  presentUnsub?.();
  presentUnsub = null;
  lotteryGen += 1;
  lotteryUnsub?.();
  lotteryUnsub = null;
}

function emptyVoteState(day) {
  return {
    day,
    records: {},
    present: {},
    counts: countVotes({}),
    mine: emptyMine(),
    uid,
    revealed: false,
    online: {},
  };
}

/**
 * Names come from `present`. Checkmarks come from this seat's own ballot.
 * The day tree stays sealed before and after the lock, so another canteen
 * never arrives. After the lock the public counts stay empty: one own vote
 * is not the room's result.
 */
export function listenVotes(onChange) {
  unsub?.();
  unsub = null;
  presentUnsub?.();
  presentUnsub = null;
  const gen = ++listenGen;
  const now = new Date();
  const day = berlinDate(now);
  const empty = emptyVoteState(day);
  ensureApp()
    .then(async ({ db, get, onDisconnect, onValue, ref, remove, set }) => {
      if (gen !== listenGen) return;
      await purgeStaleVotes();
      if (gen !== listenGen) return;
      const key = await roundKeyFor(loadRoundCode());
      if (!isVoteDay(now) || !ROUND_KEY_RE.test(key)) {
        onChange(empty);
        return;
      }
      const cal = (await get(ref(db, `calendar/${day}`))).val() || {};
      const lockAt = Number(cal.l) || 0;
      const revealed = lockAt > 0 && serverNow() >= lockAt;

      let presentMap = {};
      let ownRec = null;
      /** Last ballot we actually read. A present echo must not drop it. */
      let heldRec = null;
      let online = {};
      let voteUnsub = () => {};
      /** undefined until the seat listener reports; null means no seat. */
      let watchedSlot;
      let stopped = false;
      let seated = false;
      let connected = false;
      const liveNode = uid ? ref(db, `live/${key}/${uid}`) : null;
      const pushLive = () => {
        if (stopped || !liveNode) return;
        if (!connected || !seated) {
          if (connected) remove(liveNode).catch(() => {});
          return;
        }
        onDisconnect(liveNode)
          .remove()
          .then(() => {
            if (!stopped && connected && seated) return set(liveNode, true);
          })
          .catch(() => {});
      };
      const stillPresent = () =>
        Boolean(uid) && presentMap && Object.prototype.hasOwnProperty.call(presentMap, uid);
      const emit = () => {
        if (stopped || gen !== listenGen) return;
        const rec = ownRec || (stillPresent() ? heldRec : null);
        const state = stateFromPresent({ day, present: presentMap, ownRec: rec, uid, revealed });
        if (revealed) state.counts = countVotes({});
        state.online = online;
        onChange(state);
      };
      const presentHandle = onValue(
        ref(db, presentPath(day, key)),
        (snap) => {
          const val = snap.val();
          presentMap = val && typeof val === "object" ? val : {};
          if (!stillPresent()) heldRec = null;
          emit();
        },
        () => {},
      );
      const liveHandle = onValue(
        ref(db, `live/${key}`),
        (snap) => {
          const val = snap.val();
          const next = {};
          if (val && typeof val === "object") {
            for (const [id, flag] of Object.entries(val)) {
              if (flag === true && UID_RE.test(id)) next[id] = true;
            }
          }
          online = next;
          emit();
        },
        () => {},
      );
      const connectedHandle = onValue(
        ref(db, ".info/connected"),
        (snap) => {
          connected = snap.val() === true;
          pushLive();
        },
        () => {},
      );
      const watchSlot = (slot) => {
        if (stopped) return;
        seated = typeof slot === "string";
        pushLive();
        if (typeof slot !== "string") {
          if (watchedSlot === null) {
            emit();
            return;
          }
          voteUnsub();
          voteUnsub = () => {};
          watchedSlot = null;
          ownRec = null;
          // Seat gone, but present still lists us: keep the ink until the nick drops.
          if (!stillPresent()) heldRec = null;
          emit();
          return;
        }
        if (slot === watchedSlot) return;
        voteUnsub();
        voteUnsub = () => {};
        watchedSlot = slot;
        const handle = onValue(
          ref(db, `${dayVotesPath(key, day)}/${slot}`),
          (snap) => {
            const rec = snap.val();
            ownRec = rec && rec.uid === uid ? rec : null;
            if (ownRec) heldRec = ownRec;
            else if (!rec && !stillPresent()) heldRec = null;
            emit();
          },
          () => {
            /* A denied read must not clear checks that are already drawn. */
          },
        );
        voteUnsub = () => handle();
      };
      let seatHandle = () => {};
      if (uid) {
        const handle = onValue(
          ref(db, `${seatsPath(day, key)}/${uid}`),
          (snap) => watchSlot(snap.val()),
          () => {},
        );
        seatHandle = () => handle();
      }
      const stop = () => {
        if (stopped) return;
        stopped = true;
        presentHandle();
        liveHandle();
        connectedHandle();
        seatHandle();
        voteUnsub();
        if (liveNode && connected) remove(liveNode).catch(() => {});
      };
      const waitMs = Math.max(0, lockAt - serverNow()) + 50;
      if (lockAt > serverNow()) {
        setTimeout(() => {
          if (gen !== listenGen) return;
          listenVotes(onChange);
        }, waitMs);
      }
      if (gen !== listenGen) {
        stop();
        return;
      }
      presentUnsub = stop;
      unsub = stop;
    })
    .catch(() => {});
  return () => unsub?.();
}

export function listenPresent(onChange) {
  presentUnsub?.();
  presentUnsub = null;
  const gen = ++presentGen;
  ensureApp()
    .then(async ({ db, onValue, ref }) => {
      if (gen !== presentGen) return;
      await ensureVoteUser();
      const key = await activeRoundKey();
      const day = berlinDate();
      const handle = onValue(
        ref(db, presentPath(day, key)),
        (snap) => onChange(snap.val() || {}),
        () => {},
      );
      if (gen !== presentGen) {
        handle();
        return;
      }
      presentUnsub = () => handle();
    })
    .catch(() => onChange({}));
  return () => presentUnsub?.();
}

function isPermissionDenied(err) {
  const msg = String(err?.code || err?.message || err);
  return /permission[_-]?denied/i.test(msg);
}

function historyPayload(mine, nick) {
  if (mine?.egal) return { canteen: "egal", nick };
  if (!mine?.picks?.length) return null;
  const row = { canteen: mine.picks[0], nick };
  if (mine.picks[1]) row.second = mine.picks[1];
  return row;
}

async function writeBallot(mine) {
  const nick = await reserveNick(loadNick());
  const id = await ensureVoteUser();
  await purgeStaleVotes();
  const key = await activeRoundKey();
  const { db, get, ref, update } = await ensureApp();
  const day = berlinDate();
  const path = dayVotesPath(key, day);
  const seatPath = `${seatsPath(day, key)}/${id}`;
  const showPath = `${presentPath(day, key)}/${id}`;
  const histPath = historyPath(day, key, id);
  // Before lock the day tree is unreadable — use seat + present instead.
  const [seatSnap, presentSnap] = await Promise.all([
    get(ref(db, seatPath)),
    get(ref(db, presentPath(day, key))),
  ]);
  const present = presentSnap.val() && typeof presentSnap.val() === "object" ? presentSnap.val() : {};
  const seated = Object.keys(present).filter((who) => UID_RE.test(who)).length;
  const seat = seatSnap.val();
  const updating = typeof seat === "string";
  if (!updating && seated >= MAX_VOTERS) throw new Error("full");
  const ballot = ballotPayload(id, nick, mine, Date.now());
  if (!ballot) throw new Error("nick");
  const hist = historyPayload(mine, nick);
  if (!hist) throw new Error("nick");
  const writeSlot = async (slot, payload) => {
    await update(ref(db), {
      [`${path}/${slot}`]: payload,
      [seatPath]: slot,
      [showPath]: nick,
      [histPath]: hist,
    });
    return mineFromRecord(payload);
  };
  const write = async (slot) => {
    try {
      return await writeSlot(slot, ballot);
    } catch (err) {
      if (!mine?.egal || !isPermissionDenied(err)) throw err;
      return writeSlot(slot, {
        uid: id,
        nick,
        canteen: MARKET_ID,
        at: ballot.at,
        egal: true,
      });
    }
  };
  if (updating) return write(seat);
  for (let slot = 0; slot < MAX_VOTERS; slot += 1) {
    try {
      return await write(String(slot));
    } catch {
      /* seat taken between probe and write */
    }
  }
  throw new Error("full");
}

export async function clearVote(records = {}) {
  assertBallotOpen();
  const id = await ensureVoteUser();
  const key = await activeRoundKey();
  const { db, ref, update } = await ensureApp();
  const { slot } = await loadOwnBallot(id, key, records);
  if (slot == null) return emptyMine();
  await purgeStaleVotes();
  const day = berlinDate();
  const path = dayVotesPath(key, day);
  await update(ref(db), {
    [`${path}/${slot}`]: null,
    [`${seatsPath(day, key)}/${id}`]: null,
    [`${presentPath(day, key)}/${id}`]: null,
    [historyPath(day, key, id)]: null,
  });
  return emptyMine();
}

/** The mine the click already drew. Null when the caller did not ink one. */
function inkedMine(mine) {
  if (!mine || typeof mine !== "object" || !Array.isArray(mine.picks)) return null;
  if (mine.egal) return { picks: [], egal: true };
  return { picks: [...mine.picks], egal: false };
}

export async function toggleVote(canteen, current, records = {}) {
  assertBallotOpen();
  assertCanteen(canteen);
  const inked = inkedMine(current);
  if (inked) {
    if (!inked.picks.length) return clearVote(records);
    return writeBallot(inked);
  }
  const id = await ensureVoteUser();
  const key = await activeRoundKey();
  const { mine, records: ownRecords } = await loadOwnBallot(id, key, records);
  const next = nextMineForPick(mine, canteen);
  if (!next.picks.length) return clearVote(ownRecords);
  return writeBallot(next);
}

function cleanGuesses(guesses, self, seated) {
  const clean = {};
  for (const [who, pick] of Object.entries(guesses || {})) {
    if (who === self || !UID_RE.test(who) || !seated.has(who) || !isPlateId(pick)) continue;
    clean[who] = pick;
  }
  return clean;
}

export async function savePlate(dish, guesses) {
  if (!isPlateId(dish)) throw new Error("dish");
  assertBallotOpen();
  const id = await ensureVoteUser();
  await purgeStaleVotes();
  const key = await activeRoundKey();
  const { db, get, ref, set } = await ensureApp();
  const day = berlinDate();
  const seat = (await get(ref(db, `${seatsPath(day, key)}/${id}`))).val();
  if (typeof seat !== "string") throw new Error("ballot");
  const own = (await get(ref(db, `${dayVotesPath(key, day)}/${seat}`))).val();
  const nick = normalizeNick(own?.nick);
  if (!own || !isValidNick(nick) || nick !== own.nick) throw new Error("ballot");
  const present = (await get(ref(db, presentPath(day, key)))).val() || {};
  const seated = new Set(Object.keys(present));
  seated.add(id);
  const at = Date.now();
  const payload = { uid: id, nick, dish, at };
  const picked = cleanGuesses(guesses, id, seated);
  if (Object.keys(picked).length) payload.guesses = picked;
  await set(ref(db, `eats/${key}/${day}/${id}`), payload);
  return payload;
}

/** Own sheet for today. Other people's dishes stay unread, before and after the lock. */
export function listenEats(onChange) {
  eatUnsub?.();
  eatUnsub = null;
  const gen = ++eatGen;
  const code = loadRoundCode();
  if (!code) {
    onChange({});
    return () => {};
  }
  ensureApp()
    .then(async ({ db, onValue, ref }) => {
      if (gen !== eatGen) return;
      await ensureVoteUser();
      if (!uid) {
        onChange({});
        return;
      }
      const key = await activeRoundKey();
      const day = berlinDate();
      const tree = {};
      const publish = () => {
        if (gen !== eatGen) return;
        onChange({ ...tree });
      };
      const handle = onValue(
        ref(db, `eats/${key}/${day}/${uid}`),
        (snap) => {
          const sheet = snap.val();
          tree[day] = sheet ? { [uid]: sheet } : {};
          publish();
        },
        () => publish(),
      );
      if (gen !== eatGen) {
        handle();
        return;
      }
      eatUnsub = () => handle();
      publish();
    })
    .catch(() => onChange({}));
  return () => eatUnsub?.();
}

/** Server points and the weekend crown. Not the private scores node. */
export function listenLottery(onChange) {
  lotteryUnsub?.();
  lotteryUnsub = null;
  const gen = ++lotteryGen;
  const code = loadRoundCode();
  if (!code) {
    onChange({ points: {}, winner: null });
    return () => {};
  }
  ensureApp()
    .then(async ({ db, onValue, ref }) => {
      if (gen !== lotteryGen) return;
      await ensureVoteUser();
      const key = await activeRoundKey();
      let points = {};
      let winner = null;
      const publish = () => {
        if (gen !== lotteryGen) return;
        onChange({ points, winner });
      };
      const pointsHandle = onValue(
        ref(db, `tallies/rounds/${key}/points`),
        (snap) => {
          points = snap.val() || {};
          publish();
        },
        () => publish(),
      );
      const winnerHandle = onValue(
        ref(db, `tallies/rounds/${key}/winner`),
        (snap) => {
          winner = snap.val() || null;
          publish();
        },
        () => publish(),
      );
      if (gen !== lotteryGen) {
        pointsHandle();
        winnerHandle();
        return;
      }
      lotteryUnsub = () => {
        pointsHandle();
        winnerHandle();
      };
    })
    .catch(() => onChange({ points: {}, winner: null }));
  return () => lotteryUnsub?.();
}

/** Canteen sums the server already folded. Not the ballots. */
export async function loadRoundDays(key) {
  await ensureVoteUser();
  const round = key || (await activeRoundKey());
  const { db, get, ref } = await ensureApp();
  try {
    return (await get(ref(db, `tallies/rounds/${round}/days`))).val() || {};
  } catch {
    return {};
  }
}

export async function loadDirectory() {
  await ensureVoteUser();
  const { auth } = await ensureApp();
  const token = await auth.currentUser?.getIdTokenResult();
  if (!token?.claims?.desk) return {};
  const { db, get, ref } = await ensureApp();
  return (await get(ref(db, "tallies/directory"))).val() || {};
}

export async function hasDeskClaim() {
  try {
    await ensureVoteUser();
    const { auth } = await ensureApp();
    const token = await auth.currentUser.getIdTokenResult();
    return token?.claims?.desk === true;
  } catch {
    return false;
  }
}

export async function toggleEgal(records = {}, current = null) {
  assertBallotOpen();
  const inked = inkedMine(current);
  if (inked) {
    if (!inked.egal) return clearVote(records);
    return writeBallot({ picks: [], egal: true });
  }
  const id = await ensureVoteUser();
  const key = await activeRoundKey();
  const { mine, records: ownRecords } = await loadOwnBallot(id, key, records);
  if (mine.egal) return clearVote(ownRecords);
  return writeBallot({ picks: [], egal: true });
}

export async function setRoundLabel(label) {
  if (!(await hasDeskClaim())) throw new Error("desk");
  const key = await activeRoundKey();
  const text = String(label || "").trim().slice(0, 40);
  if (!text) return;
  const { db, ref, set } = await ensureApp();
  await set(ref(db, `tallies/directory/${key}/label`), text);
}
