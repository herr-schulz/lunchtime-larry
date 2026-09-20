export function ghostLine(seed: string): string;
export function formatDishName(name: string, canteenId?: string): string;
export function dishRow(
  dish: { name: string; diet?: string; category?: string; price?: string },
  index: number,
  likes: Set<string>,
  canteenId?: string,
): string;

export function boardHtml(opts: {
  block:
    | {
        canteens?: Array<{
          id: string;
          dishes?: Array<{
            name: string;
            diet?: string;
            category?: string;
            price?: string;
          }>;
        }>;
      }
    | null
    | undefined;
  canteens: Record<string, { name: string; short: string; url: string }>;
  sources?: Record<string, { status?: string }> | null;
  likes: Set<string>;
  votingOpen: boolean;
  weekStale?: boolean;
}): string;

export function placeAt(
  ids: string[] | null | undefined,
  canteens: Record<string, { name: string }> | null | undefined,
): string;

export function hitsHtml(opts: {
  items: Array<{
    key?: string;
    label: string;
    name?: string;
    canteen?: string;
    places?: string[];
  }>;
  saved?: Array<{
    key?: string;
    name?: string;
    label: string;
    places?: string[];
    onWeek?: boolean;
  }>;
  sheetOpen?: boolean;
  canteens: Record<string, { name: string }> | null | undefined;
  weekStale?: boolean;
  staleNote?: { kicker?: string; line?: string } | null;
}): string;
