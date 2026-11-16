import CANTEENS from "./canteens.json" with { type: "json" };
import { escapeHtml, html, setHtml } from "./dom.js?v=d3d5b527";
import {
  gameMains,
  isPlateId,
  playableMembers,
  pointsForWeek,
  weekLine,
  weekSheetDays,
} from "./eat.js?v=4c1eats1";
import { joinDishSides, phraseDish } from "./likes.js?v=9db8d9ec";
import { loadMenu } from "./menuFetch.js?v=99f0e614";
import {
  berlinDate,
  berlinWeekday,
  CANTEEN_IDS,
  loadNick,
  loadRoundCode,
  votePhase,
} from "./vote.js?v=857e7e26";
import {
  ensureVoteUser,
  listenEats,
  listenVotes,
  savePlate,
  syncBadge,
} from "./voteClient.js?v=4c1eats1";

const STEP_KEY = "lunchtime-larry-eat-step";
const DIET = { vegan: "vegan", veggie: "veggie", meat: "Fleisch", fish: "Fisch" };
const PEN = html`<svg class="pen-underline" viewBox="0 0 120 6" preserveAspectRatio="none" aria-hidden="true"><path d="M1.5 3.1 L 118.5 2.9" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" pathLength="1"/></svg>`;

const lede = document.querySelector("#eat-lede");
const explain = document.querySelector("#eat-dialog");
const rail = document.querySelector("#eat-rail");
const board = document.querySelector("#board");
const week = document.querySelector("#week-line");
const note = document.querySelector("#eat-note");
const kicker = document.querySelector("#eat-kicker");

const WEEKDAYS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
};

const probe =
  /^(localhost|127\.0\.0\.1)$/.test(location.hostname) &&
  new URLSearchParams(location.search).get("probe") === "1";

let step = 1;
let myUid = "";
let records = {};
let eatsTree = {};
let mineDish = "";
let placed = {};
let pendingAt = 0;
let mains = [];
let closed = false;
let dragging = null;
let justDragged = false;
const inked = new Set();

function menuDay() {
  const day = berlinWeekday();
  if (day === "saturday" || day === "sunday") return "friday";
  return day;
}

function rememberedStep() {
  try {
    return sessionStorage.getItem(STEP_KEY) === berlinDate();
  } catch {
    return false;
  }
}

function rememberStep() {
  try {
    sessionStorage.setItem(STEP_KEY, berlinDate());
  } catch {
    /* private mode */
  }
}

function tiltFor(name) {
  let n = 0;
  for (const ch of name) n += ch.charCodeAt(0);
  return -12 + (n % 9);
}

function mySheet() {
  const day = eatsTree[berlinDate()] || {};
  return myUid ? day[myUid] : null;
}

function adoptRemote() {
  const mine = mySheet();
  if (pendingAt && (!mine?.at || mine.at < pendingAt)) return;
  if (mine?.dish && isPlateId(mine.dish)) {
    mineDish = mine.dish;
    placed = { ...(mine.guesses || {}) };
    if (step < 3) step = 3;
    return;
  }
  if (!pendingAt) {
    mineDish = "";
    placed = {};
  }
}

function members() {
  return playableMembers(records, myUid);
}

function showNote(text) {
  if (!note) return;
  note.hidden = !text;
  note.textContent = text || "";
}

function shownNick() {
  return loadNick() || (probe ? "Sven" : "");
}

function readyToSave() {
  if (probe) return !closed && Boolean(shownNick());
  return Boolean(loadNick()) && Boolean(loadRoundCode()) && !closed;
}

function ledeText() {
  if (closed && votePhase() === "closed") return "Am Wochenende ruht das Spiel. Die Woche steht unten.";
  if (closed) return "Tipps und Gerichte sind zu. Die Auswertung steht.";
  if (!mains.length) return "Heute nichts auf dem Zettel.";
  if (step < 3) return "Such dir dein Hauptgericht.";
  if (!members().length) return "Heute ist sonst niemand in der Runde.";
  return "Zieh die Namen auf die Gerichte.";
}

function inkStampHtml(name, { fresh = false, uid = "" } = {}) {
  const tilt = tiltFor(name);
  const who = uid ? html` data-uid="${uid}" data-name="${name}"` : "";
  return html`<span class="name-stamp${uid ? "" : " is-self"}${fresh ? " is-inking" : ""}" style="--tilt:${tilt}deg"${who}>${name}</span>`;
}

