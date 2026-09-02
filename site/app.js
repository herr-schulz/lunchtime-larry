
const CANTEENS = {
  stmuv: { name: "StMUV", short: "Umweltministerium" },
  sodexo: { name: "Dave B", short: "Arabeska" },
  bella23: { name: "Bella 23", short: "Burda" },
};

const DAYS = {
  monday: "Montag",
  tuesday: "Dienstag",
  wednesday: "Mittwoch",
  thursday: "Donnerstag",
  friday: "Freitag",
};

const DIET = {
  vegan: "vegan",
  veggie: "veggie",
  meat: "Fleisch",
  fish: "Fisch",
};

const board = document.querySelector("#board");
const banner = document.querySelector("#banner");
const empty = document.querySelector("#empty");
const dayDate = document.querySelector("#day-date");
const marketBanner = document.querySelector("#market-banner");
const escapeWrap = document.querySelector("#escape-wrap");
const daysNav = document.querySelector(".days");
const dayIndicator = document.querySelector(".days-indicator");
const kwEl = document.querySelector("#kw");
const stamp = document.querySelector("#stamp");

let enterTimer;

function isoWeek(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
}

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(
    date,
  );
  const when = new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
  }).format(date);
  return `<span class="weekday">${weekday}</span><span class="when">${when}</span>`;
}

function formatStamp(iso) {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function todayKey() {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(new Date())
    .toLowerCase();
  if (day === "saturday" || day === "sunday") return "friday";
  return day;
}

function bannerText(data) {
  const issues = Object.entries(data.sources || {}).filter(([, src]) =>
    ["error", "stale"].includes(src.status),
  );
  if (!issues.length) return "";
  if (issues.every(([, src]) => src.status === "error") && issues.length === 3) {
    const last = data.lastSuccessAt ? formatStamp(data.lastSuccessAt) : null;
    return last
      ? `Heute kein frischer Speiseplan. Letzter Stand: ${last}.`
      : "Heute kein frischer Speiseplan — der Crawl ist fehlgeschlagen.";
  }
  return issues
    .map(([id, src]) => {
      const name = CANTEENS[id]?.name ?? id;
      if (src.status === "stale") {
        return `${name}: letzter bekannter Plan (Aktualisierung fehlgeschlagen).`;
      }
      return `${name}: Speiseplan gerade nicht geladen.`;
    })
    .join(" ");
}

function formatDishName(name) {
  const parts = String(name)
    .split(/\s*[|/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return escapeHtml(name);
  const sep = '<span class="sep" aria-hidden="true"></span>';
  return parts.map((part) => escapeHtml(part)).join(sep);
}

function dishRow(dish, index) {
  const diet =
    dish.diet && DIET[dish.diet]
      ? `<span class="pill ${dish.diet}">${DIET[dish.diet]}</span>`
      : "";
  const category = dish.category
    ? `<span class="pill">${dish.category}</span>`
    : "";
  const price = dish.price ? `<span class="price">${dish.price}</span>` : "";
  return `<article class="dish" style="--dish-i:${index}">
    <div class="name">${formatDishName(dish.name)}</div>
    ${price}
    <div class="meta">${category}${diet}</div>
  </article>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDay(data, day) {
  const block = data.days[day];
  dayDate.innerHTML = block ? formatDate(block.date) : "";
  marketBanner.hidden = day !== "thursday";
  board.innerHTML = (block?.canteens ?? [])
    .map((canteen, slipIndex) => {
      const meta = CANTEENS[canteen.id];
      const source = data.sources?.[canteen.id];
      const pizza =
        canteen.id === "sodexo" ? `<span class="pizza">Pizza täglich</span>` : "";
      let note = "";
      if (source?.status === "error") {
        note = `<p class="note">Speiseplan gerade nicht geladen.</p>`;
      } else if (source?.status === "stale") {
        note = `<p class="note">Letzter bekannter Plan — Aktualisierung fehlgeschlagen.</p>`;
      }
      const body = canteen.dishes?.length
        ? canteen.dishes.map((dish, index) => dishRow(dish, index)).join("")
        : source?.status === "error"
          ? ""
          : `<p class="ghost">Heute nichts eingetragen.</p>`;
      return `<section class="slip" style="--slip-i:${slipIndex}">
        <div class="slip-head">
          <div>
            <h2>${meta.name}</h2>
            <p class="where">${meta.short}</p>
          </div>
          ${pizza}
        </div>
        ${note}
        ${body}
      </section>`;
    })
    .join("");
}

function updateDayIndicator(activeButton, { instant = false } = {}) {
  if (!dayIndicator || !activeButton || !daysNav) return;
  const place = () => {
    const navRect = daysNav.getBoundingClientRect();
    const btnRect = activeButton.getBoundingClientRect();
    const x = btnRect.left - navRect.left;
    if (instant) dayIndicator.style.transition = "none";
    dayIndicator.style.width = `${btnRect.width}px`;
    dayIndicator.style.transform = `translate3d(${x}px, 0, 0)`;
    if (instant) {
      // Force reflow, then restore sliding transition for later clicks
      void dayIndicator.offsetWidth;
      dayIndicator.style.transition = "";
    }
  };
  window.requestAnimationFrame(place);
}

function playEnterAnimation() {
  board.classList.remove("is-entering");
  dayDate.classList.remove("is-entering");
  if (marketBanner && !marketBanner.hidden) {
    marketBanner.classList.remove("is-entering");
  }
  window.clearTimeout(enterTimer);
  window.requestAnimationFrame(() => {
    board.classList.add("is-entering");
    dayDate.classList.add("is-entering");
    if (marketBanner && !marketBanner.hidden) {
      marketBanner.classList.add("is-entering");
    }
    enterTimer = window.setTimeout(() => {
      board.classList.remove("is-entering");
      dayDate.classList.remove("is-entering");
      if (marketBanner) marketBanner.classList.remove("is-entering");
    }, 900);
  });
}

function selectDay(data, day, { instantIndicator = false } = {}) {
  for (const button of document.querySelectorAll(".days button")) {
    button.setAttribute("aria-selected", String(button.dataset.day === day));
  }
  const active = document.querySelector('.days button[aria-selected="true"]');
  updateDayIndicator(active, { instant: instantIndicator });
  renderDay(data, day);
  playEnterAnimation();
}

try {
  const response = await fetch("./data/menu.json", { cache: "no-store" });
  if (!response.ok) throw new Error("missing");
  const data = await response.json();
  kwEl.textContent = isoWeek(data.weekStart);
  stamp.textContent = `Stand: ${formatStamp(data.scrapedAt)}`;
  const message = bannerText(data);
  if (message) {
    banner.hidden = false;
    banner.textContent = message;
  }
  board.hidden = false;
  escapeWrap.hidden = false;
  const start = todayKey();
  selectDay(data, start, { instantIndicator: true });
  // After the days bar finishes its enter animation, re-measure the pill
  window.setTimeout(() => {
    const active = document.querySelector('.days button[aria-selected="true"]');
    updateDayIndicator(active, { instant: true });
  }, 750);
  for (const button of document.querySelectorAll(".days button")) {
    button.addEventListener("click", () => selectDay(data, button.dataset.day));
  }
  window.addEventListener("resize", () => {
    const active = document.querySelector('.days button[aria-selected="true"]');
    updateDayIndicator(active, { instant: true });
  });
} catch {
  empty.hidden = false;
  stamp.textContent = "Stand: noch kein Crawl";
}
