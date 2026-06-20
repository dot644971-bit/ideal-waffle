'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { SERIES_LIST, getSeriesBySlug, posterUrl, SITE_NAME } from '@/lib/config';
import type { Series, Episode } from '@/lib/types';

/* ═══════════════════════════════════════════════════════════════════════════
   LocalStorage helpers for liked / notifications (mirrors PHP session logic)
   ═══════════════════════════════════════════════════════════════════════════ */
const LS_KEYS = {
  like: 'mx_liked',
  notify: 'mx_notifications',
} as const;

function lsGet(k: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(k) || '[]');
  } catch {
    return [];
  }
}

function lsForceSet(k: string, v: string, on: boolean) {
  const a = lsGet(k);
  const i = a.indexOf(v);
  if (on && i === -1) {
    a.push(v);
    localStorage.setItem(k, JSON.stringify(a));
  } else if (!on && i !== -1) {
    a.splice(i, 1);
    localStorage.setItem(k, JSON.stringify(a));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Generate demo episodes (same as PHP fallback — 12 eps with dQw4w9WgXcQ)
   ═══════════════════════════════════════════════════════════════════════════ */
function generateDemoEpisodes(seriesName: string): Episode[] {
  const eps: Episode[] = [];
  for (let i = 1; i <= 12; i++) {
    eps.push({
      videoId: 'dQw4w9WgXcQ',
      title: `${seriesName} — Episode ${i}`,
      description: 'Episode description will appear here.',
      thumbnail: `https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg`,
      position: i - 1,
    });
  }
  return eps;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SeriesPage component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function SeriesPage() {
  /* ── FIX: Read slug from BOTH the store (in-app nav) AND the URL (direct load) ── */
  const storeSlug = useAppStore((s) => s.pageParams.slug || '');
  const setPageParams = useAppStore((s) => s.setPageParams);
  const navigate = useAppStore((s) => s.navigate);
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist);
  const isInWatchlist = useAppStore((s) => s.isInWatchlist);
  const recordWatched = useAppStore((s) => s.recordWatched);

  /* ── FIX: On direct URL load (/series?slug=...), seed the store from the URL ── */
  const [urlSlug, setUrlSlug] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('slug') || '';
      if (fromUrl && !storeSlug) {
        setPageParams({ slug: fromUrl });
      }
      setUrlSlug(fromUrl);
    }
  }, [storeSlug, setPageParams]);

  /* ── Use store slug when available (in-app nav), fall back to URL slug ── */
  const slug = storeSlug || urlSlug;

  // Find the series
  const series: Series | undefined = getSeriesBySlug(slug);

  // Generate episodes
  const episodes: Episode[] = series ? generateDemoEpisodes(series.name) : [];
  const firstVideo = episodes.length > 0 ? episodes[0].videoId : '';

  // Local state for liked / notified (stored in localStorage, synced with PHP session pattern)
  const [isLiked, setIsLiked] = useState(false);
  const [isNotified, setIsNotified] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);

  // Toast messages
  const [toasts, setToasts] = useState<string[]>([]);

  // Refs for IntersectionObserver
  const revealRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const sliderOuterRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  // Initialize local states from localStorage
  useEffect(() => {
    if (!slug) return;
    setIsLiked(lsGet(LS_KEYS.like).includes(slug));
    setIsNotified(lsGet(LS_KEYS.notify).includes(slug));
    setInWatchlist(isInWatchlist(undefined, slug));
  }, [slug, isInWatchlist]);

  // Record this series in watch history on mount
  useEffect(() => {
    if (!series) return;
    recordWatched({
      slug: series.slug,
      name: series.name,
      poster_url: series.poster_url,
      rating: series.rating,
      year: series.year,
      seasons: series.seasons,
      genre: series.genre,
      url: `series?slug=${encodeURIComponent(series.slug)}`,
      watchedAt: Date.now(),
    });
  }, [series, recordWatched]);

  // IntersectionObserver for reveal animations
  useEffect(() => {
    const container = revealRef.current;
    if (!container) return;
    const targets = container.querySelectorAll('.reveal, .sec-label');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    targets.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, []);

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((_, i) => i !== 0));
    }, 2800);
  }, []);

  // Action handlers
  const handleLike = () => {
    const next = !isLiked;
    setIsLiked(next);
    lsForceSet(LS_KEYS.like, slug, next);
    showToast(next ? 'Liked!' : 'Like removed.');
  };

  const handleWatchlist = () => {
    if (!series) return;
    const added = toggleWatchlist({
      slug: series.slug,
      name: series.name,
      poster_url: series.poster_url,
      rating: series.rating,
      year: series.year,
      seasons: series.seasons,
      genre: series.genre,
      url: `series?slug=${encodeURIComponent(series.slug)}`,
    });
    setInWatchlist(added);
    showToast(added ? 'Added to list!' : 'Removed from list.');
  };

  const handleNotify = () => {
    const next = !isNotified;
    setIsNotified(next);
    lsForceSet(LS_KEYS.notify, slug, next);
    showToast(next ? 'Notifications turned on!' : 'Notifications turned off.');
  };

  // Slider navigation
  const sliderScrollBy = (direction: 'prev' | 'next') => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const step = 180;
    track.scrollBy({ left: direction === 'prev' ? -step * 3 : step * 3, behavior: 'smooth' });
  };

  // Touch handling for slider
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const track = sliderTrackRef.current;
    if (!track) return;
    const d = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(d) > 40) track.scrollBy({ left: d * 1.5, behavior: 'smooth' });
  };

  // Navigate to player
  const playEpisode = (videoId: string, ep?: number) => {
    navigate('player', {
      slug,
      video: videoId,
      ...(ep !== undefined ? { ep: String(ep) } : {}),
    });
  };

  // Navigate to series detail
  const goToSeries = (s: string) => {
    navigate('series', { slug: s });
  };

  // Similar series (exclude current, max 12)
  const similar = series
    ? SERIES_LIST.filter((s) => s.slug !== slug).slice(0, 12)
    : [];

  // Genre list (first 3)
  const genres = series
    ? series.genre
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  // Cast list
  const cast = series
    ? (series as Series & { cast?: string }).cast
        ?.split(',')
        .map((c) => c.trim())
        .filter(Boolean) ?? []
    : [];

  // Episodes count from series data
  const seriesEpCount = series?.episodes
    ? parseInt(series.episodes, 10)
    : undefined;

  const currentYear = new Date().getFullYear();

  // Poster error handler
  const [posterError, setPosterError] = useState(false);

  /* ── Not Found ── */
  if (!series) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: '#e5e5e5',
          fontFamily: "'Outfit', sans-serif",
          background: '#0a0a0a',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#fff' }}>
          Series Not Found
        </h1>
        <button
          className="btn-primary"
          onClick={() => navigate('home')}
          style={{
            background: '#fff',
            color: '#000',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '0.95rem',
            fontWeight: 700,
            padding: '12px 26px',
            borderRadius: '3px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ← Go Home
        </button>
        <style>{cssBlock}</style>
      </div>
    );
  }

  return (
    <>
      <style>{cssBlock}</style>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* ── NAVBAR ── */}
      <nav id="nav">
        <div className="nav-inner">
          <a
            href="#"
            className="nav-logo"
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
          >
            {SITE_NAME}
          </a>

          <form
            className="nav-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="text"
              placeholder="Search series, anime..."
              autoComplete="off"
              aria-label="Search"
              readOnly
            />
          </form>

          <a
            href="#"
            className="nav-back"
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
            Home
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div className="series-hero">
        <div
          className="hero-bg"
          style={{ backgroundImage: `url('${posterUrl(series.name)}')` }}
        />
        <div className="hero-vignette" />
        <div className="hero-side-vignette" />

        <div className="hero-content">
          {/* POSTER */}
          <div className="hero-poster">
            {!posterError ? (
              <img
                src={posterUrl(series.name)}
                alt={series.name}
                onError={() => setPosterError(true)}
              />
            ) : null}
            <div className="poster-ph" style={{ display: posterError ? 'flex' : 'none' }}>
              🎬
            </div>
          </div>

          {/* INFO */}
          <div className="hero-info">
            <div className="hero-badge-row">
              {series.rating && (
                <span className="badge badge-rating">
                  <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'currentColor' }}>
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  {series.rating}
                </span>
              )}
              {genres.map((g, i) => (
                <span key={i} className="badge badge-genre">
                  {g}
                </span>
              ))}
              {series.year && (
                <span className="badge badge-year">{series.year}</span>
              )}
              <span className="badge badge-demo">Demo Mode</span>
            </div>

            <h1 className="hero-title">{series.name}</h1>

            {series.description && (
              <p className="hero-desc">{series.description}</p>
            )}

            <div className="hero-stats">
              {series.seasons && (
                <div className="h-stat">
                  <span className="h-stat-val">{series.seasons}</span>
                  <div className="h-stat-lbl">Season</div>
                </div>
              )}
              {seriesEpCount && (
                <div className="h-stat">
                  <span className="h-stat-val">{seriesEpCount}</span>
                  <div className="h-stat-lbl">Episode</div>
                </div>
              )}
              <div className="h-stat">
                <span className="h-stat-val">{episodes.length}</span>
                <div className="h-stat-lbl">Available</div>
              </div>
            </div>

            {cast.length > 0 && (
              <div className="cast-block">
                <div className="cast-lbl">Cast</div>
                <div className="cast-chips">
                  {cast.map((actor, i) => (
                    <span key={i} className="cast-chip">
                      {actor}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="hero-actions">
              {firstVideo && (
                <a
                  href="#"
                  className="btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    playEpisode(firstVideo);
                  }}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="btn-label-txt">Start Watching</span>
                </a>
              )}

              <button
                className={`btn-secondary${isLiked ? ' active' : ''}`}
                id="btn-like"
                aria-pressed={isLiked ? 'true' : 'false'}
                onClick={handleLike}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: 18, height: 18 }}
                  fill={isLiked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span className="btn-label-txt">{isLiked ? 'Liked' : 'Like'}</span>
              </button>

              <button
                className={`btn-secondary${inWatchlist ? ' active' : ''}`}
                id="btn-watchlist"
                aria-pressed={inWatchlist ? 'true' : 'false'}
                onClick={handleWatchlist}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: 18, height: 18 }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {inWatchlist ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </>
                  )}
                </svg>
                <span className="btn-label-txt">
                  {inWatchlist ? 'In List' : 'Add to List'}
                </span>
              </button>

              <button
                className={`btn-secondary${isNotified ? ' active' : ''}`}
                id="btn-notify"
                aria-pressed={isNotified ? 'true' : 'false'}
                onClick={handleNotify}
              >
                <svg
                  viewBox="0 0 24 24"
                  style={{ width: 18, height: 18 }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="btn-label-txt">
                  {isNotified ? 'Notifications On' : 'Turn On Notifications'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE BODY ── */}
      <div className="page-body" ref={revealRef}>
        {/* EPISODES */}
        <div className="sec-label reveal">
          <span className="sec-label-text">Episodes</span>
          <span className="sec-label-count">{episodes.length} episodes</span>
        </div>

        <div className="reveal" style={{ transitionDelay: '.05s' }}>
          {episodes.length === 0 ? (
            <div className="ep-empty">
              <div className="ep-empty-icon">🎬</div>
              <div className="ep-empty-title">No episodes found</div>
              <p className="ep-empty-desc">
                Episodes will load automatically with a YouTube API Key.
              </p>
            </div>
          ) : (
            <div className="episodes-grid">
              {episodes.map((ep, i) => (
                <a
                  key={i}
                  href="#"
                  className="ep-card"
                  onClick={(e) => {
                    e.preventDefault();
                    playEpisode(ep.videoId, i);
                  }}
                >
                  <div className="ep-thumb">
                    {ep.thumbnail ? (
                      <img
                        src={ep.thumbnail}
                        alt={ep.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className="ep-thumb-ph">🎬</div>
                    )}
                    <div className="ep-overlay">
                      <div className="ep-play-btn">
                        <svg viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ep-num-badge">{i + 1}</div>
                  </div>
                  <div className="ep-info">
                    <div className="ep-num">Episode {i + 1}</div>
                    <div className="ep-title">{ep.title}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* SIMILAR SERIES */}
        {similar.length > 0 && (
          <>
            <div className="sec-label reveal" style={{ transitionDelay: '.1s' }}>
              <span className="sec-label-text">Similar Series</span>
            </div>
            <div
              className="slider-outer reveal"
              ref={sliderOuterRef}
              style={{ transitionDelay: '.15s' }}
            >
              <div style={{ position: 'relative' }}>
                <div className="slider-fade-l" />
                <div className="slider-fade-r" />
                <div
                  className="slider-track"
                  ref={sliderTrackRef}
                  id="simSlider"
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  {similar.map((s) => (
                    <a
                      key={s.slug}
                      href="#"
                      className="sim-card"
                      onClick={(e) => {
                        e.preventDefault();
                        goToSeries(s.slug);
                      }}
                    >
                      <img
                        src={posterUrl(s.name)}
                        alt={s.name}
                        className="sim-img"
                        loading="lazy"
                      />
                      <div className="sim-overlay">
                        <div className="sim-play">
                          <svg viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <div className="sim-title">{s.name}</div>
                        <div className="sim-meta">
                          <span className="sim-rating">★ {s.rating}</span>
                          <span>
                            {s.genre
                              .split(',')[0]
                              .trim()}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
              <button
                className="slider-btn prev"
                aria-label="Previous"
                onClick={() => sliderScrollBy('prev')}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <button
                className="slider-btn next"
                aria-label="Next"
                onClick={() => sliderScrollBy('next')}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div className="footer-logo">{SITE_NAME}</div>
        <p>
          &copy; {currentYear} {SITE_NAME} — All rights reserved. &nbsp;|&nbsp;
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
          >
            Home
          </a>{' '}
          &nbsp;|&nbsp;
          <a href="#">How It Works?</a> &nbsp;|&nbsp;
          <a href="mailto:tvfiremax@gmail.com">Contact</a>
        </p>
      </footer>

      {/* ── TOAST CONTAINER ── */}
      <div className="toast-container" id="toast-container">
        {toasts.map((msg, i) => (
          <div key={i} className="toast">
            {msg}
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Full CSS from series.php — preserved EXACTLY as-is
   ═══════════════════════════════════════════════════════════════════════════ */
const cssBlock = `
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

:root {
  --nf-red:     #e50914;
  --nf-red-dim: #b20710;
  --nf-bg:      #141414;
  --nf-bg2:     #0a0a0a;
  --nf-surface: #1f1f1f;
  --nf-surface2:#2a2a2a;
  --nf-surface3:#333333;
  --nf-border:  rgba(255,255,255,0.08);
  --nf-border2: rgba(255,255,255,0.14);
  --nf-text:    #e5e5e5;
  --nf-text2:   #a3a3a3;
  --nf-text3:   #6b6b6b;
  --nf-radius:  4px;
}

body {
  font-family: 'Outfit', -apple-system, sans-serif;
  background: var(--nf-bg2);
  color: var(--nf-text);
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
a { text-decoration: none; color: inherit; }
button { cursor: pointer; border: none; background: none; font-family: inherit; }
img { display: block; max-width: 100%; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--nf-red); }

/* ── NAVBAR ── */
nav {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(10,10,10,0.95);
  border-bottom: 1px solid var(--nf-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.nav-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 28px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.nav-logo {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--nf-red);
  letter-spacing: -0.04em;
  text-decoration: none;
  flex-shrink: 0;
}
.nav-search {
  flex: 1;
  max-width: 320px;
  position: relative;
  display: flex;
  align-items: center;
}
.nav-search svg {
  position: absolute;
  left: 12px;
  width: 15px; height: 15px;
  fill: var(--nf-text3);
  pointer-events: none;
}
.nav-search input {
  width: 100%;
  background: var(--nf-surface);
  border: 1px solid var(--nf-border2);
  border-radius: 3px;
  padding: 8px 14px 8px 36px;
  font-family: 'Outfit', sans-serif;
  font-size: 0.84rem;
  color: var(--nf-text);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.nav-search input::placeholder { color: var(--nf-text3); }
.nav-search input:focus {
  border-color: rgba(229,9,20,0.5);
  box-shadow: 0 0 0 2px rgba(229,9,20,0.1);
}
.nav-back {
  display: flex;
  align-items: center;
  gap: 7px;
  background: none;
  border: 1px solid var(--nf-border2);
  color: var(--nf-text2);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 3px;
  text-decoration: none;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
  white-space: nowrap;
}
.nav-back:hover { border-color: rgba(229,9,20,0.5); color: #fff; background: rgba(229,9,20,0.08); }
.nav-back svg { width: 14px; height: 14px; fill: currentColor; }

/* ── HERO ── */
.series-hero {
  position: relative;
  min-height: 580px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center top;
  filter: blur(3px) brightness(0.28) saturate(1.2);
  transform: scale(1.06);
  z-index: 0;
}
.hero-vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10,10,10,0.2) 0%,
    rgba(10,10,10,0.5) 35%,
    rgba(10,10,10,0.88) 70%,
    #0a0a0a 100%
  );
  z-index: 1;
}
.hero-side-vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(10,10,10,0.75) 0%,
    transparent 55%
  );
  z-index: 1;
}
.hero-content {
  position: relative;
  z-index: 2;
  max-width: 1280px;
  margin: 0 auto;
  padding: 100px 28px 60px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 36px;
  align-items: flex-end;
  width: 100%;
}

/* poster */
.hero-poster {
  width: 175px;
  flex-shrink: 0;
  animation: fadeUp 0.6s ease both;
}
.hero-poster img {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--nf-border2);
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
}
.poster-ph {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 3px;
  border: 1px solid var(--nf-border2);
  background: var(--nf-surface);
  display: flex; align-items: center; justify-content: center;
  font-size: 44px;
}
@keyframes fadeUp { from { opacity:0; transform: translateY(24px); } to { opacity:1; transform: none; } }

/* info */
.hero-info { animation: fadeUp 0.6s 0.1s ease both; min-width: 0; }

.hero-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 3px;
}
.badge-rating {
  background: rgba(229,9,20,0.15);
  border: 1px solid rgba(229,9,20,0.3);
  color: #ff6b6b;
}
.badge-genre {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--nf-text2);
}
.badge-year {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--nf-text2);
}
.badge-demo {
  background: rgba(255,168,0,0.12);
  border: 1px solid rgba(255,168,0,0.28);
  color: #ffb347;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(26px, 4.5vw, 56px);
  font-weight: 900;
  color: #fff;
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 14px;
}
.hero-desc {
  font-size: 0.88rem;
  color: var(--nf-text2);
  line-height: 1.75;
  max-width: 520px;
  margin-bottom: 20px;
}
.hero-stats {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.h-stat-val {
  font-family: 'Outfit', sans-serif;
  font-size: 26px;
  font-weight: 900;
  color: var(--nf-red);
  display: block;
  line-height: 1;
  margin-bottom: 3px;
}
.h-stat-lbl {
  font-size: 0.68rem;
  color: var(--nf-text3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.cast-block { margin-bottom: 22px; }
.cast-lbl {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--nf-text3);
  margin-bottom: 7px;
}
.cast-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.cast-chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--nf-border2);
  border-radius: 2px;
  padding: 3px 10px;
  font-size: 0.78rem;
  color: var(--nf-text2);
  transition: border-color 0.2s, color 0.2s;
}
.cast-chip:hover { border-color: rgba(229,9,20,0.4); color: #fff; }

/* action buttons */
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: #fff;
  color: #000;
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 12px 26px;
  border-radius: 3px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.btn-primary:hover { background: rgba(255,255,255,0.85); transform: scale(1.02); }
.btn-primary svg { width: 18px; height: 18px; fill: #000; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: rgba(109,109,110,0.5);
  color: #fff;
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 12px 22px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  user-select: none;
  white-space: nowrap;
}
.btn-secondary:hover { background: rgba(109,109,110,0.7); }
.btn-secondary.active { background: rgba(229,9,20,0.3); }
.btn-secondary svg { width: 17px; height: 17px; fill: currentColor; }

/* ── PAGE BODY ── */
.page-body {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 28px 80px;
}

/* ── SECTION LABEL ── */
.sec-label {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
  margin-top: 52px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.45s ease, transform 0.45s ease;
}
.sec-label.visible { opacity: 1; transform: none; }
.sec-label-text {
  font-size: 1.2rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.sec-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--nf-border);
}
.sec-label-count {
  font-size: 0.78rem;
  color: var(--nf-text3);
  font-weight: 600;
}

/* ── REVEAL ── */
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal.visible { opacity: 1; transform: none; }

/* ── EPISODES GRID ── */
.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px;
}
@media(max-width:640px) {
  .episodes-grid { grid-template-columns: repeat(2,1fr); gap: 3px; }
}

.ep-card {
  background: var(--nf-surface);
  border: none;
  overflow: hidden;
  text-decoration: none;
  display: block;
  transition: transform 0.2s, z-index 0s;
  position: relative;
  z-index: 0;
}
.ep-card:hover {
  transform: scale(1.04);
  z-index: 5;
  box-shadow: 0 8px 32px rgba(0,0,0,0.7);
}
.ep-thumb {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16/9;
  background: var(--nf-surface2);
}
.ep-thumb img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}
.ep-card:hover .ep-thumb img { transform: scale(1.06); }
.ep-thumb-ph {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: var(--nf-surface2);
  color: var(--nf-text3);
  font-size: 28px;
}
.ep-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.ep-card:hover .ep-overlay { opacity: 1; }
.ep-play-btn {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: rgba(255,255,255,0.9);
  display: flex; align-items: center; justify-content: center;
  transform: scale(0.8);
  transition: transform 0.2s;
}
.ep-card:hover .ep-play-btn { transform: scale(1); }
.ep-play-btn svg { width: 20px; height: 20px; fill: #000; margin-left: 3px; }
.ep-num-badge {
  position: absolute;
  top: 8px; left: 8px;
  background: rgba(0,0,0,0.8);
  border-radius: 2px;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--nf-text2);
}
.ep-info { padding: 10px 12px 14px; }
.ep-num {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nf-red);
  margin-bottom: 3px;
}
.ep-title {
  font-size: 0.83rem;
  font-weight: 600;
  color: var(--nf-text);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* empty */
.ep-empty {
  text-align: center;
  padding: 80px 24px;
  background: var(--nf-surface);
  border-radius: 3px;
}
.ep-empty-icon { font-size: 40px; margin-bottom: 16px; }
.ep-empty-title { font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 8px; }
.ep-empty-desc { font-size: 0.84rem; color: var(--nf-text2); }

/* ── SIMILAR SERIES SLIDER ── */
.slider-outer { position: relative; }
.slider-track {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 4px;
}
.slider-track::-webkit-scrollbar { display: none; }
.slider-fade-l, .slider-fade-r {
  position: absolute;
  top: 0; bottom: 0; width: 60px;
  pointer-events: none; z-index: 2;
}
.slider-fade-l { left: 0; background: linear-gradient(to right, #0a0a0a, transparent); }
.slider-fade-r { right: 0; background: linear-gradient(to left, #0a0a0a, transparent); }
.slider-btn {
  position: absolute;
  top: 50%; transform: translateY(-50%);
  z-index: 3;
  width: 40px; height: 80px;
  border: none;
  background: rgba(30,30,30,0.9);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}
.slider-btn:hover { background: rgba(50,50,50,0.95); }
.slider-btn.prev { left: 0; }
.slider-btn.next { right: 0; }
.slider-btn svg { width: 18px; height: 18px; fill: currentColor; }

.sim-card {
  scroll-snap-align: start;
  flex: 0 0 170px;
  text-decoration: none;
  display: block;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s, z-index 0s;
  z-index: 0;
}
.sim-card:hover { transform: scale(1.05); z-index: 5; box-shadow: 0 8px 32px rgba(0,0,0,0.7); }
.sim-img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; }
.sim-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.25) 50%, transparent 100%);
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 12px 10px;
}
.sim-play {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: rgba(255,255,255,0.85);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 8px;
  opacity: 0; transform: scale(0.7);
  transition: opacity 0.2s, transform 0.2s;
}
.sim-play svg { width: 13px; height: 13px; fill: #000; margin-left: 2px; }
.sim-card:hover .sim-play { opacity: 1; transform: scale(1); }
.sim-title {
  font-size: 0.78rem; font-weight: 700; color: #fff;
  text-align: center; margin-bottom: 3px;
  line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.sim-meta { display: flex; justify-content: center; gap: 7px; font-size: 0.67rem; color: var(--nf-text2); }
.sim-rating { color: #f0b429; }

/* ── TOAST ── */
.toast-container { position: fixed; bottom: 24px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; }
.toast {
  background: rgba(20,20,20,0.98);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 3px;
  padding: 12px 18px;
  font-size: 0.83rem; font-weight: 600; color: #fff;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  animation: toastIn 0.25s ease, toastOut 0.25s ease 2.4s forwards;
  max-width: 280px; pointer-events: none;
}
@keyframes toastIn { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: none; } }
@keyframes toastOut { from { opacity:1; } to { opacity:0; transform: translateY(6px); } }

/* ── FOOTER ── */
footer {
  position: relative;
  z-index: 1;
  border-top: 1px solid var(--nf-border);
  padding: 28px 28px;
  max-width: 1280px;
  margin: 0 auto;
}
footer p { font-size: 0.8rem; color: var(--nf-text3); }
footer a { color: var(--nf-text3); text-decoration: none; transition: color 0.2s; }
footer a:hover { color: var(--nf-text2); }
.footer-logo {
  font-family: 'Outfit', sans-serif;
  font-size: 1.3rem; font-weight: 900; color: var(--nf-red);
  margin-bottom: 8px; display: inline-block;
}

/* ── RESPONSIVE ── */
@media(max-width:768px) {
  .hero-content { grid-template-columns: 1fr; gap: 20px; padding: 70px 20px 40px; }
  .hero-poster { width: 110px; margin: 0 auto; }
  .hero-info { text-align: center; }
  .hero-badge-row { justify-content: center; }
  .hero-stats { justify-content: center; }
  .cast-chips { justify-content: center; }
  .hero-actions { justify-content: center; }
  .hero-desc { margin-left: auto; margin-right: auto; }
  .page-body { padding: 0 16px 60px; }
  .sim-card { flex: 0 0 130px; }
  .nav-search { display: none; }
}
@media(max-width:480px) {
  .hero-actions .btn-label-txt { display: none; }
  .btn-primary { padding: 11px 20px; font-size: 0.88rem; }
}
`;
