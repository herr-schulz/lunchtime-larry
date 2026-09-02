import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const src = await readFile("lunchtime-larry.svg", "utf8");
const recolored = src
  .replace("#8f1926", "#c4452d")
  .replace('id="Ebene_1" data-name="Ebene 1" ', "");

await writeFile("site/larry.svg", recolored);

const icon = recolored
  .replace(
    "</defs>",
    `</defs>
  <rect width="96" height="96" rx="20" fill="#f2e2c4"/>
  <g transform="translate(3.5 2.5) scale(0.93)">`,
  )
  .replace("</svg>", "</g>\n</svg>");

await writeFile("site/favicon.svg", icon);

const browser = await chromium.launch({ headless: true });
const sizes = [
  ["site/apple-touch-icon.png", 180],
  ["site/icon-192.png", 192],
  ["site/icon-512.png", 512],
];
for (const [out, size] of sizes) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${icon}</body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate((s) => {
    const svg = document.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", String(s));
      svg.setAttribute("height", String(s));
    }
  }, size);
  await page.screenshot({ path: out, omitBackground: false });
  await page.close();
}
await browser.close();
console.log("larry assets ready");
