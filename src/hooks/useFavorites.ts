import { useState, useEffect } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<any[]>(() => {
    const saved = localStorage.getItem('cineverse_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cineverse_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = (movie: any) => {
    if (!movie?.slug) return;
    if (!favorites.find(m => m?.slug === movie.slug)) {
      setFavorites([...favorites, movie]);
    }
  };

  const removeFavorite = (slug: string) => {
    if (!slug) return;
    setFavorites(favorites.filter(m => m?.slug !== slug));
  };

  const isFavorite = (slug: string) => {
    if (!slug) return false;
    return !!favorites.find(m => m?.slug === slug);
  };

  const toggleFavorite = (movie: any) => {
    if (!movie?.slug) return;
    if (isFavorite(movie.slug)) {
      removeFavorite(movie.slug);
    } else {
      addFavorite(movie);
    }
  };

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite };
}
