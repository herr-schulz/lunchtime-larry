export function isDevHost(hostname?: string): boolean;
export function readDevQuery(search?: string): string | null;
export function berlinAt(hour: number, minute: number, base?: Date): Date;

export type DemoVoteMode = "lead" | "tie";

export function demoVotes(mode?: DemoVoteMode): {
  counts: Record<string, number>;
  records: Record<string, { nick: string; canteen: string; at: number }>;
  mine: string;
};

export function mountDevPreview(api: {
  run: (phase: "open" | "locked" | "reveal" | null, mode?: DemoVoteMode) => void;
  phaseLabel: () => string;
}): HTMLElement | null;
