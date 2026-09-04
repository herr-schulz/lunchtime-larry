import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const PAPER = "#f2e2c4";

const larry = await readFile("site/larry.svg", "utf8");
const favicon = await readFile("site/favicon.svg", "utf8");

/**
 * Opaque cream tile + dark Larry. Never transparent: Android's splash
 * composites transparent pixels onto black, which is why the launch
 * screen looked like a black icon on a black field.
 *
 * Maskable icons keep ≥20% padding so the circular crop does not clip Larry.
 */
function iconSvg(larryMarkup, { pad }) {
  const inner = larryMarkup
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");
  const scale = 1 - pad * 2;
  const shift = 96 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="${PAPER}"/>
  <g transform="translate(${shift} ${shift}) scale(${scale})">${inner}</g>
</svg>`;
}

function inlineSvg(svg, size) {
  return svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg /, `<svg width="${size}" height="${size}" `);
}

const browser = await chromium.launch({ headless: true });

async function raster(svg, out, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html>
<html>
<body style="margin:0;width:${size}px;height:${size}px;background:${PAPER};overflow:hidden">
${inlineSvg(svg, size)}
</body>
</html>`,
    { waitUntil: "load" },
  );
  await page.waitForSelector("svg");
  await page.screenshot({
    path: out,
    omitBackground: false,
    animations: "disabled",
  });
  await page.close();
}

const anyIcon = iconSvg(larry, { pad: 0.08 });
const maskableIcon = iconSvg(larry, { pad: 0.22 });

await raster(favicon, "site/apple-touch-icon.png", 180);
await raster(anyIcon, "site/icon-192.png", 192);
await raster(anyIcon, "site/icon-512.png", 512);
await raster(maskableIcon, "site/icon-maskable-192.png", 192);
await raster(maskableIcon, "site/icon-maskable-512.png", 512);

await browser.close();
console.log("larry assets ready (opaque paper, separate any/maskable)");
