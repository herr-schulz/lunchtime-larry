/** How often Larry is thrown in the bin. A public counter, not a ballot. */

import config from "./firebase.json?v=8c4496a6" with { type: "json" };

const FIREBASE_VER = "11.10.0";

/** @type {Promise<{
 *   auth: import("firebase/auth").Auth,
 *   database: import("firebase/database").Database,
 *   ref: typeof import("firebase/database").ref,
 *   get: typeof import("firebase/database").get,
 *   runTransaction: typeof import("firebase/database").runTransaction,
 *   signInAnonymously: typeof import("firebase/auth").signInAnonymously,
 * }> | null} */
let ready = null;

async function open() {
  if (!ready) {
    ready = (async () => {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}`;
      const [{ getApp, getApps, initializeApp }, { getAuth, signInAnonymously }, { get, getDatabase, ref, runTransaction }] =
        await Promise.all([
          import(`${base}/firebase-app.js`),
          import(`${base}/firebase-auth.js`),
          import(`${base}/firebase-database.js`),
        ]);
      const existing = getApps();
      let app = existing.length ? getApp() : null;
      if (!app) {
        try {
          app = initializeApp(config);
        } catch {
          app = getApp();
        }
      }
      return {
        auth: getAuth(app),
        database: getDatabase(app),
        ref,
        get,
        runTransaction,
        signInAnonymously,
      };
    })();
  }
  return ready;
}

function asCount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

/** Public total. Missing node reads as zero. */
export async function readTosses() {
  const { database, ref, get } = await open();
  const snap = await get(ref(database, "tosses/n"));
  return asCount(snap.val());
}

/** Plus one. Anonymous sign-in is enough; ballots stay untouched. */
export async function incrementTosses() {
  const { auth, database, ref, runTransaction, signInAnonymously } = await open();
  if (!auth.currentUser) await signInAnonymously(auth);
  const result = await runTransaction(ref(database, "tosses/n"), (current) => asCount(current) + 1);
  return asCount(result.snapshot.val());
}
