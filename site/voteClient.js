import {
  canAcceptVote,
  countVotes,
  lastVoteDate,
  loadNick,
  MAX_VOTERS,
  mySlot,
  votesPath,
} from "./vote.js?v=789701db";
import config from "./firebase.json?v=8c4496a6" with { type: "json" };

let appReady = null;
let uid = null;
let unsub = null;

function dayVotesPath() {
  return votesPath(lastVoteDate());
}

async function firebase() {
  const [
    { initializeApp },
    { getAuth, onAuthStateChanged, signInAnonymously },
    { getDatabase, onValue, ref, remove, set },
  ] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js"),
  ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  return { auth, db, onAuthStateChanged, onValue, ref, remove, set, signInAnonymously };
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
    .then(({ db, onValue, ref }) => {
      const handle = onValue(
        ref(db, dayVotesPath()),
        (snap) => {
          const records = snap.val() || {};
          onChange({
            day,
            records,
            counts: countVotes(records),
            mine: uid ? Object.values(records).find((rec) => rec?.uid === uid)?.canteen ?? null : null,
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
  const nick = loadNick();
  if (!nick) throw new Error("nick");
  const id = await ensureVoteUser();
  if (!canAcceptVote(records, id)) throw new Error("full");
  const { db, ref, set } = await ensureApp();
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
  const { db, ref, remove } = await ensureApp();
  await remove(ref(db, `${dayVotesPath()}/${slot}`));
}

export async function toggleVote(canteen, current, records = {}) {
  if (current === canteen) {
    await clearVote(records);
    return null;
  }
  await setVote(canteen, records);
  return canteen;
}
