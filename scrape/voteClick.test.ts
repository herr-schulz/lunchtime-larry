import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { heuteDabeiLine, roundNicks, winnerOf } from "../site/vote.js";
import {
  adoptRemoteVote,
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
    expect(bare.querySelector("#heute-dabei")?.textContent).toMatch(/Sven/);

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

    release({ picks: ["sodexo"], egal: false });
    await hung;
    expect(mark?.classList.contains("is-drawn")).toBe(true);
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
