/** All Larry speech copy — first person, one place to edit. */

export const IDLE_TIP = {
  kicker: "Hey",
  line: "Tipps und Abstimmungen landen bei mir.",
};

export function menuFreshNote({ old = false, issueNames = [] } = {}) {
  const kicker = "Larry informiert:";
  const fresh = "Am Montag oder Mittwoch gibt es wieder was Neues.";
  /* One or two named canteens → call them out; full wipe or age-only → generic. */
  const partial = issueNames.length > 0 && issueNames.length < 3;
  if (partial) {
    return {
      kicker,
      line: `Bei ${issueNames.join(", ")} hakt’s. ${fresh}`,
    };
  }
  if (old || issueNames.length >= 3) {
    return {
      kicker,
      line: `Der Speiseplan wirkt veraltet. ${fresh}`,
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

export function likeAck(label) {
  const line = LIKE_ACKS[Math.floor(Math.random() * LIKE_ACKS.length)](label);
  return { kicker: "Notiert", line };
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
