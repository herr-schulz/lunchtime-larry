import {
  canAcceptVote,
  CANTEEN_IDS,
  countVotes,
  isValidNick,
  lastVoteDate,
  loadNick,
  MAX_VOTERS,
  mySlot,
  normalizeNick,
  staleVoteDays,
  votesPath,
} from "./vote.js?v=a52b5e64";
import config from "./firebase.json?v=8c4496a6" with { type: "json" };

let appReady = null;
let uid = null;
let unsub = null;
let purgeOnce = null;

function dayVotesPath() {
  return votesPath(lastVoteDate());
}

function assertCanteen(canteen) {
  if (!CANTEEN_IDS.includes(canteen)) throw new Error("canteen");
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
 * Advance meta/voteDay and delete older `votes/{day}` trees.
 * Nick lives only in today’s ballots (+ localStorage); purged days leave no server nick.
 */
export async function purgeStaleVotes() {
  if (!purgeOnce) {
    purgeOnce = (async () => {
      await ensureVoteUser();
      const keep = lastVoteDate();
      const { db, get, ref, remove, set } = await ensureApp();
      const metaRef = ref(db, "meta/voteDay");
      const metaSnap = await get(metaRef);
      const current = metaSnap.val();
      if (!current || keep > current) {
        await set(metaRef, keep);
      }
      const votesSnap = await get(ref(db, "votes"));
      const keys = Object.keys(votesSnap.val() || {});
      await Promise.all(
        staleVoteDays(keys, keep).map((day) => remove(ref(db, votesPath(day)))),
      );
    })().catch(() => {
      /* offline / rules / first deploy */
      purgeOnce = null;
    });
  }
  return purgeOnce;
}

export function listenVotes(onChange) {
  unsub?.();
  const day = lastVoteDate();
  const empty = {
    day,
    records: {},
    counts: countVotes({}),
    mine: null,
    uid,
  };
  ensureApp()
    .then(async ({ db, onValue, ref }) => {
      await purgeStaleVotes();
      const handle = onValue(
        ref(db, dayVotesPath()),
        (snap) => {
          const records = snap.val() || {};
          onChange({
            day,
            records,
            counts: countVotes(records),
            mine: uid
              ? Object.values(records).find((rec) => rec?.uid === uid)?.canteen ??
                null
              : null,
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

export async function setVote(canteen, records = {}) {
  assertCanteen(canteen);
  const nick = normalizeNick(loadNick());
  if (!isValidNick(nick)) throw new Error("nick");
  const id = await ensureVoteUser();
  await purgeStaleVotes();
  if (!canAcceptVote(records, id)) throw new Error("full");
  const { db, ref, set } = await ensureApp();
  /* Nick only in today’s ballot for display — never a permanent profile. */
  const ballot = { uid: id, nick, canteen, at: Date.now() };
  const existing = mySlot(records, id);
  if (existing != null) {
    await set(ref(db, `${dayVotesPath()}/${existing}`), ballot);
    return;
  }
  for (let slot = 0; slot < MAX_VOTERS; slot += 1) {
    if (records[slot]) continue;
    try {
      await set(ref(db, `${dayVotesPath()}/${slot}`), ballot);
      return;
    } catch {
      /* seat taken between listen and write */
    }
  }
  throw new Error("full");
}

export async function clearVote(records = {}) {
  const id = await ensureVoteUser();
  const slot = mySlot(records, id);
  if (slot == null) return;
  await purgeStaleVotes();
  const { db, ref, remove } = await ensureApp();
  await remove(ref(db, `${dayVotesPath()}/${slot}`));
}

export async function toggleVote(canteen, current, records = {}) {
  assertCanteen(canteen);
  if (current === canteen) {
    await clearVote(records);
    return null;
  }
  await setVote(canteen, records);
  return canteen;
}
