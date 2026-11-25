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
  YEAR_ROW_LABELS,
  dayLabel,
  isDesk,
  peopleRows,
  personDetail,
  yearWeeks,
} from "./tally.js?v=ba2c4fb3";
import {
  ensureVoteUser,
  hasDeskClaim,
  listenLottery,
  loadDirectory,
  loadRoundDays,
} from "./voteClient.js?v=57fbf601";

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

function paintYear(days, today) {
  const weeks = yearWeeks(days, today);
  const block = node("section", "strich-block strich-year");
  block.append(node("h2", "strich-kicker", "Jahr"));
  block.append(
    node(
      "p",
      "strich-note",
      "Spalten sind Wochen. Mo, Mi und Fr stehen links. Ein grüner Kasten ist ein Tag mit Stimmen in dieser Runde. Die Farbe zählt die Personen, nicht die Kantine. Leer bleibt, wo keine Summe liegt.",
    ),
  );
  const frame = node("div", "strich-cal-frame");
  const scroll = node("div", "strich-cal-scroll");
  const months = node("div", "strich-cal-months");
  months.setAttribute("aria-hidden", "true");
  for (const week of weeks) months.append(node("span", "", week.label));
  const labels = node("div", "strich-cal-labels");
  labels.setAttribute("aria-hidden", "true");
  for (const label of YEAR_ROW_LABELS) labels.append(node("span", "", label));
  const cols = node("div", "strich-cal-weeks");
  cols.setAttribute("role", "group");
  cols.setAttribute("aria-label", "Tage mit Stimmen im letzten Jahr");
  const hover = node("p", "strich-cal-hover");
  let current = null;
  const show = (button, text) => {
    current = button;
    hover.textContent = text;
  };
  const hide = (button) => {
    if (current !== button) return;
    current = null;
    hover.textContent = "";
  };
  for (const week of weeks) {
    const col = node("div", "strich-cal-week");
    for (const cell of week.cells) {
      if (!cell.hover) {
        const empty = node("span", "strich-cal-cell");
        empty.setAttribute("aria-hidden", "true");
        col.append(empty);
        continue;
      }
      const button = node("button", `strich-cal-cell is-lv${cell.level}`);
      button.type = "button";
      button.setAttribute("aria-label", cell.hover);
      button.addEventListener("mouseenter", () => show(button, cell.hover));
      button.addEventListener("focus", () => show(button, cell.hover));
      button.addEventListener("mouseleave", () => hide(button));
      button.addEventListener("blur", () => hide(button));
      col.append(button);
    }
    cols.append(col);
  }
  scroll.append(months, cols);
  frame.append(labels, scroll);
  const pin = () => {
    if (scroll.scrollWidth <= scroll.clientWidth + 4) return;
    scroll.scrollLeft = scroll.scrollWidth;
    observer?.disconnect();
  };
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(pin) : null;
  observer?.observe(scroll);
  requestAnimationFrame(pin);
  const scale = node("div", "strich-cal-scale");
  scale.append(node("span", "", "Weniger"));
  for (let level = 0; level <= 4; level += 1) {
    const swatch = node("span", `strich-cal-cell is-lv${level}`);
    swatch.setAttribute("aria-hidden", "true");
    scale.append(swatch);
  }
  scale.append(node("span", "", "Mehr"));
  block.append(frame, hover, scale);
  return block;
}

function paint(root, board) {
  root.replaceChildren();
  root.append(paintToday(board));
  root.append(paintYear(board.archive?.days || {}, board.today));
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
