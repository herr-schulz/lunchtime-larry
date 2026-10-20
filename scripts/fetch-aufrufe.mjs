import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const ORIGIN = "https://lunchtime-larry.goatcounter.com";
const file = join(site, "data", "aufrufe.json");

function clean(count) {
  const text = String(count ?? "").trim();
  return /^[\d.,]+$/.test(text) ? text : "";
}

async function readCount(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return clean(data?.count);
  } catch {
    return "";
  }
}

const counts = {
  total: await readCount(`${ORIGIN}/counter/TOTAL.json`),
  week: await readCount(`${ORIGIN}/counter/TOTAL.json?start=week`),
  month: await readCount(`${ORIGIN}/counter/TOTAL.json?start=month`),
  board: await readCount(`${ORIGIN}/counter//.json`),
  alt: await readCount(`${ORIGIN}/counter//alternativen.html.json`),
};

if (!counts.total) {
  console.warn("GoatCounter total missing, leaving the saved count in place");
  process.exit(0);
}

await writeFile(file, `${JSON.stringify(counts, null, 2)}\n`);

const word = counts.total.replace(/\D/g, "") === "1" ? "Aufruf" : "Aufrufe";
const stamp = `<span class="aufruf-count" data-aufruf-count>${counts.total}</span>
        <span class="aufruf-label">${word}</span>`;

for (const name of ["index.html", "alternativen.html"]) {
  const path = join(site, name);
  const html = await readFile(path, "utf8");
  const stampRe =
    /<span class="aufruf-count" data-aufruf-count>[\s\S]*?<\/span>\s*<span class="aufruf-label">[\s\S]*?<\/span>/;
  if (!stampRe.test(html)) {
    console.warn(`stamp markup missing in ${name}`);
    continue;
  }
  await writeFile(path, html.replace(stampRe, stamp));
}

console.log(`aufrufe ${counts.total}`);
