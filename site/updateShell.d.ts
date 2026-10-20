export const SHELL_BUILD: string;
export function cacheNameFor(build: string): string;
export function remoteBuildFrom(payload: unknown): string;
export function isStaleShell(localBuild: string, remoteBuild: string): boolean;
export function shouldBypassCache(pathname: string): boolean;
export function staleShellCopy(): { kicker: string; line: string; action: string };
export function reloadFresh(): Promise<void>;
