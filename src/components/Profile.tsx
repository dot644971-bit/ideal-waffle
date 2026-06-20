'use client';

import { useAppStore } from '@/lib/store';
import { SHOP_CATALOG, getFeaturesForLevel } from '@/lib/level-features';
import { xpGetStats, xpForNextLevel, xpLevelTitle, xpLevelFromTotal, xpInCurrentLevel } from '@/lib/gamification';
import type { XpStats, ShopItem, XpHistoryEntry } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   EVENT META — mirrors the JS META object from profile.php
   ═══════════════════════════════════════════════════════════════════════ */
const EVENT_META: Record<string, { icon: string; cls: string; label: string }> = {
  click:     { icon: '▶', cls: 'click',     label: 'Clicked content' },
  middle:    { icon: '◐', cls: 'middle',    label: 'Reached middle of content' },
  finish:    { icon: '✓', cls: 'finish',    label: 'Finished content' },
  watchlist: { icon: '+', cls: 'watchlist', label: 'Added to list' },
  purchase:  { icon: '🛒', cls: 'finish',   label: 'Purchased' },
  start:     { icon: '▶', cls: 'start',     label: 'Started watching' },
};

function fmt(n: number): string {
  return Number(n).toLocaleString('en-US');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ALL CSS from profile.php — kept exactly as-is
   (dynamic values like conic-gradient and width are applied via inline styles)
   ═══════════════════════════════════════════════════════════════════════ */
const PROFILE_CSS = `
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:       #0a0a0a;
  --bg2:      #141414;
  --surface:  #1a1a1a;
  --surface2: #222;
  --surface3: #2a2a2a;
  --border:   rgba(255,255,255,0.07);
  --border2:  rgba(255,255,255,0.12);
  --text:     #e5e5e5;
  --text2:    #a3a3a3;
  --text3:    #666;
  --red:      #e50914;
  --red2:     rgba(229,9,20,0.15);
  --red3:     rgba(229,9,20,0.35);
  --gold:     #f59e0b;
  --gold2:    rgba(245,158,11,0.15);
  --green:    #22c55e;
  --green2:   rgba(34,197,94,0.15);
  --r:        6px;
  --tr:       0.18s ease;
}

/* ── CARD ── */
.profile-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}
.profile-card-title {
  font-size: 0.72rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text3); margin-bottom: 20px;
}

/* ── LAYOUT ── */
.profile-wrap {
  max-width: 1100px; margin: 0 auto; padding: 40px 24px 80px;
}
.profile-page-title {
  font-size: 1.8rem; font-weight: 900;
  color: #fff; margin-bottom: 32px;
  letter-spacing: -0.03em;
}
.profile-page-title span { color: var(--red); }
.profile-grid {
  display: grid; grid-template-columns: 340px 1fr; gap: 24px;
}
@media(max-width: 860px) { .profile-grid { grid-template-columns: 1fr; } }

/* ── LEVEL BADGE ── */
.profile-level-badge {
  display: flex; align-items: center; justify-content: center; flex-direction: column;
  gap: 4px;
  width: 110px; height: 110px; border-radius: 50%;
  margin: 0 auto 20px;
  position: relative;
}
.profile-level-badge::before {
  content: '';
  position: absolute; inset: 8px;
  border-radius: 50%;
  background: var(--surface);
}
.level-badge-inner {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
}
.level-num {
  font-size: 2rem; font-weight: 900;
  color: #fff; line-height: 1;
}
.level-lbl {
  font-size: 0.6rem; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--red);
}
.level-title-badge {
  text-align: center; margin-bottom: 18px;
}
.level-title-text {
  font-size: 1rem; font-weight: 700; color: var(--gold);
  background: var(--gold2);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 20px;
  padding: 4px 16px; display: inline-block;
}

/* ── XP BAR ── */
.xp-bar-wrap { margin-bottom: 20px; }
.xp-bar-labels {
  display: flex; justify-content: space-between;
  font-size: 0.75rem; color: var(--text2);
  margin-bottom: 6px;
}
.xp-bar-labels strong { color: var(--red); }
.xp-bar {
  height: 8px; border-radius: 4px;
  background: var(--surface3); overflow: hidden;
}
.xp-bar-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, var(--red), #ff4444);
  transition: width 0.6s cubic-bezier(0.34,1.2,0.64,1);
  box-shadow: 0 0 10px rgba(229,9,20,0.5);
}

/* ── STAT PILLS ── */
.stat-row {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.stat-pill {
  flex: 1; min-width: 80px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); padding: 10px 14px; text-align: center;
}
.stat-pill-val {
  font-size: 1.5rem; font-weight: 900; color: #fff;
  display: block; line-height: 1;
}
.stat-pill-lbl {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--text3);
  display: block; margin-top: 3px;
}

/* ── NEXT LEVEL ── */
.next-level {
  margin-top: 20px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); padding: 12px 16px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px;
}
.next-level-lbl { font-size: 0.78rem; color: var(--text2); }
.next-level-val { font-size: 0.92rem; font-weight: 700; color: var(--red); white-space: nowrap; }

/* ── HISTORY ── */
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-item {
  display: flex; align-items: center; gap: 12px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); padding: 10px 14px;
}
.history-icon {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 800;
}
.history-icon.start {
  background: var(--green2); color: var(--green);
  border: 1px solid rgba(34,197,94,0.25);
}
.history-icon.finish {
  background: var(--red2); color: var(--red);
  border: 1px solid var(--red3);
}
.history-icon.click {
  background: var(--green2); color: var(--green);
  border: 1px solid rgba(34,197,94,0.25);
}
.history-icon.middle {
  background: var(--gold2); color: var(--gold);
  border: 1px solid rgba(245,158,11,0.3);
}
.history-icon.watchlist {
  background: rgba(99,102,241,0.15); color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3);
}
.history-text { flex: 1; min-width: 0; }
.history-slug {
  font-size: 0.85rem; font-weight: 600; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.history-meta { font-size: 0.72rem; color: var(--text3); margin-top: 1px; }
.history-xp {
  font-size: 0.85rem; font-weight: 800; color: var(--gold);
  white-space: nowrap; flex-shrink: 0;
}
.history-empty {
  text-align: center; color: var(--text3);
  font-size: 0.88rem; padding: 24px 0;
}

/* ── LEADERBOARD ── */
.leader-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.leader-row:last-child { border-bottom: none; }
.leader-rank {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 900;
  background: var(--surface3); color: var(--text2);
}
.leader-rank.top1 { background: #f59e0b; color: #000; }
.leader-rank.top2 { background: #94a3b8; color: #000; }
.leader-rank.top3 { background: #cd7c2f; color: #000; }
.leader-info { flex: 1; min-width: 0; }
.leader-name {
  font-size: 0.8rem; font-weight: 600; color: var(--text2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.leader-title { font-size: 0.68rem; color: var(--text3); }
.leader-xp {
  font-size: 0.85rem; font-weight: 800; color: var(--red);
  white-space: nowrap;
}
.leader-lvl {
  font-size: 0.68rem; font-weight: 700;
  background: var(--red2); color: var(--red);
  border: 1px solid var(--red3); border-radius: 3px;
  padding: 2px 7px; flex-shrink: 0;
}

/* ── Banner (profile-specific) ── */
.profile-banner {
  width: 100%;
  height: 220px;
  background-size: cover;
  background-position: center;
  background-color: var(--surface2);
  border-radius: 14px;
  margin-bottom: -80px;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
}
.profile-banner.empty {
  background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
  display: flex; align-items: center; justify-content: center;
  color: var(--text3); font-size: 0.85rem;
}
.profile-banner-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, transparent 50%, rgba(10,10,10,0.85));
}
.profile-user-card {
  display: flex; align-items: flex-end; gap: 20px;
  margin-bottom: 24px;
  position: relative; z-index: 2;
}
.profile-avatar-frame {
  width: 130px; height: 130px;
  padding: 4px;
  flex-shrink: 0;
  background: var(--surface);
  border-radius: 50%;
}
.profile-avatar-frame .user-avatar-img,
.profile-avatar-frame .avatar-letter-circle {
  width: 100%; height: 100%;
  border-radius: 50%;
}
.profile-avatar-frame .avatar-letter-circle {
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem; font-weight: 900;
  background: var(--red2); color: var(--red);
}
.profile-user-info { flex: 1; min-width: 0; padding-bottom: 6px; }
.profile-username { font-size: 1.8rem; font-weight: 900; line-height: 1.1; }
.profile-nickname-row {
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  margin-top: 6px;
}
.profile-email { color: var(--text2); font-size: 0.85rem; margin-top: 4px; }

/* ── User badge / nickname / level pill (from user-style.php) ── */
.user-nickname {
  font-size: 0.82rem; font-weight: 700;
  color: var(--gold); background: var(--gold2);
  border: 1px solid rgba(245,158,11,0.3);
  border-radius: 20px; padding: 3px 12px;
}
.user-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 700;
  border: 1px solid; border-radius: 20px; padding: 3px 10px;
}
.user-level-pill {
  font-size: 0.7rem; font-weight: 800;
  background: var(--red2); color: var(--red);
  border: 1px solid var(--red3); border-radius: 3px;
  padding: 2px 8px;
}
.user-level-pill.lvl6 {
  background: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4);
  color: #fff; border-color: rgba(255,255,255,0.2);
  animation: lvl6glow 2s ease infinite;
}
@keyframes lvl6glow {
  0%,100% { box-shadow: 0 0 6px rgba(245,158,11,0.4); }
  50% { box-shadow: 0 0 14px rgba(139,92,246,0.6); }
}

/* ── Owned items grid ── */
.owned-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.owned-tile {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 10px;
  text-align: center;
  font-size: 0.75rem;
}
.owned-tile.equipped {
  box-shadow: 0 0 10px rgba(245,158,11,0.25);
}
.owned-tile .icon {
  font-size: 1.6rem;
  margin-bottom: 6px;
  display: block;
}
.owned-tile .name {
  font-weight: 700;
  color: #fff;
  margin-bottom: 2px;
}
.owned-tile .meta {
  color: var(--text3);
  font-size: 0.68rem;
}

/* ── Back button (profile variant) ── */
.profile-back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--text2); font-size: 0.82rem; font-weight: 600;
  padding: 7px 14px; border-radius: var(--r);
  border: 1px solid var(--border2);
  transition: all var(--tr);
  text-decoration: none; cursor: pointer;
}
.profile-back-btn:hover { color: #fff; border-color: var(--red3); background: var(--red2); }
.profile-back-btn svg { width: 14px; height: 14px; }

/* ── Username effects ── */
.username-display { color: #fff; }
.username-display.effect-gold { color: var(--gold); }
.username-display.effect-rgb {
  background: linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #f59e0b);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: rgbShift 3s linear infinite;
}
@keyframes rgbShift {
  0% { background-position: 0% center; }
  100% { background-position: 200% center; }
}

/* ── Avatar frames ── */
.avatar-frame-silver { box-shadow: 0 0 0 3px #94a3b8; }
.avatar-frame-gold   { box-shadow: 0 0 0 3px #f59e0b; }
.avatar-frame-rainbow {
  box-shadow: 0 0 0 3px transparent;
  border-image: linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4) 1;
}
`;

/* ═══════════════════════════════════════════════════════════════════════
   Pure function: read XP stats from localStorage (no hooks, no side effects)
   ═══════════════════════════════════════════════════════════════════════ */
function readXpStatsFromStorage(): XpStats {
  try {
    const raw = localStorage.getItem('mx_xp_data');
    if (raw) {
      const data = JSON.parse(raw);
      const totalXp: number = data.total_xp || 0;
      const history: XpHistoryEntry[] = data.history || [];

      const level = xpLevelFromTotal(totalXp);
      const levelXp = xpInCurrentLevel(totalXp);
      const levelNeeded = xpForNextLevel(level);
      const pct = levelNeeded > 0 ? Math.round((levelXp / levelNeeded) * 1000) / 10 : 0;

      return {
        level,
        total_xp: totalXp,
        level_xp: levelXp,
        level_needed: levelNeeded,
        progress_pct: pct,
        level_title: xpLevelTitle(level),
        history,
        started_count: history.filter((h) => h.event === 'start').length,
        finished_count: history.filter((h) => h.event === 'finish').length,
        watchlist_count: history.filter((h) => h.event === 'watchlist').length,
        middle_count: history.filter((h) => h.event === 'middle').length,
      };
    }
  } catch {
    // ignore parse errors
  }
  return xpGetStats();
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const { currentUser, userCustom, userPurchases } = useAppStore();
  const [stats, setStats] = useState<XpStats>(() => readXpStatsFromStorage());
  const [avatarError, setAvatarError] = useState(false);

  /* ── Subscribe to cross-tab localStorage changes ── */
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'mx_xp_data') setStats(readXpStatsFromStorage());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  /* ── Derived: user & custom data ── */
  const user = currentUser;
  const custom = userCustom;

  // Level features for avatar frame & username effect
  const features = useMemo(() => getFeaturesForLevel(stats.level), [stats.level]);

  // Active nickname from shop catalog
  const activeNicknameInfo = useMemo(() => {
    if (!custom.active_nickname) return null;
    return (
      SHOP_CATALOG.find(
        (item) => item.name === custom.active_nickname || item.id === custom.active_nickname
      ) ?? null
    );
  }, [custom.active_nickname]);

  // Equipped badge from shop catalog
  const equippedBadgeInfo = useMemo(() => {
    if (!custom.equipped_badge) return null;
    return SHOP_CATALOG.find((item) => item.id === custom.equipped_badge) ?? null;
  }, [custom.equipped_badge]);

  // Level thresholds for the "How XP Works" card
  const levelThresholds = useMemo(() => {
    const thresholds: { from: number; to: number; needed: number }[] = [];
    for (let l = 1; l <= 5; l++) {
      thresholds.push({ from: l, to: l + 1, needed: xpForNextLevel(l) });
    }
    return thresholds;
  }, []);

  // History items newest-first
  const historyReversed = useMemo(() => [...stats.history].reverse(), [stats.history]);

  // Progress clamped to 100
  const pct = Math.min(100, stats.progress_pct);

  // Username effect class
  const usernameEffectCls =
    features.username_effect === 'gold'
      ? 'effect-gold'
      : features.username_effect === 'rgb'
        ? 'effect-rgb'
        : '';

  // Avatar frame class
  const avatarFrameCls =
    features.avatar_frame === 'silver'
      ? 'avatar-frame-silver'
      : features.avatar_frame === 'gold'
        ? 'avatar-frame-gold'
        : features.avatar_frame === 'rainbow'
          ? 'avatar-frame-rainbow'
          : '';

  /* ── Render ── */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PROFILE_CSS }} />

      <div className="profile-wrap">
        <h1 className="profile-page-title">
          My <span>Profile</span>
        </h1>

        {/* ═══ BANNER + AVATAR + USERNAME ═══ */}
        {user && (
          <>
            <div
              className={`profile-banner${!custom.custom_banner ? ' empty' : ''}`}
              style={
                custom.custom_banner
                  ? { backgroundImage: `url('${custom.custom_banner}')` }
                  : undefined
              }
            >
              <div className="profile-banner-overlay" />
            </div>

            <div className="profile-user-card">
              <div className={`profile-avatar-frame ${avatarFrameCls}`}>
                {custom.custom_avatar && !avatarError ? (
                  <img
                    src={custom.custom_avatar}
                    alt=""
                    className="user-avatar-img"
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="avatar-letter-circle">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="profile-user-info">
                <div className={`profile-username username-display ${usernameEffectCls}`}>
                  {user.username}
                </div>
                <div className="profile-nickname-row">
                  {custom.active_nickname && (
                    <span className="user-nickname">{custom.active_nickname}</span>
                  )}
                  {equippedBadgeInfo && (
                    <span
                      className="user-badge"
                      style={{
                        background: `${equippedBadgeInfo.color}22`,
                        color: equippedBadgeInfo.color,
                        borderColor: `${equippedBadgeInfo.color}55`,
                      }}
                    >
                      {equippedBadgeInfo.icon} {equippedBadgeInfo.name}
                    </span>
                  )}
                  <span className={`user-level-pill${stats.level >= 6 ? ' lvl6' : ''}`}>
                    LVL <span>{stats.level}</span>
                  </span>
                </div>
                <div className="profile-email">{user.email}</div>
              </div>
            </div>
          </>
        )}

        <div className="profile-grid">
          {/* ══════════════════════════════════════════════
              LEFT COLUMN
              ══════════════════════════════════════════════ */}
          <div>
            {/* ── XP & Level Card ── */}
            <div className="profile-card" style={{ marginBottom: 20 }}>
              <div className="profile-card-title">XP &amp; Level</div>

              {/* Conic-gradient badge (dynamic via inline style) */}
              <div
                className="profile-level-badge"
                style={{
                  background: `conic-gradient(var(--red) ${pct}%, var(--surface3) 0%)`,
                }}
              >
                <div className="level-badge-inner">
                  <span className="level-num">{stats.level}</span>
                  <span className="level-lbl">LVL</span>
                </div>
              </div>

              <div className="level-title-badge">
                <span className="level-title-text">{stats.level_title}</span>
              </div>

              {/* XP Bar */}
              <div className="xp-bar-wrap">
                <div className="xp-bar-labels">
                  <span>
                    <strong>{fmt(stats.level_xp)} XP</strong> in this level
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="xp-bar">
                  <div
                    className="xp-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stat pills */}
              <div className="stat-row" style={{ marginBottom: 16 }}>
                <div className="stat-pill">
                  <span className="stat-pill-val">{fmt(stats.total_xp)}</span>
                  <span className="stat-pill-lbl">Total XP</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-val">{stats.started_count}</span>
                  <span className="stat-pill-lbl">Started</span>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-val">{stats.finished_count}</span>
                  <span className="stat-pill-lbl">Finished</span>
                </div>
              </div>

              {/* Next level info */}
              <div className="next-level">
                <span className="next-level-lbl">
                  {fmt(Math.max(0, stats.level_needed - stats.level_xp))} XP to Level{' '}
                  {stats.level + 1}
                </span>
                <span className="next-level-val">
                  {fmt(stats.level_needed)} needed
                </span>
              </div>
            </div>

            {/* ── How XP Works Card ── */}
            <div className="profile-card">
              <div className="profile-card-title">How XP Works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Start watching row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--green2)',
                      color: 'var(--green)',
                      border: '1px solid rgba(34,197,94,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    ▶
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                      Start watching
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                      +20 XP per new series
                    </div>
                  </div>
                </div>

                {/* Finish episode row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--red2)',
                      color: 'var(--red)',
                      border: '1px solid var(--red3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                      Finish an episode
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>
                      +20 XP per series finished
                    </div>
                  </div>
                </div>

                {/* Level thresholds table */}
                <div
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--gold)',
                      marginBottom: 6,
                    }}
                  >
                    Level thresholds
                  </div>
                  {levelThresholds.map((t) => (
                    <div
                      key={t.from}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.72rem',
                        color: 'var(--text2)',
                        padding: '2px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <span>
                        Level {t.from} → {t.to}
                      </span>
                      <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                        {fmt(t.needed)} XP
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginTop: 6 }}>
                    Each level requires 2× the XP of the previous.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              RIGHT COLUMN
              ══════════════════════════════════════════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Recent Activity ── */}
            <div className="profile-card">
              <div className="profile-card-title">Recent Activity</div>
              <div className="history-list">
                {historyReversed.length === 0 ? (
                  <div className="history-empty">
                    No activity yet — start watching to earn XP!
                  </div>
                ) : (
                  historyReversed.map((h, i) => {
                    const m =
                      EVENT_META[h.event] || { icon: '•', cls: 'click', label: h.event };
                    const sign = h.xp < 0 ? '' : '+';
                    const xpColor = h.xp < 0 ? '#ff6b6b' : 'var(--gold)';
                    return (
                      <div className="history-item" key={i}>
                        <div className={`history-icon ${m.cls}`}>{m.icon}</div>
                        <div className="history-text">
                          <div className="history-slug">{h.slug || '—'}</div>
                          <div className="history-meta">
                            {m.label} · {formatDate(h.ts)}
                          </div>
                        </div>
                        <div className="history-xp" style={{ color: xpColor }}>
                          {sign}
                          {h.xp} XP
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Leaderboard ── */}
            <div className="profile-card">
              <div className="profile-card-title">Leaderboard</div>
              <div className="history-empty">
                <strong style={{ color: 'var(--gold)', display: 'block', marginBottom: 6 }}>
                  Coming soon 🏆
                </strong>
                XP is stored in your browser, so cross-device leaderboard is not available.
              </div>
            </div>

            {/* ── My Items (purchased nicknames & badges) ── */}
            <div className="profile-card">
              <div className="profile-card-title">
                My Items ({userPurchases.length})
              </div>
              {userPurchases.length === 0 ? (
                <div className="history-empty">
                  No items purchased yet.
                  <br />
                  <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    Go to Shop →
                  </span>
                </div>
              ) : (
                <>
                  <div className="owned-grid">
                    {userPurchases.map((item: ShopItem) => {
                      const isEquipped =
                        (item.type === 'nickname' &&
                          item.name === custom.active_nickname) ||
                        (item.type === 'badge' &&
                          item.id === custom.equipped_badge);

                      return (
                        <div
                          key={item.id}
                          className={`owned-tile${isEquipped ? ' equipped' : ''}`}
                          style={{
                            borderColor: isEquipped
                              ? item.color
                              : 'var(--border)',
                          }}
                        >
                          <span className="icon">{item.icon}</span>
                          <div className="name" style={{ color: item.color }}>
                            {item.name}
                          </div>
                          <div className="meta">
                            {item.type === 'nickname' ? 'Nickname' : 'Badge'}
                            {isEquipped ? (
                              <>
                                {' '}
                                ·{' '}
                                <strong style={{ color: 'var(--gold)' }}>
                                  Equipped
                                </strong>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 14, textAlign: 'center' }}>
                    <span
                      className="profile-back-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#f59e0b',
                        borderColor: 'rgba(245,158,11,0.3)',
                        background: 'rgba(245,158,11,0.1)',
                      }}
                    >
                      🛒 Go to Shop
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
