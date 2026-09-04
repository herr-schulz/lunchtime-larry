# Lunchtime Larry

Wochenspeiseplan für drei Kantinen im Münchner Arabellapark. Montags und mittwochs um 9 Uhr (Europe/Berlin) crawlt GitHub Actions die Original-Seiten und veröffentlicht eine statische Tafel.

**Live:** https://lunchtime-larry.web.app · [GitHub Pages](https://herr-schulz.github.io/lunchtime-larry) bleibt als Fallback für `menu.json`.

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
- **Heute hierhin:** Tipp auf den Kantinen-Zettel (nicht aufs Gericht). Auf dem Zettel: Haken plus die Namen. Spitznamen ohne Zahlen, max. 20 Zeichen. Gerichte merken bleibt das Herz. Stimmen gelten für den aktuellen Werktag (Europe/Berlin, am Wochenende Freitag). Maximal **6 Stimmen** pro Tag.
- **Herz merken:** kurzes Vibrieren auf Android (iOS Safari unterstützt `vibrate` nicht). Aus bei „Bewegung reduzieren“.

## Firebase

Projekt `lunchtime-larry` (Spark). Die Web-Config in [`site/firebase.json`](site/firebase.json) ist öffentlich — Schutz sitzt in [`database.rules.json`](database.rules.json): **6 feste Plätze** (0–5) pro Tag, Schreiben nur mit Anonymous Auth und nur auf den eigenen Platz, Nick/Kantine/Zeit validiert. Wer schon sitzt, darf umziehen oder zurückziehen.

Die URL ist öffentlich; Anonymous Auth ist kein Login. Die 6er-Kappe ist der Missbrauchsschutz für die kleine Runde — ein Troll kann den Tag vollsetzen. Später ggf. PIN.

Einmalig in der [Console](https://console.firebase.google.com/project/lunchtime-larry):

1. **Realtime Database** anlegen, Region **europe-west1**, Startmodus gesperrt. Danach im Repo: `firebase deploy --only database`
2. **Authentication → Sign-in method → Anonymous** an, falls noch aus
3. **Authentication → Settings → Authorized domains:** `localhost`, `lunchtime-larry.web.app`, `lunchtime-larry.firebaseapp.com` und `herr-schulz.github.io`

Hosting (Spark, kostenlos): `site/` liegt auf `lunchtime-larry.web.app`. Nach UI-Änderungen: `npm run deploy` (bzw. `firebase deploy --only hosting`). Der Speiseplan-Crawl bleibt GitHub Actions → Pages; die Tafel lädt `menu.json` von dort, falls sie lokal fehlt.

Lokal: `firebase login` (ohne `--no-localhost` unter Windows).

## GitHub Actions

- **CI:** Typecheck und Parser-Tests bei Push und Pull Request
- **Scrape:** Cron `0 7 * * 1,3` (Mo + Mi, 9:00 CEST / 8:00 CET) und manuell unter Actions → *Scrape and publish*
- **Publish:** Push auf `main`, der `site/` ändert — nimmt den letzten `menu.json` von Pages mit, ohne die Kantinen-Seiten erneut anzufassen
- Android-Homescreen: nach einem Icon-Update die Verknüpfung einmal entfernen und neu anlegen, sonst bleibt der alte Splash-Cache.
- Schlägt eine Quelle fehl oder liefert eine unplausible Woche (leer, nur Desserts, stark ausgedünnt), geht die Seite trotzdem online: Banner oben, betroffene Karte mit Hinweis. Gibt es für dieselbe Woche noch einen alten Stand, bleibt der als Fallback sichtbar.

## Teams

Ein `@kantinenbot` braucht Azure Bot + Freigabe im Firmen-Tenant. Ohne das: diese URL im Channel pinnen. Optional später ein Power-Automate-Webhook (Secret `TEAMS_WEBHOOK_URL`) — nicht Teil von v1.