function handStampHtml(name, { uid = "" } = {}) {
  const tilt = tiltFor(name);
  const label = name.toLocaleUpperCase("de-DE");
  const width = Math.max(78, Math.min(168, Math.round(label.length * 9.2 + 30)));
  const cx = width / 2;
  return html`<span class="hand-stamp" style="--tilt:${tilt}deg" data-uid="${uid}" data-name="${name}" role="img" aria-label="${name}"><svg class="hand-stamp-svg" viewBox="0 0 ${width} 122" aria-hidden="true">
    <ellipse cx="${cx}" cy="27" rx="15.5" ry="18" fill="#e8c7a4"/>
    <ellipse cx="${cx}" cy="27" rx="15.5" ry="18" fill="none" stroke="#c4966c" stroke-width="1"/>
    <ellipse cx="${cx - 5}" cy="19" rx="5.5" ry="6.5" fill="#f8efe4" opacity="0.75"/>
    <path d="M${cx - 9} 32 q7 6 17 1" fill="none" stroke="#c4956c" stroke-width="0.8" opacity="0.5"/>
    <path d="M${cx - 4} 16 q3 6 4 12" fill="none" stroke="#b8885c" stroke-width="0.7" opacity="0.35"/>
    <path d="M${cx - 7} 43 h14 l3.5 24 h-21 z" fill="#d5ab82"/>
    <path d="M${cx - 7} 43 h14 l3.5 24 h-21 z" fill="none" stroke="#c4966c" stroke-width="0.8"/>
    <rect x="1.5" y="64" width="${width - 3}" height="36" rx="1.6" fill="#f6e6cf" stroke="#c9a67c" stroke-width="1"/>
    <path d="M7 73 h${width - 14}" stroke="#ead4b6" stroke-width="1.1"/>
    <path d="M7 81 h${width - 14}" stroke="#ead4b6" stroke-width="1.1" opacity="0.85"/>
    <text class="hand-stamp-face" x="${cx}" y="88" text-anchor="middle">${label}</text>
    <rect x="6" y="100" width="${width - 12}" height="16" rx="1" fill="#3c352f"/>
    <g transform="translate(${cx}, 112) scale(-1, 1)">
      <text class="hand-stamp-die" text-anchor="middle" y="0">${label}</text>
    </g>
  </svg></span>`;
}

function dishHtml(row) {
  const phrase = phraseDish(row.dish.name, { canteen: row.canteenId });
  const sides = joinDishSides(phrase.sides);
  const diet =
    row.dish.diet && DIET[row.dish.diet]
      ? html`<span class="pill ${row.dish.diet}">${DIET[row.dish.diet]}</span>`
      : "";
  const price = row.dish.price ? html`<span class="price">${row.dish.price}</span>` : "";
  const names = [];
  if (row.id === mineDish && shownNick()) names.push(inkStampHtml(shownNick(), { fresh: inked.has("self") }));
  if (step === 3) {
    for (const member of members()) {
      if (placed[member.uid] !== row.id) continue;
      names.push(inkStampHtml(member.nick, { uid: member.uid, fresh: inked.has(member.uid) }));
    }
  }
  const who = names.length ? html`<span class="stamp-row">${names}</span>` : "";
  const pointed = row.id === mineDish ? " is-pointed" : "";
  return html`<article class="dish${pointed}" data-plate="${row.id}" role="button" tabindex="0">
    <div class="name">
      <span class="dish-title"><span class="dish-mark">${phrase.title}${PEN}</span></span>
      ${sides ? html`<span class="dish-sides">${sides}</span>` : ""}
      ${who}
    </div>
    ${price}
    <div class="meta">${diet}</div>
  </article>`;
}

function renderBoard() {
  if (!board) return;
  const byCanteen = new Map(CANTEEN_IDS.map((id) => [id, []]));
  for (const row of mains) byCanteen.get(row.canteenId)?.push(row);
  board.hidden = false;
  board.classList.toggle("is-quiet", step === 1 || closed);
  setHtml(
    board,
    html`${CANTEEN_IDS.map((id, index) => {
      const meta = CANTEENS[id];
      const rows = byCanteen.get(id) || [];
      const body = rows.length
        ? html`${rows.map((row) => dishHtml(row))}`
        : html`<p class="note">Heute nichts auf dem Zettel.</p>`;
      const voted = rows.some((row) => row.id === mineDish) ? " is-voted" : "";
      return html`<section class="slip${voted}" style="--slip-i:${index}" data-canteen="${id}">
      <div class="slip-head">
        <div>
          <h2>${meta?.name || id}</h2>
          <p class="where">${meta?.short || ""}</p>
        </div>
      </div>
      <div class="slip-list">${body}</div>
    </section>`;
    })}`,
  );
  inked.clear();
}

