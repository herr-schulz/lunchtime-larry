import config from "./firebase.json" with { type: "json" };
import { isValidNick, loadNick, normalizeNick, saveNick } from "./vote.js";

const SLOTS = ["1", "2", "3", "4"];
const FLAG_RE = /^[A-Za-z0-9_-]{8,64}$/;
const LEGACY_NICK_KEY = "larry.hunt.nick";

const form = document.querySelector("#hunt-form");
const nickInput = document.querySelector("#hunt-nick");
const submit = document.querySelector("#hunt-submit");
const statusEl = document.querySelector("#hunt-status");
const hintEl = document.querySelector("#hunt-hint");
const boardEl = document.querySelector("#hunt-board");
const inputs = Object.fromEntries(SLOTS.map((n) => [n, document.querySelector(`#hunt-flag-${n}`)]));

let uid = null;
let db = null;
let sdk = null;
let mine = {};
let suggested4 = "";
const marked = new Set();
let creditBusy = false;
let creditDone = false;

function say(text, tone = "") {
  statusEl.textContent = text;
  if (tone) statusEl.dataset.tone = tone;
  else delete statusEl.dataset.tone;
}

function rememberNick(value) {
  const nick = saveNick(value);
  if (nick) nickInput.value = nick;
  return nick;
}

function storedNick() {
  const current = loadNick();
  if (current) return current;
  try {
    return rememberNick(localStorage.getItem(LEGACY_NICK_KEY) || "");
  } catch {
    return "";
  }
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Flag 4 is the first 16 hex chars of SHA-256("flag1|flag2|flag3"). */
async function derivedFlag4(f1, f2, f3) {
  return (await sha256Hex(`${f1}|${f2}|${f3}`)).slice(0, 16);
}

async function startFirebase() {
  const [{ initializeApp }, { getAuth, onAuthStateChanged, signInAnonymously }, database] =
    await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js"),
    ]);
  const app = initializeApp(config);
  const auth = getAuth(app);
  db = database.getDatabase(app);
  sdk = database;
  if (!auth.currentUser) await signInAnonymously(auth);
  uid = await new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) return;
        stop();
        resolve(user.uid);
      },
      reject,
    );
  });
}

function shortUid(id) {
  return `${id.slice(0, 6)}…`;
}

/** RTDB turns the numeric slot keys into an array. Read them as slots either way. */
function slotValue(slots, n) {
  if (Array.isArray(slots)) return slots[Number(n)];
  if (slots && typeof slots === "object") return slots[n];
  return undefined;
}

function slipsFrom(value) {
  const out = {};
  for (const n of SLOTS) {
    const slip = slotValue(value, n);
    if (typeof slip === "string" && slip) out[n] = slip;
  }
  return out;
}

function slotCount(slots) {
  return SLOTS.filter((n) => slotValue(slots, n) === true).length;
}

