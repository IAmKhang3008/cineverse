import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { UserSettings, FavoriteItem, HistoryItem } from '../types/firebase';

export async function migrateLocalData(user: User): Promise<void> {
  const uid = user.uid;
  const settingsRef = doc(db, 'users', uid);

  try {
    const settingsDoc = await getDoc(settingsRef);

    if (settingsDoc.exists() && settingsDoc.data().migrated) {
      // Already migrated
      return;
    }

    // Step 1: Read local storage data
    const localSettingsData = localStorage.getItem('cineverse_settings');
    const localFavoritesData = localStorage.getItem('cineverse_favorites');
    const localHistoryData = localStorage.getItem('cineverse_history');

    let settings: UserSettings = {};
    if (localSettingsData) {
      try {
        const parsed = JSON.parse(localSettingsData);
        settings = {
          displayName: parsed.name,
          email: parsed.email,
          theme: parsed.theme || 'dark',
          notifications: parsed.notifications,
        };
      } catch (e) {}
    } else {
        settings = {
            theme: 'dark'
        }
    }

    // Always preserve original display name/email from Google Auth if empty locally
    if (!settings.displayName && user.displayName) settings.displayName = user.displayName;
    if (!settings.email && user.email) settings.email = user.email;
    settings.migrated = true;

    let favorites: any[] = [];
    if (localFavoritesData) {
      try {
        favorites = JSON.parse(localFavoritesData) || [];
      } catch (e) {}
    }

    let history: any[] = [];
    if (localHistoryData) {
      try {
        history = JSON.parse(localHistoryData) || [];
      } catch (e) {}
    }

    // Step 2: Batch write
    const batch = writeBatch(db);

    // Save Settings (users collection)
    batch.set(settingsRef, settings, { merge: true });

    // Save Favorites
    favorites.forEach((fav, index) => {
      const favId = fav._id || fav.slug;
      if (favId) {
        const favRef = doc(db, 'users', uid, 'favorites', String(favId));
        batch.set(favRef, {
          movieId: String(favId),
          name: fav.name || fav.origin_name || '',
          poster_url: fav.poster_url || fav.thumb_url || '',
          addedAt: Date.now() - index * 1000, // keep roughly the same order conceptually
        } as FavoriteItem);
      }
    });

    // Save History
    history.forEach((histItem, index) => {
      const histId = histItem.movie?._id || histItem.movie?.slug || histItem.id;
      if (histId) {
        const histRef = doc(db, 'users', uid, 'history', String(histId));
        batch.set(histRef, {
          movieId: String(histId),
          name: histItem.movie?.name || histItem.movie?.origin_name || '',
          poster_url: histItem.movie?.poster_url || histItem.movie?.thumb_url || '',
          timestamp: Date.now() - index * 1000,
          progress: histItem.progress || 0,
        } as HistoryItem);
      }
    });

    await batch.commit();

    // Step 3: Remove local storage
    localStorage.removeItem('cineverse_settings');
    localStorage.removeItem('cineverse_favorites');
    localStorage.removeItem('cineverse_history');

    console.log("Migration successful");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}