function renderRail() {
  if (!rail) return;
  const open = step === 3 && !closed;
  rail.hidden = !open;
  if (!open) {
    setHtml(rail, html``);
    return;
  }
  const waiting = members().filter((member) => !placed[member.uid]);
  setHtml(
    rail,
    waiting.length
      ? html`${waiting.map((member) => handStampHtml(member.nick, { uid: member.uid }))}`
      : html``,
  );
}

function treeForScore() {
  if (!myUid || !isPlateId(mineDish)) return eatsTree;
  const day = berlinDate();
  return {
    ...eatsTree,
    [day]: {
      ...(eatsTree[day] || {}),
      [myUid]: { uid: myUid, nick: shownNick(), dish: mineDish, guesses: placed },
    },
  };
}

function renderWeek() {
  const rows = pointsForWeek(treeForScore(), weekSheetDays());
  const line = weekLine(rows);
  if (!week) return;
  week.hidden = !line;
  week.textContent = line;
  const mine = rows.find((row) => row.uid === myUid);
  if (mine && !probe) {
    const monday = weekSheetDays()[0];
    syncBadge(mine.points, monday).catch(() => {});
  }
}

function render() {
  if (kicker) {
    const day = menuDay();
    kicker.textContent = `Arabellapark · ${WEEKDAYS[day] || ""}`.replace(/ · $/, "");
  }
  if (lede) lede.textContent = ledeText();
  renderRail();
  renderBoard();
  renderWeek();
}

function seedProbe() {
  records = {
    ada: { uid: "probe-ada", nick: "Ada", canteen: "sodexo" },
    kim: { uid: "probe-kim", nick: "Kim", canteen: "egal" },
    leo: { uid: "probe-leo", nick: "Leo", canteen: "bella23" },
  };
  const today = berlinDate();
  const adaDish = mains.find((row) => /maispolenta/i.test(row.dish?.name || ""))?.id || mains[0]?.id || "";
  const days = weekSheetDays().filter((day) => day !== today);
  eatsTree = {};
  const [monday, tuesday] = days;
  if (monday) {
    eatsTree[monday] = {
      "probe-ada": {
        uid: "probe-ada",
        nick: "Ada",
        dish: "stmuv:probe-a",
        guesses: { "probe-kim": "bella23:probe-b" },
      },
      "probe-kim": {
        uid: "probe-kim",
        nick: "Kim",
        dish: "bella23:probe-b",
        guesses: { "probe-ada": "stmuv:probe-a" },
      },
    };
  }
  if (tuesday) {
    eatsTree[tuesday] = {
      "probe-ada": {
        uid: "probe-ada",
        nick: "Ada",
        dish: "sodexo:probe-c",
        guesses: { "probe-kim": "stmuv:probe-d" },
      },
      "probe-kim": {
        uid: "probe-kim",
        nick: "Kim",
        dish: "stmuv:probe-d",
        guesses: { "probe-ada": "bella23:falsch" },
      },
    };
  }
  if (isPlateId(adaDish)) {
    eatsTree[today] = {
      "probe-ada": { uid: "probe-ada", nick: "Ada", dish: adaDish, guesses: {} },
    };
  }
}

async function persist() {
  if (probe) return;
  if (!readyToSave() || !isPlateId(mineDish)) {
    if (!closed && (!loadNick() || !loadRoundCode())) {
      showNote("Erst auf der Tafel mitstimmen. Dann wird das hier ein Spiel.");
    }
    return;
  }
  const at = Date.now();
  pendingAt = at;
  try {
    const saved = await savePlate(mineDish, placed);
    pendingAt = saved.at || at;
    showNote("");
  } catch (err) {
    console.warn(err);
    const msg = String(err?.message || err || "");
    showNote(
      msg === "ballot"
        ? "Erst auf der Tafel mitstimmen. Dann wird das hier ein Spiel."
        : msg.includes("locked")
          ? "Tipps sind zu."
          : "Das hat Larry nicht behalten. Gleich noch einmal.",
    );
  }
}

function pickDish(id) {
  if (step < 2 || closed || !isPlateId(id) || id === mineDish) return;
  mineDish = id;
  inked.add("self");
  if (step === 2) step = 3;
  rememberStep();
  render();
  persist();
}

function placeStamp(uid, plate) {
  if (!uid || !isPlateId(plate)) return;
  placed = { ...placed, [uid]: plate };
  inked.add(uid);
  render();
  persist();
}

