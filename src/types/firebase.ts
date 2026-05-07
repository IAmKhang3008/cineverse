export interface UserSettings {
  displayName?: string;
  email?: string;
  theme?: string;
  notifications?: boolean;
  migrated?: boolean;
}

export interface FavoriteItem {
  movieId: string;
  name: string;
  poster_url: string;
  addedAt: number; // timestamp
}

export interface HistoryItem {
  movieId: string;
  name: string;
  poster_url: string;
  timestamp: number;
  progress?: number;
}
