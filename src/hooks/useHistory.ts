import { useState, useEffect } from 'react';
import { collection, doc, deleteDoc, setDoc, onSnapshot, query, orderBy, limit, writeBatch, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function useHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'history'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hist = snapshot.docs.map(d => {
        const data = d.data();
        return { 
          ...data,
          // Extract timestamp as ms for components that expect a number
          timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now(), 
          slug: d.id // Ensure backward compatibility with existing components looking for slug if any
        };
      });
      setHistory(hist);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/history`);
      showToast("Lỗi khi tải lịch sử xem", "error");
    });

    return () => unsubscribe();
  }, [user, showToast]);

  const addToHistory = async (movie: any, episodeName: string = '', progress: number = 0) => {
    if (!user || !movie) {
      console.warn("Không thể lưu lịch sử vì chưa đăng nhập");
      return;
    }
    const movieId = String(movie._id || movie.slug);
    if (!movieId) return;

    try {
      // Find existing history document with this movieId
      const q = query(collection(db, 'users', user.uid, 'history'), where('movieId', '==', movieId));
      const querySnapshot = await getDocs(q);
      
      let histRef;
      if (!querySnapshot.empty) {
        // Document exists, we will update it
        histRef = querySnapshot.docs[0].ref;
      } else {
        // Create new document with auto-id
        histRef = doc(collection(db, 'users', user.uid, 'history'));
      }

      await setDoc(histRef, {
        movieId,
        name: movie.name || movie.origin_name || '',
        poster_url: movie.poster_url || movie.thumb_url || '',
        currentEpisode: episodeName, // keeping old fields for compat
        progress,
        timestamp: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/history (auto-id)`);
      showToast("Lỗi khi lưu lịch sử xem", "error");
    }
  };

  const removeFromHistory = async (idOrSlug: string) => {
    if (!user || !idOrSlug) return;
    try {
      // idOrSlug can be the document ID (from history state mapped as `slug: d.id`)
      const histRef = doc(db, 'users', user.uid, 'history', String(idOrSlug));
      await deleteDoc(histRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/history/${idOrSlug}`);
      showToast("Lỗi khi xoá lịch sử", "error");
    }
  };

  const clearHistory = async () => {
    if (!user || history.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      // We mapped the document ID to `slug` on read
      history.forEach(item => {
        const histId = item.slug;
        if (histId) {
          const histRef = doc(db, 'users', user.uid, 'history', String(histId));
          batch.delete(histRef);
        }
      });
      await batch.commit();
      showToast("Đã xoá toàn bộ lịch sử", "success");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/history`);
      showToast("Lỗi khi xoá toàn bộ lịch sử", "error");
    }
  };

  return { history, addToHistory, removeFromHistory, clearHistory };
}
