// Types from PHP config.php — MegaXtoon series platform

export interface Series {
  id?: string;
  slug: string;
  name: string;
  poster_url: string;
  rating: string;
  year: string;
  seasons: string;
  genre: string;
  description?: string;
  playlist_id?: string;
}

export interface Episode {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  position: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface UserCustomization {
  custom_avatar: string;
  custom_banner: string;
  active_nickname: string;
  equipped_badge: string;
}

export interface ShopItem {
  id: string;
  type: 'nickname' | 'badge';
  name: string;
  desc: string;
  cost_xp: number;
  min_level: number;
  icon: string;
  color: string;
}

export interface LevelFeatures {
  avatar_change: boolean;
  banner_change: boolean;
  shop_nicknames: boolean;
  shop_badges: boolean;
  username_effect: string;
  avatar_frame: string;
}

export interface XpStats {
  level: number;
  total_xp: number;
  level_xp: number;
  level_needed: number;
  progress_pct: number;
  level_title: string;
  history: XpHistoryEntry[];
  started_count: number;
  finished_count: number;
  watchlist_count: number;
  middle_count: number;
}

export interface XpHistoryEntry {
  event: 'start' | 'finish' | 'middle';
  slug: string;
  xp: number;
  ts: string;
}

export interface WatchlistEntry {
  id?: string;
  slug: string;
  name: string;
  poster_url: string;
  rating: string;
  year: string;
  seasons: string;
  genre: string;
  url: string;
}

export interface WatchHistoryEntry extends WatchlistEntry {
  watchedAt: number;
}

export type PageView = 'home' | 'login' | 'player' | 'series' | 'profile';
