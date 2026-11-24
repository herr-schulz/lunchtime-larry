import {
  berlinDate,
  loadNick,
  loadRoundCode,
  roundKeyFor,
  votePhase,
} from "./vote.js?v=9cf92e86";
import { countDigits, counterUrl, readCountAt, readLocalAufrufe } from "./visits.js?v=66ea366b";
import { readTosses } from "./tosses.js?v=6eb65288";
import { pointsBoardText, publicDayTallies, publicWinner } from "./lottery.js?v=57fbf601";
import {
  BAR_FIELDS,
  TALLY_NAMES,
  dayLabel,
  hourBands,
  isDesk,
  leadingDays,
  peopleRows,
  personDetail,
  recentDays,
  recentMonths,
  recentWeeks,
  shareOf,
  shiftIso,
  sumTallies,
  thursdayMarket,
  winsLine,
} from "./tally.js?v=903bf68a";
import {
  ensureVoteUser,
  hasDeskClaim,
  listenLottery,
  loadDirectory,
  loadRoundDays,
} from "./voteClient.js?v=57fbf601";

const RANGES = [
  ["days", "Tage"],
  ["weeks", "Wochen"],
  ["months", "Monat"],
  ["year", "Jahr"],
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

function peopleWord(n) {
  return n === 1 ? "1 Person" : `${n} Personen`;
}

function breakdown(tally) {
  if (!tally?.n) return "Keine Stimme.";
  const bits = BAR_FIELDS.filter((id) => tally[id]).map((id) => `${TALLY_NAMES[id]} ${tally[id]}`);
  const extra = [];
  if (tally.egal) extra.push(`Egal ${tally.egal}`);
  if (tally.second) extra.push(`zweite Kantine ${tally.second}`);
  const detail = [...bits, ...extra].join(", ");
  return `${peopleWord(tally.n)}. ${detail || "Keine Kantine gewählt."}`;
}

function legend() {
  const list = node("ul", "strich-legend");
  for (const id of BAR_FIELDS) {
    const item = node("li", "strich-chip");
    item.append(node("span", `strich-swatch is-${id}`));
    item.append(document.createTextNode(TALLY_NAMES[id]));
    list.append(item);
  }
  return list;
}

function tip(text) {
  return node("span", "strich-tip-card", text);
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
    wrap.append(seg);
  }
  return wrap;
}

function paintRows(list, rows) {
  list.replaceChildren();
  for (const row of rows) {
    const line = node("li", "strich-row");
    line.tabIndex = 0;
    const when = node("span", "strich-when", row.label);
    when.append(tip(row.tally ? breakdown(row.tally) : `${row.label}: keine Stimme.`));
    line.append(when);
    line.append(row.tally ? segmented(row.tally) : node("span", "strich-bar is-empty"));
    const num = node("span", "strich-num", row.tally ? String(row.tally.n) : "—");
    num.title = row.tally ? `${row.tally.n} ${row.tally.n === 1 ? "Person" : "Personen"}` : "Keine Stimme";
    line.append(num);
    list.append(line);
  }
}

function paintHours(tally) {
  const bands = hourBands(tally);
  const max = Math.max(1, ...bands.shown.map((band) => band.n));
  const block = node("section", "strich-block");
  block.append(node("h2", "strich-kicker", "Wann abgestimmt"));
  block.append(
    node(
      "p",
      "strich-note",
      "Jede Säule ist eine Uhrzeit. Die Zahl darüber ist, wie viele Personen in dieser Stunde abgestimmt haben.",
    ),
  );
  const chart = node("div", "strich-hours");
  for (const band of bands.shown) {
    const col = node("div", "strich-hour");
    col.tabIndex = 0;
    const said = band.n
      ? `${band.hour} Uhr: ${peopleWord(band.n)} ${band.n === 1 ? "hat" : "haben"} in dieser Stunde abgestimmt.`
      : `${band.hour} Uhr: niemand.`;
    col.append(node("span", "strich-hour-value", band.n ? String(band.n) : ""));
    const track = node("span", "strich-hour-track");
    const fill = node("span", "strich-hour-fill");
    if (!band.n) fill.classList.add("is-zero");
    fill.style.height = band.n ? `${(band.n / max) * 100}%` : "0";
    track.append(fill);
    col.append(track);
    col.append(node("span", "strich-hour-label", String(band.hour)));
    col.append(tip(said));
    chart.append(col);
  }
  block.append(chart);
  block.append(node("p", "strich-note", "Unter der Säule steht die Stunde, von 8 bis 15 Uhr."));
  if (bands.rest) block.append(node("p", "strich-note", `Vor 8 und nach 15 Uhr: ${bands.rest}.`));
  return block;
}

