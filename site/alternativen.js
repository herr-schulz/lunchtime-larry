import { ALTERNATIVES, renderAltCard } from "./alternatives.js";

const grid = document.querySelector("#spot-grid");

grid.innerHTML = ALTERNATIVES.map((spot, i) => renderAltCard(spot, i)).join("");

window.requestAnimationFrame(() => {
  document.body.classList.add("spots-ready");
});
