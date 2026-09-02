# Lunchtime Larry

Wochenspeiseplan für drei Kantinen im Münchner Arabellapark. Montags um 9 Uhr (Europe/Berlin) crawlt GitHub Actions die Original-Seiten und veröffentlicht eine statische Tafel auf GitHub Pages.

**Live:** https://herr-schulz.github.io/lunchtime-larry

| Kantine | Quelle |
| --- | --- |
| StMUV | https://www.stmuv.bayern.de/speiseplan/ |
| Dave B / Arabeska | [Sodexo Everyday](https://de.everyday.sodexo.com/menu/Arabeska/Restaurant%20Speiseplan%20Arabeska%20M%C3%BCnchen) |
| Bella 23 | https://www.bella23.de/#wochenkarte |

## Lokal

```bash
npm install
npx playwright install chromium
npm run scrape
npm run dev
```

`npm run scrape` schreibt `site/data/menu.json`. Die Seite liest genau diese Datei.

## Extras auf der Seite

- **Donnerstag:** dezenter Banner zum [Wochenmarkt Bogenhausen](https://maerkte-muenchen.de/service/info/wochenmarkt-bogenhausen/M00343491/) (nur am Do sichtbar)
- **Was anderes?!** — eigene Seite [`alternativen.html`](site/alternativen.html) mit Gehminuten & Tags (Pflege in `site/alternatives.js`)

## GitHub Actions

- Cron: `0 7 * * 1` (9:00 CEST / 8:00 CET)
- Manuell: Repo → **Actions** → *Scrape and publish* → **Run workflow**
- Schlägt eine Quelle fehl, geht die Seite trotzdem online: Banner oben, betroffene Karte mit Hinweis. Gibt es für dieselbe Woche noch einen alten Stand, bleibt der als Fallback sichtbar.

## Teams

Ein `@kantinenbot` braucht Azure Bot + Freigabe im Firmen-Tenant. Ohne das: diese URL im Channel pinnen. Optional später ein Power-Automate-Webhook (Secret `TEAMS_WEBHOOK_URL`) — nicht Teil von v1.