function paintPeople(nicks) {
  const rows = peopleRows(nicks);
  if (!rows.length) return null;
  const block = node("section", "strich-block");
  block.append(node("h2", "strich-kicker", "Wer wohin"));
  block.append(
    node(
      "p",
      "strich-note",
      "Personen aus dieser Runde, über alle abgeschlossenen Tage seit Beginn. Nicht nur diese Woche.",
    ),
  );
  const list = node("ul", "strich-people");
  for (const row of rows) {
    const line = node("li", "strich-person");
    const text = node("p", "strich-person-line");
    text.append(node("strong", "", row.name));
    text.append(document.createTextNode(` ${personDetail(row)}`));
    line.append(text);
    list.append(line);
  }
  block.append(list);
  return block;
}

function monthDays(days, today) {
  const end = shiftIso(today, -1);
  const [year, month, last] = end.split("-").map(Number);
  const key = end.slice(0, 7);
  const rows = [];
  for (let date = 1; date <= last; date += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
    rows.push({ key: iso, label: String(date), tally: days?.[iso]?.n ? days[iso] : null });
  }
  return { key, rows };
}

function rowsAsDays(rows) {
  const out = {};
  for (const row of rows) if (row.tally) out[row.key] = row.tally;
  return out;
}

function factsText(days) {
  const total = sumTallies(days);
  const market = thursdayMarket(days);
  let bestHour = null;
  for (let hour = 0; hour < 24; hour += 1) {
    const n = total[`h${hour}`] || 0;
    if (n && (!bestHour || n > bestHour.n)) bestHour = { hour, n };
  }
  let favorite = null;
  for (const id of BAR_FIELDS) {
    const n = total[id] || 0;
    if (n && (!favorite || n > favorite.n)) favorite = { id, n };
  }
  const bits = [winsLine(leadingDays(days))];
  if (favorite) bits.push(`${TALLY_NAMES[favorite.id]} ${favorite.n} Mal gewählt`);
  bits.push(`Egal ${shareOf(total.egal, total.n)} %`);
  bits.push(`zweite Kantine ${shareOf(total.second, total.n)} %`);
  bits.push(`Markt am Donnerstag ${market.thursday}, sonst ${market.other}`);
  if (bestHour) bits.push(`häufigste Stunde ${bestHour.hour} Uhr`);
  return bits.join(" · ");
}

function paintStrip(rows) {
  const max = Math.max(1, ...rows.map((row) => row.tally?.n || 0));
  const chart = node("div", "strich-strip");
  for (const row of rows) {
    const col = node("div", "strich-daycol");
    col.tabIndex = 0;
    const stack = node("span", "strich-daystack");
    const picks = BAR_FIELDS.reduce((sum, id) => sum + (row.tally?.[id] || 0), 0);
    if (!row.tally?.n) stack.classList.add("is-empty");
    else stack.style.height = `${Math.max(12, ((row.tally.n || 0) / max) * 100)}%`;
    if (picks) {
      for (const id of [...BAR_FIELDS].reverse()) {
        const count = row.tally[id] || 0;
        if (!count) continue;
        const seg = node("span", `strich-seg is-${id}`);
        seg.style.height = `${(count / picks) * 100}%`;
        stack.append(seg);
      }
    }
    col.append(stack);
    const dayNo = Number(row.label);
    const showLabel = Boolean(row.tally?.n) || (dayNo > 0 && dayNo % 5 === 0);
    col.append(node("span", "strich-hour-label", showLabel ? row.label : ""));
    col.append(tip(`${row.key ? dayLabel(row.key) : row.label}. ${row.tally ? breakdown(row.tally) : "Keine Stimme."}`));
    chart.append(col);
  }
  return chart;
}

