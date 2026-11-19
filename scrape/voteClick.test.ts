import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { heuteDabeiLine, roundNicks, winnerOf } from "../site/vote.js";
import {
  adoptRemoteVote,
  applyRemoteVote,
  inkMineForCanteen,
  inkVote,
  paintVoteBoard,
  stateFromPresent,
  type VotePending,
  type VoteSnap,
} from "../site/voteMarks.js";

const NAMES = {
  stmuv: "StMUV",
  sodexo: "Dave B",
  bella23: "Bella 23",
  wochenmarkt: "Wochenmarkt",
};

function voteDocument() {
  const { document } = parseHTML(`<!doctype html><body>
    <button id="heute-dabei" hidden></button>
    <section class="slip" data-canteen="stmuv">
      <button type="button" class="vote-mark" data-vote="stmuv" aria-pressed="false">
        <span class="vote-nicks"></span>
        <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
      </button>
    </section>
    <section class="slip" data-canteen="sodexo">
      <button type="button" class="vote-mark" data-vote="sodexo" aria-pressed="false">
        <span class="vote-nicks"></span>
        <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
      </button>
    </section>
    <section class="slip" data-canteen="bella23">
      <button type="button" class="vote-mark" data-vote="bella23" aria-pressed="false">
        <span class="vote-nicks"></span>
        <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
      </button>
    </section>
  </body>`);
  return document;
}

/** Same two paints as the board: the checkmark, then the name over the slips. */
function paintBoard(document: Document, state: VoteSnap) {
  const result = winnerOf(state.counts || {}, NAMES);
  paintVoteBoard(document, state, {
    open: true,
    show: true,
    showMarket: false,
    reveal: false,
    result,
  });
  const text = heuteDabeiLine(result, roundNicks(state.records), false);
  const heute = document.querySelector<HTMLElement>("#heute-dabei");
  if (!heute) return;
  heute.hidden = !text;
  heute.textContent = text;
}

describe("vote click ink", () => {
  it("draws the canteen checkmark and the name before the ballot write settles", async () => {
    const document = voteDocument();
    const uid = "voter00000000001";
    let state: VoteSnap = { mine: { picks: [], egal: false }, records: {}, present: {}, uid };
    let pending: VotePending | null = null;
    let markWhenWriteStarted = false;
    let nameWhenWriteStarted = "";
    let release: (mine: { picks: string[]; egal: boolean }) => void = () => {};
    const gate = new Promise<{ picks: string[]; egal: boolean }>((resolve) => {
      release = resolve;
    });
    const hung = inkVote({
      state,
      mine: inkMineForCanteen(state.mine, "sodexo"),
      nick: "Sven",
      uid,
      paint: (next, hold) => {
        state = next;
        pending = hold;
        paintBoard(document, next);
      },
      write: () => {
        const mark = document.querySelector('[data-vote="sodexo"]');
        markWhenWriteStarted = Boolean(mark?.classList.contains("is-drawn"));
        nameWhenWriteStarted = document.querySelector("#heute-dabei")?.textContent || "";
        return gate;
      },
    });

    const mark = document.querySelector('[data-vote="sodexo"]');
    const heute = document.querySelector<HTMLElement>("#heute-dabei");
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-vote="stmuv"]')?.classList.contains("is-drawn")).toBe(
      false,
    );
    expect(heute?.hidden).toBe(false);
    expect(heute?.textContent).toMatch(/Sven/);

    await Promise.resolve();
    expect(markWhenWriteStarted).toBe(true);
    expect(nameWhenWriteStarted).toMatch(/Sven/);

    const nickOnly = stateFromPresent({
      day: "2026-11-17",
      present: { [uid]: "Sven" },
      ownRec: null,
      uid,
    });
    const bare = voteDocument();
    paintBoard(bare, nickOnly);
    expect(bare.querySelector('[data-vote="sodexo"]')?.classList.contains("is-drawn")).toBe(false);
    expect(bare.querySelector("#heute-dabei")?.textContent).toBe("");

    const kept = adoptRemoteVote(nickOnly, pending);
    paintBoard(document, kept.state);
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(heute?.textContent).toMatch(/Sven/);
    expect(kept.pending).not.toBeNull();

    const echoed = stateFromPresent({
      day: "2026-11-17",
      present: { [uid]: "Sven" },
      ownRec: { uid, nick: "Sven", canteen: "sodexo", at: 1 },
      uid,
    });
    const adopted = adoptRemoteVote(echoed, kept.pending);
    expect(adopted.pending).toBeNull();
    paintBoard(document, adopted.state);
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.getAttribute("aria-pressed")).toBe("true");
    expect(heute?.textContent).toMatch(/Sven/);

    const again = applyRemoteVote(adopted.state, nickOnly, null);
    expect(again.pending).toBeNull();
    paintBoard(document, again.state);
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(heute?.textContent).toMatch(/Sven/);

    release({ picks: ["sodexo"], egal: false });
    await hung;
    expect(mark?.classList.contains("is-drawn")).toBe(true);
  });

  it("draws the checks on click and does not undraw them on a nick-only update", async () => {
    const document = voteDocument();
    const uid = "voter00000000001";
    let state: VoteSnap = { mine: { picks: [], egal: false }, records: {}, present: {}, uid };
    const hung = inkVote({
      state,
      mine: inkMineForCanteen(state.mine, "bella23"),
      nick: "Sven",
      uid,
      paint: (next) => {
        state = next;
        paintBoard(document, next);
      },
      write: () => new Promise(() => {}),
    });

    const mark = document.querySelector('[data-vote="bella23"]');
    const heute = document.querySelector<HTMLElement>("#heute-dabei");
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.getAttribute("aria-pressed")).toBe("true");
    expect(heute?.hidden).toBe(false);
    expect(heute?.textContent).toMatch(/Sven/);

    const nickOnly = stateFromPresent({
      day: "2026-11-19",
      present: { [uid]: "Sven" },
      ownRec: null,
      uid,
    });
    expect(nickOnly.mine?.picks ?? []).toEqual([]);
    const kept = applyRemoteVote(state, nickOnly, null);
    paintBoard(document, kept.state);
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-vote="sodexo"]')?.classList.contains("is-drawn")).toBe(
      false,
    );
    expect(heute?.textContent).toMatch(/Sven/);

    const left = applyRemoteVote(
      kept.state,
      stateFromPresent({ day: "2026-11-19", present: {}, ownRec: null, uid }),
      null,
    );
    paintBoard(document, left.state);
    expect(mark?.classList.contains("is-drawn")).toBe(false);
    expect(heute?.textContent).toBe("");
    void hung;
  });

  it("takes the checkmark back off when the write fails", async () => {
    const document = voteDocument();
    const uid = "voter00000000001";
    const state: VoteSnap = { mine: { picks: [], egal: false }, records: {}, uid };
    const failed = inkVote({
      state,
      mine: inkMineForCanteen(state.mine, "stmuv"),
      nick: "Sven",
      uid,
      paint: (next) => paintBoard(document, next),
      write: () => Promise.reject(new Error("offline")),
    });
    expect(document.querySelector('[data-vote="stmuv"]')?.classList.contains("is-drawn")).toBe(
      true,
    );
    await expect(failed).rejects.toThrow(/offline/);
    expect(document.querySelector('[data-vote="stmuv"]')?.classList.contains("is-drawn")).toBe(
      false,
    );
    expect(document.querySelector('[data-vote="stmuv"]')?.getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(document.querySelector("#heute-dabei")?.textContent).toBe("");
  });
});

