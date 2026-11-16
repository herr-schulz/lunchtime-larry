/**
 * Builds `pages-dist/` for GitHub Pages.
 *
 * Pages no longer serves the app. It keeps only `data/menu.json` (the scraper's
 * publish target that the board still reads) and redirects every page to the
 * Firebase Hosting origin, where the CSP and security headers live.
 *
 *   node scripts/build-pages-dist.mjs
 */
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const out = join(root, "pages-dist");
const ORIGIN = "https://lunchtime-larry.web.app";

const PAGES = [
  ["index.html", "/"],
  ["404.html", "/"],
  ["wer-isst-was.html", "/wer-isst-was.html"],
  ["strichliste.html", "/strichliste.html"],
  ["alternativen.html", "/alternativen.html"],
  ["fundbuero.html", "/fundbuero.html"],
];

function stub(path) {
  const target = `${ORIGIN}${path}`;
  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <link rel="canonical" href="${target}" />
    <title>Lunchtime Larry</title>
  </head>
  <body>
    <p><a href="${target}">Weiter zu Lunchtime Larry</a></p>
  </body>
</html>
`;
}

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "data"), { recursive: true });

const menu = join(site, "data", "menu.json");
if (existsSync(menu)) {
  await copyFile(menu, join(out, "data", "menu.json"));
  console.log("copied data/menu.json");
} else {
  console.warn("warning: site/data/menu.json missing — Pages will only redirect");
}

for (const [file, path] of PAGES) {
  await writeFile(join(out, file), stub(path));
  console.log(`redirect ${file} -> ${ORIGIN}${path}`);
}
await writeFile(join(out, ".nojekyll"), "");
console.log("built pages-dist/");
