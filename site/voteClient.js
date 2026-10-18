import {
  berlinDate,
  ballotPayload,
  canAcceptVote,
  berlinWeekday,
  countVotes,
  emptyMine,
  isValidNick,
  isVoteDay,
  loadNick,
  loadRoundCode,
  MAX_VOTERS,
  mineFromRecord,
  mySlot,
  nextMineForPick,
  normalizeNick,
  staleVoteDays,
  votePhase,
  voteTargetIds,
  votesPath,
} from "./vote.js?v=cda9bcf0";
import config from "./firebase.json?v=8c4496a6" with { type: "json" };

let appReady = null;
let uid = null;
let unsub = null;
let purgeOnce = null;

function dayVotesPath() {
  const path = votesPath(berlinDate(), loadRoundCode());
  if (!path) throw new Error("round");
  return path;
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
  const [
    { initializeApp },
    { getAuth, onAuthStateChanged, signInAnonymously },
    { getDatabase, get, onValue, ref, remove, set },
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js"),
  ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  return {
    auth,
    db,
    get,
    onAuthStateChanged,
    onValue,
    ref,
    remove,
    set,
    signInAnonymously,
  };
}

function ensureApp() {
  if (!appReady) appReady = firebase();
  return appReady;
}

export async function ensureVoteUser() {
  const { auth, onAuthStateChanged, signInAnonymously } = await ensureApp();
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
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
  return uid;
}

/**
 * Advance meta/voteDay. Old days are deleted only inside the joined round.
 * Nothing here writes a ballot to `votes/{day}`.
 */
export async function purgeStaleVotes() {
  if (!purgeOnce) {
    purgeOnce = advanceVoteDay().catch(() => {
      /* offline / rules / first deploy */
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

async function purgeActiveRound() {
  const code = loadRoundCode();
  if (!code) return;
  try {
    await ensureVoteUser();
    const keep = berlinDate();
    const { db, get, ref, remove } = await ensureApp();
    const snap = await get(ref(db, `votes/${code}`));
    const keys = Object.keys(snap.val() || {});
    await Promise.all(
      staleVoteDays(keys, keep).map((day) => remove(ref(db, votesPath(day, code)))),
    );
  } catch {
    /* offline / rules */
  }
}

export function listenVotes(onChange) {
  unsub?.();
  const now = new Date();
  const day = berlinDate(now);
  const empty = {
    day,
    records: {},
    counts: countVotes({}),
    mine: emptyMine(),
    uid,
  };
  ensureApp()
    .then(async ({ db, onValue, ref }) => {
      await purgeStaleVotes();
      const path = votesPath(day, loadRoundCode());
      if (!isVoteDay(now) || !path) {
        onChange(empty);
        return;
      }
      const handle = onValue(
        ref(db, path),
        (snap) => {
          const records = snap.val() || {};
          onChange({
            day,
            records,
            counts: countVotes(records),
            mine: mineFromRecord(
              uid ? Object.values(records).find((rec) => rec?.uid === uid) : null,
            ),
            uid,
          });
        },
        () => onChange(empty),
      );
      unsub = () => handle();
    })
    .catch(() => onChange(empty));
  return () => unsub?.();
}

async function writeBallot(mine) {
  const nick = normalizeNick(loadNick());
  if (!isValidNick(nick)) throw new Error("nick");
  const id = await ensureVoteUser();
  await purgeStaleVotes();
  const { db, get, ref, set } = await ensureApp();
  const path = dayVotesPath();
  /* Always re-read seats — voteState can still hold another round after a join. */
  const fresh = (await get(ref(db, path))).val() || {};
  if (!canAcceptVote(fresh, id)) throw new Error("full");
  const ballot = ballotPayload(id, nick, mine, Date.now());
  if (!ballot) throw new Error("nick");
  const existing = mySlot(fresh, id);
  if (existing != null) {
    await set(ref(db, `${path}/${existing}`), ballot);
    return mineFromRecord(ballot);
  }
  for (let slot = 0; slot < MAX_VOTERS; slot += 1) {
    if (fresh[slot]) continue;
    try {
      await set(ref(db, `${path}/${slot}`), ballot);
      return mineFromRecord(ballot);
    } catch {
      /* seat taken between get and write */
    }
  }
  throw new Error("full");
}

export async function clearVote(records = {}) {
  assertBallotOpen();
  const id = await ensureVoteUser();
  const slot = mySlot(records, id);
  if (slot == null) return emptyMine();
  await purgeStaleVotes();
  const { db, ref, remove } = await ensureApp();
  await remove(ref(db, `${dayVotesPath()}/${slot}`));
  return emptyMine();
}

export async function toggleVote(canteen, _current, records = {}) {
  assertBallotOpen();
  assertCanteen(canteen);
  const id = await ensureVoteUser();
  const { db, get, ref } = await ensureApp();
  const fresh = (await get(ref(db, dayVotesPath()))).val() || {};
  const next = nextMineForPick(mineFromRecord(fresh[mySlot(fresh, id)]), canteen);
  if (next.blocked) throw new Error("picks");
  if (!next.picks.length) return clearVote(fresh);
  return writeBallot(next);
}

export async function toggleEgal(records = {}) {
  assertBallotOpen();
  const id = await ensureVoteUser();
  const { db, get, ref } = await ensureApp();
  const fresh = (await get(ref(db, dayVotesPath()))).val() || records;
  const mine = mineFromRecord(
    id ? Object.values(fresh).find((rec) => rec?.uid === id) : null,
  );
  if (mine.egal) return clearVote(fresh);
  return writeBallot({ picks: [], egal: true });
}
