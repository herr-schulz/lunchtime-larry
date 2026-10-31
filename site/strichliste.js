import { berlinDate, loadRoundCode } from "./vote.js?v=881e6ec7";
import { countDigits, counterUrl, readCountAt, readLocalAufrufe } from "./visits.js?v=7f685c41";
import config from "./firebase.json?v=8c4496a6" with { type: "json" };
import {
  BAR_FIELDS,
  TALLY_NAMES,
  hourBands,
  leadingDays,
  peopleRows,
  recentDays,
  recentMonths,
  recentWeeks,
  shareOf,
  sumTallies,
  thursdayMarket,
  winsLine,
} from "./tally.js?v=4f35ceaa";

const RANGES = [
  ["days", "Tage"],
  ["weeks", "Wochen"],
  ["months", "Monate"],
];

const VISIT_FIGURES = [
  ["total", "Gesamt", counterUrl("TOTAL")],
  ["week", "7 Tage", counterUrl("TOTAL", "week")],
  ["month", "Monat", counterUrl("TOTAL", "month")],
];

const VISIT_PAGES = [
  ["board", "Tafel", counterUrl("/")],
  ["alt", "Alternativen", counterUrl("/alternativen.html")],
];

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function segmented(tally) {
  const wrap = node("span", "strich-bar");
  const total = BAR_FIELDS.reduce((sum, id) => sum + (tally?.[id] || 0), 0);
  if (!total) {
    wrap.classList.add("is-empty");
    return wrap;
  }
  for (const id of BAR_FIELDS) {
    const n = tally[id] || 0;
    if (!n) continue;
    const seg = node("span", `strich-seg is-${id}`);
    seg.style.width = `${(n / total) * 100}%`;
    seg.title = `${TALLY_NAMES[id]} ${n}`;
    wrap.append(seg);
  }
  return wrap;
}

function paintRows(list, rows) {
  list.replaceChildren();
  for (const row of rows) {
    const line = node("li", "strich-row");
    line.append(node("span", "strich-when", row.label));
    line.append(row.tally ? segmented(row.tally) : node("span", "strich-bar is-empty"));
    line.append(node("span", "strich-num", row.tally ? String(row.tally.n) : "—"));
    list.append(line);
  }
}

function paintHours(tally) {
  const bands = hourBands(tally);
  const max = Math.max(1, ...bands.shown.map((band) => band.n));
  const block = node("section", "strich-block");
  block.append(node("h2", "strich-kicker", "Wann abgestimmt"));
  const chart = node("div", "strich-hours");
  for (const band of bands.shown) {
    const col = node("div", "strich-hour");
    const fill = node("span", "strich-hour-fill");
    fill.style.height = `${(band.n / max) * 100}%`;
    col.append(fill);
    col.append(node("span", "strich-hour-label", String(band.hour)));
    chart.append(col);
  }
  block.append(chart);
  if (bands.rest) block.append(node("p", "strich-note", `Davor und danach ${bands.rest}`));
  return block;
}

function paintPeople(nicks) {
  const rows = peopleRows(nicks);
  if (!rows.length) return null;
  const block = node("section", "strich-block");
  block.append(node("h2", "strich-kicker", "Wer wohin"));
  const list = node("ul", "strich-people");
  for (const row of rows) {
    const line = node("li", "strich-person");
    line.append(node("span", "strich-person-name", row.name));
    const picks = row.picks.map((pick) => `${TALLY_NAMES[pick.id]} ${pick.n}`).join(" · ");
    line.append(node("span", "strich-person-picks", picks));
    list.append(line);
  }
  block.append(list);
  return block;
}

