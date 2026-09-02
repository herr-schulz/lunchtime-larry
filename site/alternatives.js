/** Täglich erreichbare Alternativen — ab Elektrstraße 6 · Arabellapark */
export const ALTERNATIVES = [
  {
    name: "Paulaner's",
    vibe: "Bayerisch",
    note: "Business Lunch, Spinatknödel, Biergarten im Sommer",
    where: "Arabellastr. 6",
    when: "Di–Fr 11:30–14:30",
    walk: 2,
    tags: ["Sitzplatz", "Mittagstisch"],
    url: "https://www.arabellapark-dining.com/paulaners",
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
    name: "Arabella Kebaphaus",
    vibe: "Döner & Imbiss",
    note: "schnell, günstig, klassischer Arabellapark-Retter",
    where: "Arabellastr. 19",
    when: "Mo–So",
    walk: 4,
    tags: ["Mitnehmen", "Schnell", "Günstig"],
    url: "https://www.google.com/maps/search/?api=1&query=Arabella+Kebaphaus+Arabellastra%C3%9Fe+19+M%C3%BCnchen",
  },
  {
    name: "Subway",
    vibe: "Sandwich & Salat",
    note: "Subs, Wraps, Salate — individuell zusammenstellen",
    where: "Rosenkavalierplatz 8",
    when: "Mo–So 9–22",
    walk: 4,
    tags: ["Mitnehmen", "Sitzplatz", "Schnell"],
    url: "https://restaurants.subway.com/de/deutschland/by/munchen/rosenkavalierplatz-8",
  },
  {
    name: "REWE Arabellapark",
    vibe: "Salatbar & Sushi",
    note: "Frische Theke, Sushi, Snacks — zwei Etagen im Center",
    where: "Rosenkavalierplatz 5",
    when: "Mo–Sa 7–20",
    walk: 4,
    tags: ["Mitnehmen", "Günstig", "Schnell"],
    url: "https://www.google.com/maps/search/?api=1&query=REWE+Rosenkavalierplatz+5+M%C3%BCnchen",
  },
  {
    name: "Vinzenzmurr",
    vibe: "Leberkäse & Wurst",
    note: "Semmel, Snack, klassisch münchnerisch",
    where: "Rosenkavalierplatz 4",
    when: "Mo–Fr 8–19 · Sa bis 15",
    walk: 4,
    tags: ["Mitnehmen", "Schnell", "Günstig"],
    url: "https://www.google.com/maps/search/?api=1&query=Vinzenzmurr+Rosenkavalierplatz+4+M%C3%BCnchen",
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
];

export const MARKET = {
  url: "https://maerkte-muenchen.de/service/info/wochenmarkt-bogenhausen/M00343491/",
  title: "Wochenmarkt Bogenhausen",
  where: "Rosenkavalierplatz",
  when: "Do 8–18 Uhr",
  note: "Gemüse, Fisch, Imbiss, Käse & mehr",
};

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderAltCard(spot, index = 0) {
  const tags = (spot.tags ?? [])
    .map((t) => `<span class="pill tag">${escapeHtml(t)}</span>`)
    .join("");
  return `<a class="spot-card" href="${escapeHtml(spot.url)}" target="_blank" rel="noopener noreferrer" style="--i:${index}">
    <div class="spot-top">
      <h3>${escapeHtml(spot.name)}</h3>
      <span class="spot-walk">${spot.walk} min</span>
    </div>
    <span class="spot-vibe">${escapeHtml(spot.vibe)}</span>
    <p class="spot-note">${escapeHtml(spot.note)}</p>
    <div class="spot-tags">${tags}</div>
    <p class="spot-meta">${escapeHtml(spot.where)} · ${escapeHtml(spot.when)}</p>
  </a>`;
}
