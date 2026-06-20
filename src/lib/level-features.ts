// level-features.ts — PHP level-features.php converted to TypeScript
// Level-based feature unlocks and shop catalog

import type { LevelFeatures, ShopItem } from './types';

// Level-based feature gates
export const LEVEL_FEATURES: Record<number, LevelFeatures> = {
  1: {
    avatar_change: false,
    banner_change: false,
    shop_nicknames: false,
    shop_badges: false,
    username_effect: 'none',
    avatar_frame: 'none',
  },
  2: {
    avatar_change: true,
    banner_change: false,
    shop_nicknames: false,
    shop_badges: false,
    username_effect: 'none',
    avatar_frame: 'silver',
  },
  3: {
    avatar_change: true,
    banner_change: true,
    shop_nicknames: false,
    shop_badges: false,
    username_effect: 'gold',
    avatar_frame: 'silver',
  },
  4: {
    avatar_change: true,
    banner_change: true,
    shop_nicknames: true,
    shop_badges: false,
    username_effect: 'gold',
    avatar_frame: 'gold',
  },
  5: {
    avatar_change: true,
    banner_change: true,
    shop_nicknames: true,
    shop_badges: true,
    username_effect: 'gold',
    avatar_frame: 'gold',
  },
  6: {
    avatar_change: true,
    banner_change: true,
    shop_nicknames: true,
    shop_badges: true,
    username_effect: 'rgb',
    avatar_frame: 'rainbow',
  },
};

/** Returns all cumulative features for a given level. */
export function getFeaturesForLevel(level: number): LevelFeatures {
  let result: LevelFeatures = { ...LEVEL_FEATURES[1] };
  for (let l = 2; l <= Math.min(level, 6); l++) {
    if (LEVEL_FEATURES[l]) {
      result = { ...result, ...LEVEL_FEATURES[l] };
    }
  }
  return result;
}

/** Checks whether a feature is unlocked at a given level. */
export function isFeatureUnlocked(level: number, featureKey: keyof LevelFeatures): boolean {
  const features = getFeaturesForLevel(level);
  return !!features[featureKey];
}

// Shop catalog
export const SHOP_CATALOG: ShopItem[] = [
  // Nicknames
  { id: 'nick_steven_lion', type: 'nickname', cost_xp: 150, min_level: 4, name: "Steven's Lion", desc: "From the Steven Universe universe — protective and loyal.", icon: '🦁', color: '#ff6b9d' },
  { id: 'nick_fin_dost', type: 'nickname', cost_xp: 150, min_level: 4, name: "Finn's Loyal Friend", desc: "Adventure Time — a loyal companion like Jake.", icon: '🐶', color: '#fbbf24' },
  { id: 'nick_gumball', type: 'nickname', cost_xp: 200, min_level: 4, name: "Gumball Watterson", desc: "Elmore's craziest blue cat.", icon: '🐱', color: '#3b82f6' },
  { id: 'nick_mordecai', type: 'nickname', cost_xp: 220, min_level: 4, name: "Mordecai & Rigby", desc: "Regular Show — the park's mischievous duo.", icon: '🐦', color: '#06b6d4' },
  { id: 'nick_phineas', type: 'nickname', cost_xp: 280, min_level: 5, name: "Phineas' Inventor", desc: "The kid who made the most of summer vacation.", icon: '🔧', color: '#f97316' },
  { id: 'nick_dipper', type: 'nickname', cost_xp: 320, min_level: 5, name: "Dipper's Assistant", desc: "Young detective solving Gravity Falls mysteries.", icon: '🔍', color: '#8b5cf6' },
  { id: 'nick_avatar', type: 'nickname', cost_xp: 500, min_level: 5, name: "Avatar's Successor", desc: "Legendary warrior balancing the four elements.", icon: '🌀', color: '#10b981' },
  { id: 'nick_legend', type: 'nickname', cost_xp: 800, min_level: 6, name: "Cartoon Legend", desc: "The highest-tier nickname — only for true masters.", icon: '👑', color: '#f59e0b' },
  // Badges
  { id: 'badge_hunter', type: 'badge', cost_xp: 200, min_level: 5, name: "Cartoon Hunter", desc: "For explorers who clicked on 10 different series.", icon: '🎯', color: '#ef4444' },
  { id: 'badge_binge', type: 'badge', cost_xp: 350, min_level: 5, name: "Episode Devourer", desc: "For viewers who finished 5 episodes completely.", icon: '📺', color: '#3b82f6' },
  { id: 'badge_season', type: 'badge', cost_xp: 600, min_level: 5, name: "Season King", desc: "For loyal viewers who finished a full season.", icon: '👑', color: '#f59e0b' },
  { id: 'badge_collector', type: 'badge', cost_xp: 400, min_level: 5, name: "List Collector", desc: "For planners who added 10+ series to their list.", icon: '📚', color: '#8b5cf6' },
  { id: 'badge_master', type: 'badge', cost_xp: 750, min_level: 5, name: "Cartoon Master", desc: "For legendary viewers who watched 50+ episodes.", icon: '⚡', color: '#06b6d4' },
  { id: 'badge_legend', type: 'badge', cost_xp: 1500, min_level: 6, name: "MegaXtoon Legend", desc: "Only for elite viewers who reached Level 6.", icon: '🏆', color: '#fbbf24' },
];

/** Returns the full catalog. */
export function getShopCatalog(): ShopItem[] {
  return SHOP_CATALOG;
}

/** Finds a specific item by ID. */
export function getShopItem(itemId: string): ShopItem | null {
  return SHOP_CATALOG.find(item => item.id === itemId) ?? null;
}

export const XP_REWARDS = { click: 5, middle: 10, finish: 20, watchlist: 15 };
export const LEVEL_THRESHOLDS: Record<number, number> = { 1: 0, 2: 200, 3: 600, 4: 1400, 5: 3000, 6: 6200 };
