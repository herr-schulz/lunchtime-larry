/**
 * Migrate legacy plaintext round codes (e.g. aiteam) to random codes + PBKDF2 roundKeys.
 *
 * Copies votes/eats/seats/tallies under the new key, reserves names, writes uid-bound
 * move tickets, then deletes the old plaintext paths.
 *
 * Needs firebase-admin (not a project dependency):
 *   npm install --no-save firebase-admin
 *
 *   node scripts/migrate-rounds.mjs aiteam [service-account.json]
 *   node scripts/migrate-rounds.mjs --cleanup-moves [service-account.json]
 *
 * Prints the new plaintext code once — store it offline. Do not commit it.
 */
import { createHash, randomBytes, pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";

const ROUND_SALT = "lunchtime-larry-round-v1";
const PBKDF2_ITERS = 600_000;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
const args = process.argv.slice(2);
const cleanup = args.includes("--cleanup-moves");
const positional = args.filter((a) => !a.startsWith("--"));
const [legacyOrUid, keyPath] = positional;
const credentialPath = keyPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!credentialPath) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS or pass the service-account JSON path.");
  process.exit(1);
}

function generateCode() {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function deriveRoundKey(code) {
  return pbkdf2Sync(code, ROUND_SALT, PBKDF2_ITERS, 32, "sha256").toString("hex");
}

function collectUids(tree) {
  const uids = new Set();
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && /^[A-Za-z0-9]{16,128}$/.test(k) && depth >= 1) uids.add(k);
      if (v && typeof v === "object") {
        if (typeof v.uid === "string") uids.add(v.uid);
        walk(v, depth + 1);
      }
    }
  };
  walk(tree);
  return uids;
}

function collectNames(votes) {
  /** @type {Map<string, string>} */
  const names = new Map();
  for (const day of Object.values(votes || {})) {
    if (!day || typeof day !== "object") continue;
    for (const rec of Object.values(day)) {
      if (!rec?.uid || !rec?.nick) continue;
      const key = String(rec.nick).toLowerCase();
      if (!names.has(key)) names.set(key, rec.uid);
    }
  }
  return names;
}

const account = JSON.parse(await readFile(credentialPath, "utf8"));
let adminApp;
let db;
try {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getDatabase } = await import("firebase-admin/database");
  adminApp = initializeApp({
    credential: cert(account),
    databaseURL: account.databaseURL || process.env.FIREBASE_DATABASE_URL,
  });
  db = getDatabase(adminApp);
} catch (err) {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("firebase-admin is missing. Run: npm install --no-save firebase-admin");
  } else {
    console.error(err?.message || err);
  }
  process.exit(1);
}

if (!process.env.FIREBASE_DATABASE_URL && !account.databaseURL) {
  // Default project URL for lunchtime-larry
  db = (await import("firebase-admin/database")).getDatabase(adminApp, "https://lunchtime-larry-default-rtdb.europe-west1.firebasedatabase.app");
}

if (cleanup) {
  const snap = await db.ref("moves").get();
  const moves = snap.val() || {};
  const cutoff = Date.now() - 30 * 86400000;
  let removed = 0;
  for (const [uid, row] of Object.entries(moves)) {
    // Tickets have no timestamp; cleanup deletes all remaining after manual confirm window.
    await db.ref(`moves/${uid}`).remove();
    removed += 1;
    void row;
    void cutoff;
  }
  console.log(`removed ${removed} move tickets`);
  process.exit(0);
}

const legacy = String(legacyOrUid || "").toLowerCase();
if (!/^[a-z0-9][a-z0-9-]{1,22}[a-z0-9]$/.test(legacy)) {
  console.error("usage: node scripts/migrate-rounds.mjs <legacy-code> [service-account.json]");
  process.exit(1);
}

const code = generateCode();
const roundKey = deriveRoundKey(code);
console.log(`new code (store offline): ${code}`);
console.log(`roundKey: ${roundKey}`);

const roots = ["votes", "eats", "seats", "tallies/rounds"];
const copied = {};
for (const root of roots) {
  const snap = await db.ref(`${root}/${legacy}`).get();
  copied[root] = snap.val();
}
const directory = (await db.ref(`tallies/directory/${legacy}`).get()).val();

const updates = {};
for (const root of roots) {
  if (copied[root] != null) updates[`${root}/${roundKey}`] = copied[root];
}
if (directory != null) {
  updates[`tallies/directory/${roundKey}`] = {
    ...directory,
    label: directory.label || legacy,
  };
} else {
  updates[`tallies/directory/${roundKey}/label`] = legacy;
}

const uids = new Set([
  ...collectUids(copied.votes),
  ...collectUids(copied.eats),
  ...collectUids(copied.seats),
]);
for (const uid of uids) {
  updates[`moves/${uid}`] = { code };
}

for (const [name, uid] of collectNames(copied.votes)) {
  updates[`rounds/${roundKey}/names/${name}`] = uid;
}

await db.ref().update(updates);
console.log(`copied data for ${uids.size} uids`);

for (const root of roots) {
  await db.ref(`${root}/${legacy}`).remove();
}
await db.ref(`tallies/directory/${legacy}`).remove();
console.log(`removed legacy path ${legacy}`);
console.log("done — users with a ticket pick up the new code on next visit");
