'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getSeriesBySlug, SITE_NAME } from '@/lib/config';
import type { Series, Episode } from '@/lib/types';

/* ══════════════════════════════════════════════════════════
   YOUTUBE IFRAME API TYPES
══════════════════════════════════════════════════════════ */
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: typeof YT;
  }
}
namespace YT {
  export enum PlayerState { UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5 }
  export class Player {
    constructor(elementId: string, opts?: { events?: { onReady?: (e:{target:Player})=>void; onStateChange?: (e:{data:PlayerState;target:Player})=>void; onError?: (e:{data:number;target:Player})=>void } });
    getDuration(): number;
    getCurrentTime(): number;
    seekTo(s: number, a: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    setVolume(v: number): void;
    getVolume(): number;
    mute(): void;
    unMute(): void;
    setPlaybackRate(r: number): void;
    getVideoLoadedFraction(): number;
    destroy(): void;
  }
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function fmt(s: number): string {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

async function fetchEpisodes(playlistId: string): Promise<Episode[]> {
  try {
    const res = await fetch(`/api/playlist?playlistId=${encodeURIComponent(playlistId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.episodes || [];
  } catch {
    return [];
  }
}

/* ══════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════ */
export default function PlayerPage() {
  const pageParams = useAppStore((s) => s.pageParams);
  const navigate = useAppStore((s) => s.navigate);

  /* ── Resolve params: store (in-app nav) or URL (direct link) ── */
  const [urlParams, setUrlParams] = useState<Record<string,string>>({});
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      setUrlParams({ slug: p.get('slug')||'', video: p.get('video')||'', ep: p.get('ep')||'0' });
    }
  }, []);

  const slug   = (pageParams.slug  || urlParams.slug  || '').trim();
  const initVideoId = (pageParams.video || urlParams.video || '').trim();
  const initEpIdx   = parseInt(pageParams.ep || urlParams.ep || '0', 10) || 0;

  const series = useMemo<Series | undefined>(() => getSeriesBySlug(slug), [slug]);

  /* ── Fetch real episodes from YouTube playlist ── */
  const [episodes, setEpisodes]     = useState<Episode[]>([]);
  const [epLoading, setEpLoading]   = useState(false);
  const [activeEpIdx, setActiveEpIdx] = useState(initEpIdx);

  useEffect(() => {
    if (!series?.playlist_id) return;
    setEpLoading(true);
    fetchEpisodes(series.playlist_id)
      .then((eps) => {
        setEpisodes(eps);
        /* If a specific videoId was passed, find its index */
        if (initVideoId && eps.length > 0) {
          const idx = eps.findIndex((e) => e.videoId === initVideoId);
          setActiveEpIdx(idx >= 0 ? idx : initEpIdx);
        }
      })
      .finally(() => setEpLoading(false));
  }, [series?.playlist_id]);

  const currentEp  = episodes[activeEpIdx] || null;
  const activeVideoId = currentEp?.videoId || initVideoId;

  /* ── YouTube Player ── */
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const loopRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cpReady,    setCpReady]    = useState(false);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [isMuted,    setIsMuted]    = useState(false);
  const [duration,   setDuration]   = useState(0);
  const [curTime,    setCurTime]    = useState(0);
  const [filled,     setFilled]     = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [volValue,   setVolValue]   = useState(100);
  const [speed,      setSpeed]      = useState(1);
  const [isFS,       setIsFS]       = useState(false);
  const [ctrlsVisible, setCtrlsVisible] = useState(true);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [settOpen,     setSettOpen]     = useState(false);
  const [epOpen,       setEpOpen]       = useState(false);
  const [embedErr,     setEmbedErr]     = useState(false);
  const [toasts,       setToasts]       = useState<string[]>([]);

  const videoAreaRef = useRef<HTMLDivElement>(null);
  const progBarRef   = useRef<HTMLDivElement>(null);
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const showToast = useCallback((msg: string) => {
    setToasts((p) => [...p, msg]);
    setTimeout(() => setToasts((p) => p.slice(1)), 2800);
  }, []);

  /* ── Load YouTube IFrame API ── */
  useEffect(() => {
    if ((window as any).YT?.Player) { initPlayer(); return; }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = initPlayer;
    return () => { window.onYouTubeIframeAPIReady = undefined; };
  }, []);

  /* ── Reinit player when video changes ── */
  useEffect(() => {
    if (!activeVideoId || !(window as any).YT?.Player) return;
    destroyPlayer();
    setTimeout(() => initPlayer(), 100);
  }, [activeVideoId]);

  function destroyPlayer() {
    if (loopRef.current) clearInterval(loopRef.current);
    ytPlayerRef.current?.destroy();
    ytPlayerRef.current = null;
    setCpReady(false);
  }

  function initPlayer() {
    if (!activeVideoId) return;
    const el = document.getElementById('yt-iframe-container');
    if (!el || !(window as any).YT?.Player) return;
    try {
      ytPlayerRef.current = new (window as any).YT.Player('yt-iframe-container', {
        videoId: activeVideoId,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, iv_load_policy: 3 },
        events: {
          onReady: (e: any) => {
            setCpReady(true);
            setDuration(e.target.getDuration() || 0);
            setVolValue(e.target.getVolume());
            startLoop(e.target);
          },
          onStateChange: (e: any) => {
            const playing = e.data === 1;
            setIsPlaying(playing);
            if (e.data === 0) handleVideoEnd();
            if (e.data === 3 || e.data === 5) setEmbedErr(false);
          },
          onError: () => setEmbedErr(true),
        },
      });
    } catch { setEmbedErr(true); }
  }

  function startLoop(player: any) {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(() => {
      try {
        const ct = player.getCurrentTime() || 0;
        const dur = player.getDuration() || 0;
        setCurTime(ct);
        setDuration(dur);
        setFilled(dur > 0 ? (ct / dur) * 100 : 0);
        setBuffered((player.getVideoLoadedFraction?.() || 0) * 100);
      } catch {}
    }, 500);
  }

  function handleVideoEnd() {
    const next = episodes[activeEpIdx + 1];
    if (next) {
      setActiveEpIdx(activeEpIdx + 1);
      showToast(`Playing next: ${next.title}`);
    }
  }

  /* ── Controls ── */
  const togglePlay = () => {
    if (!ytPlayerRef.current) return;
    isPlaying ? ytPlayerRef.current.pauseVideo() : ytPlayerRef.current.playVideo();
  };

  const toggleMute = () => {
    if (!ytPlayerRef.current) return;
    isMuted ? ytPlayerRef.current.unMute() : ytPlayerRef.current.mute();
    setIsMuted(!isMuted);
  };

  const setVolume = (v: number) => {
    ytPlayerRef.current?.setVolume(v);
    setVolValue(v);
    if (v === 0) setIsMuted(true);
    else if (isMuted) { ytPlayerRef.current?.unMute(); setIsMuted(false); }
  };

  const seek = (pct: number) => {
    if (!ytPlayerRef.current || !duration) return;
    ytPlayerRef.current.seekTo((pct / 100) * duration, true);
  };

  const seekBy = (sec: number) => {
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.seekTo(Math.max(0, curTime + sec), true);
    showToast(sec > 0 ? `+${sec}s` : `${sec}s`);
  };

  const setSpeedAt = (s: number) => {
    ytPlayerRef.current?.setPlaybackRate(s);
    setSpeed(s);
    showToast(`Speed: ${s}x`);
    setSettOpen(false);
  };

  const toggleFS = () => {
    const el = videoAreaRef.current;
    if (!el) return;
    if (!isFS) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFS(!isFS);
  };

  /* ── Controls auto-hide ── */
  const resetHideTimer = useCallback(() => {
    setCtrlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCtrlsVisible(false), 3000);
  }, []);

  /* ── Select episode ── */
  const selectEpisode = (idx: number) => {
    if (idx === activeEpIdx) return;
    destroyPlayer();
    setActiveEpIdx(idx);
    setEpOpen(false);
    if (typeof window !== 'undefined' && series) {
      const ep = episodes[idx];
      window.history.replaceState({}, '', `/player?slug=${encodeURIComponent(slug)}&video=${encodeURIComponent(ep?.videoId || '')}&ep=${idx}`);
    }
  };

  /* ── Redirect if no series ── */
  useEffect(() => {
    if (slug && !series) navigate('home');
  }, [slug, series, navigate]);

  /* ── Cleanup ── */
  useEffect(() => () => { destroyPlayer(); if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  if (!slug) return <><style>{CSS}</style><div style={{ minHeight:'100vh', background:'#000' }} /></>;

  return (
    <>
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      <div className="player-root">
        {/* ── TOP BAR ── */}
        <div className="player-topbar">
          <button className="topbar-back" onClick={() => { destroyPlayer(); navigate('series', { slug }); }}>
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          </button>
          <div className="topbar-info">
            <span className="topbar-series">{series?.name || 'Loading…'}</span>
            {currentEp && <span className="topbar-ep">{currentEp.title}</span>}
          </div>
          <button className="topbar-home" onClick={() => { destroyPlayer(); navigate('home'); }}>
            <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
          </button>
        </div>

        {/* ── MAIN LAYOUT ── */}
        <div className="player-layout">
          {/* VIDEO AREA */}
          <div
            className={`player-video-wrap${sidebarOpen ? '' : ' full'}`}
            ref={videoAreaRef}
            onMouseMove={resetHideTimer}
            onTouchStart={resetHideTimer}
          >
            {/* YouTube iframe */}
            <div className="yt-container">
              <div id="yt-iframe-container" />
            </div>

            {/* Embed error */}
            {embedErr && (
              <div className="embed-err">
                <p>⚠️ Video could not be embedded.</p>
                <a href={`https://www.youtube.com/watch?v=${activeVideoId}`} target="_blank" rel="noreferrer">
                  Watch on YouTube ↗
                </a>
              </div>
            )}

            {/* Controls overlay */}
            <div className={`cp-overlay${ctrlsVisible ? '' : ' hidden'}`} onClick={togglePlay}>
              {/* Seek buttons */}
              <button className="seek-btn seek-left" onClick={(e) => { e.stopPropagation(); seekBy(-10); }}>
                <svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
                10
              </button>
              <button className="seek-btn seek-right" onClick={(e) => { e.stopPropagation(); seekBy(10); }}>
                10
                <svg viewBox="0 0 24 24"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 15.7c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 15h9V6l-3.6 4.6z"/></svg>
              </button>

              {/* Center play/pause */}
              <button className="cp-center-btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                {isPlaying
                  ? <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
              </button>

              {/* Bottom controls */}
              <div className="cp-bottom" onClick={(e) => e.stopPropagation()}>
                {/* Progress bar */}
                <div className="cp-progress-wrap"
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    seek(((e.clientX - rect.left) / rect.width) * 100);
                  }}
                >
                  <div className="cp-progress-track">
                    <div className="cp-progress-buffered" style={{ width:`${buffered}%` }} />
                    <div className="cp-progress-filled" style={{ width:`${filled}%` }} />
                    <div className="cp-progress-thumb" style={{ left:`${filled}%` }} />
                  </div>
                </div>