function paintBoard(all) {
  const rows = Object.entries(all || {})
    .map(([id, slots]) => ({ id, count: slotCount(slots) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  boardEl.removeAttribute("aria-busy");
  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "Noch nichts abgegeben.";
    boardEl.replaceChildren(li);
    return;
  }
  const nick = loadNick();
  boardEl.replaceChildren(
    ...rows.map((row) => {
      const li = document.createElement("li");
      const who = document.createElement("span");
      who.className = "hunt-uid";
      const isMe = row.id === uid;
      who.textContent = isMe ? `${shortUid(row.id)} (du${nick ? `, ${nick}` : ""})` : shortUid(row.id);
      const count = document.createElement("span");
      count.textContent = `${row.count} / 4`;
      if (isMe) li.className = "me";
      li.append(who, count);
      return li;
    }),
  );
}

function solved() {
  return SLOTS.every((n) => typeof mine[n] === "string" && mine[n]);
}

async function refreshHint() {
  if (mine["1"] && !mine["2"]) {
    hintEl.hidden = false;
    hintEl.textContent = "Das Paket trägt denselben Namen wie in den Regeln. Es ist keine Klarschrift.";
    return;
  }
  const [f1, f2, f3] = [mine["1"], mine["2"], mine["3"]];
  if (!f1 || !f2 || !f3 || mine["4"]) {
    hintEl.hidden = true;
    return;
  }
  hintEl.hidden = false;
  if (f1 && f2 && f3 && crypto?.subtle) {
    suggested4 = await derivedFlag4(f1, f2, f3);
    hintEl.textContent = `Fundstück 4 ist kein Fund, sondern eine Rechnung: die ersten 16 Hex-Zeichen von SHA-256 über „1|2|3“ (die drei Fundstücke, mit senkrechtem Strich verbunden). Vorschlag für dein Feld: ${suggested4}`;
    if (!inputs["4"].value) inputs["4"].value = suggested4;
  } else {
    hintEl.textContent =
      "Fundstück 4 ist kein Fund, sondern eine Rechnung: die ersten 16 Hex-Zeichen von SHA-256 über „1|2|3“ (die ersten drei Fundstücke, mit senkrechtem Strich verbunden).";
  }
}

async function markSlot(n) {
  if (marked.has(n) || typeof mine[n] !== "string" || !mine[n]) return;
  marked.add(n);
  const { ref, set } = sdk;
  try {
    await set(ref(db, `huntBoard/${uid}/${n}`), true);
  } catch {
    marked.delete(n);
  }
}

async function recordCredit() {
  if (creditDone || creditBusy || !uid || !solved()) return;
  const nick = loadNick();
  if (!isValidNick(nick)) {
    say("Alle vier stimmen. Trag den Spitznamen von der Tafel ein, dann steht er auf der Strichliste.", "ok");
    return;
  }
  creditBusy = true;
  const { get, ref, set } = sdk;
  try {
    const existing = await get(ref(db, `funde/${uid}`));
    if (existing.exists()) {
      creditDone = true;
      return;
    }
    await set(ref(db, `funde/${uid}`), { nick, at: Date.now() });
    creditDone = true;
    say("Alle vier sind abgegeben. Dein Spitzname steht auf der Strichliste.", "ok");
  } catch {
    /* already recorded, or the rules declined */
  } finally {
    creditBusy = false;
  }
}

function listen() {
  const { onValue, ref } = sdk;
  onValue(
    ref(db, `hunt/${uid}`),
    (snap) => {
      mine = slipsFrom(snap.val());
      for (const n of SLOTS) {
        if (typeof mine[n] === "string" && mine[n] && !inputs[n].value) inputs[n].value = mine[n];
      }
      refreshHint();
      for (const n of SLOTS) markSlot(n);
      recordCredit();
    },
    () => {
      say("Deine Fundstücke sind gerade nicht erreichbar.", "bad");
    },
  );
  onValue(
    ref(db, "huntBoard"),
    (snap) => {
      paintBoard(snap.val() || {});
    },
    () => {
      boardEl.removeAttribute("aria-busy");
      say("Die Fundliste ist gerade nicht erreichbar.", "bad");
    },
  );
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!uid) {
    say("Einen Moment, Larry meldet dich noch an.", "bad");
    return;
  }
  const typed = normalizeNick(nickInput.value);
  if (isValidNick(typed)) rememberNick(typed);
  const todo = SLOTS.map((n) => [n, inputs[n].value.trim()]).filter(([n, v]) => v && v !== mine[n]);
  if (!todo.length) {
    if (solved()) await recordCredit();
    else say("Nichts Neues zum Abgeben.");
    return;
  }
  const bad = todo.find(([, v]) => !FLAG_RE.test(v));
  if (bad) {
    say(`Fundstück ${bad[0]} sieht nicht richtig aus.`, "bad");
    return;
  }
  submit.disabled = true;
  say("Larry prüft …");
  const { ref, set } = sdk;
  const okSlots = [];
  const failed = [];
  for (const [n, value] of todo) {
    try {
      await set(ref(db, `hunt/${uid}/${n}`), value);
      okSlots.push(n);
      try {
        await set(ref(db, `huntBoard/${uid}/${n}`), true);
        marked.add(n);
      } catch {
        /* the slip is kept; the count can follow on the next read */
      }
    } catch {
      failed.push(n);
    }
  }
  submit.disabled = false;
  if (okSlots.length && !failed.length) {
    say(`Abgegeben: ${okSlots.join(", ")}.`, "ok");
  } else if (okSlots.length) {
    say(`Abgegeben: ${okSlots.join(", ")}. Nicht angenommen: ${failed.join(", ")}.`, "bad");
  } else {
    say(`Larry hat das nicht angenommen (${failed.join(", ")}).`, "bad");
  }
});

nickInput.value = storedNick();
startFirebase()
  .then(listen)
  .catch(() => {
    boardEl.removeAttribute("aria-busy");
    say("Larry erreicht das Fundbüro gerade nicht.", "bad");
  });
