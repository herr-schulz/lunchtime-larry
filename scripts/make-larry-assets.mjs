import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const larry = await readFile("site/larry.svg", "utf8");
const favicon = await readFile("site/favicon.svg", "utf8");

function inlineSvg(svg, size) {
  return svg
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg /, `<svg width="${size}" height="${size}" `);
}

/** Black Larry on transparent, unflipped, padded for Android's circular mask. */
function androidIcon(size) {
  const inner = larry
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "");
  const pad = 0.12;
  const s = 1 - pad * 2;
  const t = 96 * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
  <g transform="translate(${t} ${t}) scale(${s})">${inner}</g>
</svg>`;
}

const browser = await chromium.launch({ headless: true });

async function raster(svg, out, size, { transparent }) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html>
<html>
<body style="margin:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden">
${inlineSvg(svg, size)}
</body>
</html>`,
    { waitUntil: "load" },
  );
  await page.waitForSelector("svg");
  await page.screenshot({
    path: out,
    omitBackground: transparent,
    animations: "disabled",
  });
  await page.close();
}

await raster(favicon, "site/apple-touch-icon.png", 180, { transparent: false });
await raster(androidIcon(192), "site/icon-192.png", 192, { transparent: true });
await raster(androidIcon(512), "site/icon-512.png", 512, { transparent: true });

await browser.close();
console.log("larry assets ready");