function paintVisits(root, counts) {
  root.removeAttribute("aria-busy");
  root.replaceChildren(node("h2", "strich-kicker", "Besuche"));
  const any = Object.values(counts).some((value) => value);
  if (!any) {
    root.append(node("p", "strich-note", "Die Besuchszahl ist gerade nicht erreichbar."));
    return;
  }
  const figures = node("div", "strich-figures");
  for (const [id, label] of VISIT_FIGURES) {
    const card = node("p", "strich-figure-card");
    card.append(node("span", "strich-figure", counts[id] || "—"));
    card.append(node("span", "strich-figure-label", label));
    figures.append(card);
  }
  root.append(figures);
  root.append(
    node(
      "p",
      "strich-note",
      "Ein Besuch ist das erste Öffnen einer Seite in acht Stunden.",
    ),
  );
  const boardN = countDigits(counts.board);
  const altN = countDigits(counts.alt);
  const whole = boardN == null || altN == null ? 0 : boardN + altN;
  const list = node("ol", "strich-rows");
  for (const [id, label] of VISIT_PAGES) {
    const line = node("li", "strich-row");
    line.append(node("span", "strich-when", label));
    const bar = node("span", "strich-bar");
    const n = countDigits(counts[id]);
    if (whole && n) {
      const seg = node("span", `strich-seg is-${id}`);
      seg.style.width = `${(n / whole) * 100}%`;
      bar.append(seg);
    } else {
      bar.classList.add("is-empty");
    }
    line.append(bar);
    line.append(node("span", "strich-num", counts[id] || "—"));
    list.append(line);
  }
  root.append(list);
}

async function loadVisits() {
  const slots = [...VISIT_FIGURES, ...VISIT_PAGES];
  const values = await Promise.all(slots.map(([, , url]) => readCountAt(url).catch(() => "")));
  const counts = Object.fromEntries(slots.map(([id], index) => [id, values[index]]));
  if (Object.values(counts).some(Boolean)) return counts;
  try {
    const local = await readLocalAufrufe();
    return Object.fromEntries(slots.map(([id]) => [id, String(local?.[id] ?? "").trim()]));
  } catch {
    return counts;
  }
}

function paint(root, archive) {
  const days = archive?.days || {};
  const any = Object.values(days).some((day) => day?.n);
  if (!any) {
    root.replaceChildren(node("p", "strich-note", "Noch kein abgeschlossener Tag."));
    return;
  }
  const today = berlinDate();
  const ranges = {
    days: recentDays(days, today),
    weeks: recentWeeks(days, today),
    months: recentMonths(days, today),
  };
  const total = sumTallies(days);
  const market = thursdayMarket(days);
  root.replaceChildren();
  root.append(node("p", "strich-lead", winsLine(leadingDays(days))));
  const facts = node("p", "strich-facts");
  facts.textContent = `Egal ${shareOf(total.egal, total.n)} % · Zweite Kantine ${shareOf(total.second, total.n)} % · Markt am Donnerstag ${market.thursday} · sonst ${market.other}`;
  root.append(facts);

  const tabs = node("div", "strich-range");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Zeitraum");
  const list = node("ol", "strich-rows");
  for (const [id, label] of RANGES) {
    const button = node("button", "strich-tab", label);
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", id === "days" ? "true" : "false");
    button.addEventListener("click", () => {
      for (const other of tabs.querySelectorAll(".strich-tab")) {
        other.setAttribute("aria-selected", other === button ? "true" : "false");
      }
      paintRows(list, ranges[id]);
    });
    tabs.append(button);
  }
  root.append(tabs, list);
  paintRows(list, ranges.days);
  root.append(paintHours(total));
  const people = paintPeople(archive?.nicks);
  if (people) root.append(people);
}

async function loadArchive(code) {
  const [{ initializeApp }, { getDatabase, get, ref }] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js"),
  ]);
  const snap = await get(ref(getDatabase(initializeApp(config)), `tallies/rounds/${code}`));
  return snap.val() || {};
}

const visitsRoot = document.querySelector("#strich-visits");
if (visitsRoot) {
  loadVisits()
    .then((counts) => paintVisits(visitsRoot, counts))
    .catch(() => {
      visitsRoot.removeAttribute("aria-busy");
      visitsRoot.replaceChildren(
        node("h2", "strich-kicker", "Besuche"),
        node("p", "strich-note", "Die Besuchszahl ist gerade nicht erreichbar."),
      );
    });
}

const root = document.querySelector("#strich");
const code = loadRoundCode();
if (root && code) {
  root.hidden = false;
  root.replaceChildren(node("p", "strich-note", "Einen Moment."));
  loadArchive(code)
    .then((archive) => paint(root, archive))
    .catch(() => {
      root.replaceChildren(node("p", "strich-note", "Die Liste ist gerade nicht erreichbar."));
    });
}
