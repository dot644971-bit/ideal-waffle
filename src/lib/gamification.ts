// gamification.ts — PHP gamification.php converted to TypeScript
// XP engine — all calculations preserved exactly

export const XP_BASE_LEVEL = 200;
export const XP_PER_ACTION = 20;

/** XP required to advance from one level to the next. */
export function xpForNextLevel(lv: number): number {
  return Math.floor(XP_BASE_LEVEL * Math.pow(2, Math.max(1, lv) - 1));
}

/** Compute level from total XP. */
export function xpLevelFromTotal(xp: number): number {
  let lv = 1;
  while (lv < 9999) {
    const n = xpForNextLevel(lv);
    if (xp < n) break;
    xp -= n;
    lv++;
  }
  return lv;
}

/** XP accumulated within the current level. */
export function xpInCurrentLevel(xp: number): number {
  let lv = 1;
  while (lv < 9999) {
    const n = xpForNextLevel(lv);
    if (xp < n) break;
    xp -= n;
    lv++;
  }
  return xp;
}

/** Level title. Identical to JS. */
export function xpLevelTitle(lv: number): string {
  const titles = [
    'Rookie',           // L1
    'Apprentice',       // L2
    'Binge Watcher',    // L3
    'Series Hunter',    // L4
    'Cartoon Master',   // L5
    'MegaXtoon Legend'  // L6+
  ];
  const idx = Math.min(Math.max(1, lv), titles.length) - 1;
  return titles[idx];
}

/** Empty (default) stats — for profile's first render. */
export function xpGetStats(): import('./types').XpStats {
  const lv = 1;
  const tx = 0;
  const lxp = 0;
  const ln = xpForNextLevel(lv);
  const pct = 0;
  return {
    level: lv,
    total_xp: tx,
    level_xp: lxp,
    level_needed: ln,
    progress_pct: pct,
    level_title: xpLevelTitle(lv),
    history: [],
    started_count: 0,
    finished_count: 0,
    watchlist_count: 0,
    middle_count: 0,
  };
}
