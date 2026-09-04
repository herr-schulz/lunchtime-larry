# Lunchtime Larry

Wochenspeiseplan für drei Kantinen im Münchner Arabellapark. Montags und mittwochs um 9 Uhr (Europe/Berlin) crawlt GitHub Actions die Original-Seiten und veröffentlicht eine statische Tafel auf GitHub Pages.

**Live:** https://herr-schulz.github.io/lunchtime-larry

![CI](https://github.com/herr-schulz/lunchtime-larry/actions/workflows/ci.yml/badge.svg)

| Kantine | Quelle |
| --- | --- |
| StMUV | https://www.stmuv.bayern.de/speiseplan/ |
| Dave B / Arabeska | [Sodexo Everyday](https://de.everyday.sodexo.com/menu/Arabeska/Restaurant%20Speiseplan%20Arabeska%20M%C3%BCnchen) |
| Bella 23 | https://www.bella23.de/#wochenkarte |

## Lokal

```bash
npm install
npx playwright install chromium
npm test
npm run scrape
npm run dev
```

`npm run scrape` schreibt `site/data/menu.json`. Die Seite liest genau diese Datei.

## Extras auf der Seite

- **Donnerstag:** dezenter Banner zum [Wochenmarkt Bogenhausen](https://maerkte-muenchen.de/service/info/wochenmarkt-bogenhausen/M00343491/) (nur am Do sichtbar)
- **Was anderes?!** — eigene Seite [`alternativen.html`](site/alternativen.html) mit Gehminuten & Tags (Pflege in `site/locations.js`)

## GitHub Actions

- **CI:** Typecheck und Parser-Tests bei Push und Pull Request
- **Scrape:** Cron `0 7 * * 1,3` (Mo + Mi, 9:00 CEST / 8:00 CET) und manuell unter Actions → *Scrape and publish*
- **Publish:** Push auf `main`, der `site/` ändert — nimmt den letzten `menu.json` von Pages mit, ohne die Kantinen-Seiten erneut anzufassen
- Android-Homescreen: nach einem Icon-Update die Verknüpfung einmal entfernen und neu anlegen, sonst bleibt der alte Splash-Cache.
- Schlägt eine Quelle fehl oder liefert eine unplausible Woche (leer, nur Desserts, stark ausgedünnt), geht die Seite trotzdem online: Banner oben, betroffene Karte mit Hinweis. Gibt es für dieselbe Woche noch einen alten Stand, bleibt der als Fallback sichtbar.

## Teams

Ein `@kantinenbot` braucht Azure Bot + Freigabe im Firmen-Tenant. Ohne das: diese URL im Channel pinnen. Optional später ein Power-Automate-Webhook (Secret `TEAMS_WEBHOOK_URL`) — nicht Teil von v1.
