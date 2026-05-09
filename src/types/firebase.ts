/**
 * types/firebase.ts
 * Định nghĩa toàn bộ kiểu dữ liệu cho Firestore collections của Cineverse.
 *
 * Cấu trúc Firestore:
 *   users/{uid}                    → UserSettings
 *   users/{uid}/favorites/{movieId} → FavoriteItem
 *   users/{uid}/history/{movieId}   → HistoryItem
 *   users/{uid}/comments/{commentId} → CommentItem (nếu dùng sau)
 */

// ============================================================
// users/{uid}
// ============================================================
export interface UserSettings {
  /** Tên hiển thị của user */
  displayName?:    string;
  /** Email đăng nhập */
  email?:          string;
  /** Giao diện: 'dark' | 'light' */
  theme?:          'dark' | 'light';
  /** Cài đặt thông báo */
  notifications?:  NotificationSettings;
  /** Đánh dấu đã migrate localStorage → Firestore */
  migrated?:       boolean;
  /** URL avatar (từ Google hoặc tự upload) */
  avatarUrl?:      string;
  /** Timestamp tạo tài khoản (ms) */
  createdAt?:      number;
  /** Timestamp cập nhật gần nhất (ms) */
  updatedAt?:      number;
}

export interface NotificationSettings {
  email?: boolean;
  push?:  boolean;
}

// ============================================================
// users/{uid}/favorites/{movieId}
// ============================================================
export interface FavoriteItem {
  /** ID phim (từ phimapi._id hoặc slug) */
  movieId:    string;
  /** Tên phim tiếng Việt */
  name:       string;
  /** URL poster */
  poster_url: string;
  /** Timestamp thêm vào (ms) */
  addedAt:    number;
  /** Slug để navigate đến trang Detail */
  slug?:      string;
  /** Năm phát hành */
  year?:      string | number;
  /** Chất lượng (HD, FHD...) */
  quality?:   string;
}

// ============================================================
// users/{uid}/history/{movieId}
// ============================================================
export interface HistoryItem {
  /** ID phim */
  movieId:    string;
  /** Tên phim */
  name:       string;
  /** URL poster */
  poster_url: string;
  /** Timestamp xem gần nhất (ms) */
  timestamp:  number;
  /** Tiến trình xem (0–100) */
  progress:   number;
  /** Tập đang xem (với phim bộ) */
  episode?:   string;
  /** Slug để navigate */
  slug?:      string;
}

// ============================================================
// users/{uid}/comments/{commentId}  — dùng khi tích hợp comments
// ============================================================
export interface CommentItem {
  commentId:  string;
  movieId:    string;
  movieName:  string;
  text:       string;
  authorId:   string;
  authorName: string;
  authorAvatar?: string;
  createdAt:  number;
  likes?:     number;
}