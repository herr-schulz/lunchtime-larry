import config from "./firebase.json" with { type: "json" };

const SLOTS = ["1", "2", "3", "4"];
const FLAG_RE = /^[A-Za-z0-9_-]{8,64}$/;
const NICK_KEY = "larry.hunt.nick";

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

function say(text, tone = "") {
  statusEl.textContent = text;
  if (tone) statusEl.dataset.tone = tone;
  else delete statusEl.dataset.tone;
}

function loadNick() {
  try {
    return localStorage.getItem(NICK_KEY) || "";
  } catch {
    return "";
  }
}

function saveNick(value) {
  try {
    localStorage.setItem(NICK_KEY, value);
  } catch {
    /* private mode */
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

function paintBoard(all) {
  const rows = Object.entries(all || {})
    .map(([id, flags]) => ({
      id,
      count: Object.keys(flags && typeof flags === "object" ? flags : {}).filter((k) => SLOTS.includes(k)).length,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  boardEl.removeAttribute("aria-busy");
  if (!rows.length) {
    const li = document.createElement("li");
    li.textContent = "Noch nichts abgegeben.";
    boardEl.replaceChildren(li);
    return;
  }
  boardEl.replaceChildren(
    ...rows.map((row) => {
      const li = document.createElement("li");
      const who = document.createElement("span");
      who.className = "hunt-uid";
      const isMe = row.id === uid;
      who.textContent = isMe ? `${shortUid(row.id)} (du${loadNick() ? `, ${loadNick()}` : ""})` : shortUid(row.id);
      const count = document.createElement("span");
      count.textContent = `${row.count} / 4`;
      if (isMe) li.className = "me";
      li.append(who, count);
      return li;
    }),
  );
}

async function refreshHint() {
  const found = SLOTS.filter((n) => mine[n]);
  if (found.length < 3 || mine["4"]) {
    hintEl.hidden = true;
    return;
  }
  hintEl.hidden = false;
  const [f1, f2, f3] = [mine["1"], mine["2"], mine["3"]];
  if (f1 && f2 && f3 && crypto?.subtle) {
    suggested4 = await derivedFlag4(f1, f2, f3);
    hintEl.textContent = `Fundstück 4 ist kein Fund, sondern eine Rechnung: die ersten 16 Hex-Zeichen von SHA-256 über „1|2|3“ (die drei Fundstücke, mit senkrechtem Strich verbunden). Vorschlag für dein Feld: ${suggested4}`;
    if (!inputs["4"].value) inputs["4"].value = suggested4;
  } else {
    hintEl.textContent =
      "Fundstück 4 ist kein Fund, sondern eine Rechnung: die ersten 16 Hex-Zeichen von SHA-256 über „1|2|3“ (die ersten drei Fundstücke, mit senkrechtem Strich verbunden).";
  }
}

async function listen() {
  const { onValue, ref } = sdk;
  onValue(
    ref(db, "hunt"),
    (snap) => {
      const all = snap.val() || {};
      paintBoard(all);
      const own = all[uid];
      mine = own && typeof own === "object" ? { ...own } : {};
      for (const n of SLOTS) {
        if (mine[n] && !inputs[n].value) inputs[n].value = mine[n];
      }
      refreshHint();
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
  const nick = nickInput.value.trim();
  if (nick) saveNick(nick);
  const todo = SLOTS.map((n) => [n, inputs[n].value.trim()]).filter(([n, v]) => v && v !== mine[n]);
  if (!todo.length) {
    say("Nichts Neues zum Abgeben.");
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

nickInput.value = loadNick();
startFirebase()
  .then(listen)
  .catch(() => {
    boardEl.removeAttribute("aria-busy");
    say("Larry erreicht das Fundbüro gerade nicht.", "bad");
  });
