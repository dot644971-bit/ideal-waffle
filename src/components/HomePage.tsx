'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { SITE_NAME, SERIES_LIST, getSeriesBySlug, posterUrl, bgUrl } from '@/lib/config';
import { SHOP_CATALOG } from '@/lib/level-features';
import type { Series, WatchlistEntry } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════
   Helper functions (converted from PHP)
   ══════════════════════════════════════════════════════════════ */

function seriesUrl(s: Series): string {
  if (s.id) return `/watch?id=${encodeURIComponent(s.id)}`;
  return `/series?slug=${encodeURIComponent(s.slug)}`;
}

function isYazVaktiTagged(s: Series): boolean {
  const norm = (s.genre ?? '').toLowerCase().replace(/\s+/g, '');
  return norm.includes('yazvakti');
}

function relTime(ts: number): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* TV Channels data */
const TV_CHANNELS = [
  { icon: '💥', name: 'MEGAXTOON TV' },
  { icon: '⚡', name: 'MEGAXBOOM TV' },
  { icon: '🎭', name: 'MEGAXPRIME TV' },
  { icon: '🌌', name: 'MEGAXYOUNGTV' },
  { icon: '🎨', name: 'GALAXYHDPLUS' },
  { icon: '🇮🇳', name: 'KIDSMEGA HD' },
  { icon: '🎪', name: 'SERBIAKIDS HD' },
  { icon: '🎠', name: 'BULGARIANTOON TV' },
  { icon: '🔥', name: 'KIDSXPRIME HD' },
  { icon: '✨', name: 'MINIXTOON HD' },
];

/* Translations */
const T = {
  home: 'Home',
  trending: 'Trending Now',
  new: 'New Releases',
  genre: 'Browse by Genre',
  watchlist: 'My List',
  explore: 'Explore All',
  see_all: 'See All',
  online: 'Online',
  ai_hi: 'Hi! I can recommend series for you. What are you in the mood for?',
  ai_ph: 'Ask me anything...',
  ai_send: 'Send',
  empty_wl: 'Your list is empty',
  add_wl: 'Add series to your list from the series page.',
  history: 'Recently Watched',
  empty_hist: 'No watch history yet',
  add_hist: 'Start watching to see your history here.',
};

/* ══════════════════════════════════════════════════════════════
   SVG placeholder for missing poster images
   ══════════════════════════════════════════════════════════════ */
const PhSvg = () => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z' />
  </svg>
);

/* PosterImg component — portrait mode */
function PosterImg({ s, cls = 'card-img' }: { s: Series; cls?: string }) {
  const src = s.poster_url || posterUrl(s.name);
  const alt = s.name;
  const shortName = s.name.length > 30 ? s.name.substring(0, 30) + '\u2026' : s.name;
  const [imgErr, setImgErr] = useState(false);
  return (
    <>
      {!imgErr && (
        <img
          src={src}
          alt={alt}
          className={cls}
          loading="lazy"
          onError={() => setImgErr(true)}
        />
      )}
      {imgErr && (
        <div className="card-img-ph" style={imgErr ? { display: 'flex' } : { display: 'none' }}>
          <PhSvg />
          <span>{shortName}</span>
        </div>
      )}
    </>
  );
}

