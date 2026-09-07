/** All Larry speech copy — first person, one place to edit. */

export const IDLE_TIP = {
  kicker: "Hey",
  line: "Tipps und Abstimmungen landen bei mir.",
};

const CRAWL_DAYS = new Set(["monday", "wednesday"]);
const LOOK_TEN = "Ich schau um 10 Uhr nochmal in der Küche vorbei.";
const LOOK_HALF = "Ich schau um 11:30 nochmal vorbei — vor dem Essen.";
const STUCK = "Da hakt’s wohl — ich komm heute nicht mehr durch.";

/** Timed promise on Mo/Mi; after noon (or other days) the stuck line. */
export function nextLookLine(hour, weekday) {
  if (!CRAWL_DAYS.has(weekday)) return STUCK;
  if (hour < 10) return LOOK_TEN;
  if (hour < 12) return LOOK_HALF;
  return STUCK;
}

export function menuFreshNote({
  old = false,
  issueNames = [],
  hour = 12,
  weekday = "friday",
} = {}) {
  const kicker = "Larry informiert:";
  const look = nextLookLine(hour, weekday);
  const partial = issueNames.length > 0 && issueNames.length < 3;
  if (partial) {
    const follow =
      look === STUCK ? "Ich komm heute nicht mehr durch." : look;
    return {
      kicker,
      line: `Bei ${issueNames.join(", ")} hakt’s. ${follow}`,
    };
  }
  if (old || issueNames.length >= 3) {
    return {
      kicker,
      line:
        look === STUCK
          ? `Der Speiseplan wirkt veraltet. ${STUCK}`
          : `Der Speiseplan ist noch der alte. ${look}`,
    };
  }
  return null;
}

export function winnerLead(name) {
  return {
    kicker: "Mein Mittags-Tipp",
    line: `Heute geht’s zu ${name}.`,
  };
}

export function winnerTie() {
  return {
    kicker: "Hmm",
    line: "Das sieht mir wohl nach einem Unentschieden aus.",
  };
}

export function voteFull() {
  return {
    kicker: "Ohje",
    line: "6 Kollegen haben bereits abgestimmt. Mehr geht heute nicht.",
  };
}

export function voteOffline() {
  return {
    kicker: "Ohje",
    line: "Ich komm gerade nicht an die Stimmen ran.",
  };
}

const LIKE_ACKS = [
  (label) => `Oh, du magst also ${label} — das merk ich mir.`,
  (label) => `${label}? Notiert.`,
  (label) => `Alles klar — ${label} kommt auf meinen Zettel.`,
  (label) => `Fein, ${label} hab ich mir gemerkt.`,
];

const UNLIKE_ACKS = [
  (label) => `${label} fliegt vom Zettel. War ja auch nur so mittel.`,
  (label) => `Alles klar — ${label} streich ich.`,
  (label) => `Okay, ${label} muss nicht mehr sein.`,
  (label) => `${label} ist runter. Hast du’s dir anders überlegt?`,
];

export function likeAck(label) {
  const line = LIKE_ACKS[Math.floor(Math.random() * LIKE_ACKS.length)](label);
  return { kicker: "Notiert", line };
}

export function unlikeAck(label) {
  const line = UNLIKE_ACKS[Math.floor(Math.random() * UNLIKE_ACKS.length)](label);
  return { kicker: "Gestrichen", line };
}

export function favoriteToday(label, place) {
  return {
    kicker: "Larry empfiehlt:",
    line: `Heute gibt’s ${label} bei ${place}.`,
  };
}

export function pizzaDaily() {
  return {
    kicker: "Dave B",
    line: "Ja. Wirklich. Täglich. Glaub mir.",
  };
}

export function leisureMode() {
  return {
    kicker: "Wow!",
    line: "Danke für den Drink! Ich mach dann mal Feierabend!",
  };
}
