import { pickSpot } from "./dice.js?v=b5a71252";
import { mountDice, prefersReducedMotion, spotEntries } from "./diceReel.js?v=8e6c8fb6";
import { LOCATIONS } from "./locations.js?v=8bbcd50b";

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
      card.classList.remove("is-pointed");
      void card.offsetWidth;
      card.classList.add("is-pointed");
      window.setTimeout(() => card.classList.remove("is-pointed"), 1200);
    },
  });
}
