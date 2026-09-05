import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..", "site");

async function hashFile(name) {
  const buf = await readFile(join(site, name));
  return createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

const likesHash = await hashFile("likes.js");
const iconsHash = await hashFile("icons.js");
const voteHash = await hashFile("vote.js");
const voteClientHash = await hashFile("voteClient.js");
const firebaseHash = await hashFile("firebase.json");
const appPath = join(site, "app.js");
const appBefore = await readFile(appPath, "utf8");
const appAfter = appBefore
  .replace(/(\.\/likes\.js)(?:\?v=[^"']*)?/g, `./likes.js?v=${likesHash}`)
  .replace(/(\.\/icons\.js)(?:\?v=[^"']*)?/g, `./icons.js?v=${iconsHash}`)
  .replace(/(\.\/vote\.js)(?:\?v=[^"']*)?/g, `./vote.js?v=${voteHash}`)
  .replace(/(\.\/voteClient\.js)(?:\?v=[^"']*)?/g, `./voteClient.js?v=${voteClientHash}`);
if (appAfter !== appBefore) {
  await writeFile(appPath, appAfter);
  console.log("stamped app.js imports");
}

const voteClientPath = join(site, "voteClient.js");
const voteClientBefore = await readFile(voteClientPath, "utf8");
const voteClientAfter = voteClientBefore
  .replace(/(\.\/vote\.js)(?:\?v=[^"']*)?/g, `./vote.js?v=${voteHash}`)
  .replace(/(\.\/firebase\.json)(?:\?v=[^"']*)?/g, `./firebase.json?v=${firebaseHash}`);
if (voteClientAfter !== voteClientBefore) {
  await writeFile(voteClientPath, voteClientAfter);
  console.log("stamped voteClient.js imports");
}

const assets = ["styles.css", "app.js", "locations.js", "larry.svg", "leisure-larry.svg", "canteens.json"];
const hashes = Object.fromEntries(
  await Promise.all(assets.map(async (name) => [name, await hashFile(name)])),
);

const pattern = new RegExp(
  `\\./(${assets.map((name) => name.replaceAll(".", "\\.")).join("|")})(?:\\?v=[^\"']*)?`,
  "g",
);

for (const page of ["index.html", "alternativen.html"]) {
  const path = join(site, page);
  const before = await readFile(path, "utf8");
  const after = before.replace(pattern, (_, file) => `./${file}?v=${hashes[file]}`);
  if (after !== before) await writeFile(path, after);
  console.log(`stamped ${page}`);
}
