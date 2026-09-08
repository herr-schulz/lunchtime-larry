export function displayDishName(name: string): string;
export function joinDishSides(sides: string[]): string;
export function phraseDish(name: string): {
  title: string;
  sides: string[];
  spoken: string;
};
export function dishKey(name: string): string;
export function dishLabel(name: string): string;
export function alarmLabel(name: string): string;
export function isLiked(name: string, likes: Set<string>): boolean;
export function toggleLikeSet(name: string, likes: Iterable<string>): Set<string>;
export function findLikedDishes(
  dayBlock:
    | {
        canteens?: Array<{
          id?: string;
          dishes?: Array<{ name: string }>;
        }>;
      }
    | null
    | undefined,
  likes: Set<string>,
): Array<{
  key: string;
  name: string;
  label: string;
  canteen?: string;
  places: string[];
}>;
export function parkedFavorites(
  saved: Array<{
    key?: string;
    name?: string;
    label?: string;
    places?: string[];
    onWeek?: boolean;
  }>,
  found: Array<{ key?: string; name?: string }>,
): Array<{
  key?: string;
  name?: string;
  label?: string;
  places?: string[];
  onWeek?: boolean;
}>;
export function listAllFavorites(
  likes: Set<string>,
  days:
    | Record<
        string,
        {
          canteens?: Array<{
            id?: string;
            dishes?: Array<{ name: string }>;
          }>;
        }
      >
    | null
    | undefined,
  todayDay: string,
): Array<{
  key: string;
  name: string;
  label: string;
  places: string[];
  onWeek: boolean;
}>;