/* PosterImgLandscape component — landscape/wide mode */
function PosterImgLandscape({ s, cls = 'cw-img' }: { s: Series; cls?: string }) {
  const src = s.poster_url || posterUrl(s.name);
  const alt = s.name;
  const [imgErr, setImgErr] = useState(false);
  return (
    <>
      {!imgErr && (
        <img
          src={src}
          alt={alt}
          className={cls}
          loading="lazy"
          onError={() => setImgErr(true)}
        />
      )}
      {imgErr && (
        <div className="cw-img-ph" style={imgErr ? { display: 'flex' } : { display: 'none' }}>
          <PhSvg />
        </div>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ──────────────────────────────────────────────────────────── */
export default function HomePage() {
  /* ── Store ── */
  const {
    isLoggedIn, currentUser, userCustom, logout,
    searchQ, setSearchQ,
    watchlist, loadWatchlist, removeFromWatchlist,
    watchHistory, loadWatchHistory, clearWatchHistory,
    aiOpen, toggleAi,
    menuOpen, toggleMenu, closeMenu,
  } = useAppStore();

  /* ── Local State ── */
  const [scrolled, setScrolled] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [activeGenre, setActiveGenre] = useState(() => {
    // Compute initial genre from topGenres to avoid effect + setState
    const groups: Record<string, Series[]> = {};
    SERIES_LIST.filter(s => !isYazVaktiTagged(s)).forEach(s => {
      s.genre.split(',').forEach(g => {
        const trimmed = g.trim();
        if (trimmed) {
          if (!groups[trimmed]) groups[trimmed] = [];
          groups[trimmed].push(s);
        }
      });
    });
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    return sorted.slice(0, 6).map(([g]) => g)[0] || '';
  });
  const [aiInput, setAiInput] = useState('');
  const [aiMsgs, setAiMsgs] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: T.ai_hi },
  ]);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  /* ── Refs ── */
  const headerRef = useRef<HTMLElement>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroProgRef = useRef<HTMLDivElement>(null);
  const aiMsgsRef = useRef<HTMLDivElement>(null);
  const DUR = 6000;

  /* ── SERIES MAP for lookups (stable, never changes) ── */
  const seriesMap = useMemo(() => {
    const m: Record<string, Series & { url: string }> = {};
    SERIES_LIST.forEach(s => {
      const entry = { ...s, url: seriesUrl(s) };
      if (s.id) m['id_' + s.id] = entry;
      m['slug_' + s.slug] = entry;
    });
    return m;
  }, []);

  /* ── Derived Data ── */
  // Yaz Koleksiyonu filter
  const { yazKoleksiyonu, filteredList } = useMemo(() => {
    const yaz = SERIES_LIST.filter(isYazVaktiTagged);
    const rest = SERIES_LIST.filter(s => !isYazVaktiTagged(s));
    return { yazKoleksiyonu: yaz, filteredList: rest };
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return filteredList.filter(
      s => s.name.toLowerCase().includes(q) || s.genre.toLowerCase().includes(q)
    );
  }, [searchQ, filteredList]);

  // Hero series: top 5 by rating
  const heroSeries = useMemo(() => {
    const sorted = [...filteredList].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    return sorted.slice(0, 5);
  }, [filteredList]);

  // Top rated: top 16 by rating
  const topRated = useMemo(() => {
    const sorted = [...filteredList].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    return sorted.slice(0, 16);
  }, [filteredList]);

  // New arrivals: top 16 by year
  const newArrivals = useMemo(() => {
    const sorted = [...filteredList].sort((a, b) => parseInt(b.year) - parseInt(a.year));
    return sorted.slice(0, 16);
  }, [filteredList]);

  // Trending: first 16
  const trendingSeries = useMemo(() => filteredList.slice(0, 16), [filteredList]);

  // Genre groups
  const { genreGroups, topGenres } = useMemo(() => {
    const groups: Record<string, Series[]> = {};
    filteredList.forEach(s => {
      s.genre.split(',').forEach(g => {
        const trimmed = g.trim();
        if (trimmed) {
          if (!groups[trimmed]) groups[trimmed] = [];
          groups[trimmed].push(s);
        }
      });
    });
    // Sort genres by count descending
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    const top = sorted.slice(0, 6).map(([g]) => g);
    // Set initial active genre
    return { genreGroups: groups, topGenres: top };
  }, [filteredList]);

  // Explore all: shuffled
  const exploreAll = useMemo(() => shuffleArray(filteredList), [filteredList]);

  // Shop catalog lookups
  const equippedBadgeInfo = useMemo(() => {
    if (!userCustom.equipped_badge) return null;
    return SHOP_CATALOG.find(item => item.id === userCustom.equipped_badge) ?? null;
  }, [userCustom.equipped_badge]);

  const activeNicknameInfo = useMemo(() => {
    if (!userCustom.active_nickname) return null;
    return SHOP_CATALOG.find(
      item => item.name === userCustom.active_nickname || item.id === userCustom.active_nickname
    ) ?? null;
  }, [userCustom.active_nickname]);

  /* ── Load from localStorage on mount ── */
  useEffect(() => {
    loadWatchlist();
    loadWatchHistory();
  }, [loadWatchlist, loadWatchHistory]);

  /* ── Header scroll ── */
  useEffect(() => {
    let tick = false;
    const onScroll = () => {
      if (!tick) {
        requestAnimationFrame(() => {
          setScrolled(window.scrollY > 30);
          tick = false;
        });
        tick = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Hero carousel auto-advance ── */
  const goHero = useCallback((n: number) => {
    const len = heroSeries.length;
    if (len === 0) return;
    const next = ((n % len) + len) % len;
    setHeroIdx(next);
    // Reset progress bar
    if (heroProgRef.current) {
      heroProgRef.current.style.transition = 'none';
      heroProgRef.current.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (heroProgRef.current) {
            heroProgRef.current.style.transition = `width ${DUR}ms linear`;
            heroProgRef.current.style.width = '100%';
          }
        });
      });
    }
  }, [heroSeries.length]);

  // Progress bar reset helper (only touches DOM, no state)
  const resetProgressBar = useCallback(() => {
    if (heroProgRef.current) {
      heroProgRef.current.style.transition = 'none';
      heroProgRef.current.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (heroProgRef.current) {
            heroProgRef.current.style.transition = `width ${DUR}ms linear`;
            heroProgRef.current.style.width = '100%';
          }
        });
      });
    }
  }, [DUR]);

  useEffect(() => {
    if (heroSeries.length === 0) return;
    // Reset progress bar on mount (DOM-only, no setState)
    resetProgressBar();
    heroTimerRef.current = setInterval(() => {
      setHeroIdx(prev => {
        const next = (prev + 1) % heroSeries.length;
        // Reset progress bar inside interval callback (not synchronously in effect body)
        requestAnimationFrame(() => {
          if (heroProgRef.current) {
            heroProgRef.current.style.transition = 'none';
            heroProgRef.current.style.width = '0%';
            requestAnimationFrame(() => {
              if (heroProgRef.current) {
                heroProgRef.current.style.transition = `width ${DUR}ms linear`;
                heroProgRef.current.style.width = '100%';
              }
            });
          }
        });
        return next;
      });
    }, DUR);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroSeries.length, resetProgressBar]);

  /* ── Hero touch swipe ── */
  const heroTouchRef = useRef<{ startX: number }>({ startX: 0 });

  /* ── Slider scroll functions ── */
  const slideRight = (btn: React.MouseEvent<HTMLButtonElement>) => {
    const outer = (btn.target as HTMLElement).closest('.slider-outer');
    if (!outer) return;
    const track = outer.querySelector('.slider-track') as HTMLElement;
    if (track) track.scrollBy({ left: track.offsetWidth * 0.75, behavior: 'smooth' });
  };
  const slideLeft = (btn: React.MouseEvent<HTMLButtonElement>) => {
    const outer = (btn.target as HTMLElement).closest('.slider-outer');
    if (!outer) return;
    const track = outer.querySelector('.slider-track') as HTMLElement;
    if (track) track.scrollBy({ left: -track.offsetWidth * 0.75, behavior: 'smooth' });
  };

  /* ── Toast ── */
  const showToast = useCallback((msg: string, ms = 3200) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, ms + 400);
  }, []);

  /* ── AI Chat send (simulated client-side) ── */
  const sendAI = useCallback(() => {
    const text = aiInput.trim();
    if (!text) return;
    setAiInput('');
    const newMsgs = [...aiMsgs, { role: 'user' as const, text }];
    setAiMsgs(newMsgs);

    // Simulated response
    setTimeout(() => {
      const suggestions = filteredList
        .filter(s => s.name.toLowerCase().includes(text.toLowerCase()) || s.genre.toLowerCase().includes(text.toLowerCase()))
        .slice(0, 3);
      let reply = 'I found some great series for you! Check out the suggestions below.';
      if (suggestions.length === 0) {
        reply = `I'm not sure about "${text}", but try searching or browsing by genre above!`;
      }
      setAiMsgs(prev => [...prev, { role: 'bot' as const, text: reply }]);
    }, 800);
  }, [aiInput, aiMsgs, filteredList]);

  // Scroll AI messages to bottom
  useEffect(() => {
    if (aiMsgsRef.current) {
      aiMsgsRef.current.scrollTop = aiMsgsRef.current.scrollHeight;
    }
  }, [aiMsgs]);

  /* ── Escape key closes menu ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeMenu]);

  /* ── Render watchlist from store ── */
  const resolvedWatchlist = useMemo(() => {
    return watchlist.map(item => {
      const found = item.slug ? seriesMap['slug_' + item.slug] : null;
      if (found && (!item.poster_url || item.poster_url === '')) {
        return { ...found, ...item };
      }
      return item;
    }).filter(Boolean) as WatchlistEntry[];
  }, [watchlist, seriesMap]);

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header className={`header${scrolled ? ' scrolled' : ''}`} ref={headerRef} id="mainHeader">
        <a href="/" className="logo" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="logo-text">{SITE_NAME}</span>
        </a>
        <nav className="nav">
          <a href="/" className="active">Home</a>
          <a href="/#section-trending" onClick={e => { e.preventDefault(); document.getElementById('section-trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Trending</a>
          <a href="/#section-genre" onClick={e => { e.preventDefault(); document.getElementById('section-genre')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Browse</a>
          <a href="/#section-watchlist" onClick={e => { e.preventDefault(); document.getElementById('section-watchlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>My List</a>
          <a href="/shop" style={{ color: '#f59e0b', fontWeight: 700 }}>🛒 Shop</a>
        </nav>
        <div className="header-right">
          <div className="search-wrap">
            <form onSubmit={e => { e.preventDefault(); }} action="">
              <input
                type="search"
                name="q"
                placeholder="Search series..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                autoComplete="off"
                aria-label="Search"
              />
              <svg className="si" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </form>
          </div>

          {/* USER PILL */}
          {isLoggedIn && currentUser && (
            <>
              <a href="/profile" className="user-pill" id="userPill" title={currentUser.email}>
                <div className="user-avatar-frame frame-none" id="userAvatarFrame">
                  {userCustom.custom_avatar ? (
                    <img src={userCustom.custom_avatar} alt="" className="user-avatar-img" />
                  ) : (
                    <div
                      className="avatar-letter-circle"
                      style={{
                        background: `${activeNicknameInfo?.color ?? '#e50914'}22`,
                        color: activeNicknameInfo?.color ?? '#e50914',
                      }}
                    >
                      {currentUser.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="user-pill-info">
                  <span className="username-display" id="userDisplayName">{currentUser.username}</span>
                  {userCustom.active_nickname && (
                    <span className="user-nickname">{userCustom.active_nickname}</span>
                  )}
                </div>
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
                <span className="user-level-pill" id="userLevelPill">LVL <span id="userLevelNum">1</span></span>
              </a>
              <button className="logout-btn" title="Sign out" onClick={() => logout()}>⏻</button>
            </>
          )}

          <button
            className={`hamburger${menuOpen ? ' open' : ''}`}
            id="hamBtn"
            onClick={toggleMenu}
            aria-label="Menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>

      {/* MOBILE OVERLAY */}
      <div className={`mob-overlay${menuOpen ? ' no-scroll-target' : ''}`} onClick={closeMenu} style={menuOpen ? { opacity: 1, pointerEvents: 'all' } : {}}></div>
      <div className="mob-drawer" style={menuOpen ? { transform: 'translateX(0)' } : {}}>
        <div className="drawer-top">
          <span className="logo-text" style={{ fontSize: '1.2rem' }}>{SITE_NAME}</span>
          <button className="drawer-close" onClick={closeMenu}>✕</button>
        </div>
        <nav className="drawer-nav">
          <a href="/" className="active" onClick={e => { e.preventDefault(); closeMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Home</a>
          <a href="/#section-trending" className="" onClick={e => { e.preventDefault(); closeMenu(); document.getElementById('section-trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Trending</a>
          <a href="/#section-genre" className="" onClick={e => { e.preventDefault(); closeMenu(); document.getElementById('section-genre')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Browse by Genre</a>
          <a href="/#section-watchlist" className="" onClick={e => { e.preventDefault(); closeMenu(); document.getElementById('section-watchlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>My List</a>
        </nav>
      </div>

      {/* ═══ SEARCH RESULTS ═══ */}
      {searchQ.trim() ? (
        <div className="search-sec">
          <h2 className="search-h">Results for <em>&ldquo;{searchQ}&rdquo;</em></h2>
          {searchResults.length === 0 ? (
            <div className="no-res">
              <div className="no-res-icon">🔍</div>
              <div style={{ fontSize: '.9rem' }}>No results found.</div>
            </div>
          ) : (
            <div className="res-grid">
              {searchResults.map(s => (
                <a key={s.slug} href={seriesUrl(s)} className="res-card">
                  <PosterImg s={s} />
                  <div className="res-body">
                    <div className="res-title">{s.name}</div>
                    <div className="res-meta">{s.year} · ⭐ {s.rating}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ═══ HERO CAROUSEL ═══ */}
          <div
            className="hero"
            id="heroCarousel"
            onTouchStart={e => { heroTouchRef.current.startX = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const dx = e.changedTouches[0].clientX - heroTouchRef.current.startX;
              if (Math.abs(dx) > 48) {
                if (heroTimerRef.current) clearInterval(heroTimerRef.current);
                goHero(dx < 0 ? heroIdx + 1 : heroIdx - 1);
                heroTimerRef.current = setInterval(() => {
                  setHeroIdx(prev => {
                    const next = (prev + 1) % heroSeries.length;
                    if (heroProgRef.current) {
                      heroProgRef.current.style.transition = 'none';
                      heroProgRef.current.style.width = '0%';
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          if (heroProgRef.current) {
                            heroProgRef.current.style.transition = `width ${DUR}ms linear`;
                            heroProgRef.current.style.width = '100%';
                          }
                        });
                      });
                    }
                    return next;
                  });
                }, DUR);
              }
            }}
          >
            {heroSeries.map((hs, idx) => (
              <div key={hs.slug} className={`hero-slide${idx === heroIdx ? ' active' : ''}`}>
                <div className="hero-bg" style={{ backgroundImage: `url('${bgUrl(hs.name)}')` }}></div>
                <div className="hero-content">
                  <div className="hero-badge">
                    {idx === 0 && <span className="hb-new">TOP PICK</span>}
                    <span className="hb-rank">#{idx + 1} in Trending</span>
                  </div>
                  <div className="hero-title">{hs.name}</div>
                  <div className="hero-meta">
                    <span className="hero-tag">⭐ {hs.rating}</span>
                    <span className="hero-tag">{hs.year}</span>
                    {hs.genre.split(',').slice(0, 2).map((g, gi) => (
                      <span key={gi} className="hero-tag">{g.trim()}</span>
                    ))}
                  </div>
                  {hs.description && <div className="hero-desc">{hs.description}</div>}
                  <div className="hero-acts">
                    <a href={seriesUrl(hs)} className="btn-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      Play
                    </a>
                    <a href={`/series?slug=${encodeURIComponent(hs.slug)}`} className="btn-ghost">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      More Info
                    </a>
                  </div>
                </div>
              </div>
            ))}
            <div className="hero-dots">
              {heroSeries.map((_, i) => (
                <button
                  key={i}
                  className={`hdot${i === heroIdx ? ' active' : ''}`}
                  onClick={() => {
                    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
                    goHero(i);
                    heroTimerRef.current = setInterval(() => {
                      setHeroIdx(prev => {
                        const next = (prev + 1) % heroSeries.length;
                        if (heroProgRef.current) {
                          heroProgRef.current.style.transition = 'none';
                          heroProgRef.current.style.width = '0%';
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                              if (heroProgRef.current) {
                                heroProgRef.current.style.transition = `width ${DUR}ms linear`;
                                heroProgRef.current.style.width = '100%';
                              }
                            });
                          });
                        }
                        return next;
                      });
                    }, DUR);
                  }}
                ></button>
              ))}
            </div>
            <div className="hero-prog"><div className="hero-prog-bar" ref={heroProgRef} id="hpb"></div></div>
          </div>

          {/* ═══ YAZ KOLEKSİYONU (SUMMER COLLECTION) ═══ */}
          <section className="section summer-wrap" id="section-summer">
            {yazKoleksiyonu.length > 0 ? (
              <div className="summer-banner">
                <div className="summer-lava" aria-hidden="true">
                  <span className="lava-blob b1"></span>
                  <span className="lava-blob b2"></span>
                  <span className="lava-blob b3"></span>
                  <span className="lava-blob b4"></span>
                  <span className="lava-blob b5"></span>
                </div>
                <div className="summer-banner-content">
                  <div className="sec-head summer-head">
                    <span className="summer-icon">☀️</span>
                    <div>
                      <h2 className="sec-title summer-title">Summer Collection</h2>
                      <div className="summer-sub">The most entertaining TV series of hot days are here</div>
                    </div>
                    <span className="sec-count summer-count">{yazKoleksiyonu.length}</span>
                  </div>
                  <div className="slider-outer summer-slider-outer">
                    <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
                    <div className="slider-track">
                      {yazKoleksiyonu.map(s => (
                        <a key={s.slug} href={seriesUrl(s)} className="card summer-card">
                          <PosterImg s={s} />
                          <div className="card-badge summer">☀️ SUMMER</div>
                          <div className="card-rat">⭐ {s.rating}</div>
                          <div className="card-ov">
                            <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                            <div className="card-name">{s.name}</div>
                            <div className="card-sub"><span>{s.year}</span><span>·</span><span>{s.seasons}S</span></div>
                          </div>
                        </a>
                      ))}
                    </div>
                    <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="summer-empty">☀️ No series tagged with &quot;Yaz Vakti&quot; yet.</div>
            )}
          </section>

          {/* ═══ WATCH HISTORY ═══ */}
          {watchHistory.length > 0 && (
            <section className="section" id="section-watch-history" style={{ display: '' }}>
              <div className="sec-head">
                <span className="sec-dot"></span>
                <h2 className="sec-title">{T.history}</h2>
                <span className="sec-count">{watchHistory.length}</span>
                <button
                  className="sec-all"
                  onClick={() => { clearWatchHistory(); showToast('Watch history cleared'); }}
                  style={{ color: 'var(--text3)', fontSize: '0.72rem' }}
                >
                  Clear
                </button>
              </div>
              <div className="slider-outer">
                <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
                <div className="slider-track">
                  {watchHistory.map(s => (
                    <a key={s.slug + '-' + s.watchedAt} href={s.url} className="card">
                      <PosterImg s={s} />
                      <div className="card-rat">⭐ {s.rating}</div>
                      <div className="card-ov">
                        <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                        <div className="card-name">{s.name}</div>
                        <div className="card-sub"><span>{s.year}</span><span>·</span><span>{s.seasons}S</span></div>
                      </div>
                      <div className="card-hist-time">{relTime(s.watchedAt)}</div>
                    </a>
                  ))}
                </div>
                <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
              </div>
            </section>
          )}

          {/* ═══ TRENDING NOW ═══ */}
          <section className="section" id="section-trending">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">{T.trending}</h2>
              <span className="sec-badge hot">HOT</span>
              <span className="sec-count">{trendingSeries.length}</span>
              <span className="sec-all">{T.see_all}</span>
            </div>
            <div className="slider-outer">
              <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
              <div className="slider-track">
                {trendingSeries.map((s, i) => (
                  <a key={s.slug} href={seriesUrl(s)} className="card">
                    <PosterImg s={s} />
                    {i < 3 && <div className="card-badge rank">#{i + 1}</div>}
                    <div className="card-rat">⭐ {s.rating}</div>
                    <div className="card-ov">
                      <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                      <div className="card-name">{s.name}</div>
                      <div className="card-sub"><span>{s.year}</span><span>·</span><span>{s.seasons}S</span></div>
                    </div>
                  </a>
                ))}
              </div>
              <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
            </div>
          </section>

          {/* ═══ TOP RATED ═══ */}
          <section className="section">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">Top Rated</h2>
              <span className="sec-count">{topRated.length}</span>
            </div>
            <div className="slider-outer">
              <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
              <div className="slider-track">
                {topRated.map(s => (
                  <a key={s.slug} href={seriesUrl(s)} className="card-wide">
                    <PosterImgLandscape s={s} />
                    <div className="cw-body">
                      <div className="cw-title">{s.name}</div>
                      <div className="cw-meta">
                        <div className="cw-rat">⭐ {s.rating}</div>
                        <span className="cw-genre">{s.genre.split(',')[0].trim()}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
              <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
            </div>
          </section>

          {/* ═══ NEW ARRIVALS ═══ */}
          <section className="section">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">{T.new}</h2>
              <span className="sec-badge new">NEW</span>
              <span className="sec-count">{newArrivals.length}</span>
              <span className="sec-all">{T.see_all}</span>
            </div>
            <div className="slider-outer">
              <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
              <div className="slider-track">
                {newArrivals.map(s => (
                  <a key={s.slug} href={seriesUrl(s)} className="card">
                    <PosterImg s={s} />
                    {parseInt(s.year) >= 2022 && <div className="card-badge nb">NEW</div>}
                    <div className="card-rat">⭐ {s.rating}</div>
                    <div className="card-ov">
                      <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                      <div className="card-name">{s.name}</div>
                      <div className="card-sub"><span>{s.year}</span><span>·</span><span>{s.seasons}S</span></div>
                    </div>
                  </a>
                ))}
              </div>
              <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
            </div>
          </section>

          {/* ═══ GENRES ═══ */}
          <section className="section" id="section-genre">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">{T.genre}</h2>
            </div>
            <div className="genre-tabs" id="genreTabs">
              {topGenres.map((g, i) => (
                <button
                  key={g}
                  className={`genre-pill${activeGenre === g ? ' active' : ''}`}
                  data-genre={g}
                  onClick={() => setActiveGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            {topGenres.map((g, i) => (
              <div
                key={g}
                className="slider-outer genre-section"
                data-genre={g}
                style={activeGenre !== g ? { display: 'none' } : {}}
              >
                <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
                <div className="slider-track">
                  {(genreGroups[g] || []).map(s => (
                    <a key={s.slug} href={seriesUrl(s)} className="card">
                      <PosterImg s={s} />
                      <div className="card-rat">⭐ {s.rating}</div>
                      <div className="card-ov">
                        <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                        <div className="card-name">{s.name}</div>
                        <div className="card-sub"><span>⭐ {s.rating}</span><span>·</span><span>{s.year}</span></div>
                      </div>
                    </a>
                  ))}
                </div>
                <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
              </div>
            ))}
          </section>

          {/* ═══ WATCHLIST ═══ */}
          <section className="section" id="section-watchlist">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">{T.watchlist}</h2>
              <span className="sec-count">{resolvedWatchlist.length || ''}</span>
            </div>
            <div id="wlContent">
              {resolvedWatchlist.length === 0 ? (
                <div className="wl-empty" id="wlEmpty">
                  <div className="wl-empty-icon">📭</div>
                  <div className="wl-empty-title">{T.empty_wl}</div>
                  <div style={{ fontSize: '.8rem', marginTop: '4px' }}>{T.add_wl}</div>
                </div>
              ) : (
                <div className="slider-outer">
                  <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
                  <div className="slider-track">
                    {resolvedWatchlist.map(s => (
                      <a key={s.slug + (s.id || '')} href={s.url || `/series?slug=${encodeURIComponent(s.slug)}`} className="card">
                        <PosterImg s={s} />
                        <div className="card-rat">⭐ {s.rating}</div>
                        <div className="card-ov">
                          <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                          <div className="card-name">{s.name}</div>
                          <div className="card-sub"><span>{s.year}</span><span>·</span><span>{s.seasons}S</span></div>
                        </div>
                      </a>
                    ))}
                  </div>
                  <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
                </div>
              )}
            </div>
          </section>

          {/* ═══ TV CHANNELS ═══ */}
          <section className="section" id="section-tv-channels">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">📺 TV Channels</h2>
              <span className="sec-count">10</span>
            </div>
            <div className="slider-outer">
              <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
              <div className="slider-track" style={{ gap: '12px', padding: '8px 4px 16px' }}>
                {TV_CHANNELS.map(ch => (
                  <a key={ch.name} href="https://www.megaxtoon.eu/global/live.php" className="tv-channel-card" target="_blank" rel="noopener noreferrer">
                    <div className="tv-live-dot"></div>
                    <div className="tv-channel-icon">{ch.icon}</div>
                    <div className="tv-channel-name">{ch.name}</div>
                  </a>
                ))}
              </div>
              <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
            </div>
          </section>

          {/* ═══ EXPLORE ALL ═══ */}
          <section className="section">
            <div className="sec-head">
              <span className="sec-dot"></span>
              <h2 className="sec-title">{T.explore}</h2>
              <span className="sec-count">{filteredList.length}</span>
            </div>
            <div className="slider-outer">
              <button className="sl-btn left" onClick={slideLeft}>&#8249;</button>
              <div className="slider-track">
                {exploreAll.map(s => (
                  <a key={s.slug} href={seriesUrl(s)} className="card">
                    <PosterImg s={s} />
                    <div className="card-rat">⭐ {s.rating}</div>
                    <div className="card-ov">
                      <div className="card-play"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                      <div className="card-name">{s.name}</div>
                      <div className="card-sub"><span>⭐ {s.rating}</span><span>·</span><span>{s.year}</span></div>
                    </div>
                  </a>
                ))}
              </div>
              <button className="sl-btn right" onClick={slideRight}>&#8250;</button>
            </div>
          </section>
        </>
      )}

      {/* ═══ FOOTER ═══ */}
      <footer className="footer">
        <div className="foot-inner">
          <div className="foot-logo">{SITE_NAME}</div>
          <nav className="foot-links">
            <a href="/">Home</a>
            <a href="/#section-trending">Trending</a>
            <a href="/#section-genre">Browse</a>
            <a href="/#section-watchlist">My List</a>
            <a href="/ai-chat">StreamAI</a>
          </nav>
          <div className="foot-copy">© {new Date().getFullYear()} {SITE_NAME}</div>
        </div>
      </footer>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      <div className="bot-nav">
        <div className="bot-nav-inner">
          <a href="/" className="bot-item active">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Home
          </a>
          <a href="/#section-trending" className="bot-item" onClick={e => { e.preventDefault(); document.getElementById('section-trending')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
            Trending
          </a>
          <a href="/#section-genre" className="bot-item" onClick={e => { e.preventDefault(); document.getElementById('section-genre')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Browse
          </a>
          <a href="/#section-watchlist" className="bot-item" onClick={e => { e.preventDefault(); document.getElementById('section-watchlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            My List
          </a>
        </div>
      </div>

      {/* ═══ AI FAB ═══ */}
      <button className="ai-fab" id="aiFab" onClick={toggleAi} aria-label="StreamAI" aria-expanded={aiOpen}>🤖</button>
      <div className={`ai-panel${aiOpen ? ' open' : ''}`} id="aiPanel">
        <div className="ai-head">
          <div className="ai-avatar">🤖</div>
          <div>
            <div className="ai-name">StreamAI</div>
            <div className="ai-online">{T.online}</div>
          </div>
          <button className="ai-close" onClick={toggleAi}>✕</button>
        </div>
        <div className="ai-msgs" id="aiMsgs" ref={aiMsgsRef}>
          {aiMsgs.map((m, i) => (
            <div key={i} className={`ai-msg ${m.role}`}>
              <div className="ai-bub">{m.text}</div>
            </div>
          ))}
        </div>
        <div className="ai-inp-row">
          <input
            type="text"
            id="aiInput"
            placeholder={T.ai_ph}
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendAI(); }}
            autoComplete="off"
          />
          <button className="ai-send" onClick={sendAI}>{T.ai_send}</button>
        </div>
      </div>

      {/* ═══ TOAST STACK ═══ */}
      <div className="toast-stack" id="toastStack">
        {toasts.map(t => (
          <div key={t.id} className="toast show">{t.msg}</div>
        ))}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   FULL CSS — faithfully converted from PHP index.php
   ~825 lines of CSS, EXACT same as original, NO Tailwind
   ══════════════════════════════════════════════════════════════ */
const CSS = `
/* ══ RESET & BASE ══════════════════ */
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:      #141414;
  --bg2:     #0a0a0a;
  --bg3:     #1a1a1a;
  --surface: #1f1f1f;
  --surface2:#2a2a2a;
  --surface3:#333333;
  --border:  rgba(255,255,255,0.06);
  --border2: rgba(255,255,255,0.11);
  --border3: rgba(255,255,255,0.18);
  --text:    #e5e5e5;
  --text2:   #a3a3a3;
  --text3:   #737373;
  --red:     #e50914;
  --red2:    #b20710;
  --red3:    #ff3b30;
  --gold:    #f0b429;
  --green:   #2ecc71;
  --r:       4px;
  --rl:      8px;
  --hh:      64px;
  --mnh:     56px;
  --shadow:  0 8px 32px rgba(0,0,0,0.7);
  --tr:      0.18s cubic-bezier(0.4,0,0.2,1);
  --tr2:     0.32s cubic-bezier(0.4,0,0.2,1);
}
html { scroll-behavior: smooth; }
body {
  font-family: 'Outfit', -apple-system, sans-serif;
  background: var(--bg2);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
body.no-scroll { overflow: hidden; }
a { text-decoration: none; color: inherit; }
img { display: block; max-width: 100%; }
button { cursor: pointer; border: none; background: none; font-family: inherit; }
input { font-family: inherit; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--red); }

/* ══ HEADER ═══════════════════════════════════ */
.header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  height: var(--hh);
  display: flex; align-items: center;
  padding: 0 28px; gap: 20px;
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: background var(--tr2), border-color var(--tr2);
}
.header.scrolled {
  background: rgba(20,20,20,0.96);
  border-color: var(--border);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.logo { display: flex; align-items: center; gap: 0; flex-shrink: 0; text-decoration: none; }
.logo-text {
  font-family: 'Outfit', sans-serif;
  font-size: 1.65rem; font-weight: 900;
  color: var(--red);
  letter-spacing: -0.04em;
}

.nav { display: flex; align-items: center; gap: 2px; }
.nav a {
  font-size: 0.84rem; font-weight: 500;
  color: var(--text2);
  padding: 6px 12px; border-radius: var(--r);
  transition: color var(--tr);
  white-space: nowrap;
}
.nav a:hover, .nav a.active { color: var(--text); }

.header-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

/* search */
.search-wrap { position: relative; }
.search-wrap input {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  padding: 8px 12px 8px 34px;
  color: var(--text);
  font-size: 0.84rem;
  width: 190px; outline: none;
  transition: width var(--tr2), border-color var(--tr), box-shadow var(--tr);
}
.search-wrap input::placeholder { color: var(--text3); }
.search-wrap input:focus {
  width: 260px;
  border-color: rgba(229,9,20,0.5);
  box-shadow: 0 0 0 2px rgba(229,9,20,0.12);
}
.search-wrap .si { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--text3); pointer-events: none; }
.search-wrap input:focus ~ .si { color: var(--red); }

/* hamburger */
.hamburger {
  display: none; flex-direction: column; gap: 4px;
  width: 36px; height: 36px; align-items: center; justify-content: center;
  background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r);
  transition: background var(--tr); flex-shrink: 0;
}
.hamburger span { display: block; width: 16px; height: 1.5px; background: var(--text); border-radius: 2px; transition: transform 0.22s ease, opacity 0.22s ease; }
.hamburger.open span:nth-child(1) { transform: translateY(5.5px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-5.5px) rotate(-45deg); }

/* ══ MOBILE DRAWER ═══════════════════════════ */
.mob-overlay { display: none; position: fixed; inset: 0; z-index: 190; background: rgba(0,0,0,0.75); backdrop-filter: blur(6px); opacity: 0; pointer-events: none; transition: opacity var(--tr2); }
.mob-drawer { display: none; position: fixed; top: 0; right: 0; bottom: 0; z-index: 195; width: min(300px, 82vw); background: var(--bg3); border-left: 1px solid var(--border2); transform: translateX(100%); transition: transform var(--tr2); flex-direction: column; overflow-y: auto; padding-bottom: calc(var(--mnh) + env(safe-area-inset-bottom)); }
@media(max-width:768px) { .mob-overlay, .mob-drawer { display: flex; } }
.no-scroll .mob-overlay { opacity: 1; pointer-events: all; }
.no-scroll .mob-drawer { transform: translateX(0); }
.drawer-top { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.drawer-close { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: var(--surface); border-radius: 50%; font-size: 1rem; color: var(--text2); transition: all var(--tr); }
.drawer-close:hover { background: var(--surface2); color: var(--text); }
.drawer-nav { display: flex; flex-direction: column; gap: 1px; padding: 10px; }
.drawer-nav a { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--r); font-size: 0.92rem; font-weight: 500; color: var(--text2); transition: background var(--tr), color var(--tr); }
.drawer-nav a:hover, .drawer-nav a.active { background: var(--surface); color: var(--text); }

/* ══ BOTTOM NAV (mobile) ════════════════════════ */
.bot-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 180; height: calc(var(--mnh) + env(safe-area-inset-bottom)); background: rgba(10,10,10,0.97); border-top: 1px solid var(--border2); backdrop-filter: blur(24px); padding-bottom: env(safe-area-inset-bottom); }
.bot-nav-inner { height: var(--mnh); display: flex; align-items: center; }
.bot-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 100%; font-size: 0.57rem; font-weight: 700; letter-spacing: 0.04em; color: var(--text3); text-decoration: none; text-transform: uppercase; transition: color var(--tr); }
.bot-item svg { width: 20px; height: 20px; }
.bot-item.active { color: var(--red); }
.bot-item:hover { color: var(--text2); }
@media(max-width:768px) { .bot-nav { display: block; } }

/* ══ HERO ═══════════════════════════════════════ */
.hero { position: relative; height: 88vh; min-height: 520px; max-height: 860px; overflow: hidden; }
.hero-slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1s cubic-bezier(0.4,0,0.2,1); pointer-events: none; }
.hero-slide.active { opacity: 1; pointer-events: all; }
.hero-bg { position: absolute; inset: 0; background-size: cover; background-position: center 20%; transform: scale(1.05); transition: transform 9s ease; will-change: transform; }
.hero-slide.active .hero-bg { transform: scale(1); }
.hero-bg::before { content: ''; position: absolute; inset: 0; background: linear-gradient(105deg, rgba(20,20,20,0.97) 0%, rgba(20,20,20,0.75) 40%, rgba(20,20,20,0.1) 65%, rgba(20,20,20,0.4) 100%); }
.hero-bg::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 55%; background: linear-gradient(to top, var(--bg2) 0%, transparent 100%); }
.hero-content { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 52px 92px; max-width: 680px; }
.hero-badge { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; width: fit-content; }
.hb-new { background: var(--red); color: #fff; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; padding: 4px 10px; border-radius: 2px; }
.hb-rank { background: rgba(255,255,255,0.07); border: 1px solid var(--border3); color: var(--text2); font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 2px; }
.hero-title { font-family: 'Outfit', sans-serif; font-size: clamp(2rem, 4.5vw, 3.8rem); font-weight: 900; line-height: 1.04; letter-spacing: -0.03em; margin-bottom: 12px; color: #fff; text-shadow: 0 2px 24px rgba(0,0,0,0.5); }
.hero-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; flex-wrap: wrap; }
.hero-tag { font-size: 0.73rem; font-weight: 600; color: var(--text2); background: rgba(255,255,255,0.07); border: 1px solid var(--border2); padding: 3px 10px; border-radius: 2px; }
.hero-desc { font-size: 0.88rem; line-height: 1.72; color: var(--text2); margin-bottom: 24px; max-width: 480px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.hero-acts { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* ── BUTTONS ── */
.btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: #000; font-weight: 700; font-size: 0.92rem; padding: 12px 26px; border-radius: var(--r); border: none; cursor: pointer; font-family: inherit; transition: background var(--tr), transform var(--tr); letter-spacing: 0.01em; }
.btn-primary:hover { background: rgba(255,255,255,0.85); transform: scale(1.02); }
.btn-primary svg { width: 18px; height: 18px; flex-shrink: 0; }
.btn-ghost { display: inline-flex; align-items: center; gap: 8px; background: rgba(109,109,110,0.5); color: var(--text); font-weight: 600; font-size: 0.88rem; padding: 12px 22px; border-radius: var(--r); border: none; cursor: pointer; font-family: inherit; transition: background var(--tr); backdrop-filter: blur(8px); }
.btn-ghost:hover { background: rgba(109,109,110,0.7); }
.btn-ghost svg { width: 16px; height: 16px; flex-shrink: 0; }

.hero-dots { position: absolute; bottom: 36px; right: 52px; z-index: 3; display: flex; gap: 6px; align-items: center; }
.hdot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.25); border: none; cursor: pointer; transition: background var(--tr), width var(--tr); padding: 0; }
.hdot.active { width: 24px; border-radius: 3px; background: var(--red); }
.hero-prog { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; height: 2px; background: rgba(255,255,255,0.05); }
.hero-prog-bar { height: 100%; background: var(--red); width: 0%; transition: width 6s linear; }

/* ══ STATS STRIP ════════════════════════════════ */
.stats-strip { margin: 0 36px 44px; display: flex; background: rgba(20,20,20,0.8); border: 1px solid var(--border2); border-radius: var(--r); overflow: hidden; backdrop-filter: blur(12px); }
.stat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 14px; border-right: 1px solid var(--border); gap: 4px; transition: background var(--tr); }
.stat:last-child { border-right: none; }
.stat:hover { background: rgba(255,255,255,0.02); }
.stat-val { font-family: 'Outfit', sans-serif; font-size: 1.7rem; font-weight: 900; color: var(--red); line-height: 1; letter-spacing: -0.02em; }
.stat-lbl { font-size: 0.64rem; font-weight: 700; color: var(--text3); text-transform: uppercase; letter-spacing: 0.11em; }

/* ══ SECTIONS ════════════════════════════════════ */
.section { padding: 32px 0 4px; position: relative; z-index: 1; }
.sec-head { display: flex; align-items: center; gap: 10px; padding: 0 36px; margin-bottom: 14px; }
.sec-dot { width: 3px; height: 20px; border-radius: 2px; background: var(--red); flex-shrink: 0; }
.sec-title { font-family: 'Outfit', sans-serif; font-size: 1.12rem; font-weight: 800; letter-spacing: -0.02em; color: #fff; }
.sec-count { font-size: 0.7rem; color: var(--text3); background: var(--surface); border: 1px solid var(--border); padding: 2px 8px; border-radius: 20px; font-weight: 600; }
.sec-badge { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; padding: 3px 9px; border-radius: 2px; }
.sec-badge.hot { background: rgba(229,9,20,0.15); color: var(--red3); border: 1px solid rgba(229,9,20,0.25); }
.sec-badge.new { background: rgba(46,204,113,0.12); color: var(--green); border: 1px solid rgba(46,204,113,0.22); }
.sec-all { margin-left: auto; font-size: 0.75rem; font-weight: 700; color: var(--text2); display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: var(--r); transition: color var(--tr), background var(--tr); }
.sec-all::after { content: '→'; }
.sec-all:hover { color: var(--text); background: rgba(255,255,255,0.05); }

/* ══ SLIDERS ═════════════════════════════════════ */
.slider-outer { position: relative; padding: 0 36px; }
.slider-track { display: flex; gap: 4px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; padding-bottom: 8px; -ms-overflow-style: none; scrollbar-width: none; }
.slider-track::-webkit-scrollbar { display: none; }
.sl-btn { position: absolute; top: 0; bottom: 8px; width: 36px; background: rgba(0,0,0,0.6); border: none; color: var(--text); display: flex; align-items: center; justify-content: center; z-index: 10; transition: background var(--tr); cursor: pointer; font-size: 1.2rem; opacity: 0; }
.slider-outer:hover .sl-btn { opacity: 1; }
.sl-btn:hover { background: rgba(0,0,0,0.85); }
.sl-btn.left { left: 0; border-radius: 0 var(--r) var(--r) 0; }
.sl-btn.right { right: 0; border-radius: var(--r) 0 0 var(--r); }
.slider-outer::before, .slider-outer::after { content: ''; position: absolute; top: 0; bottom: 8px; width: 36px; z-index: 5; pointer-events: none; }
.slider-outer::before { left: 36px; background: linear-gradient(to right, var(--bg2), transparent); }
.slider-outer::after { right: 36px; background: linear-gradient(to left, var(--bg2), transparent); }

/* ══ POSTER PLACEHOLDER ════════════════════════ */
.card-img-ph { width: 100%; aspect-ratio: 2/3; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--surface2); gap: 8px; }
.card-img-ph svg { width: 28px; height: 28px; color: var(--text3); opacity: 0.4; }
.card-img-ph span { font-size: 0.62rem; color: var(--text3); font-weight: 600; text-align: center; padding: 0 8px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cw-img-ph { width: 100%; aspect-ratio: 16/9; display: flex; align-items: center; justify-content: center; background: var(--surface2); }
.cw-img-ph svg { width: 28px; height: 28px; color: var(--text3); opacity: 0.35; }

/* ══ CARD — portrait ════════════════════════════ */
.card { flex-shrink: 0; width: 185px; scroll-snap-align: start; overflow: hidden; position: relative; cursor: pointer; background: var(--surface); transition: transform var(--tr2), box-shadow var(--tr2), z-index 0s; z-index: 0; }
.card:hover { transform: scale(1.08); box-shadow: 0 16px 48px rgba(0,0,0,0.75); z-index: 5; }
.card-img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; transition: transform 0.5s ease; }
.card:hover .card-img { transform: scale(1.04); }
.card-ov { position: absolute; inset: 0; background: linear-gradient(to top, rgba(20,20,20,0.98) 0%, rgba(20,20,20,0.5) 40%, transparent 65%); opacity: 0; transition: opacity var(--tr); display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; }
.card:hover .card-ov { opacity: 1; }
.card-play { width: 36px; height: 36px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; flex-shrink: 0; }
.card-play svg { width: 14px; height: 14px; color: #000; margin-left: 2px; fill: #000; }
.card-name { font-size: 0.76rem; font-weight: 700; color: var(--text); line-height: 1.3; margin-bottom: 3px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.card-sub { display: flex; align-items: center; gap: 5px; font-size: 0.65rem; color: var(--text2); }
.card-badge { position: absolute; top: 6px; left: 6px; font-size: 0.57rem; font-weight: 800; padding: 3px 7px; border-radius: 2px; letter-spacing: 0.07em; z-index: 2; }
.card-badge.rank { background: var(--red); color: #fff; }
.card-badge.nb { background: rgba(46,204,113,0.18); border: 1px solid rgba(46,204,113,0.32); color: var(--green); }
.card-badge.hot { background: rgba(229,9,20,0.18); border: 1px solid rgba(229,9,20,0.3); color: var(--red3); }
.card-rat { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.82); border: 1px solid rgba(255,255,255,0.12); color: var(--gold); font-size: 0.62rem; font-weight: 700; padding: 3px 7px; border-radius: 2px; backdrop-filter: blur(4px); display: flex; align-items: center; gap: 3px; z-index: 2; }

/* ── history badge ── */
.card-hist-time { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.82); color: var(--text3); font-size: 0.58rem; font-weight: 600; padding: 4px 8px; text-align: center; letter-spacing: 0.04em; z-index: 3; }

/* ══ CARD — wide ════════════════════════════════ */
.card-wide { flex-shrink: 0; width: 310px; scroll-snap-align: start; overflow: hidden; position: relative; cursor: pointer; background: var(--surface); transition: transform var(--tr2), box-shadow var(--tr2); z-index: 0; }
.card-wide:hover { transform: scale(1.04); box-shadow: 0 14px 44px rgba(0,0,0,0.7); z-index: 5; }
.cw-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; object-position: top; display: block; transition: transform 0.5s ease; }
.card-wide:hover .cw-img { transform: scale(1.05); }
.cw-body { padding: 11px 13px 13px; }
.cw-title { font-size: 0.85rem; font-weight: 700; color: var(--text); margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cw-meta { display: flex; align-items: center; gap: 7px; }
.cw-rat { font-size: 0.73rem; font-weight: 700; color: var(--gold); display: flex; align-items: center; gap: 3px; }
.cw-genre { font-size: 0.67rem; color: var(--text3); background: var(--surface2); padding: 2px 8px; border-radius: 20px; font-weight: 600; }

/* ══ GENRE TABS ══════════════════════════════════ */
.genre-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 36px; margin-bottom: 14px; }
.genre-pill { padding: 7px 16px; border-radius: 2px; border: 1px solid var(--border2); font-size: 0.76rem; font-weight: 700; color: var(--text2); background: var(--surface); cursor: pointer; transition: all var(--tr); letter-spacing: 0.01em; }
.genre-pill:hover { border-color: rgba(229,9,20,0.45); color: var(--text); background: rgba(229,9,20,0.06); }
.genre-pill.active { background: rgba(229,9,20,0.15); border-color: rgba(229,9,20,0.45); color: #fff; }

/* ══ SEARCH RESULTS ══════════════════════════════ */
.search-sec { padding: calc(var(--hh) + 28px) 36px 44px; position: relative; z-index: 1; }
.search-h { font-family: 'Outfit', sans-serif; font-size: 1.4rem; font-weight: 800; margin-bottom: 22px; letter-spacing: -0.025em; }
.search-h em { font-style: normal; color: var(--red); }
.res-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 4px; }
.res-card { overflow: hidden; background: var(--surface); transition: transform var(--tr); cursor: pointer; text-decoration: none; color: inherit; display: block; }
.res-card:hover { transform: scale(1.04); box-shadow: var(--shadow); }
.res-body { padding: 10px 12px; }
.res-title { font-size: 0.82rem; font-weight: 700; margin-bottom: 3px; line-height: 1.3; }
.res-meta { font-size: 0.69rem; color: var(--text3); }
.no-res { text-align: center; padding: 60px 20px; color: var(--text3); }
.no-res-icon { font-size: 2.8rem; margin-bottom: 10px; opacity: 0.35; }

/* ══ WATCHLIST EMPTY ════════════════════════════ */
.wl-empty { margin: 0 36px; padding: 44px 28px; text-align: center; background: var(--surface); border: 1.5px dashed var(--border2); border-radius: var(--r); color: var(--text3); }
.wl-empty-icon { font-size: 2.4rem; margin-bottom: 10px; opacity: 0.35; }
.wl-empty-title { font-size: 0.96rem; font-weight: 700; color: var(--text2); margin-bottom: 4px; }

/* ══ FOOTER ══════════════════════════════════════ */
.footer { margin-top: 60px; border-top: 1px solid var(--border); padding-bottom: calc(var(--mnh) + 20px); position: relative; z-index: 1; }
.foot-inner { display: flex; align-items: center; gap: 20px; padding: 26px 36px; flex-wrap: wrap; }
.foot-logo { font-family: 'Outfit', sans-serif; font-size: 1.3rem; font-weight: 900; color: var(--red); letter-spacing: -0.04em; }
.foot-links { display: flex; gap: 18px; flex-wrap: wrap; }
.foot-links a { font-size: 0.78rem; color: var(--text3); transition: color var(--tr); font-weight: 500; }
.foot-links a:hover { color: var(--text2); }
.foot-copy { margin-left: auto; font-size: 0.72rem; color: var(--text3); }

/* ══ TOAST ════════════════════════════════════════ */
.toast-stack { position: fixed; bottom: calc(var(--mnh) + 14px); right: 18px; z-index: 999; display: flex; flex-direction: column; gap: 7px; align-items: flex-end; }
@media(min-width:769px) { .toast-stack { bottom: 22px; } }
.toast { background: rgba(20,20,20,0.98); border: 1px solid var(--border2); border-radius: var(--r); padding: 11px 16px; font-size: 0.82rem; color: var(--text); box-shadow: var(--shadow); transform: translateX(110%); transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); max-width: 260px; pointer-events: none; }
.toast.show { transform: translateX(0); }

/* ══ AI CHAT ══════════════════════════════════════ */
.ai-fab { position: fixed; bottom: calc(var(--mnh) + 14px); left: 22px; z-index: 180; width: 50px; height: 50px; background: var(--red); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(229,9,20,0.4); cursor: pointer; transition: transform var(--tr), box-shadow var(--tr); border: none; font-size: 1.2rem; }
.ai-fab:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 10px 32px rgba(229,9,20,0.5); }
@media(min-width:769px) { .ai-fab { bottom: 26px; } }
.ai-panel { position: fixed; bottom: calc(var(--mnh) + 78px); left: 22px; z-index: 180; width: 320px; background: rgba(20,20,20,0.98); border: 1px solid var(--border2); border-radius: var(--rl); box-shadow: var(--shadow); display: flex; flex-direction: column; max-height: 460px; opacity: 0; pointer-events: none; transform: translateY(16px) scale(0.97); transform-origin: bottom left; transition: opacity var(--tr), transform var(--tr); overflow: hidden; backdrop-filter: blur(24px); }
.ai-panel.open { opacity: 1; pointer-events: all; transform: translateY(0) scale(1); }
@media(min-width:769px) { .ai-panel { bottom: 96px; } }
@media(max-width:480px) { .ai-panel { width: calc(100vw - 30px); left: 15px; } }
.ai-head { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.ai-avatar { width: 32px; height: 32px; background: var(--red); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0; }
.ai-name { font-weight: 700; font-size: 0.86rem; }
.ai-online { display: flex; align-items: center; gap: 4px; font-size: 0.65rem; color: var(--green); }
.ai-online::before { content: ''; width: 5px; height: 5px; background: var(--green); border-radius: 50%; display: inline-block; }
.ai-close { margin-left: auto; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; background: var(--surface2); border-radius: 50%; font-size: 0.9rem; color: var(--text3); transition: all var(--tr); }
.ai-close:hover { background: var(--surface3); color: var(--text); }
.ai-msgs { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 9px; min-height: 160px; }
.ai-msg { max-width: 86%; }
.ai-msg.bot { align-self: flex-start; }
.ai-msg.user { align-self: flex-end; }
.ai-bub { padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; line-height: 1.55; }
.ai-msg.bot .ai-bub { background: var(--surface2); color: var(--text); border-radius: 3px 12px 12px 12px; }
.ai-msg.user .ai-bub { background: var(--red); color: #fff; font-weight: 600; border-radius: 12px 3px 12px 12px; }
.ai-sugg-list { display: flex; flex-direction: column; gap: 5px; margin-top: 7px; }
.ai-sugg-item { display: flex; align-items: center; gap: 7px; background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r); padding: 7px 10px; cursor: pointer; transition: all var(--tr); font-size: 0.76rem; text-decoration: none; color: var(--text); }
.ai-sugg-item:hover { background: var(--surface2); border-color: rgba(229,9,20,0.3); }
.ai-inp-row { display: flex; gap: 7px; padding: 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
.ai-inp-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border2); border-radius: var(--r); padding: 8px 11px; color: var(--text); font-size: 0.8rem; outline: none; transition: border-color var(--tr); font-family: inherit; }
.ai-inp-row input:focus { border-color: rgba(229,9,20,0.5); }
.ai-inp-row input::placeholder { color: var(--text3); }
.ai-send { background: var(--red); color: #fff; border-radius: var(--r); padding: 8px 14px; font-weight: 700; font-size: 0.8rem; transition: background var(--tr); flex-shrink: 0; }
.ai-send:hover { background: var(--red2); }

/* ══ RESPONSIVE ════════════════════════════════ */
@media(max-width:768px) {
  .nav, .header-right .search-wrap { display: none; }
  .hamburger { display: flex; }
  .hero-content { padding: 0 24px 80px; max-width: 100%; }
  .hero-dots { right: 24px; bottom: 28px; }
  .stats-strip { margin: 0 16px 36px; }
  .sec-head { padding: 0 20px; }
  .slider-outer { padding: 0 20px; }
  .slider-outer::before { left: 20px; }
  .slider-outer::after { right: 20px; }
  .genre-tabs { padding: 0 20px; }
  .search-sec { padding: calc(var(--hh) + 20px) 20px 36px; }
  .wl-empty { margin: 0 20px; }
  .foot-inner { padding: 22px 20px; }
  .card { width: 140px; }
  .card-wide { width: 240px; }
}
@media(max-width:480px) {
  .hero-title { font-size: clamp(1.6rem, 7vw, 2.4rem); }
  .hero-desc { font-size: 0.82rem; -webkit-line-clamp: 2; }
  .hero-acts { gap: 8px; }
  .btn-primary, .btn-ghost { padding: 10px 18px; font-size: 0.85rem; }
}

/* ── XP Header Badge ── */
.xp-hbadge {
  display: inline-flex; align-items: center; gap: 7px;
  background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.32);
  border-radius: 24px; padding: 4px 12px 4px 5px;
  text-decoration: none; flex-shrink: 0;
  transition: background .18s, border-color .18s;
}
.xp-hbadge:hover { background: rgba(229,9,20,0.2); border-color: rgba(229,9,20,0.55); }
.xp-hcircle {
  width: 26px; height: 26px; border-radius: 50%;
  background: linear-gradient(135deg, #e50914, #b20710);
  display: flex; align-items: center; justify-content: center;
  font-size: .65rem; font-weight: 900; color: #fff;
  box-shadow: 0 0 10px rgba(229,9,20,.45); flex-shrink: 0;
}
.xp-hinfo { display: flex; flex-direction: column; gap: 1px; }
.xp-hrank { font-size: .52rem; font-weight: 700; color: #f59e0b; letter-spacing: .05em; text-transform: uppercase; line-height: 1; }
.xp-hpts  { font-size: .65rem; font-weight: 800; color: #fff; line-height: 1; }
.xp-hpts em { color: #e50914; font-style: normal; }
.xp-hbar { width: 54px; height: 3px; background: rgba(255,255,255,.1); border-radius: 2px; margin-top: 2px; overflow: hidden; }
.xp-hbar-fill { height: 100%; background: linear-gradient(90deg,#e50914,#ff4b55); border-radius: 2px; }
@media(max-width:540px) { .xp-hbadge .xp-hinfo { display: none; } }

/* ═══ USER PILL (logged-in user) ═══ */
.user-pill {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 4px 12px 4px 4px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24px;
  text-decoration: none;
  transition: all .18s;
  flex-shrink: 0;
}
.user-pill:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.2);
}
.user-avatar-frame {
  width: 34px; height: 34px;
  padding: 0;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.user-avatar-frame .user-avatar-img {
  width: 34px; height: 34px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-letter-circle {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 800;
}
.user-pill-info {
  display: flex; flex-direction: column; gap: 1px;
  min-width: 0;
}
.user-pill-info .username-display {
  font-size: 0.82rem; font-weight: 700; color: #fff;
  max-width: 120px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.1;
}
.user-pill-info .user-nickname {
  font-size: 0.62rem; font-weight: 600;
  max-width: 120px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.1;
}
.user-badge {
  font-size: 0.56rem; font-weight: 800;
  padding: 3px 8px; border-radius: 12px;
  white-space: nowrap; flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 3px;
  line-height: 1;
  border: 1px solid;
}
.user-level-pill {
  font-size: 0.62rem; font-weight: 800;
  padding: 3px 8px; border-radius: 12px;
  background: linear-gradient(135deg, #e50914, #b20710);
  color: #fff; flex-shrink: 0;
  box-shadow: 0 0 8px rgba(229,9,20,0.35);
}
.user-level-pill.lvl6 {
  background: linear-gradient(135deg, #ff0080, #ff8c00, #ffd700, #00ff7f, #00bfff, #8a2be2);
  background-size: 200% 100%;
  animation: rgbFlow 3s linear infinite;
}
@keyframes rgbFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }

.logout-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(229,9,20,0.1);
  border: 1px solid rgba(229,9,20,0.3);
  color: #ff6b6b; font-size: 1rem;
  transition: all .18s;
  flex-shrink: 0;
}
.logout-btn:hover {
  background: rgba(229,9,20,0.25);
  border-color: rgba(229,9,20,0.5);
  color: #ff8c8c;
}

/* Compact mobile header layout */
@media (max-width: 900px) {
  .user-pill-info { display: none; }
}
@media (max-width: 700px) {
  .user-level-pill { display: none; }
}
@media (max-width: 540px) {
  .nav { display: none; }
}

/* ══════════════════════════════════════════════════════════════════════
   ☀️ YAZ KOLEKSİYONU — Summer Collection banner + slider
   Animated shifting gradient background + floating, color-changing
   "lava lamp" blobs in a tropical summer palette. Pure CSS, additive
   only — does not alter any rule above.
   ══════════════════════════════════════════════════════════════════════ */
.summer-wrap { padding: 28px 0 4px; }
.summer-banner {
  position: relative;
  margin: 0 36px;
  border-radius: var(--rl);
  overflow: hidden;
  isolation: isolate;
  box-shadow: 0 18px 50px rgba(255,90,60,0.18), 0 2px 0 rgba(255,255,255,0.06) inset;
}
.summer-banner::before {
  content: '';
  position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(115deg, #ff5e3a 0%, #ff8c42 18%, #ffd23f 36%, #ff4d8d 58%, #2ee6c7 78%, #ff5e3a 100%);
  background-size: 340% 340%;
  animation: summerGradientShift 16s ease-in-out infinite;
}
.summer-lava {
  position: absolute; inset: -10%; z-index: 1;
  filter: blur(46px) saturate(1.3);
  mix-blend-mode: soft-light;
  pointer-events: none;
}
.lava-blob {
  position: absolute;
  border-radius: 50%;
  opacity: 0.85;
  will-change: transform, filter;
}
.lava-blob.b1 { width: 30%; aspect-ratio: 1/1; left: -6%;  top: -12%;
  background: radial-gradient(circle at 35% 35%, #fff3b0, #ff8c42 55%, transparent 100%);
  animation: lavaDrift1 19s ease-in-out infinite, lavaHue 13s linear infinite; }
.lava-blob.b2 { width: 24%; aspect-ratio: 1/1; left: 22%; top: 35%;
  background: radial-gradient(circle at 40% 40%, #ffe066, #ff4d8d 60%, transparent 100%);
  animation: lavaDrift2 23s ease-in-out infinite, lavaHue 17s linear infinite reverse; animation-delay: -4s, -6s; }
.lava-blob.b3 { width: 32%; aspect-ratio: 1/1; left: 55%; top: -18%;
  background: radial-gradient(circle at 45% 35%, #b8fff0, #2ee6c7 55%, transparent 100%);
  animation: lavaDrift3 21s ease-in-out infinite, lavaHue 15s linear infinite; animation-delay: -9s, -3s; }
.lava-blob.b4 { width: 22%; aspect-ratio: 1/1; left: 70%; top: 40%;
  background: radial-gradient(circle at 35% 35%, #ffd6e8, #ff5e3a 60%, transparent 100%);
  animation: lavaDrift1 26s ease-in-out infinite reverse, lavaHue 19s linear infinite; animation-delay: -11s, -7s; }
.lava-blob.b5 { width: 20%; aspect-ratio: 1/1; left: 4%; top: 55%;
  background: radial-gradient(circle at 40% 40%, #fffbe0, #ffd23f 55%, transparent 100%);
  animation: lavaDrift2 18s ease-in-out infinite, lavaHue 12s linear infinite reverse; animation-delay: -2s, -10s; }
@keyframes summerGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes lavaDrift1 {
  0%,100% { transform: translate(0,0) scale(1); }
  33%     { transform: translate(14%, 10%) scale(1.25); }
  66%     { transform: translate(-8%, 16%) scale(0.85); }
}
@keyframes lavaDrift2 {
  0%,100% { transform: translate(0,0) scale(1); }
  50%     { transform: translate(-16%, -12%) scale(1.35); }
}
@keyframes lavaDrift3 {
  0%,100% { transform: translate(0,0) scale(1); }
  40%     { transform: translate(10%, -14%) scale(1.15); }
  70%     { transform: translate(-13%, 8%) scale(0.9); }
}
@keyframes lavaHue {
  0%   { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}
.summer-banner-content { position: relative; z-index: 2; padding: 30px 32px 26px; }
.summer-head { padding: 0; margin-bottom: 18px; align-items: flex-start; gap: 14px; }
.summer-icon {
  font-size: 1.8rem; line-height: 1;
  filter: drop-shadow(0 2px 10px rgba(0,0,0,0.25));
  animation: sunPulse 3.4s ease-in-out infinite;
}
@keyframes sunPulse { 0%,100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.12) rotate(8deg); } }
.summer-title {
  color: #fff; font-size: 1.3rem; font-weight: 900; letter-spacing: -0.02em;
  text-shadow: 0 2px 14px rgba(0,0,0,0.35); margin-bottom: 3px;
}
.summer-sub { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.92); text-shadow: 0 1px 8px rgba(0,0,0,0.3); }
.summer-count {
  margin-left: auto; background: rgba(0,0,0,0.28); color: #fff; border: 1px solid rgba(255,255,255,0.35);
  backdrop-filter: blur(6px); font-weight: 800;
}
.summer-slider-outer::before { background: linear-gradient(to right, rgba(255,94,58,0.55), transparent); }
.summer-slider-outer::after  { background: linear-gradient(to left, rgba(46,230,199,0.45), transparent); }
.card.summer-card { box-shadow: 0 6px 22px rgba(0,0,0,0.35); }
.card-badge.summer {
  background: linear-gradient(135deg, #ffd23f, #ff5e3a); color: #3a1500;
  box-shadow: 0 0 10px rgba(255,140,40,0.55);
}
.summer-empty {
  margin: 0 32px; padding: 10px 0 2px; font-size: 0.8rem; font-weight: 600;
  color: rgba(255,255,255,0.85); position: relative; z-index: 2;
}
@media (max-width: 768px) {
  .summer-banner { margin: 0 20px; }
  .summer-banner-content { padding: 24px 20px 20px; }
  .summer-title { font-size: 1.1rem; }
}
@media (prefers-reduced-motion: reduce) {
  .summer-banner::before, .lava-blob, .summer-icon { animation: none !important; }
}

/* ══ TV CHANNELS SLIDER ════════════════════════════════════════════════════
   Square channel cards — independent of config, always link to
   https://www.megaxtoon.eu/global/live.php
   ════════════════════════════════════════════════════════════════════════ */
.tv-channel-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 140px;
  min-width: 140px;
  min-height: 140px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--rl);
  text-decoration: none;
  color: var(--text);
  gap: 10px;
  padding: 14px 10px;
  transition: background var(--tr), border-color var(--tr), transform var(--tr), box-shadow var(--tr);
  cursor: pointer;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.tv-channel-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(229,9,20,0.08) 0%, transparent 60%);
  opacity: 0;
  transition: opacity var(--tr);
}
.tv-channel-card:hover {
  background: var(--surface2);
  border-color: rgba(229,9,20,0.45);
  transform: translateY(-4px) scale(1.04);
  box-shadow: 0 12px 32px rgba(229,9,20,0.18);
}
.tv-channel-card:hover::before { opacity: 1; }
.tv-channel-icon {
  font-size: 2rem;
  line-height: 1;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
  position: relative; z-index: 1;
}
.tv-channel-name {
  font-size: 0.68rem;
  font-weight: 800;
  text-align: center;
  color: var(--text);
  letter-spacing: 0.04em;
  line-height: 1.3;
  position: relative; z-index: 1;
  word-break: break-word;
}
.tv-live-dot {
  position: absolute;
  top: 10px; right: 10px;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
  animation: tvLivePulse 1.6s ease-in-out infinite;
}
@keyframes tvLivePulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50%     { opacity: 0.5; transform: scale(1.35); }
}
@media (max-width: 480px) {
  .tv-channel-card { width: 120px; height: 120px; min-width: 120px; min-height: 120px; }
  .tv-channel-icon { font-size: 1.6rem; }
  .tv-channel-name { font-size: 0.6rem; }
}
`;