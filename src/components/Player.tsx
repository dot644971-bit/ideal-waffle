'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { getSeriesBySlug, SITE_NAME } from '@/lib/config';
import type { Episode } from '@/lib/types';

// ─────────────────────────────────────────────────────────
//  ↓ YOUTUBE API KEY — Series.tsx ile aynı key olmalı
// ─────────────────────────────────────────────────────────
const YOUTUBE_API_KEY = 'AIzaSyCLBWLHTxyPo4VHEHo6E7JhR7AZKopWUfc';
// ─────────────────────────────────────────────────────────

async function fetchYouTubePlaylist(playlistId: string): Promise<Episode[]> {
  const all: Episode[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page++) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    for (const item of (data.items || [])) {
      const s = item.snippet;
      const videoId = s?.resourceId?.videoId;
      if (!videoId || s.title === 'Private video' || s.title === 'Deleted video') continue;
      all.push({
        videoId,
        title: s.title || 'Episode',
        thumbnail: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return all;
}

export default function PlayerPage() {
  const router = useRouter();

  const storeParams = useAppStore((s) => s.pageParams);
  const navigate    = useAppStore((s) => s.navigate);

  // URL parametrelerini oku (doğrudan link veya router.push ile gelince)
  const [urlParams, setUrlParams] = useState({ slug: '', video: '', ep: '0' });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      setUrlParams({ slug: p.get('slug') || '', video: p.get('video') || '', ep: p.get('ep') || '0' });
    }
  }, []);

  const slug    = storeParams.slug    || urlParams.slug;
  const videoId = storeParams.video   || urlParams.video;
  const epIdx   = parseInt(storeParams.ep || urlParams.ep || '0', 10);
  const series  = getSeriesBySlug(slug);

  const [episodes,  setEpisodes]  = useState<Episode[]>([]);
  const [curVideoId, setCurVideoId] = useState(videoId);
  const [curEpIdx,   setCurEpIdx]   = useState(epIdx);
  const [loading,    setLoading]    = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Parametre değişince güncelle
  useEffect(() => { if (videoId) setCurVideoId(videoId); }, [videoId]);
  useEffect(() => { setCurEpIdx(epIdx); }, [epIdx]);

  // Playlist'i çek
  useEffect(() => {
    if (!series?.playlist_id) return;
    setLoading(true);
    fetchYouTubePlaylist(series.playlist_id)
      .then(setEpisodes)
      .finally(() => setLoading(false));
  }, [series?.playlist_id]);

  const playEp = useCallback((vid: string, idx: number) => {
    setCurVideoId(vid);
    setCurEpIdx(idx);
    navigate('player', { slug, video: vid, ep: String(idx) });
    // URL'yi güncelle ama sayfa yenileme yapma
    window.history.replaceState(null, '', `/player?slug=${encodeURIComponent(slug)}&video=${encodeURIComponent(vid)}&ep=${idx}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug, navigate]);

  const goToSeries = () => {
    navigate('series', { slug });
    router.push(`/series?slug=${encodeURIComponent(slug)}`);
  };

  const goHome = () => { navigate('home'); router.push('/'); };

  const prevEp = episodes[curEpIdx - 1];
  const nextEp = episodes[curEpIdx + 1];
  const yr = new Date().getFullYear();

  const embedUrl = curVideoId
    ? `https://www.youtube.com/embed/${curVideoId}?autoplay=1&rel=0&modestbranding=1`
    : '';

  if (!slug || !curVideoId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: "'Outfit',sans-serif" }}>
        <style>{CSS}</style>
        <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Video bulunamadı.</p>
        <button onClick={goHome} style={{ background: '#fff', color: '#000', padding: '10px 24px', borderRadius: '3px', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>Ana Sayfa</button>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <nav id="nav"><div className="nav-inner">
        <a href="/" className="nav-logo" onClick={(e) => { e.preventDefault(); goHome(); }}>{SITE_NAME}</a>
        {series && <a href={`/series?slug=${encodeURIComponent(slug)}`} className="nav-back" onClick={(e) => { e.preventDefault(); goToSeries(); }}>
          <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          {series.name}
        </a>}
      </div></nav>

      <div className="player-layout">
        {/* Video Alanı */}
        <div className="player-main">
          <div className="player-wrap">
            {embedUrl && (
              <iframe
                ref={iframeRef}
                key={curVideoId}
                src={embedUrl}
                title={episodes[curEpIdx]?.title || 'Episode'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="player-iframe"
              />
            )}
          </div>

          {/* Bölüm Bilgisi */}
          <div className="ep-meta">
            <div className="ep-meta-left">
              {series && <div className="ep-series-name">{series.name}</div>}
              {episodes[curEpIdx] && <h1 className="ep-title-main">Bölüm {curEpIdx + 1} — {episodes[curEpIdx].title}</h1>}
            </div>
            <div className="ep-nav-btns">
              {prevEp && (
                <button className="ep-nav-btn" onClick={() => playEp(prevEp.videoId, curEpIdx - 1)}>
                  <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>
                  Önceki
                </button>
              )}
              {nextEp && (
                <button className="ep-nav-btn next-btn" onClick={() => playEp(nextEp.videoId, curEpIdx + 1)}>
                  Sonraki
                  <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kenar Bölüm Listesi */}
        {episodes.length > 0 && (
          <div className="ep-sidebar">
            <div className="sidebar-header">Tüm Bölümler <span className="sidebar-count">{episodes.length}</span></div>
            <div className="sidebar-list">
              {loading && <div className="sidebar-loading">Yükleniyor…</div>}
              {episodes.map((ep, i) => (
                <button key={ep.videoId + i} className={`sidebar-ep${i === curEpIdx ? ' active' : ''}`} onClick={() => playEp(ep.videoId, i)}>
                  <div className="sidebar-ep-thumb">
                    <img src={ep.thumbnail} alt={ep.title} loading="lazy"
                      onError={(ev) => { (ev.target as HTMLImageElement).src = `https://img.youtube.com/vi/${ep.videoId}/mqdefault.jpg`; }} />
                    {i === curEpIdx && <div className="sidebar-ep-playing"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>}
                  </div>
                  <div className="sidebar-ep-info">
                    <div className="sidebar-ep-num">Bölüm {i + 1}</div>
                    <div className="sidebar-ep-title">{ep.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer><div className="footer-logo">{SITE_NAME}</div>
        <p>&copy; {yr} {SITE_NAME} &nbsp;|&nbsp;
          <a href="/" onClick={(e) => { e.preventDefault(); goHome(); }}>Ana Sayfa</a>
        </p>
      </footer>
    </>
  );
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
:root{--red:#e50914;--bg:#0a0a0a;--surface:#1f1f1f;--surface2:#2a2a2a;--border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.14);--text:#e5e5e5;--text2:#a3a3a3;--text3:#6b6b6b}
body{font-family:'Outfit',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}button{cursor:pointer;border:none;background:none;font-family:inherit}img{display:block;max-width:100%}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#333;border-radius:5px}::-webkit-scrollbar-thumb:hover{background:var(--red)}
nav{position:sticky;top:0;z-index:100;background:rgba(10,10,10,0.95);border-bottom:1px solid var(--border);backdrop-filter:blur(20px)}
.nav-inner{max-width:1600px;margin:0 auto;padding:0 20px;height:60px;display:flex;align-items:center;gap:16px}
.nav-logo{font-size:1.4rem;font-weight:900;color:var(--red);letter-spacing:-0.04em;flex-shrink:0}
.nav-back{display:flex;align-items:center;gap:7px;border:1px solid var(--border2);color:var(--text2);font-size:0.82rem;font-weight:600;padding:7px 14px;border-radius:3px;transition:all 0.2s;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.nav-back:hover{border-color:rgba(229,9,20,0.5);color:#fff;background:rgba(229,9,20,0.08)}
.nav-back svg{width:14px;height:14px;fill:currentColor;flex-shrink:0}
.player-layout{display:grid;grid-template-columns:1fr 340px;gap:0;max-width:1600px;margin:0 auto;min-height:calc(100vh - 60px)}
@media(max-width:900px){.player-layout{grid-template-columns:1fr}}
.player-main{padding:16px 16px 0;display:flex;flex-direction:column}
.player-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:4px;overflow:hidden}
.player-iframe{position:absolute;inset:0;width:100%;height:100%;border:none}
.ep-meta{padding:16px 0 20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:flex-start}
.ep-meta-left{flex:1;min-width:0}
.ep-series-name{font-size:0.78rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
.ep-title-main{font-size:1.1rem;font-weight:800;color:#fff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ep-nav-btns{display:flex;gap:8px;flex-shrink:0}
.ep-nav-btn{display:flex;align-items:center;gap:6px;background:var(--surface2);color:var(--text2);font-family:'Outfit',sans-serif;font-size:0.82rem;font-weight:600;padding:9px 16px;border-radius:3px;border:1px solid var(--border2);transition:all 0.2s;cursor:pointer;white-space:nowrap}
.ep-nav-btn:hover{background:rgba(229,9,20,0.15);border-color:rgba(229,9,20,0.4);color:#fff}
.ep-nav-btn svg{width:14px;height:14px;fill:currentColor}
.next-btn{background:var(--red);color:#fff;border-color:var(--red)}
.next-btn:hover{background:#c40812;border-color:#c40812}
.ep-sidebar{border-left:1px solid var(--border);display:flex;flex-direction:column;height:calc(100vh - 60px);position:sticky;top:60px;overflow:hidden}
@media(max-width:900px){.ep-sidebar{height:auto;position:static;border-left:none;border-top:1px solid var(--border)}}
.sidebar-header{padding:14px 16px 10px;font-size:0.88rem;font-weight:800;color:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0}
.sidebar-count{background:var(--red);color:#fff;font-size:0.68rem;padding:2px 7px;border-radius:10px;font-weight:700}
.sidebar-list{overflow-y:auto;flex:1}
.sidebar-loading{padding:24px;text-align:center;color:var(--text3);font-size:0.84rem}
.sidebar-ep{display:flex;align-items:center;gap:10px;padding:10px 12px;width:100%;text-align:left;background:none;cursor:pointer;border:none;border-bottom:1px solid var(--border);transition:background 0.15s}
.sidebar-ep:hover{background:var(--surface)}
.sidebar-ep.active{background:rgba(229,9,20,0.1);border-left:3px solid var(--red)}
.sidebar-ep-thumb{position:relative;width:80px;flex-shrink:0;aspect-ratio:16/9;overflow:hidden;border-radius:3px;background:var(--surface2)}
.sidebar-ep-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.sidebar-ep-playing{position:absolute;inset:0;background:rgba(229,9,20,0.7);display:flex;align-items:center;justify-content:center}
.sidebar-ep-playing svg{width:18px;height:18px;fill:#fff}
.sidebar-ep-info{flex:1;min-width:0}
.sidebar-ep-num{font-size:0.66rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px}
.sidebar-ep-title{font-size:0.78rem;font-weight:600;color:var(--text);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
footer{border-top:1px solid var(--border);padding:20px 20px;max-width:1600px;margin:0 auto}
footer p{font-size:0.78rem;color:var(--text3)}footer a{color:var(--text3);text-decoration:none;transition:color 0.2s}footer a:hover{color:var(--text2)}
.footer-logo{font-size:1.2rem;font-weight:900;color:var(--red);margin-bottom:6px;display:inline-block}
`;
