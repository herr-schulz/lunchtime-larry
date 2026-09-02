export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type Diet = "vegan" | "veggie" | "meat" | "fish" | "unknown";
export type CanteenId = "stmuv" | "sodexo" | "bella23";
export type SourceStatus = "ok" | "error" | "stale";

export interface Dish {
  name: string;
  price?: string;
  diet: Diet;
  category?: string;
}

export interface CanteenDay {
  id: CanteenId;
  dishes: Dish[];
}

export interface SourceMeta {
  status: SourceStatus;
  error?: string;
  scrapedAt?: string;
}

export interface DayMenu {
  date: string;
  canteens: CanteenDay[];
}

export interface MenuData {
  weekStart: string;
  scrapedAt: string;
  lastSuccessAt?: string;
  sources: Record<CanteenId, SourceMeta>;
  days: Record<Weekday, DayMenu>;
}

export const CANTEENS: Record<
  CanteenId,
  { name: string; short: string; url: string }
> = {
  stmuv: {
    name: "StMUV",
    short: "Umweltministerium",
    url: "https://www.stmuv.bayern.de/speiseplan/",
  },
  sodexo: {
    name: "Dave B",
    short: "Arabeska",
    url: "https://de.everyday.sodexo.com/menu/Arabeska/Restaurant%20Speiseplan%20Arabeska%20M%C3%BCnchen",
  },
  bella23: {
    name: "Bella 23",
    short: "Burda",
    url: "https://www.bella23.de/#wochenkarte",
  },
};

export const USER_AGENT =
  "LunchtimeLarry/1.0 (+https://github.com/herr-schulz/lunchtime-larry)";
