import React, { createContext, useContext, useState, useEffect } from 'react';

interface FavoritesContextType {
  favorites: any[];
  addFavorite: (movie: any) => void;
  removeFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (movie: any) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      setFavorites(prev => [...prev, movie]);
    }
  };

  const removeFavorite = (slug: string) => {
    if (!slug) return;
    setFavorites(prev => prev.filter(m => m?.slug !== slug));
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

  return (
    <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavoritesContext = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavoritesContext must be used within a FavoritesProvider');
  }
  return context;
};
