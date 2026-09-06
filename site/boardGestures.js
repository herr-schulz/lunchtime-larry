/** Board pointer gestures: day swipe, dish like, pizza hold. */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.board
 * @param {string[]} opts.dayKeys
 * @param {() => string} opts.getDay
 * @param {(day: string) => void} opts.selectDay
 * @param {(dish: HTMLElement) => void} opts.toggleDishLike
 * @param {() => boolean} opts.votingOpen
 * @param {(canteen: string) => void} opts.onVote
 * @param {() => void} opts.onPizzaHold
 */
export function bindBoardGestures({
  board,
  dayKeys,
  getDay,
  selectDay,
  toggleDishLike,
  votingOpen,
  onVote,
  onPizzaHold,
}) {
  if (!board) return;
  let origin = null;
  let swiped = false;
  let lastTap = null;

  board.addEventListener("pointerdown", (event) => {
    if (event.target.closest("a")) return;
    origin = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      type: event.pointerType,
    };
    swiped = false;
  });
  board.addEventListener("pointermove", (event) => {
    if (!origin || origin.id !== event.pointerId) return;
    if (Math.abs(event.clientX - origin.x) > 28) swiped = true;
  });
  board.addEventListener("click", (event) => {
    const vote = event.target.closest(".vote-mark[data-vote]");
    if (!vote || !votingOpen()) return;
    onVote(vote.dataset.vote);
  });
  board.addEventListener("pointerup", (event) => {
    if (!origin || origin.id !== event.pointerId) return;
    const { x, y, type } = origin;
    origin = null;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    if (swiped || (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.4)) {
      lastTap = null;
      const index = dayKeys.indexOf(getDay());
      const next = dx < 0 ? index + 1 : index - 1;
      if (next >= 0 && next < dayKeys.length) selectDay(dayKeys[next]);
      return;
    }
    if (event.target.closest("a, .vote-mark, .pizza")) return;
    const dish = event.target.closest(".dish");
    if (dish) {
      if (type === "touch") {
        const now = performance.now();
        if (lastTap && lastTap.key === dish.dataset.key && now - lastTap.t < 340) {
          lastTap = null;
          toggleDishLike(dish);
        } else {
          lastTap = { key: dish.dataset.key, t: now };
        }
        return;
      }
      toggleDishLike(dish);
      return;
    }
  });
  board.addEventListener("pointercancel", () => {
    origin = null;
    lastTap = null;
  });
  bindPizzaHold(board, onPizzaHold);
  board.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a")) return;
    const dish = event.target.closest(".dish");
    if (!dish || event.target !== dish) return;
    event.preventDefault();
    toggleDishLike(dish);
  });
}

function bindPizzaHold(board, onPizzaHold) {
  let holdTimer = 0;
  let holdId = null;
  board.addEventListener("pointerdown", (event) => {
    const pizza = event.target.closest("[data-pizza]");
    if (!pizza) return;
    holdId = event.pointerId;
    try {
      pizza.setPointerCapture(event.pointerId);
    } catch {
      /* older browsers */
    }
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      holdTimer = 0;
      holdId = null;
      onPizzaHold();
    }, 650);
  });
  const clear = (event) => {
    if (holdId != null && event.pointerId !== holdId) return;
    clearTimeout(holdTimer);
    holdTimer = 0;
    holdId = null;
  };
  board.addEventListener("pointerup", clear);
  board.addEventListener("pointercancel", clear);
}
