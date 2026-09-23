/**
 * Localhost-only vote-phase preview. Open with ?dev=1 (or ?dev=reveal).
 * Freezes the Berlin clock and seeds demo ballots so the 12:00 presentation runs.
 */

const HOST_OK = ["localhost", "127.0.0.1", "[::1]"];

export function isDevHost(hostname = location.hostname) {
  return HOST_OK.includes(hostname);
}

export function readDevQuery(search = location.search) {
  const raw = new URLSearchParams(search).get("dev");
  if (raw == null) return null;
  const value = raw.trim().toLowerCase() || "1";
  if (value === "0" || value === "false" || value === "off") return null;
  return value;
}

/** Same calendar day as `base`, at Berlin wall-clock hour:minute. */
export function berlinAt(hour, minute, base = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
  const pad = (n) => String(n).padStart(2, "0");
  /* September probe uses CEST; refine against berlinClock so winter days stay correct. */
  let guess = new Date(`${day}T${pad(hour)}:${pad(minute)}:00+02:00`);
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(guess);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const delta = hour * 60 + minute - (h * 60 + m);
    if (delta === 0) break;
    guess = new Date(guess.getTime() + delta * 60_000);
  }
  return guess;
}

export function demoVotes(mode = "lead") {
  if (mode === "tie") {
    return {
      counts: { stmuv: 2, sodexo: 2, bella23: 0, wochenmarkt: 0 },
      records: {
        a: { nick: "Sven", canteen: "stmuv", at: 1 },
        b: { nick: "Ada", canteen: "stmuv", at: 2 },
        c: { nick: "Kim", canteen: "sodexo", at: 3 },
        d: { nick: "Leo", canteen: "sodexo", at: 4 },
      },
      mine: "stmuv",
    };
  }
  return {
    counts: { stmuv: 3, sodexo: 1, bella23: 0, wochenmarkt: 0 },
    records: {
      a: { nick: "Sven", canteen: "stmuv", at: 1 },
      b: { nick: "Ada", canteen: "stmuv", at: 2 },
      c: { nick: "Kim", canteen: "stmuv", at: 3 },
      d: { nick: "Leo", canteen: "sodexo", at: 4 },
    },
    mine: "stmuv",
  };
}

/**
 * @param {object} api
 * @param {(phase: 'open'|'locked'|'reveal'|null, mode?: 'lead'|'tie') => void} api.run
 * @param {() => string} api.phaseLabel
 */
export function mountDevPreview(api) {
  if (!isDevHost() || !readDevQuery()) return null;

  const root = document.createElement("aside");
  root.className = "dev-preview";
  root.setAttribute("aria-label", "Dev-Vorschau Abstimmung");
  root.innerHTML = `
    <p class="dev-preview-kicker">Dev · Abstimmung</p>
    <p class="dev-preview-phase" data-dev-phase></p>
    <menu>
      <button type="button" data-dev="open">11:00 offen</button>
      <button type="button" data-dev="locked">11:55 zu</button>
      <button type="button" data-dev="reveal-lead">12:00 Lead</button>
      <button type="button" data-dev="reveal-tie">12:00 Unentschieden</button>
      <button type="button" data-dev="live">Live-Zeit</button>
    </menu>
  `;
  document.body.append(root);

  const phaseEl = root.querySelector("[data-dev-phase]");
  const sync = () => {
    if (phaseEl) phaseEl.textContent = api.phaseLabel();
  };

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-dev]");
    if (!btn) return;
    const action = btn.getAttribute("data-dev");
    if (action === "open") api.run("open");
    else if (action === "locked") api.run("locked");
    else if (action === "reveal-lead") api.run("reveal", "lead");
    else if (action === "reveal-tie") api.run("reveal", "tie");
    else if (action === "live") api.run(null);
    sync();
  });

  sync();

  const boot = readDevQuery();
  if (boot === "reveal" || boot === "lead") {
    queueMicrotask(() => {
      api.run("reveal", "lead");
      sync();
    });
  } else if (boot === "tie") {
    queueMicrotask(() => {
      api.run("reveal", "tie");
      sync();
    });
  } else if (boot === "locked") {
    queueMicrotask(() => {
      api.run("locked");
      sync();
    });
  }

  return root;
}
