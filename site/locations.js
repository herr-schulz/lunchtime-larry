/** Lunch-Locations ab Elektrstraße 6 · Arabellapark */
export const LOCATIONS = [
  {
    name: "REWE Arabellapark",
    vibe: "Salatbar & Sushi",
    note: "Frische Theke, Sushi, Snacks — zwei Etagen im Center",
    where: "Rosenkavalierplatz 5",
    when: "Mo–Sa 7–20",
    walk: 1,
    tags: ["Mitnehmen", "Günstig", "Schnell"],
    url: "https://www.google.com/maps/search/?api=1&query=REWE+Rosenkavalierplatz+5+M%C3%BCnchen",
  },
  {
    name: "Vinzenzmurr",
    vibe: "Leberkäse & Wurst",
    note: "Semmel, Snack, klassisch münchnerisch",
    where: "Rosenkavalierplatz 4",
    when: "Mo–Fr 8–19 · Sa bis 15",
    walk: 1,
    tags: ["Mitnehmen", "Schnell", "Günstig"],
    url: "https://www.google.com/maps/search/?api=1&query=Vinzenzmurr+Rosenkavalierplatz+4+M%C3%BCnchen",
  },
  {
    name: "Subway",
    vibe: "Sandwich & Salat",
    note: "Subs, Wraps, Salate — individuell zusammenstellen",
    where: "Rosenkavalierplatz 8",
    when: "Mo–So 9–22",
    walk: 2,
    tags: ["Mitnehmen", "Sitzplatz", "Schnell"],
    url: "https://restaurants.subway.com/de/deutschland/by/munchen/rosenkavalierplatz-8",
  },
  {
    name: "Hans im Glück",
    vibe: "Burger",
    note: "Veggie, vegan & Fleisch — Terrasse am Park",
    where: "Arabellastr. 17",
    when: "täglich ab 11:30",
    walk: 3,
    tags: ["Sitzplatz", "Mitnehmen", "Terrasse"],
    url: "https://hansimglueck-burgergrill.de/burger-restaurant/muenchen-arabellapark",
  },
  {
    name: "Q & Q",
    vibe: "Asiatisch",
    note: "Sushi, Wok, Bowls — Mittags gut voll",
    where: "Rosenkavalierplatz 15",
    when: "Mo–Sa 11–15 & abends",
    walk: 5,
    tags: ["Sitzplatz", "Mittagstisch", "Mitnehmen"],
    url: "https://www.google.com/maps/search/?api=1&query=Q%26Q+Restaurant+Rosenkavalierplatz+M%C3%BCnchen",
  },
  {
    name: "Bistro Föhn",
    vibe: "Bistro",
    note: "International, entspannt — auch abends offen",
    where: "Rosenkavalierplatz",
    when: "Mo–Fr 11:30–22:30",
    walk: 5,
    tags: ["Sitzplatz", "Mittagstisch"],
    url: "https://www.google.com/maps/search/?api=1&query=Bistro+F%C3%B6hn+Rosenkavalierplatz+M%C3%BCnchen",
  },
  {
    name: "030 Kebap",
    vibe: "Berliner Döner",
    note: "früher Arabella Kebaphaus — schnell, günstig, Berliner Art",
    where: "Arabellastr. 19",
    when: "Mo–Sa 10–21",
    walk: 4,
    tags: ["Mitnehmen", "Schnell", "Günstig"],
    url: "https://www.google.com/maps/search/?api=1&query=030+Kebap+Arabellastra%C3%9Fe+19+M%C3%BCnchen",
  },
  {
    name: "Paulaner’s",
    vibe: "Bayerisch",
    note: "Business Lunch, Spinatknödel, Biergarten im Sommer",
    where: "Arabellastr. 6",
    when: "Di–Fr 11:30–14:30",
    walk: 6,
    tags: ["Sitzplatz", "Mittagstisch"],
    url: "https://www.arabellapark-dining.com/paulaners",
  },
];

const DAY_SHORT = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
};

const DAY_ORDER = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function berlinWeekdayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Berlin",
  })
    .format(now)
    .toLowerCase();
}

/** Best-effort open check from German short hours strings. */
export function isLikelyOpenToday(when, weekdayKey = berlinWeekdayKey()) {
  const text = String(when || "");
  const today = DAY_SHORT[weekdayKey];
  if (!today) return true;
  if (/täglich/i.test(text)) return true;
  if (/Mo\s*[–-]\s*So/i.test(text)) return true;

  const range = text.match(
    /\b(Mo|Di|Mi|Do|Fr|Sa|So)\s*[–-]\s*(Mo|Di|Mi|Do|Fr|Sa|So)\b/i,
  );
  if (range) {
    const start = DAY_ORDER.indexOf(range[1]);
    const end = DAY_ORDER.indexOf(range[2]);
    const here = DAY_ORDER.indexOf(today);
    if (start >= 0 && end >= 0 && here >= 0) {
      if (start <= end) return here >= start && here <= end;
      return here >= start || here <= end;
    }
  }

  const singles = [...text.matchAll(/\b(Mo|Di|Mi|Do|Fr|Sa|So)\b/g)].map(
    (match) => match[1],
  );
  if (singles.length) return singles.includes(today);
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderLocationCard(spot, index = 0) {
  const open = isLikelyOpenToday(spot.when);
  const tags = (spot.tags ?? [])
    .map((t) => `<span class="pill tag">${escapeHtml(t)}</span>`)
    .join("");
  const closed = open
    ? ""
    : `<span class="spot-closed">Heute zu</span>`;
  return `<a class="spot-card${open ? "" : " is-closed"}" href="${escapeHtml(spot.url)}" target="_blank" rel="noopener noreferrer" style="--i:${index}">
    <div class="spot-top">
      <h3>${escapeHtml(spot.name)}</h3>
      <span class="spot-walk">${spot.walk} min</span>
    </div>
    <span class="spot-vibe">${escapeHtml(spot.vibe)}</span>
    ${closed}
    <p class="spot-note">${escapeHtml(spot.note)}</p>
    <div class="spot-tags">${tags}</div>
    <p class="spot-meta">${escapeHtml(spot.where)} · ${escapeHtml(spot.when)}</p>
  </a>`;
}

const grid = typeof document !== "undefined" ? document.querySelector("#spot-grid") : null;
if (grid) {
  const weekday = berlinWeekdayKey();
  const ranked = [...LOCATIONS].sort((a, b) => {
    const aOpen = isLikelyOpenToday(a.when, weekday) ? 0 : 1;
    const bOpen = isLikelyOpenToday(b.when, weekday) ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return a.walk - b.walk;
  });
  grid.innerHTML = ranked
    .map((spot, i) => renderLocationCard(spot, i))
    .join("");
  window.requestAnimationFrame(() => {
    document.body.classList.add("spots-ready");
  });
}
