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
const kwEl = document.querySelector("#kw");
const stamp = document.querySelector("#stamp");

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
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${iso}T12:00:00`));
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

function dishRow(dish) {
  const diet =
    dish.diet && DIET[dish.diet]
      ? `<span class="pill ${dish.diet}">${DIET[dish.diet]}</span>`
      : "";
  const category = dish.category
    ? `<span class="pill">${dish.category}</span>`
    : "";
  const price = dish.price ? `<span class="price">${dish.price}</span>` : "";
  return `<article class="dish">
    <div class="name">${escapeHtml(dish.name)}</div>
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
  dayDate.textContent = block ? formatDate(block.date) : "";
  board.innerHTML = (block?.canteens ?? [])
    .map((canteen) => {
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
        ? canteen.dishes.map(dishRow).join("")
        : source?.status === "error"
          ? ""
          : `<p class="ghost">Heute nichts eingetragen.</p>`;
      return `<section class="slip">
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

function selectDay(data, day) {
  for (const button of document.querySelectorAll(".days button")) {
    button.setAttribute("aria-selected", String(button.dataset.day === day));
  }
  renderDay(data, day);
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
  const start = DAYS[todayKey()] ? todayKey() : "monday";
  selectDay(data, start);
  board.classList.add("is-ready");
  window.setTimeout(() => board.classList.remove("is-ready"), 700);
  selectDay(data, start);
  for (const button of document.querySelectorAll(".days button")) {
    button.addEventListener("click", () => selectDay(data, button.dataset.day));
  }
} catch {
  empty.hidden = false;
  stamp.textContent = "Stand: noch kein Crawl";
}
