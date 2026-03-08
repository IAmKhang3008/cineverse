import { useFavoritesContext } from '@/contexts/FavoritesContext';

export function useFavorites() {
  return useFavoritesContext();
}