describe("auch dabei pill", () => {
  function egalDocument() {
    const { document } = parseHTML(`<!doctype html><body>
      <button type="button" class="dabei-pill" id="egal-vote" aria-pressed="false">
        <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
        <span class="dabei-label">auch dabei?</span>
      </button>
      <section class="slip" data-canteen="sodexo">
        <button type="button" class="vote-mark" data-vote="sodexo" aria-pressed="false">
          <span class="vote-nicks"></span>
          <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
        </button>
      </section>
      <button type="button" class="vote-mark" id="market-vote" data-vote="wochenmarkt" hidden>
        <span class="vote-nicks"></span>
        <svg class="vote-check"><circle class="vote-check-ring" /><path class="vote-check-tick" /></svg>
      </button>
    </body>`);
    return document;
  }

  const shown = {
    open: true,
    show: true,
    showMarket: true,
    reveal: false,
    result: { status: "empty" as const },
  };

  it("hides the pill after a canteen vote and leaves the checkmark ink", () => {
    const document = egalDocument();
    const egal = document.querySelector<HTMLElement>("#egal-vote");
    const mark = document.querySelector('[data-vote="sodexo"]');

    paintVoteBoard(document, { mine: { picks: [], egal: false }, records: {} }, shown);
    expect(egal?.hidden).toBe(false);
    expect(egal?.textContent).toMatch(/ohne Vote dabei/);
    expect(mark?.classList.contains("is-drawn")).toBe(false);

    paintVoteBoard(
      document,
      {
        mine: { picks: ["sodexo"], egal: false },
        records: { a: { uid: "voter00000000001", nick: "Sven", canteen: "sodexo", at: 1 } },
      },
      shown,
    );
    expect(egal?.hidden).toBe(true);
    expect(mark?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.getAttribute("aria-pressed")).toBe("true");

    paintVoteBoard(document, { mine: { picks: ["wochenmarkt"], egal: false }, records: {} }, shown);
    expect(egal?.hidden).toBe(false);
    expect(mark?.classList.contains("is-drawn")).toBe(false);

    paintVoteBoard(document, { mine: { picks: [], egal: true }, records: {} }, shown);
    expect(egal?.hidden).toBe(false);
    expect(egal?.classList.contains("is-drawn")).toBe(true);
    expect(mark?.classList.contains("is-drawn")).toBe(false);
  });
});
