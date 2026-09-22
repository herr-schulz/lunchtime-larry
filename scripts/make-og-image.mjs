import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = "#f2e2c4";

const larry = await readFile("site/larry.svg", "utf8");
const inner = larry
  .replace(/<\?xml[^>]*>\s*/, "")
  .replace(/<svg[^>]*>/, "")
  .replace("</svg>", "");

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Red+Hat+Text:ital,wght@0,600;1,400&display=swap"
    rel="stylesheet"
  />
  <style>
    html, body {
      margin: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
    }
    body {
      background:
        radial-gradient(1200px 500px at 10% -10%, #f8edd6 0%, transparent 55%),
        radial-gradient(900px 400px at 110% 0%, #e8c9a0 0%, transparent 50%),
        ${PAPER};
      color: #1c140e;
      font-family: "Red Hat Text", "Segoe UI", sans-serif;
    }
    .grain {
      position: absolute;
      inset: 0;
      opacity: 0.18;
      mix-blend-mode: multiply;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
    }
    .lockup {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0 88px 0 28px;
      gap: 8px;
    }
    .larry {
      flex: 0 0 auto;
      width: 460px;
      height: 460px;
      transform: scaleX(-1) rotate(-7deg);
    }
    .copy { min-width: 0; }
    .kicker {
      margin: 0;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      font-size: 22px;
      font-weight: 600;
      color: #5a4a3a;
    }
    h1 {
      margin: 18px 0 22px;
      font-family: Fraunces, Georgia, serif;
      font-weight: 700;
      font-size: 92px;
      letter-spacing: -0.04em;
      line-height: 0.88;
    }
    .lede {
      margin: 0;
      font-style: italic;
      font-size: 32px;
      color: #5a4a3a;
    }
  </style>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>
  <div class="lockup">
    <svg class="larry" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">${inner}</svg>
    <div class="copy">
      <p class="kicker">Arabellapark</p>
      <h1>Lunchtime Larry</h1>
      <p class="lede">Drei Kantinen. Eine Woche. Kein Azure.</p>
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await document.fonts.ready;
});
await page.screenshot({
  path: "site/og-image.png",
  type: "png",
  omitBackground: false,
  animations: "disabled",
});
await browser.close();
console.log(`og image ready (${WIDTH}x${HEIGHT}, no calendar week)`);
