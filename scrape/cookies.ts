/**
 * Cookie-banner handling for the Playwright scrape.
 *
 * To cover a new CMP later: add a phrase to COOKIE_ESSENTIAL_RE /
 * COOKIE_ACCEPT_ALL_RE, or a CSS id to COOKIE_KNOWN_SELECTORS.
 * Settings/customize buttons are never clicked.
 */

export const COOKIE_SETTINGS_RE =
  /einstellung|settings?|customize|pr[aä]ferenz|manage|mehr erfahren|cookie.?policy/i;

export const COOKIE_ESSENTIAL_RE =
  /essenziell|essentiell|essential|necessary|notwendig|reject all|ablehnen|nur notwendige|decline|refuse|reject/i;

export const COOKIE_ACCEPT_ALL_RE =
  /alle cookies akzeptieren|accept all|allen zustimmen|alle akzeptieren|allow all|accept cookies/i;

/** Lone “OK / Akzeptieren” — last resort, never settings. */
export const COOKIE_ACCEPT_RE =
  /^(akzeptieren|accept|agree|einverstanden|zustimmen|ok|okay|verstanden|got it)$/i;

/** Overlay locator for Playwright addLocatorHandler — always use `.first()`.
 * OneTrust paints banner + SDK + both buttons at once; strict mode then throws. */
export const COOKIE_OVERLAY_LOCATOR = [
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  "#CybotCookiebotDialog",
  "#usercentrics-root",
  "[id='usercentrics-root']",
  "button:has-text('Essentielle Cookies')",
  "button:has-text('Alle Cookies akzeptieren')",
  "button:has-text('Accept All')",
  "button:has-text('Accept all')",
  "button:has-text('Reject All')",
  "button:has-text('Reject all')",
  "button:has-text('Nur notwendige')",
  "button:has-text('Nur essenzielle')",
  "a:has-text('Essentielle Cookies')",
  "a:has-text('Alle Cookies akzeptieren')",
].join(", ");

/** Click these first (reject / essential before accept-all). */
export const COOKIE_KNOWN_SELECTORS = [
  "#onetrust-reject-all-handler",
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyButtonDecline",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
];

export type CookieRank = 1 | 2 | 3;

export function normalizeCookieLabel(label: string): string {
  return String(label).replace(/\s+/g, " ").trim();
}

/** Lower is better. Undefined = do not click. */
export function cookieButtonRank(label: string): CookieRank | undefined {
  const text = normalizeCookieLabel(label);
  if (!text || COOKIE_SETTINGS_RE.test(text)) return undefined;
  if (COOKIE_ESSENTIAL_RE.test(text)) return 1;
  if (COOKIE_ACCEPT_ALL_RE.test(text)) return 2;
  if (COOKIE_ACCEPT_RE.test(text)) return 3;
  return undefined;
}

export function pickCookieButton<T extends { label: string }>(
  buttons: T[],
): T | undefined {
  let best: T | undefined;
  let bestRank = Infinity;
  for (const button of buttons) {
    const rank = cookieButtonRank(button.label);
    if (rank === undefined || rank >= bestRank) continue;
    best = button;
    bestRank = rank;
  }
  return best;
}

export function cookieLabelsFromDocument(root: ParentNode): string[] {
  const nodes = root.querySelectorAll(
    "button, [role='button'], input[type='button'], input[type='submit']",
  );
  const labels: string[] = [];
  for (const node of nodes) {
    const el = node as HTMLElement & { value?: string };
    const label = normalizeCookieLabel(el.textContent || el.value || "");
    if (label) labels.push(label);
  }
  return labels;
}
