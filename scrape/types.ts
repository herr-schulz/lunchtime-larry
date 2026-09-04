import canteenData from "../site/canteens.json" with { type: "json" };

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type Diet = "vegan" | "veggie" | "meat" | "fish" | "unknown";
export type SourceStatus = "ok" | "error" | "stale";

export const CANTEENS = canteenData;
export type CanteenId = keyof typeof CANTEENS;

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

export const USER_AGENT =
  "LunchtimeLarry/1.0 (+https://github.com/herr-schulz/lunchtime-larry)";