function paintToday(board) {
  const block = node("section", "strich-block strich-today");
  if (board.phase === "open" || board.phase === "locked") {
    block.append(node("h2", "strich-kicker", "Heute"));
    block.append(node("p", "strich-lead", "Die Auszählung kommt um 12 Uhr."));
    block.append(
      node(
        "p",
        "strich-note",
        "Bis dahin bleiben die Stimmen bei den Zetteln. Danach stehen hier nur die Summen, ohne Namen.",
      ),
    );
    return block;
  }
  if (board.phase === "reveal") {
    const tally = board.archive?.days?.[board.today] || null;
    block.append(node("h2", "strich-kicker", `Heute, ${dayLabel(board.today)}`));
    block.append(legend());
    if (!tally?.n) {
      block.append(
        node("p", "strich-note", "Die Summe für heute steht hier, sobald sie geschrieben ist. Ohne Namen und ohne Gericht."),
      );
      return block;
    }
    block.append(node("p", "strich-lead", peopleWord(tally.n)));
    const bar = segmented(tally);
    bar.classList.add("is-hero");
    block.append(bar);
    block.append(node("p", "strich-facts", breakdown(tally)));
    block.append(node("p", "strich-note", "Nur die Summen. Kein Name, keine einzelne Kantine, kein Gericht."));
    return block;
  }
  const days = board.archive?.days || {};
  const iso = Object.keys(days)
    .filter((key) => days[key]?.n)
    .sort()
    .at(-1);
  block.append(node("h2", "strich-kicker", iso ? `Letzter Tag, ${dayLabel(iso)}` : "Heute"));
  block.append(legend());
  if (!iso) {
    block.append(node("p", "strich-note", "Noch keine Stimme in dieser Runde."));
    return block;
  }
  block.append(node("p", "strich-lead", peopleWord(days[iso].n)));
  const bar = segmented(days[iso]);
  bar.classList.add("is-hero");
  block.append(bar);
  block.append(node("p", "strich-facts", breakdown(days[iso])));
  block.append(
    node("p", "strich-note", "Nur die Summen. Kein Name, keine Uhrzeit, kein Gericht."),
  );
  return block;
}

function groupCards(directory, own) {
  const ownKey = String(own || "").toLowerCase();
  const cards = [];
  for (const [code, group] of Object.entries(directory || {})) {
    if (String(code).toLowerCase() === ownKey) continue;
    const days = group?.days && typeof group.days === "object" ? group.days : {};
    const dates = Object.keys(days)
      .filter((iso) => days[iso]?.n)
      .sort();
    if (!dates.length) continue;
    const last = dates.at(-1);
    cards.push({ code, last, count: dates.length, tally: days[last] });
  }
  cards.sort((a, b) => b.last.localeCompare(a.last) || a.code.localeCompare(b.code, "de"));
  return cards;
}

function paintGroups(board) {
  const block = node("section", "strich-block");
  block.append(node("h2", "strich-kicker", "Andere Runden"));
  block.append(
    node(
      "p",
      "strich-note",
      "Andere Runden auf dieser Seite. Die Namen der Leute bleiben in ihrer eigenen Runde.",
    ),
  );
  if (!board.directory) {
    block.append(node("p", "strich-note", "Die Übersicht ist gerade nicht erreichbar."));
    return block;
  }
  const cards = groupCards(board.directory, board.code);
  if (!cards.length) {
    block.append(
      node("p", "strich-note", "Noch keine andere Runde. Ein Tag landet hier, wenn diese Runde ihn abgeschlossen hat."),
    );
    return block;
  }
  const list = node("ol", "strich-rows");
  for (const card of cards) {
    const line = node("li", "strich-row");
    line.tabIndex = 0;
    const when = node("span", "strich-when", card.code);
    const dayWord = card.count === 1 ? "1 Tag" : `${card.count} Tage`;
    when.append(tip(`${card.code}, zuletzt ${dayLabel(card.last)}, ${dayWord} im Archiv. ${breakdown(card.tally)}`));
    line.append(when);
    line.append(segmented(card.tally));
    line.append(node("span", "strich-num", card.tally.n === 1 ? "1 Person zuletzt" : `${card.tally.n} Personen zuletzt`));
    list.append(line);
  }
  block.append(list);
  return block;
}