function liftStamp(uid) {
  if (placed[uid]) {
    const next = { ...placed };
    delete next[uid];
    placed = next;
    persist();
  }
  render();
}

function moveGhost(event) {
  if (!dragging?.ghost) return;
  dragging.ghost.style.left = `${event.clientX}px`;
  dragging.ghost.style.top = `${event.clientY}px`;
}

function clearHover() {
  board?.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
  rail?.classList.remove("is-over");
}

function markHover(event) {
  clearHover();
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const dish = hit?.closest?.("[data-plate]");
  const home = hit?.closest?.("[data-rail]");
  if (dish) dish.classList.add("is-over");
  else if (home) rail?.classList.add("is-over");
}

function endDrag(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const moved = dragging.moved;
  const uid = dragging.uid;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  dragging.ghost?.remove();
  dragging = null;
  clearHover();
  justDragged = moved;
  if (!moved) {
    render();
    return;
  }
  const dish = hit?.closest?.("[data-plate]");
  const home = hit?.closest?.("[data-rail]");
  if (dish) placeStamp(uid, dish.dataset.plate || "");
  else if (home) liftStamp(uid);
  else render();
}

function maybeExplain() {
  if (!explain || explain.open || step !== 1 || closed || !mains.length) return;
  explain.showModal();
}

explain?.addEventListener("close", () => {
  if (step < 2) {
    step = 2;
    rememberStep();
  }
  render();
});

board?.addEventListener("click", (event) => {
  if (justDragged) {
    justDragged = false;
    return;
  }
  const dish = event.target.closest("[data-plate]");
  if (!dish || event.target.closest(".hand-stamp[data-uid], .name-stamp[data-uid]")) return;
  pickDish(dish.dataset.plate || "");
});

board?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const dish = event.target.closest("[data-plate]");
  if (!dish) return;
  event.preventDefault();
  pickDish(dish.dataset.plate || "");
});

function woodenGhost(name, uid) {
  const holder = document.createElement("div");
  holder.innerHTML = handStampHtml(name, { uid });
  const ghost = holder.firstElementChild;
  ghost.classList.add("is-ghost");
  return ghost;
}

function onPointerDown(event) {
  const stamp = event.target.closest?.(".hand-stamp[data-uid], .name-stamp[data-uid]");
  if (!stamp || step !== 3 || closed) return;
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const ghost = stamp.classList.contains("hand-stamp")
    ? stamp.cloneNode(true)
    : woodenGhost(stamp.dataset.name || stamp.textContent.trim(), stamp.dataset.uid);
  ghost.classList.remove("is-inking", "is-lifted");
  ghost.classList.add("is-ghost");
  document.body.append(ghost);
  dragging = {
    uid: stamp.dataset.uid,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    ghost,
  };
  stamp.classList.add("is-lifted");
  moveGhost(event);
  stamp.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const dx = event.clientX - dragging.startX;
  const dy = event.clientY - dragging.startY;
  if (!dragging.moved && Math.hypot(dx, dy) > 6) dragging.moved = true;
  moveGhost(event);
  markHover(event);
}

document.addEventListener("pointerdown", onPointerDown);
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", (event) => {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  dragging.ghost?.remove();
  dragging = null;
  clearHover();
  render();
});

function onVotes(next) {
  records = next?.records || {};
  closed = votePhase() !== "open" || next?.revealed === true;
  if (!dragging) render();
}

function onEats(tree) {
  eatsTree = tree || {};
  if (!dragging) {
    adoptRemote();
    if (step > 1 && explain?.open) explain.close();
    render();
  } else {
    renderWeek();
  }
}

if (!probe && rememberedStep()) step = 2;
closed = votePhase() !== "open";

const dayName = menuDay();
kicker && (kicker.textContent = `Arabellapark · ${WEEKDAYS[dayName] || ""}`);

if (probe) {
  myUid = "probe-sven";
} else {
  try {
    myUid = await ensureVoteUser();
  } catch {
    myUid = "";
  }
  listenVotes(onVotes);
  listenEats(onEats);
}

try {
  const menu = await loadMenu();
  const block = menu?.days?.[menuDay()];
  mains = gameMains(block);
} catch {
  mains = [];
  showNote("Der Speiseplan ist gerade nicht da.");
}

if (probe) {
  seedProbe();
  showNote("Proberunde auf diesem Rechner. Ada, Kim und Leo. Nichts wird gespeichert.");
} else if (!loadNick() || !loadRoundCode()) {
  showNote("Erst auf der Tafel mitstimmen. Dann wird das hier ein Spiel.");
}

render();
maybeExplain();
