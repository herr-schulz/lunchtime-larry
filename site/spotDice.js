import { pickSpot } from "./dice.js?v=ca08ab4d";
import { mountDice, prefersReducedMotion, spotEntries } from "./diceReel.js?v=a71ad46d";
import { applyPenMark } from "./icons.js?v=952ff298";
import { LOCATIONS } from "./locations.js?v=2dcdf871";

const openButton = document.querySelector("#dice-open");
const dialog = document.querySelector("#dice-dialog");

if (openButton && dialog) {
  mountDice({
    openButton,
    dialog,
    modes: false,
    getEntries: () => spotEntries(LOCATIONS),
    pick() {
      const entries = spotEntries(LOCATIONS);
      const picked = pickSpot(entries);
      if (!picked) return null;
      return { index: entries.indexOf(picked), entry: picked };
    },
    onShow(entry) {
      const card = document.querySelector(
        `.spot-card[data-spot="${CSS.escape(entry.key || "")}"]`,
      );
      if (!card) return;
      const reduce = prefersReducedMotion();
      card.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
      for (const el of document.querySelectorAll(".spot-card.is-pointed")) {
        el.classList.remove("is-pointed");
      }
      void card.offsetWidth;
      applyPenMark(card);
      card.classList.add("is-pointed");
    },
  });
}
