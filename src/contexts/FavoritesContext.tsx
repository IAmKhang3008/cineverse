import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface FavoritesContextType {
  favorites: any[];
  addFavorite: (movie: any) => void;
  removeFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (movie: any) => boolean; // trả về true nếu thực hiện được, false nếu chưa đăng nhập
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Kiểm tra user đã đăng nhập chưa — dùng cùng key với Header/Settings
const isLoggedIn = (): boolean => {
  return !!localStorage.getItem('cineverse_settings');
};

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favorites, setFavorites] = useState<any[]>(() => {
    const saved = localStorage.getItem('cineverse_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cineverse_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = useCallback((movie: any) => {
    if (!movie?.slug) return;
    setFavorites(prev =>
      prev.find(m => m?.slug === movie.slug) ? prev : [...prev, movie]
    );
  }, []);

  const removeFavorite = useCallback((slug: string) => {
    if (!slug) return;
    setFavorites(prev => prev.filter(m => m?.slug !== slug));
  }, []);

  const isFavorite = useCallback((slug: string): boolean => {
    if (!slug) return false;
    return !!favorites.find(m => m?.slug === slug);
  }, [favorites]);

  const toggleFavorite = useCallback((movie: any): boolean => {
    if (!movie?.slug) return false;

    // Chưa đăng nhập → trả về false để component hiển thị toast
    if (!isLoggedIn()) return false;

    if (isFavorite(movie.slug)) {
      removeFavorite(movie.slug);
    } else {
      addFavorite(movie);
    }
    return true;
  }, [isFavorite, addFavorite, removeFavorite]);

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