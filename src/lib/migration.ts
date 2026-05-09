/**
 * migration.ts
 * Chuyển dữ liệu từ localStorage sang Firestore khi user đăng nhập lần đầu.
 * Dùng Firestore batch write để đảm bảo tính toàn vẹn dữ liệu (all-or-nothing).
 */
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { UserSettings, FavoriteItem, HistoryItem } from '../types/firebase';

export async function migrateLocalData(user: User): Promise<void> {
  const uid         = user.uid;
  const settingsRef = doc(db, 'users', uid);

  try {
    // Kiểm tra xem đã migrate chưa
    const settingsDoc = await getDoc(settingsRef);
    if (settingsDoc.exists() && settingsDoc.data()?.migrated === true) {
      return; // Đã migrate rồi, bỏ qua
    }

    // ============================================================
    // Bước 1: Đọc dữ liệu từ localStorage
    // ============================================================
    const localSettingsRaw  = localStorage.getItem('cineverse_settings');
    const localFavoritesRaw = localStorage.getItem('cineverse_favorites');
    const localHistoryRaw   = localStorage.getItem('cineverse_history');

    // Parse Settings
    let settings: UserSettings = { theme: 'dark' };
    if (localSettingsRaw) {
      try {
        const parsed = JSON.parse(localSettingsRaw);
        settings = {
          displayName: parsed.name    || undefined,
          email:       parsed.email   || undefined,
          theme:       parsed.theme   || 'dark',
          notifications: {
            email: parsed.emailNotifications ?? true,
            push:  parsed.pushNotifications  ?? false,
          },
        };
      } catch {
        // JSON lỗi → giữ default
      }
    }

    // Ưu tiên thông tin từ Google Auth nếu localStorage trống
    if (!settings.displayName && user.displayName) settings.displayName = user.displayName;
    if (!settings.email       && user.email)       settings.email       = user.email;

    // Đánh dấu đã migrate + timestamp
    settings.migrated  = true;
    settings.createdAt = Date.now();
    settings.updatedAt = Date.now();
    if (user.photoURL) settings.avatarUrl = user.photoURL;

    // Parse Favorites
    let favorites: any[] = [];
    if (localFavoritesRaw) {
      try { favorites = JSON.parse(localFavoritesRaw) || []; } catch { /* ignore */ }
    }

    // Parse History
    let history: any[] = [];
    if (localHistoryRaw) {
      try { history = JSON.parse(localHistoryRaw) || []; } catch { /* ignore */ }
    }

    // ============================================================
    // Bước 2: Batch write lên Firestore
    // ============================================================
    const batch = writeBatch(db);

    // Ghi Settings vào users/{uid}
    batch.set(settingsRef, settings, { merge: true });

    // Ghi Favorites vào users/{uid}/favorites/{movieId}
    favorites.forEach((fav, index) => {
      const movieId = fav._id || fav.slug;
      if (!movieId) return; // bỏ qua nếu không có ID

      const favRef  = doc(db, 'users', uid, 'favorites', String(movieId));
      const favData: FavoriteItem = {
        movieId:    String(movieId),
        name:       fav.name       || fav.origin_name || '',
        poster_url: fav.poster_url || fav.thumb_url   || '',
        addedAt:    Date.now() - index * 1000, // giữ thứ tự tương đối
        slug:       fav.slug       || '',
        year:       fav.year       || '',
        quality:    fav.quality    || '',
      };
      batch.set(favRef, favData);
    });

    // Ghi History vào users/{uid}/history/{movieId}
    history.forEach((histItem, index) => {
      // History có thể lưu dạng { movie: {...}, ... } hoặc flat
      const movie   = histItem.movie || histItem;
      const movieId = movie._id || movie.slug || histItem.id;
      if (!movieId) return;

      const histRef  = doc(db, 'users', uid, 'history', String(movieId));
      const histData: HistoryItem = {
        movieId:    String(movieId),
        name:       movie.name       || movie.origin_name || '',
        poster_url: movie.poster_url || movie.thumb_url   || '',
        timestamp:  histItem.timestamp || Date.now() - index * 1000,
        progress:   histItem.progress  || 0,
        episode:    histItem.currentEpisode || histItem.episode || '',
        slug:       movie.slug || '',
      };
      batch.set(histRef, histData);
    });

    await batch.commit();

    // ============================================================
    // Bước 3: Dọn localStorage sau khi migrate thành công
    // ============================================================
    localStorage.removeItem('cineverse_settings');
    localStorage.removeItem('cineverse_favorites');
    localStorage.removeItem('cineverse_history');

    console.info(
      `[Migration] Thành công cho user ${uid}:`,
      `${favorites.length} yêu thích,`,
      `${history.length} lịch sử xem`
    );
  } catch (error) {
    // handleFirestoreError sẽ log chi tiết và re-throw
    // AuthContext.tsx đã catch lỗi này và xử lý non-fatal
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}