export type LocationSpot = {
  name: string;
  vibe: string;
  note: string;
  where: string;
  when: string;
  walk: number;
  tags: string[];
  url: string;
};

export const LOCATIONS: LocationSpot[];

export function berlinWeekdayKey(now?: Date): string;
export function isLikelyOpenToday(when: string, weekdayKey?: string): boolean;
