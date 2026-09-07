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
const larryLinesHash = await hashFile("larryLines.js");
const locationsHash = await hashFile("locations.js");
const domHash = await hashFile("dom.js");
const menuFetchHash = await hashFile("menuFetch.js");
const firebaseHash = await hashFile("firebase.json");

const calendarPath = join(site, "calendar.js");
const calendarBefore = await readFile(calendarPath, "utf8");
const calendarAfter = calendarBefore.replace(
  /(\.\/vote\.js)(?:\?v=[^"']*)?/g,
  `./vote.js?v=${voteHash}`,
);
if (calendarAfter !== calendarBefore) {
  await writeFile(calendarPath, calendarAfter);
  console.log("stamped calendar.js imports");
}
const calendarHash = await hashFile("calendar.js");

const larryCornerPath = join(site, "larryCorner.js");
const larryCornerBefore = await readFile(larryCornerPath, "utf8");
const larryCornerAfter = larryCornerBefore.replace(
  /(\.\/larryLines\.js)(?:\?v=[^"']*)?/g,
  `./larryLines.js?v=${larryLinesHash}`,
);
if (larryCornerAfter !== larryCornerBefore) {
  await writeFile(larryCornerPath, larryCornerAfter);
  console.log("stamped larryCorner.js imports");
}
const larryCornerHash = await hashFile("larryCorner.js");

const boardRenderPath = join(site, "boardRender.js");
const boardRenderBefore = await readFile(boardRenderPath, "utf8");
const boardRenderAfter = boardRenderBefore
  .replace(/(\.\/dom\.js)(?:\?v=[^"']*)?/g, `./dom.js?v=${domHash}`)
  .replace(/(\.\/icons\.js)(?:\?v=[^"']*)?/g, `./icons.js?v=${iconsHash}`)
  .replace(/(\.\/likes\.js)(?:\?v=[^"']*)?/g, `./likes.js?v=${likesHash}`);
if (boardRenderAfter !== boardRenderBefore) {
  await writeFile(boardRenderPath, boardRenderAfter);
  console.log("stamped boardRender.js imports");
}
const boardRenderHash = await hashFile("boardRender.js");
const boardGesturesHash = await hashFile("boardGestures.js");

const voteClientPath = join(site, "voteClient.js");
const voteClientBefore = await readFile(voteClientPath, "utf8");
const voteClientAfter = voteClientBefore
  .replace(/(\.\/vote\.js)(?:\?v=[^"']*)?/g, `./vote.js?v=${voteHash}`)
  .replace(/(\.\/firebase\.json)(?:\?v=[^"']*)?/g, `./firebase.json?v=${firebaseHash}`);
if (voteClientAfter !== voteClientBefore) {
  await writeFile(voteClientPath, voteClientAfter);
  console.log("stamped voteClient.js imports");
}
const voteClientHashFinal = await hashFile("voteClient.js");

const appPath = join(site, "app.js");
const appBefore = await readFile(appPath, "utf8");
const appAfter = appBefore
  .replace(/(\.\/likes\.js)(?:\?v=[^"']*)?/g, `./likes.js?v=${likesHash}`)
  .replace(/(\.\/icons\.js)(?:\?v=[^"']*)?/g, `./icons.js?v=${iconsHash}`)
  .replace(/(\.\/vote\.js)(?:\?v=[^"']*)?/g, `./vote.js?v=${voteHash}`)
  .replace(/(\.\/voteClient\.js)(?:\?v=[^"']*)?/g, `./voteClient.js?v=${voteClientHashFinal}`)
  .replace(/(\.\/larryCorner\.js)(?:\?v=[^"']*)?/g, `./larryCorner.js?v=${larryCornerHash}`)
  .replace(/(\.\/larryLines\.js)(?:\?v=[^"']*)?/g, `./larryLines.js?v=${larryLinesHash}`)
  .replace(/(\.\/locations\.js)(?:\?v=[^"']*)?/g, `./locations.js?v=${locationsHash}`)
  .replace(/(\.\/calendar\.js)(?:\?v=[^"']*)?/g, `./calendar.js?v=${calendarHash}`)
  .replace(/(\.\/dom\.js)(?:\?v=[^"']*)?/g, `./dom.js?v=${domHash}`)
  .replace(/(\.\/menuFetch\.js)(?:\?v=[^"']*)?/g, `./menuFetch.js?v=${menuFetchHash}`)
  .replace(/(\.\/boardRender\.js)(?:\?v=[^"']*)?/g, `./boardRender.js?v=${boardRenderHash}`)
  .replace(/(\.\/boardGestures\.js)(?:\?v=[^"']*)?/g, `./boardGestures.js?v=${boardGesturesHash}`);
if (appAfter !== appBefore) {
  await writeFile(appPath, appAfter);
  console.log("stamped app.js imports");
}

const assets = [
  "styles.css",
  "app.js",
  "locations.js",
  "larry.svg",
  "leisure-larry.svg",
  "laughing-larry.svg",
  "lazy-larry.svg",
  "canteens.json",
];
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
