// store.ts — Zustand store for global state (auth, navigation, watchlist, history)
import { create } from 'zustand';
import type { PageView, User, UserCustomization, WatchlistEntry, WatchHistoryEntry, ShopItem } from './types';
import { SHOP_CATALOG } from './level-features';

// Read from localStorage helpers
function getLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function setLS(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const WL_KEY = 'mx_watchlist';
const HIST_KEY = 'mx_watch_history';
const HIST_MAX = 40;

interface AppState {
  // Navigation
  currentPage: PageView;
  pageParams: Record<string, string>;
  navigate: (page: PageView, params?: Record<string, string>) => void;

  // Auth
  isLoggedIn: boolean;
  currentUser: User | null;
  userCustom: UserCustomization;
  userPurchases: ShopItem[];
  login: (user: User) => void;
  logout: () => void;
  setUserCustom: (custom: Partial<UserCustomization>) => void;
  setPurchases: (purchases: ShopItem[]) => void;

  // Watchlist
  watchlist: WatchlistEntry[];
  loadWatchlist: () => void;
  addToWatchlist: (entry: WatchlistEntry) => void;
  removeFromWatchlist: (id?: string, slug?: string) => void;
  toggleWatchlist: (entry: WatchlistEntry) => boolean;
  isInWatchlist: (id?: string, slug?: string) => boolean;

  // Watch History
  watchHistory: WatchHistoryEntry[];
  loadWatchHistory: () => void;
  recordWatched: (entry: WatchHistoryEntry) => void;
  clearWatchHistory: () => void;

  // Search
  searchQ: string;
  setSearchQ: (q: string) => void;

  // AI Chat
  aiOpen: boolean;
  toggleAi: () => void;

  // Mobile menu
  menuOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentPage: 'home',
  pageParams: {},
  navigate: (page, params = {}) => {
    set({ currentPage: page, pageParams: params });
    window.scrollTo(0, 0);
  },

  // Auth
  isLoggedIn: false,
  currentUser: null,
  userCustom: { custom_avatar: '', custom_banner: '', active_nickname: '', equipped_badge: '' },
  userPurchases: [],
  login: (user) => set({ isLoggedIn: true, currentUser: user }),
  logout: () => set({ isLoggedIn: false, currentUser: null, userCustom: { custom_avatar: '', custom_banner: '', active_nickname: '', equipped_badge: '' }, userPurchases: [], currentPage: 'login' }),
  setUserCustom: (custom) => set((s) => ({ userCustom: { ...s.userCustom, ...custom } })),
  setPurchases: (purchases) => set({ userPurchases: purchases }),

  // Watchlist
  watchlist: [],
  loadWatchlist: () => {
    const raw = getLS<unknown[]>(WL_KEY, []);
    set({ watchlist: raw as WatchlistEntry[] });
  },
  addToWatchlist: (entry) => {
    const list = get().watchlist;
    const key = entry.id || entry.slug;
    if (!key) return;
    const already = list.some(x => (x.id && x.id === entry.id) || (x.slug && x.slug === entry.slug));
    if (already) return;
    const newList = [entry, ...list];
    set({ watchlist: newList });
    setLS(WL_KEY, newList);
  },
  removeFromWatchlist: (id, slug) => {
    let list = get().watchlist;
    list = list.filter(x => {
      if (id && x.id && x.id === id) return false;
      if (slug && x.slug && x.slug === slug) return false;
      return true;
    });
    set({ watchlist: list });
    setLS(WL_KEY, list);
  },
  toggleWatchlist: (entry) => {
    const { watchlist, addToWatchlist, removeFromWatchlist } = get();
    const inList = watchlist.some(x => (entry.id && x.id === entry.id) || (entry.slug && x.slug === entry.slug));
    if (inList) {
      removeFromWatchlist(entry.id, entry.slug);
      return false;
    } else {
      addToWatchlist(entry);
      return true;
    }
  },
  isInWatchlist: (id, slug) => {
    return get().watchlist.some(x => (id && x.id === id) || (slug && x.slug === slug));
  },

  // Watch History
  watchHistory: [],
  loadWatchHistory: () => {
    set({ watchHistory: getLS<WatchHistoryEntry[]>(HIST_KEY, []) });
  },
  recordWatched: (entry) => {
    let list = get().watchHistory;
    list = list.filter(x => !(entry.id && x.id === entry.id) && !(entry.slug && x.slug === entry.slug));
    list.unshift(entry);
    if (list.length > HIST_MAX) list = list.slice(0, HIST_MAX);
    set({ watchHistory: list });
    setLS(HIST_KEY, list);
  },
  clearWatchHistory: () => {
    set({ watchHistory: [] });
    setLS(HIST_KEY, []);
  },

  // Search
  searchQ: '',
  setSearchQ: (q) => set({ searchQ: q }),

  // AI Chat
  aiOpen: false,
  toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),

  // Mobile menu
  menuOpen: false,
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  closeMenu: () => set({ menuOpen: false }),
}));
