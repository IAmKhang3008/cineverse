import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { collection, doc, deleteDoc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';

interface FavoritesContextType {
  favorites: any[];
  addFavorite: (movie: any) => Promise<void>;
  removeFavorite: (idOrSlug: string) => Promise<void>;
  isFavorite: (idOrSlug: string) => boolean;
  toggleFavorite: (movie: any) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'favorites'), orderBy('addedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const favs = snapshot.docs.map(d => d.data());
      setFavorites(favs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/favorites`);
    });

    return () => unsubscribe();
  }, [user]);

  const addFavorite = useCallback(async (movie: any) => {
    if (!user || !movie) return;
    const favId = movie._id || movie.slug;
    if (!favId) return;

    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', String(favId));
      await setDoc(favRef, {
        movieId: String(favId),
        name: movie.name || movie.origin_name || '',
        poster_url: movie.poster_url || movie.thumb_url || '',
        addedAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/favorites/${favId}`);
    }
  }, [user]);

  const removeFavorite = useCallback(async (idOrSlug: string) => {
    if (!user || !idOrSlug) return;
    
    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', String(idOrSlug));
      await deleteDoc(favRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/favorites/${idOrSlug}`);
    }
  }, [user]);

  const isFavorite = useCallback((idOrSlug: string): boolean => {
    if (!idOrSlug) return false;
    return !!favorites.find(m => String(m.movieId) === String(idOrSlug) || String(m.slug) === String(idOrSlug) || String(m._id) === String(idOrSlug));
  }, [favorites]);

  const toggleFavorite = useCallback((movie: any): boolean => {
    if (!movie) return false;
    const favId = movie._id || movie.slug;
    if (!favId) return false;

    // Chưa đăng nhập → trả về false để component hiển thị toast
    if (!user) return false;

    if (isFavorite(favId)) {
      removeFavorite(favId);
    } else {
      addFavorite(movie);
    }
    return true;
  }, [isFavorite, addFavorite, removeFavorite, user]);

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