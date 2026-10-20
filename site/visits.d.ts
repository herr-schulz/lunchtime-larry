export const COUNT_ORIGIN: string;
export function countPathFor(page: string): string;
export function countPixelUrl(path: string, rnd?: number): string;
export function totalCountUrl(): string;
export function counterUrl(path: string, start?: string): string;
export function countDigits(count: string | number | null | undefined): number | null;
export function aufrufWord(count: string | number): string;
export function readCountAt(
  url: string,
  fetchImpl?: (
    input: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; json: () => Promise<{ count?: unknown }> }>,
): Promise<string>;
export function readLocalAufrufe(
  fetchImpl?: (input: string, init?: RequestInit) => Promise<{ json: () => Promise<Record<string, unknown>> }>,
): Promise<Record<string, unknown>>;
export function readTotalCount(
  fetchImpl?: (
    input: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; json: () => Promise<{ count?: unknown }> }>,
): Promise<string>;
export function mountVisits(root?: ParentNode): void;
