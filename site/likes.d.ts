export function displayDishName(name: string): string;
export function dishKey(name: string): string;
export function dishLabel(name: string): string;
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
): Array<{ key: string; name: string; label: string }>;