                {/* Controls row */}
                <div className="cp-row">
                  <div className="cp-left">
                    <button className="cp-btn" onClick={togglePlay}>
                      {isPlaying
                        ? <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                    </button>
                    <button className="cp-btn" onClick={toggleMute}>
                      {isMuted
                        ? <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                        : <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>}
                    </button>
                    <input type="range" className="cp-vol" min={0} max={100} value={volValue}
                      onChange={(e) => setVolume(Number(e.target.value))} onClick={(e) => e.stopPropagation()} />
                    <span className="cp-time">{fmt(curTime)} / {fmt(duration)}</span>
                  </div>
                  <div className="cp-right">
                    <button className="cp-btn" onClick={() => setSettOpen(!settOpen)}>
                      <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6S10.02 8.4 12 8.4s3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
                    </button>
                    <button className="cp-btn" onClick={() => { setEpOpen(!epOpen); setSettOpen(false); }}>
                      <svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zm-4-4h2v-2H3v2zm10-16H9v2h4V1zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3h2V1H9v2zm8 16h2v-2h-2v2zm2-8h2V9h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V5h-2v2zm0 4h2v-2h-2v2zm-4 10h2v-2h-2v2zm0-16h2V3h-2v2z"/></svg>
                      <span style={{ fontSize:'0.75rem', marginLeft:2 }}>Episodes</span>
                    </button>
                    <button className="cp-btn" onClick={toggleFS}>
                      {isFS
                        ? <svg viewBox="0 0 24 24"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
                        : <svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>}
                    </button>
                  </div>
                </div>
              </div>

              {/* Settings panel */}
              {settOpen && (
                <div className="cp-panel sett-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-title">Speed</div>
                  {SPEEDS.map((s) => (
                    <button key={s} className={`panel-item${speed === s ? ' active' : ''}`} onClick={() => setSpeedAt(s)}>{s}x</button>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar toggle */}
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <svg viewBox="0 0 24 24">
                <path d={sidebarOpen ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
              </svg>
            </button>
          </div>

          {/* ── EPISODE SIDEBAR ── */}
          {sidebarOpen && (
            <aside className="player-sidebar">
              <div className="sidebar-header">
                <div className="sidebar-title">Episodes</div>
                {epLoading && <div className="sidebar-loading"><span /><span /><span /></div>}
                {!epLoading && <div className="sidebar-count">{episodes.length} videos</div>}
              </div>
              <div className="sidebar-list">
                {episodes.map((ep, i) => (
                  <button
                    key={ep.videoId + i}
                    className={`ep-item${i === activeEpIdx ? ' active' : ''}`}
                    onClick={() => selectEpisode(i)}
                  >
                    <div className="ep-item-thumb">
                      <img
                        src={ep.thumbnail}
                        alt={ep.title}
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ep.videoId}/mqdefault.jpg`; }}
                      />
                      {i === activeEpIdx && (
                        <div className="ep-item-playing">
                          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      )}
                      <div className="ep-item-num">{i + 1}</div>
                    </div>
                    <div className="ep-item-info">
                      <div className="ep-item-title">{ep.title}</div>
                      {ep.description && <div className="ep-item-desc">{ep.description.slice(0, 80)}{ep.description.length > 80 ? '…' : ''}</div>}
                    </div>
                  </button>
                ))}
                {!epLoading && episodes.length === 0 && (
                  <div className="sidebar-empty">No episodes found.<br />Check YOUTUBE_API_KEY.</div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* ── BELOW VIDEO: episode list (mobile) ── */}
        {epOpen && (
          <div className="ep-panel-overlay" onClick={() => setEpOpen(false)}>
            <div className="ep-panel" onClick={(e) => e.stopPropagation()}>
              <div className="ep-panel-header">
                <span>Episodes ({episodes.length})</span>
                <button onClick={() => setEpOpen(false)}>✕</button>
              </div>
              <div className="ep-panel-list">
                {episodes.map((ep, i) => (
                  <button key={ep.videoId + i} className={`ep-panel-item${i === activeEpIdx ? ' active' : ''}`} onClick={() => selectEpisode(i)}>
                    <img src={ep.thumbnail} alt={ep.title} onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ep.videoId}/mqdefault.jpg`; }} />
                    <div>
                      <div className="ep-panel-num">Ep {i + 1}</div>
                      <div className="ep-panel-title">{ep.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TOASTS */}
        <div className="toast-container">{toasts.map((m, i) => <div key={i} className="toast">{m}</div>)}</div>
      </div>
    </>
  );
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--red:#e50914;--bg:#000;--surface:#141414;--surface2:#1a1a1a;--surface3:#222;--border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.14);--text:#e5e5e5;--text2:#a3a3a3;--text3:#555}
body,html{height:100%}
body{font-family:'Outfit',-apple-system,sans-serif;background:var(--bg);color:var(--text);overflow:hidden;-webkit-font-smoothing:antialiased}
button{cursor:pointer;border:none;background:none;color:inherit;font-family:inherit}
img{display:block;max-width:100%}

.player-root{display:flex;flex-direction:column;height:100vh;background:var(--bg);overflow:hidden}

/* TOP BAR */
.player-topbar{display:flex;align-items:center;gap:12px;padding:0 16px;height:52px;background:rgba(0,0,0,0.85);border-bottom:1px solid var(--border);flex-shrink:0;z-index:50}
.topbar-back,.topbar-home{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:6px;color:var(--text2);transition:all 0.15s;flex-shrink:0}
.topbar-back:hover,.topbar-home:hover{background:var(--surface3);color:#fff}
.topbar-back svg,.topbar-home svg{width:20px;height:20px;fill:currentColor}
.topbar-info{flex:1;min-width:0}
.topbar-series{display:block;font-size:0.92rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-ep{display:block;font-size:0.72rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}

/* LAYOUT */
.player-layout{display:flex;flex:1;overflow:hidden}

/* VIDEO */
.player-video-wrap{position:relative;flex:1;background:#000;overflow:hidden;display:flex;align-items:center;justify-content:center}
.player-video-wrap.full{flex:1}
.yt-container{position:absolute;inset:0;z-index:1}
.yt-container>div{width:100%;height:100%}
.yt-container iframe{width:100%;height:100%;border:none;display:block}

/* EMBED ERROR */
.embed-err{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);gap:12px;text-align:center;padding:24px}
.embed-err p{color:var(--text2)}
.embed-err a{color:var(--red);font-weight:700;text-decoration:underline}

/* CONTROLS OVERLAY */
.cp-overlay{position:absolute;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity 0.25s}
.cp-overlay.hidden{opacity:0;pointer-events:none}

/* SEEK BUTTONS */
.seek-btn{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.5);border-radius:50%;width:54px;height:54px;font-size:0.72rem;font-weight:700;color:#fff;justify-content:center;transition:background 0.15s;flex-direction:column}
.seek-btn:hover{background:rgba(0,0,0,0.75)}
.seek-btn svg{width:22px;height:22px;fill:currentColor}
.seek-left{left:15%}
.seek-right{right:15%}

/* CENTER PLAY */
.cp-center-btn{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;transition:background 0.15s}
.cp-center-btn:hover{background:rgba(255,255,255,0.25)}
.cp-center-btn svg{width:32px;height:32px;fill:#fff}

/* BOTTOM CONTROLS */
.cp-bottom{position:absolute;bottom:0;left:0;right:0;padding:12px 16px 14px;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 100%)}
.cp-progress-wrap{height:18px;display:flex;align-items:center;cursor:pointer;padding:7px 0;margin-bottom:8px}
.cp-progress-track{width:100%;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;position:relative;transition:height 0.15s}
.cp-progress-wrap:hover .cp-progress-track{height:6px}
.cp-progress-buffered{position:absolute;left:0;top:0;height:100%;background:rgba(255,255,255,0.35);border-radius:2px;pointer-events:none}
.cp-progress-filled{position:absolute;left:0;top:0;height:100%;background:var(--red);border-radius:2px;pointer-events:none}
.cp-progress-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:#fff;pointer-events:none;transition:opacity 0.15s;opacity:0}
.cp-progress-wrap:hover .cp-progress-thumb{opacity:1}
.cp-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cp-left,.cp-right{display:flex;align-items:center;gap:6px}
.cp-btn{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:4px;color:var(--text);transition:all 0.15s;font-size:0.82rem}
.cp-btn:hover{background:rgba(255,255,255,0.1);color:#fff}
.cp-btn svg{width:18px;height:18px;fill:currentColor;stroke:currentColor;stroke-width:0}
.cp-vol{width:80px;height:3px;accent-color:var(--red);cursor:pointer}
.cp-time{font-size:0.72rem;color:var(--text2);white-space:nowrap;margin-left:4px}

/* SETTINGS PANEL */
.cp-panel{position:absolute;bottom:70px;right:16px;background:rgba(20,20,20,0.96);border:1px solid var(--border2);border-radius:8px;padding:8px;min-width:120px;z-index:20;backdrop-filter:blur(8px)}
.panel-title{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--text3);padding:4px 8px 8px}
.panel-item{display:block;width:100%;text-align:left;padding:8px 12px;border-radius:4px;font-size:0.85rem;color:var(--text2);transition:all 0.15s}
.panel-item:hover{background:var(--surface3);color:#fff}
.panel-item.active{color:var(--red);font-weight:700}

/* SIDEBAR TOGGLE */
.sidebar-toggle{position:absolute;right:0;top:50%;transform:translateY(-50%);z-index:15;width:22px;height:44px;background:rgba(255,255,255,0.1);border-radius:4px 0 0 4px;display:flex;align-items:center;justify-content:center;transition:background 0.15s}
.sidebar-toggle:hover{background:rgba(255,255,255,0.2)}
.sidebar-toggle svg{width:16px;height:16px;stroke:#fff;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}

/* SIDEBAR */
.player-sidebar{width:300px;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden}
.sidebar-header{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.sidebar-title{font-size:0.9rem;font-weight:800;color:#fff}
.sidebar-count{font-size:0.72rem;color:var(--text3)}
.sidebar-empty{padding:32px 16px;text-align:center;font-size:0.82rem;color:var(--text3);line-height:1.6}
.sidebar-loading{display:flex;gap:5px}
.sidebar-loading span{width:6px;height:6px;border-radius:50%;background:var(--red);animation:dot-bounce 1.2s infinite ease-in-out both}
.sidebar-loading span:nth-child(1){animation-delay:-0.32s}
.sidebar-loading span:nth-child(2){animation-delay:-0.16s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
.sidebar-list{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#333 transparent}
.sidebar-list::-webkit-scrollbar{width:4px}
.sidebar-list::-webkit-scrollbar-thumb{background:#333;border-radius:2px}

/* EPISODE ITEMS */
.ep-item{display:flex;gap:10px;padding:8px 12px;width:100%;text-align:left;border-bottom:1px solid var(--border);transition:background 0.15s;align-items:flex-start}
.ep-item:hover{background:var(--surface2)}
.ep-item.active{background:rgba(229,9,20,0.08);border-left:2px solid var(--red)}
.ep-item-thumb{position:relative;flex-shrink:0;width:100px;aspect-ratio:16/9;border-radius:3px;overflow:hidden;background:var(--surface3)}
.ep-item-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ep-item-playing{position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center}
.ep-item-playing svg{width:20px;height:20px;fill:#fff}
.ep-item-num{position:absolute;bottom:3px;right:4px;background:rgba(0,0,0,0.75);border-radius:2px;padding:1px 5px;font-size:0.62rem;font-weight:700;color:var(--text2)}
.ep-item-info{flex:1;min-width:0}
.ep-item-title{font-size:0.78rem;font-weight:600;color:var(--text);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ep-item-desc{font-size:0.68rem;color:var(--text3);margin-top:3px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* MOBILE EPISODE PANEL */
.ep-panel-overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end}
.ep-panel{background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-height:70vh;display:flex;flex-direction:column}
.ep-panel-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);font-weight:700;flex-shrink:0}
.ep-panel-header button{font-size:1.1rem;color:var(--text2)}
.ep-panel-list{overflow-y:auto;flex:1}
.ep-panel-item{display:flex;gap:12px;padding:10px 16px;width:100%;border-bottom:1px solid var(--border);align-items:center}
.ep-panel-item.active{background:rgba(229,9,20,0.08)}
.ep-panel-item img{width:80px;aspect-ratio:16/9;object-fit:cover;border-radius:3px;flex-shrink:0}
.ep-panel-num{font-size:0.68rem;color:var(--red);font-weight:700;margin-bottom:2px}
.ep-panel-title{font-size:0.82rem;font-weight:600;color:var(--text);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* TOAST */
.toast-container{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:999;display:flex;flex-direction:column;gap:8px;align-items:center}
.toast{background:rgba(20,20,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:8px 18px;font-size:0.82rem;font-weight:600;color:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.5);animation:toastIn 0.25s ease,toastOut 0.25s ease 2.4s forwards;pointer-events:none;white-space:nowrap}
@keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateY(4px)}}

/* RESPONSIVE */
@media(max-width:768px){
  .player-sidebar{display:none}
  .sidebar-toggle{display:none}
  .seek-left{left:8%}
  .seek-right{right:8%}
  .cp-vol{width:60px}
}
`;
