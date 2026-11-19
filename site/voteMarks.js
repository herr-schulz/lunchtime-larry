import {
  MARKET_ID,
  ballotPayload,
  countVotes,
  emptyMine,
  isValidNick,
  mineFromRecord,
  mineHasPick,
  nextMineForPick,
  nicksFor,
  normalizeNick,
  roundNicks,
} from "./vote.js?v=4d6bd53e";

const LOCAL_UID = "local";
const UID_RE = /^[A-Za-z0-9]{16,128}$/;

function activeMine(mine) {
  if (mine?.egal) return { picks: [], egal: true };
  const picks = [...(mine?.picks ?? [])];
  if (!picks.length) return emptyMine();
  return { picks, egal: false };
}

function showingMine(mine) {
  return Boolean(mine?.egal) || Boolean(mine?.picks?.length);
}

export function sameMine(a, b) {
  const egalA = Boolean(a?.egal);
  const egalB = Boolean(b?.egal);
  if (egalA !== egalB) return false;
  const picksA = egalA ? [] : [...(a?.picks ?? [])];
  const picksB = egalB ? [] : [...(b?.picks ?? [])];
  return picksA.length === picksB.length && picksA.every((id, i) => id === picksB[i]);
}

function nickListed(records, nick) {
  const key = normalizeNick(nick).toLocaleLowerCase("de-DE");
  if (!isValidNick(key)) return false;
  return roundNicks(records).some((name) => name.toLocaleLowerCase("de-DE") === key);
}

/** Local ballot plus the voter's nick, so the mark and "Heute dabei" move together. */
export function projectLocalVote(state, mine, nick, uid) {
  const nextMine = activeMine(mine);
  const showing = showingMine(nextMine);
  const name = normalizeNick(nick);
  const valid = isValidNick(name);
  const self = uid || null;
  const records = {};
  let i = 0;
  for (const rec of Object.values(state?.records || {})) {
    if (!rec || typeof rec !== "object") continue;
    if (self && rec.uid === self) continue;
    if (rec.uid === LOCAL_UID) continue;
    records[String(i++)] = rec;
  }
  const present = {
    ...(state?.present && typeof state.present === "object" ? state.present : {}),
  };
  if (self) delete present[self];
  if (showing && valid) {
    const payload = ballotPayload(self || LOCAL_UID, name, nextMine, 0);
    if (payload) {
      records[String(i++)] = payload;
      if (self) present[self] = name;
    }
  }
  return {
    ...state,
    mine: nextMine,
    records,
    present,
    counts: countVotes(records),
    uid: state?.uid ?? self,
  };
}

/**
 * Keep a click's marks until a server snapshot carries the same ballot.
 * A present-only echo has the nick and an empty mine — that must not clear the ink.
 */
export function adoptRemoteVote(remote, pending) {
  if (!pending) return { state: remote, pending: null };
  const marksMatch = sameMine(remote?.mine, pending.mine);
  const listed = nickListed(remote?.records, pending.nick);
  const valid = isValidNick(normalizeNick(pending.nick));
  const presenceMatch = showingMine(pending.mine) ? listed || !valid : !listed;
  if (marksMatch && presenceMatch) return { state: remote, pending: null };
  return {
    state: projectLocalVote(remote, pending.mine, pending.nick, pending.uid || remote?.uid),
    pending,
  };
}

/**
 * A later snapshot can list the nick and carry an empty mine after the click
 * ink was already accepted. Put the checks back on that snapshot.
 * A snapshot that drops the nick, or that brings its own ballot, wins.
 */
export function mergeLiveVote(previous, incoming) {
  if (!incoming) return previous ?? { records: {}, mine: emptyMine() };
  if (!previous || showingMine(incoming.mine)) return incoming;
  const uid = incoming.uid || previous.uid || null;
  if (!uid || (previous.uid && previous.uid !== uid)) return incoming;
  const present =
    incoming.present && typeof incoming.present === "object" ? incoming.present : {};
  const nick = present[uid];
  if (!isValidNick(normalizeNick(nick)) || !showingMine(previous.mine)) return incoming;
  return projectLocalVote(incoming, previous.mine, nick, uid);
}

/** Pending click ink first, then the last drawn ballot against a nick-only echo. */
export function applyRemoteVote(previous, incoming, pending) {
  const adopted = adoptRemoteVote(incoming, pending);
  if (adopted.pending) return adopted;
  return { state: mergeLiveVote(previous, adopted.state), pending: null };
}