function paintToss(n) {
  const block = node("div", "strich-toss");
  block.append(node("h2", "strich-kicker", "Im Eimer"));
  block.append(node("p", "strich-lead", String(n)));
  block.append(
    node(
      "p",
      "strich-note",
      n === 1
        ? "Einmal ist Larry in den Eimer gewandert. Die Zahl hat keinen Namen."
        : `So oft ist Larry in den Eimer gewandert. Die Zahl hat keinen Namen.`,
    ),
  );
  return block;
}

function paintVisits(root, counts, source, tosses) {
  root.removeAttribute("aria-busy");
  root.replaceChildren(node("h2", "strich-kicker", "Besuche"));
  const any = Object.values(counts).some((value) => value);
  if (!any) {
    root.append(node("p", "strich-note", "Die Besuchszahl ist gerade nicht erreichbar."));
    if (typeof tosses === "number") root.append(paintToss(tosses));
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
  root.append(node("p", "strich-note", "Ein Besuch ist das erste Öffnen einer Seite in acht Stunden. Gesamt zählt seit Beginn."));
  root.append(
    node(
      "p",
      "strich-note",
      source === "snapshot"
        ? "Gerade der Stand vom letzten Deploy, weil der Zähler im Browser nicht geantwortet hat."
        : "7 Tage und Monat sind nur dieser Zeitraum, nicht der Gesamtwert. Die Aufrufe sind nicht nach Runden getrennt. Wer nur schaut und nie abstimmt, steckt in keiner Runde. Diese Leute kann die Seite nicht herausrechnen, weil ein Aufruf keinen Namen hat.",
    ),
  );
  const boardN = countDigits(counts.board);
  const altN = countDigits(counts.alt);
  const whole = boardN == null || altN == null ? 0 : boardN + altN;
  const list = node("ol", "strich-rows");
  for (const [id, label] of VISIT_PAGES) {
    const line = node("li", "strich-row");
    line.tabIndex = 0;
    const when = node("span", "strich-when", label);
    when.append(tip(`${label}: ${counts[id] || "keine Zahl"}. Der Balken setzt Tafel und Alternativen ins Verhältnis.`));
    line.append(when);
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
  if (typeof tosses === "number") root.append(paintToss(tosses));
}

function monthTitle(key) {
  const names = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  const [year, month] = String(key).split("-").map(Number);
  return `${names[month - 1] || key} ${year}`;
}

async function loadVisits() {
  const slots = [...VISIT_FIGURES, ...VISIT_PAGES];
  const values = await Promise.all(slots.map(([, , url]) => readCountAt(url).catch(() => "")));
  const counts = Object.fromEntries(slots.map(([id], index) => [id, values[index]]));
  if (Object.values(counts).some(Boolean)) return { counts, source: "live" };
  try {
    const local = await readLocalAufrufe();
    return {
      counts: Object.fromEntries(slots.map(([id]) => [id, String(local?.[id] ?? "").trim()])),
      source: "snapshot",
    };
  } catch {
    return { counts, source: "none" };
  }
}

function paint(root, board) {
  root.replaceChildren();
  root.append(paintToday(board));
  const days = board.archive?.days || {};
  const any = Object.values(days).some((day) => day?.n);
  if (any) {
    const today = board.today;
    const month = monthDays(days, today);
    const year = shiftIso(today, -1).slice(0, 4);
    const ranges = {
      days: recentDays(days, today, 14),
      weeks: recentWeeks(days, today, 8),
      months: month.rows,
      year: recentMonths(days, today, 12).filter((row) => row.key.startsWith(year)),
    };
    const block = node("section", "strich-block");
    block.append(node("h2", "strich-kicker", "Verlauf"));
    block.append(legend());
    block.append(
      node(
        "p",
        "strich-note",
        "Grün ist StMUV, gelb Dave B, rot Bella 23, grau der Markt. Die Zahl am Zeilenende ist die Personenzahl.",
      ),
    );
    const tabs = node("div", "strich-range");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Zeitraum");
    const host = node("div", "strich-host");
    const facts = node("p", "strich-facts");
    const hoursMount = node("div");
    const show = (id) => {
      for (const other of tabs.querySelectorAll(".strich-tab")) {
        other.setAttribute("aria-selected", other.dataset.range === id ? "true" : "false");
      }
      host.replaceChildren();
      if (id === "months") {
        host.append(node("p", "strich-note", `Jeder Strich ist ein Tag im ${monthTitle(month.key)}.`));
        const strip = paintStrip(ranges.months);
        host.append(strip);
        const first = ranges.months.findIndex((row) => row.tally?.n);
        if (first > 0) {
          const go = () => {
            const col = strip.children[first];
            if (!col || strip.scrollWidth <= strip.clientWidth + 4) return;
            strip.scrollLeft = Math.max(0, col.offsetLeft - 8);
          };
          requestAnimationFrame(go);
          if (typeof ResizeObserver !== "undefined") new ResizeObserver(go).observe(strip);
        }
      } else if (id === "year") {
        host.append(node("p", "strich-note", `Jeder Balken ist ein Monat im Jahr ${year}.`));
        const list = node("ol", "strich-rows");
        paintRows(list, ranges.year);
        host.append(list);
      } else {
        const list = node("ol", "strich-rows");
        paintRows(list, ranges[id]);
        host.append(list);
      }
      const slice = rowsAsDays(ranges[id]);
      facts.textContent = factsText(slice);
      const summed = sumTallies(slice);
      const hasHours = Object.keys(summed).some(
        (key) => /^h(?:[0-9]|1[0-9]|2[0-3])$/.test(key) && summed[key],
      );
      if (hasHours) hoursMount.replaceChildren(paintHours(summed));
      else hoursMount.replaceChildren();
    };
    for (const [id, label] of RANGES) {
      const button = node("button", "strich-tab", label);
      button.type = "button";
      button.dataset.range = id;
      button.setAttribute("role", "tab");
      button.addEventListener("click", () => show(id));
      tabs.append(button);
    }
    block.append(tabs, host, facts);
    root.append(block, hoursMount);
    show("days");
  } else {
    root.append(node("p", "strich-note", "Abgeschlossene Tage erscheinen hier ab dem nächsten Werktag."));
  }
  const people = paintPeople(board.archive?.nicks);
  if (people) root.append(people);
  if (board.desk) root.append(paintGroups(board));
}

async function loadBoard(code, desk) {
  const today = berlinDate();
  const phase = votePhase();
  await ensureVoteUser();
  const key = await roundKeyFor(code);
  const days = publicDayTallies(await loadRoundDays(key));
  const archive = { days, nicks: {} };
  let directory = null;
  if (desk) {
    try {
      directory = (await loadDirectory()) || {};
    } catch {
      directory = null;
    }
  }
  return { archive, live: null, directory, today, phase, code, desk, key };
}

const visitsRoot = document.querySelector("#strich-visits");
if (visitsRoot) {
  Promise.all([loadVisits(), readTosses().catch(() => null)])
    .then(([{ counts, source }, tosses]) => paintVisits(visitsRoot, counts, source, tosses))
    .catch(() => {
      visitsRoot.removeAttribute("aria-busy");
      visitsRoot.replaceChildren(
        node("h2", "strich-kicker", "Besuche"),
        node("p", "strich-note", "Die Besuchszahl ist gerade nicht erreichbar."),
      );
    });
}

function winnerLine(leaders) {
  if (!leaders.length) return "Niemand hat einen Punkt geholt.";
  if (leaders.length === 1) return `Gewonnen hat ${leaders[0]}.`;
  if (leaders.length === 2) return `Gleichstand zwischen ${leaders[0]} und ${leaders[1]}.`;
  return `Gleichstand zwischen ${leaders.slice(0, -1).join(", ")} und ${leaders.at(-1)}.`;
}

function paintWeeks(mount, points, winner) {
  mount.replaceChildren(node("h2", "strich-kicker", "Larrys Lunch Lottery"));
  mount.append(
    node(
      "p",
      "strich-note",
      "Nick und Punkte. Kein Gericht, keine Kantine. Ab Samstag schreibt der Server das Veto.",
    ),
  );
  const names = publicWinner(winner);
  if (names.length) mount.append(node("p", "", winnerLine(names)));
  else mount.append(node("p", "strich-note", "Vor Samstag steht kein Gewinner."));
  const line = pointsBoardText(points);
  if (!line) {
    mount.append(node("p", "strich-note", "Noch niemand in der Lottery."));
    return;
  }
  mount.append(node("p", "lottery-points", line));
}

const root = document.querySelector("#strich");
const code = loadRoundCode();
const weeksRoot = document.querySelector("#strich-weeks");

function paintFunde(rows) {
  const mount = document.querySelector("#strich-funde");
  if (!mount) return;
  if (!rows.length) {
    mount.hidden = true;
    mount.replaceChildren();
    return;
  }
  mount.hidden = false;
  mount.replaceChildren(node("h2", "strich-kicker", "Fundbüro"));
  mount.append(node("p", "strich-note", "Wer alle vier Fundstücke abgegeben hat."));
  const list = node("ul", "strich-laurel");
  for (const row of rows) {
    const item = node("li");
    const line = node("p");
    line.append(node("strong", "", row.nick));
    line.append(document.createTextNode(" hat die Jagd beendet."));
    item.append(line);
    list.append(item);
  }
  mount.append(list);
}

/** Names only. The slips themselves stay on the owning uid. */
function watchFunde() {
  const mount = document.querySelector("#strich-funde");
  Promise.all([
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js"),
  ])
    .then(([{ getApp }, { getDatabase, onValue, ref }]) => {
      onValue(
        ref(getDatabase(getApp()), "funde"),
        (snap) => {
          const all = snap.val() || {};
          const rows = Object.entries(all)
            .map(([id, row]) => ({
              id,
              nick: typeof row?.nick === "string" ? row.nick.trim() : "",
              at: typeof row?.at === "number" ? row.at : 0,
            }))
            .filter((row) => row.nick)
            .sort((a, b) => a.at - b.at || a.nick.localeCompare(b.nick, "de") || a.id.localeCompare(b.id));
          paintFunde(rows);
        },
        () => {
          if (mount) mount.hidden = true;
        },
      );
    })
    .catch(() => {
      if (mount) mount.hidden = true;
    });
}

async function bootStrich() {
  try {
    await ensureVoteUser();
    watchFunde();
  } catch {
    if (code && root) {
      root.hidden = false;
      root.replaceChildren(node("p", "strich-note", "Die Liste ist gerade nicht erreichbar."));
    }
    return;
  }
  if (!code) return;
  const desk = isDesk(loadNick(), code, await hasDeskClaim());
  if (weeksRoot) {
    weeksRoot.hidden = false;
    listenLottery(({ points, winner }) => paintWeeks(weeksRoot, points, winner));
  }
  if (root) {
    root.hidden = false;
    root.replaceChildren(node("p", "strich-note", "Einen Moment."));
    try {
      paint(root, await loadBoard(code, desk));
    } catch {
      root.replaceChildren(node("p", "strich-note", "Die Liste ist gerade nicht erreichbar."));
    }
  }
}

bootStrich().catch(() => {
  if (root) root.replaceChildren(node("p", "strich-note", "Die Liste ist gerade nicht erreichbar."));
});
