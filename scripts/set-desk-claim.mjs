/**
 * Sets the custom claim `{ desk: true }` on one Firebase Auth user.
 * The rules read it as `auth.token.desk == true`.
 *
 * Needs firebase-admin, which is NOT a project dependency (keep it out of the
 * app's lockfile). Install it on demand:
 *
 *   npm install --no-save firebase-admin
 *
 * Credentials: a service-account JSON, via GOOGLE_APPLICATION_CREDENTIALS or
 * as the second argument.
 *
 *   node scripts/set-desk-claim.mjs <uid> [path/to/service-account.json]
 *   node scripts/set-desk-claim.mjs <uid> --revoke
 *
 * The user must sign in again (or refresh their ID token) to pick up the claim.
 */
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const [uid, keyPath] = args.filter((arg) => !arg.startsWith("--"));

if (!uid || !/^[A-Za-z0-9]{16,128}$/.test(uid)) {
  console.error("usage: node scripts/set-desk-claim.mjs <uid> [service-account.json] [--revoke]");
  process.exit(1);
}

const credentialPath = keyPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS or pass the service-account JSON path.");
  process.exit(1);
}

let admin;
let auth;
try {
  const [{ initializeApp, cert }, { getAuth }] = await Promise.all([
    import("firebase-admin/app"),
    import("firebase-admin/auth"),
  ]);
  const account = JSON.parse(await readFile(credentialPath, "utf8"));
  admin = initializeApp({ credential: cert(account) });
  auth = getAuth(admin);
} catch (err) {
  if (err?.code === "ERR_MODULE_NOT_FOUND") {
    console.error("firebase-admin is missing. Run: npm install --no-save firebase-admin");
  } else {
    console.error(`could not start firebase-admin: ${err?.message || err}`);
  }
  process.exit(1);
}

try {
  const claims = revoke ? { desk: null } : { desk: true };
  await auth.setCustomUserClaims(uid, claims);
  const user = await auth.getUser(uid);
  console.log(`${revoke ? "revoked" : "set"} desk claim for ${uid}`);
  console.log("claims now:", JSON.stringify(user.customClaims ?? {}));
} catch (err) {
  console.error(`failed: ${err?.message || err}`);
  process.exit(1);
}