/** Names from `present`, checkmarks from the caller's own ballot. One snapshot, no empty mine. */
export function stateFromPresent({ day, present, ownRec, uid, revealed = false }) {
  const people = present && typeof present === "object" ? present : {};
  const records = {};
  let i = 0;
  const selfId = uid || "";
  const own = selfId && ownRec?.uid === selfId ? ownRec : null;
  for (const [id, nick] of Object.entries(people)) {
    if (!UID_RE.test(id) || !isValidNick(nick)) continue;
    // Present arrives before the seat ballot. Listing ourselves then draws the
    // name at the top and leaves the checkmarks off.
    if (selfId && id === selfId && !own) continue;
    const self = Boolean(own) && id === selfId;
    const row = {
      uid: id,
      nick,
      canteen: self ? own.canteen : "egal",
      at: 0,
    };
    if (self && own.second) row.second = own.second;
    if (self && own.egal === true) row.egal = true;
    records[String(i++)] = row;
  }
  if (own && isValidNick(own.nick) && !Object.values(records).some((rec) => rec.uid === selfId)) {
    records[String(i++)] = {
      uid: own.uid,
      nick: own.nick,
      canteen: own.canteen,
      at: own.at || 0,
      ...(own.second ? { second: own.second } : {}),
      ...(own.egal === true ? { egal: true } : {}),
    };
  }
  const mine = own ? mineFromRecord(own) : emptyMine();
  return {
    day,
    records,
    present: people,
    counts: own ? countVotes({ 0: own }) : countVotes({}),
    mine,
    uid: uid || null,
    revealed: Boolean(revealed),
  };
}

export function inkMineForCanteen(mine, canteen) {
  return nextMineForPick(mine, canteen);
}

export function inkMineForEgal(mine) {
  if (mine?.egal) return emptyMine();
  return { picks: [], egal: true };
}

/**
 * Draw the ballot, then start `write`.
 * Callers can read the marks before the returned promise settles.
 */
export function inkVote({ state, mine, nick, uid, paint, write }) {
  const pending = { mine: activeMine(mine), nick, uid: uid || null };
  const next = projectLocalVote(state, pending.mine, nick, pending.uid);
  paint(next, pending);
  return Promise.resolve()
    .then(write)
    .then((saved) => ({ saved: activeMine(saved) }))
    .catch((err) => {
      paint(state, null);
      throw err;
    });
}

function replayCheck(el) {
  if (!el) return;
  el.classList.remove("is-drawn");
  try {
    void el.offsetWidth;
  } catch {
    /* not laid out */
  }
  el.classList.add("is-drawn");
}

function paintMark(mark, { show, open, mine, nickList }) {
  if (!mark) return;
  mark.hidden = !show;
  mark.disabled = !open;
  mark.setAttribute("aria-pressed", String(Boolean(mine)));
  const names = nickList?.length ? nickList.join(" · ") : "";
  const label = names || (mine ? "Deine Stimme" : "Hierhin");
  mark.setAttribute("aria-label", label);
  const nicks = mark.querySelector(".vote-nicks");
  if (nicks) nicks.textContent = names;
  if (mine) {
    if (!mark.classList.contains("is-drawn")) replayCheck(mark);
  } else {
    mark.classList.remove("is-drawn");
  }
}

export function paintVoteBoard(root, votes, { open, show, showMarket, reveal, result }) {
  const scope = root;
  if (!scope?.querySelectorAll) return;
  for (const slip of scope.querySelectorAll(".slip[data-canteen]")) {
    const id = slip.dataset.canteen;
    const mine = Boolean(show && mineHasPick(votes?.mine, id));
    const nickList = reveal ? nicksFor(votes?.records, id) : [];
    slip.classList.toggle("is-voted", mine);
    slip.classList.toggle(
      "is-leading",
      Boolean(reveal && result?.status === "lead" && result.id === id),
    );
    paintMark(slip.querySelector(".vote-mark"), { show, open, mine, nickList });
  }
  const marketVote = scope.querySelector("#market-vote");
  if (marketVote) {
    const mine = Boolean(showMarket && mineHasPick(votes?.mine, MARKET_ID));
    const nickList = showMarket && reveal ? nicksFor(votes?.records, MARKET_ID) : [];
    paintMark(marketVote, { show: showMarket, open, mine, nickList });
  }
  const marketBanner = scope.querySelector("#market-banner");
  marketBanner?.classList.toggle(
    "is-voted",
    Boolean(showMarket && mineHasPick(votes?.mine, MARKET_ID)),
  );
  marketBanner?.classList.toggle(
    "is-leading",
    Boolean(showMarket && reveal && result?.status === "lead" && result.id === MARKET_ID),
  );
  const egalVote = scope.querySelector("#egal-vote");
  if (egalVote) {
    const pressed = Boolean(votes?.mine?.egal);
    egalVote.hidden = !show;
    egalVote.disabled = !open;
    egalVote.classList.toggle("is-on", pressed);
    egalVote.setAttribute("aria-pressed", String(pressed));
    const names = roundNicks(votes?.records);
    const label = pressed ? "dabei" : names.length ? "auch dabei?" : "ohne Vote dabei";
    const labelEl = egalVote.querySelector(".dabei-label");
    if (labelEl) labelEl.textContent = label;
    else egalVote.textContent = label;
    egalVote.setAttribute("aria-label", pressed ? `${label} — mit in der Runde` : label);
    if (pressed) {
      if (!egalVote.classList.contains("is-drawn")) replayCheck(egalVote);
    } else {
      egalVote.classList.remove("is-drawn");
    }
  }
}
