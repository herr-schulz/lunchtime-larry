/**
 * Write the public lottery tally. Admin SDK, so this bypasses security rules.
 * It runs while the slips are still stored and writes only counts, nicks and points.
 *
 *   npm install --no-save firebase-admin
 *   node scripts/lottery-tally.mjs [service-account.json]
 *
 * Needs a database credential in the environment or as the argument.
 * Does not print the credential, round codes, dishes or ballots.
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildRoundTally } from "../site/lottery.js";

const KEY_RE = /^[a-f0-9]{64}$/;

export { buildRoundTally };

async function main() {
  const credentialPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialPath) {
    console.error("Set GOOGLE_APPLICATION_CREDENTIALS or pass the service-account JSON path.");
    process.exit(1);
  }
  const account = JSON.parse(await readFile(credentialPath, "utf8"));
  const databaseURL = account.databaseURL || process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    console.error("The service account has no databaseURL.");
    process.exit(1);
  }
  let db;
  try {
    const { initializeApp, cert } = await import("firebase-admin/app");
    const { getDatabase } = await import("firebase-admin/database");
    db = getDatabase(
      initializeApp({
        credential: cert(account),
        databaseURL,
      }),
    );
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND") {
      console.error("firebase-admin is missing. Run: npm install --no-save firebase-admin");
    } else {
      console.error("Could not open the database.");
    }
    process.exit(1);
  }

  const [eatsRoot, votesRoot, calendar] = await Promise.all([
    db.ref("eats").get().then((snap) => snap.val() || {}),
    db.ref("votes").get().then((snap) => snap.val() || {}),
    db.ref("calendar").get().then((snap) => snap.val() || {}),
  ]);
  const keys = new Set(
    [...Object.keys(eatsRoot), ...Object.keys(votesRoot)].filter((key) => KEY_RE.test(key)),
  );
  const now = new Date();
  let written = 0;
  for (const key of keys) {
    const built = buildRoundTally({
      votes: votesRoot[key],
      eats: eatsRoot[key],
      calendar,
      now,
    });
    await db.ref(`tallies/rounds/${key}/days`).set(built.days);
    await db.ref(`tallies/rounds/${key}/points`).set(built.points);
    if (built.winner) await db.ref(`tallies/rounds/${key}/winner`).set(built.winner);
    else await db.ref(`tallies/rounds/${key}/winner`).remove();
    written += 1;
  }
  console.log(`lottery tallies written for ${written} rounds`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch(() => {
    console.error("lottery tally failed");
    process.exit(1);
  });
}
