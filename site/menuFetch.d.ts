export function pickFreshestMenu(menus: unknown[]): {
  weekStart: string;
  scrapedAt?: string;
} | undefined;

export function loadMenu(): Promise<{
  weekStart: string;
  scrapedAt?: string;
}>;
