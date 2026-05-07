import { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, setDoc, onSnapshot, query, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'history'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hist = snapshot.docs.map(d => ({ ...d.data(), slug: d.id })); // Ensure backward compatibility with existing components looking for slug if any
      setHistory(hist);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/history`);
    });

    return () => unsubscribe();
  }, [user]);

  const addToHistory = async (movie: any, episodeName: string = '', progress: number = 0) => {
    if (!user || !movie) return;
    const histId = movie._id || movie.slug;
    if (!histId) return;

    try {
      const histRef = doc(db, 'users', user.uid, 'history', String(histId));
      await setDoc(histRef, {
        movieId: String(histId),
        name: movie.name || movie.origin_name || '',
        poster_url: movie.poster_url || movie.thumb_url || '',
        currentEpisode: episodeName, // keeping old fields for compat
        progress,
        timestamp: Date.now()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/history/${histId}`);
    }
  };

  const removeFromHistory = async (idOrSlug: string) => {
    if (!user || !idOrSlug) return;
    try {
      const histRef = doc(db, 'users', user.uid, 'history', String(idOrSlug));
      await deleteDoc(histRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/history/${idOrSlug}`);
    }
  };

  const clearHistory = async () => {
    if (!user || history.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      history.forEach(item => {
        const histId = item.movieId || item.slug;
        if (histId) {
          const histRef = doc(db, 'users', user.uid, 'history', String(histId));
          batch.delete(histRef);
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/history`);
    }
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
}
