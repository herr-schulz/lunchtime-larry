import type { VoteMine, VoteRecord, VoteRecords } from "./vote.js";

export type VoteSnap = {
  day?: string;
  records?: VoteRecords;
  present?: Record<string, string>;
  counts?: Record<string, number>;
  mine?: VoteMine;
  uid?: string | null;
  revealed?: boolean;
};

export type VotePending = {
  mine: VoteMine;
  nick: string;
  uid: string | null;
};

export function sameMine(
  a: VoteMine | null | undefined,
  b: VoteMine | null | undefined,
): boolean;

export function projectLocalVote(
  state: VoteSnap | null | undefined,
  mine: VoteMine | null | undefined,
  nick: string,
  uid?: string | null,
): VoteSnap;

export function adoptRemoteVote(
  remote: VoteSnap,
  pending: VotePending | null | undefined,
): { state: VoteSnap; pending: VotePending | null };

export function mergeLiveVote(
  previous: VoteSnap | null | undefined,
  incoming: VoteSnap | null | undefined,
): VoteSnap;

export function applyRemoteVote(
  previous: VoteSnap | null | undefined,
  incoming: VoteSnap | null | undefined,
  pending: VotePending | null | undefined,
): { state: VoteSnap; pending: VotePending | null };

export function stateFromPresent(opts: {
  day?: string;
  present?: Record<string, string> | null;
  ownRec?: VoteRecord | null;
  uid?: string | null;
  revealed?: boolean;
}): VoteSnap;

export function inkMineForCanteen(
  mine: VoteMine | null | undefined,
  canteen: string,
): VoteMine;

export function inkMineForEgal(mine: VoteMine | null | undefined): VoteMine;

export function inkVote(opts: {
  state: VoteSnap;
  mine: VoteMine | null | undefined;
  nick: string;
  uid?: string | null;
  paint: (state: VoteSnap, pending: VotePending | null) => void;
  write: () => Promise<VoteMine> | VoteMine;
}): Promise<{ saved: VoteMine }>;

export function paintVoteBoard(
  root: ParentNode,
  votes: VoteSnap | null | undefined,
  opts: {
    open: boolean;
    show: boolean;
    showMarket: boolean;
    reveal: boolean;
    result?: { status?: string; id?: string; name?: string } | null;
  },
): void;
