'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { getSeriesBySlug, SITE_NAME } from '@/lib/config';
import type { Episode } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';

// ─────────────────────────────────────────────────────────
//  ↓ YOUTUBE API KEY'İNİZİ BURAYA YAZIN
// ─────────────────────────────────────────────────────────
const YOUTUBE_API_KEY = 'BURAYA_YOUTUBE_API_KEYINIZI_YAZIN';
// ─────────────────────────────────────────────────────────

declare global {
  interface Window { YT: any; onYouTubeIframeAPIReady: () => void; }
}

async function fetchPlaylist(playlistId: string): Promise<Episode[]> {
  const all: Episode[] = [];
  let tok = '';
  for (let p = 0; p < 10; p++) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${YOUTUBE_API_KEY}${tok ? `&pageToken=${tok}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const d = await res.json();
    for (const item of (d.items || [])) {
      const s = item.snippet;
      const vid = s?.resourceId?.videoId;
      if (!vid || s.title === 'Private video' || s.title === 'Deleted video') continue;
      all.push({ videoId: vid, title: s.title || 'Episode', thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vid}/hqdefault.jpg` });
    }
    if (!d.nextPageToken) break;
    tok = d.nextPageToken;
  }
  return all;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_LABELS: Record<number,string> = { 0.25:'×0.25', 0.5:'×0.5', 0.75:'×0.75', 1:'Normal', 1.25:'×1.25', 1.5:'×1.5', 2:'×2' };

export default function PlayerPage() {
  /* ── Auth Guard ── */
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0a0a',color:'#e5e5e5',fontFamily:"'Outfit',sans-serif" }}>
        <style>{`@keyframes mx-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:40,height:40,margin:'0 auto 20px',border:'3px solid rgba(229,9,20,0.2)',borderTopColor:'#e50914',borderRadius:'50%',animation:'mx-spin 0.8s linear infinite' }} />
          <p style={{ fontSize:'0.95rem',color:'#a3a3a3' }}>Loading...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const router = useRouter();
  const storeParams = useAppStore((s) => s.pageParams);
  const navigate    = useAppStore((s) => s.navigate);

  const [urlP, setUrlP] = useState({ slug:'', video:'', ep:'0' });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      setUrlP({ slug: p.get('slug')||'', video: p.get('video')||'', ep: p.get('ep')||'0' });
    }
  }, []);

  const slug       = storeParams.slug  || urlP.slug;
  const initVideo  = storeParams.video || urlP.video;
  const initEp     = parseInt(storeParams.ep || urlP.ep || '0', 10);
  const series     = getSeriesBySlug(slug);

  const [episodes,   setEpisodes]   = useState<Episode[]>([]);
  const [curVideo,   setCurVideo]   = useState(initVideo);
  const [curEp,      setCurEp]      = useState(initEp);

  // Player state
  const [ready,    setReady]    = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [curTime,  setCurTime]  = useState(0);
  const [dur,      setDur]      = useState(0);
  const [vol,      setVol]      = useState(100);
  const [muted,    setMuted]    = useState(false);
  const [speed,    setSpeed]    = useState(1);
  const [fsMode,   setFsMode]   = useState(false);

  // UI state
  const [showCtrl,      setShowCtrl]      = useState(true);
  const [showSpeed,     setShowSpeed]     = useState(false);
  const [showEpPanel,   setShowEpPanel]   = useState(false);
  const [showCast,      setShowCast]      = useState(false);
  const [showSub,       setShowSub]       = useState(false);
  const [seekHover,     setSeekHover]     = useState<number|null>(null);
  const [skipAnim,      setSkipAnim]      = useState<{dir:'L'|'R';k:number}|null>(null);
  const [castCopied,    setCastCopied]    = useState(false);

  // Cast (TV'ye yansıt) state
  const [castReady,     setCastReady]     = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const [castDeviceName,setCastDeviceName]= useState('');

  // Subtitle (altyazı) state
  const [subTracks, setSubTracks] = useState<{languageCode:string;displayName:string}[]>([]);
  const [activeSub, setActiveSub] = useState<string>('');

  const ytRef      = useRef<any>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const progRef    = useRef<HTMLDivElement>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout>>();
  const rafId      = useRef<number>();
  const touchStart = useRef<{x:number;y:number;t:number}|null>(null);
  const lastTap    = useRef<{x:number;t:number}|null>(null);
  const playerKey  = useRef('yt-player-div');
  const castSessionRef = useRef<any>(null);

  /* ── RAF tick for progress ── */
  const startRaf = useCallback(() => {
    const tick = () => {
      try {
        if (ytRef.current) {
          setCurTime(ytRef.current.getCurrentTime()||0);
          setDur(ytRef.current.getDuration()||0);
        }
      } catch {}
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
  }, []);
  const stopRaf = useCallback(() => { if (rafId.current) cancelAnimationFrame(rafId.current); }, []);

  /* ── Load YouTube IFrame API ── */
  useEffect(() => {
    const init = () => {
      if (ytRef.current) return;
      ytRef.current = new window.YT.Player(playerKey.current, {
        videoId: curVideo,
        playerVars: { controls:0, disablekb:1, rel:0, modestbranding:1, iv_load_policy:3, playsinline:1, fs:0, origin: typeof window!=='undefined'?window.location.origin:'' },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e:any) => {
            if (e.data === 1) { setPlaying(true); startRaf(); }
            else if (e.data === 2 || e.data === 0) { setPlaying(false); stopRaf(); }
          },
        },
      });
    };
    if (window.YT?.Player) { init(); }
    else {
      window.onYouTubeIframeAPIReady = init;
      if (!document.querySelector('script[src*="iframe_api"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);
      }
    }
    return () => stopRaf();
  }, []); // eslint-disable-line

  /* ── Load Google Cast (Chromecast) Sender SDK — TV'ye yansıt ── */
  useEffect(() => {
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (!isAvailable) return;
      const cast = (window as any).chrome?.cast;
      if (!cast) return;
      try {
        const sessionRequest = new cast.SessionRequest('233637DE'); // YouTube cast receiver
        const apiConfig = new cast.ApiConfig(
          sessionRequest,
          (session: any) => {
            castSessionRef.current = session;
            setCastConnected(true);
            setCastDeviceName(session.receiver?.friendlyName || 'TV');
            session.addUpdateListener((isAlive: boolean) => {
              if (!isAlive) { castSessionRef.current = null; setCastConnected(false); setCastDeviceName(''); }
            });
          },
          (available: boolean) => setCastReady(!!available),
          cast.AutoJoinPolicy?.ORIGIN_SCOPED
        );
        cast.initialize(apiConfig, () => setCastReady(true), () => setCastReady(false));
      } catch { setCastReady(false); }
    };
    if (!document.querySelector('script[src*="cast_sender"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      document.head.appendChild(s);
    }
  }, []);

  /* ── Switch video when episode changes ── */
  useEffect(() => {
    if (!ready || !ytRef.current) return;
    ytRef.current.loadVideoById(curVideo);
  }, [curVideo, ready]);

  /* ── Auto-hide controls ── */
  const resetHide = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3500);
  }, []);
  useEffect(() => {
    if (!playing) { setShowCtrl(true); clearTimeout(hideTimer.current); }
    else resetHide();
  }, [playing, resetHide]);

  /* ── Fetch episodes ── */
  useEffect(() => {
    if (!series?.playlist_id) return;
    fetchPlaylist(series.playlist_id).then(setEpisodes);
  }, [series?.playlist_id]);

  useEffect(() => { if (initVideo) setCurVideo(initVideo); }, [initVideo]);
  useEffect(() => { setCurEp(initEp); }, [initEp]);

  /* ── Fullscreen listener ── */
  useEffect(() => {
    const onChange = () => setFsMode(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  /* ── Controls ── */
  const togglePlay = useCallback(() => {
    if (!ytRef.current) return;
    if (playing) ytRef.current.pauseVideo(); else ytRef.current.playVideo();
  }, [playing]);

  const seekTo = useCallback((t: number) => {
    if (!ytRef.current) return;
    const clamped = Math.max(0, Math.min(t, dur));
    ytRef.current.seekTo(clamped, true);
    setCurTime(clamped);
  }, [dur]);

  const skip = useCallback((secs: number) => {
    seekTo(curTime + secs);
    setSkipAnim({ dir: secs>0?'R':'L', k: Date.now() });
    setTimeout(() => setSkipAnim(null), 800);
  }, [curTime, seekTo]);

  const setVolume = useCallback((v: number) => {
    if (!ytRef.current) return;
    ytRef.current.setVolume(v);
    setVol(v);
    if (v === 0) { ytRef.current.mute(); setMuted(true); }
    else { ytRef.current.unMute(); setMuted(false); }
  }, []);

  const toggleMute = useCallback(() => {
    if (!ytRef.current) return;
    if (muted) { ytRef.current.unMute(); setMuted(false); }
    else { ytRef.current.mute(); setMuted(true); }
  }, [muted]);

  const applySpeed = useCallback((s: number) => {
    ytRef.current?.setPlaybackRate(s);
    setSpeed(s); setShowSpeed(false);
  }, []);

  const toggleFs = useCallback(() => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) wrapRef.current.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  /* ── TV'ye Yansıt (Chromecast) ── */
  const sendCastLoad = useCallback((vid: string) => {
    const session = castSessionRef.current; if (!session) return;
    const msg = { type: 'LOAD', data: { video: { videoId: vid }, theme: 'CLASSIC' } };
    try { session.sendMessage('urn:x-cast:com.google.youtube.mdx', msg, () => {}, () => {}); } catch {}
  }, []);

  const startCast = useCallback(() => {
    const cast = (window as any).chrome?.cast;
    if (!cast) return;
    cast.requestSession(
      (session: any) => {
        castSessionRef.current = session;
        setCastConnected(true);
        setCastDeviceName(session.receiver?.friendlyName || 'TV');
        sendCastLoad(curVideo);
        try { ytRef.current?.pauseVideo?.(); } catch {}
      },
      () => {}
    );
  }, [curVideo, sendCastLoad]);

  const stopCast = useCallback(() => {
    const session = castSessionRef.current;
    if (session) { try { session.stop(() => {}, () => {}); } catch {} }
    castSessionRef.current = null;
    setCastConnected(false);
    setCastDeviceName('');
  }, []);

  /* ── Altyazı seçimi (YouTube captions modülü) ── */
  const openSubtitles = useCallback(() => {
    setShowSpeed(false); setShowCast(false); setShowEpPanel(false);
    setShowSub(p => {
      const next = !p;
      if (next && ytRef.current) {
        try {
          ytRef.current.loadModule('captions');
          setTimeout(() => {
            try {
              const list = ytRef.current?.getOption?.('captions', 'tracklist') || [];
              setSubTracks(list);
            } catch {}
          }, 350);
        } catch {}
      }
      return next;
    });
  }, []);

  const selectSubtitle = useCallback((track: {languageCode:string;displayName:string} | null) => {
    if (!ytRef.current) return;
    try {
      if (!track) {
        ytRef.current.setOption('captions', 'reload', false);
        ytRef.current.unloadModule?.('captions');
        ytRef.current.setOption?.('cc', 'load_policy', 0);
        setActiveSub('');
      } else {
        ytRef.current.loadModule('captions');
        ytRef.current.setOption('captions', 'track', track);
        ytRef.current.setOption('cc', 'load_policy', 1);
        setActiveSub(track.languageCode);
      }
    } catch {}
  }, []);

  const switchEp = useCallback((vid: string, idx: number) => {
    setCurVideo(vid); setCurEp(idx);
    navigate('player', { slug, video: vid, ep: String(idx) });
    window.history.replaceState(null,'',`/player?slug=${encodeURIComponent(slug)}&video=${encodeURIComponent(vid)}&ep=${idx}`);
    setShowEpPanel(false);
    if (castConnected) sendCastLoad(vid);
    wrapRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [slug, navigate, castConnected, sendCastLoad]);

  /* ── Progress bar ── */
  const onProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progRef.current; if (!bar||!dur) return;
    const r = bar.getBoundingClientRect();
    seekTo(((e.clientX-r.left)/r.width)*dur);
  }, [dur, seekTo]);

  const onProgressMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progRef.current; if (!bar||!dur) return;
    const r = bar.getBoundingClientRect();
    setSeekHover(((e.clientX-r.left)/r.width)*dur);
  }, [dur]);

  /* ── Keyboard ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName||'')) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); skip(10); break;
        case 'ArrowLeft':  e.preventDefault(); skip(-10); break;
        case 'ArrowUp':    e.preventDefault(); setVolume(Math.min(100, vol+10)); break;
        case 'ArrowDown':  e.preventDefault(); setVolume(Math.max(0, vol-10)); break;
        case 'KeyF':       e.preventDefault(); toggleFs(); break;
        case 'KeyM':       e.preventDefault(); toggleMute(); break;
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [togglePlay, skip, setVolume, vol, toggleFs, toggleMute]);

  /* ── Touch gestures ── */
  const onTStart = (e: React.TouchEvent) => { const t=e.touches[0]; touchStart.current={x:t.clientX,y:t.clientY,t:Date.now()}; };
  const onTEnd   = (e: React.TouchEvent) => {
    const st = touchStart.current; if (!st) return;
    const t = e.changedTouches[0];
    const dx=t.clientX-st.x, dy=t.clientY-st.y, dt=Date.now()-st.t;
    if (Math.abs(dx)<15 && Math.abs(dy)<15 && dt<300) {
      const now=Date.now(), last=lastTap.current;
      const isLeft = wrapRef.current && t.clientX < wrapRef.current.getBoundingClientRect().left + wrapRef.current.getBoundingClientRect().width/2;
      if (last && now-last.t < 350) { isLeft ? skip(-10) : skip(10); lastTap.current=null; }
      else { lastTap.current={x:t.clientX,t:now}; setTimeout(()=>{ if(lastTap.current?.t===now){togglePlay();resetHide();lastTap.current=null;} },350); }
    } else if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*2 && dt<400) { skip(dx>0?15:-15); }
    touchStart.current=null;
  };

  const closeAllPanels = () => { setShowSpeed(false);setShowEpPanel(false);setShowCast(false);setShowSub(false); };

  const pct = dur>0 ? (curTime/dur)*100 : 0;
  const prevEp = episodes[curEp-1], nextEp = episodes[curEp+1];
  const ytUrl = `https://www.youtube.com/watch?v=${curVideo}`;
  const goHome   = () => { navigate('home'); router.push('/'); };
  const goSeries = () => { navigate('series',{slug}); router.push(`/series?slug=${encodeURIComponent(slug)}`); };
  const yr = new Date().getFullYear();

  if (!slug||!curVideo) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0a0a0a',color:'#e5e5e5',fontFamily:"'Outfit',sans-serif"}}>
      <style>{CSS}</style>
      <p style={{fontSize:'1.1rem',marginBottom:'1rem'}}>Video bulunamadı.</p>
      <button onClick={goHome} style={{background:'#fff',color:'#000',padding:'10px 24px',borderRadius:'3px',border:'none',fontWeight:700,cursor:'pointer',fontFamily:"'Outfit',sans-serif"}}>Ana Sayfa</button>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>

      {/* NAV — outside fullscreen */}
      {!fsMode && (
        <nav className="top-nav"><div className="nav-inner">
          <a href="/" className="nav-logo" onClick={(e)=>{e.preventDefault();goHome();}}>{SITE_NAME}</a>
          {series&&<a href={`/series?slug=${encodeURIComponent(slug)}`} className="nav-back" onClick={(e)=>{e.preventDefault();goSeries();}}>
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            <span>{series.name}</span>
          </a>}
        </div></nav>
      )}

      <div className="page-wrap">
        {/* ═══ PLAYER ═══ */}
        <div
          ref={wrapRef}
          className={`player-box${fsMode?' fullscreen':''}`}
          onMouseMove={resetHide}
          onMouseLeave={()=>{ if(playing) setShowCtrl(false); }}
          onTouchStart={onTStart}
          onTouchEnd={onTEnd}
        >
          {/* YouTube iframe div */}
          <div id="yt-player-div" className="yt-div"/>

          {/* Loading spinner */}
          {!ready && <div className="yt-loading"><div className="yt-spinner"/></div>}

          {/* Skip feedback */}
          {skipAnim&&(
            <div key={skipAnim.k} className={`skip-fb skip-fb-${skipAnim.dir}`}>
              {skipAnim.dir==='L'
                ? <><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg><span>-10s</span></>
                : <><span>+10s</span><svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg></>}
            </div>
          )}

          {/* ── CONTROLS OVERLAY ── */}
          <div className={`ctrl-overlay${showCtrl?'':' ctrl-hidden'}`} onClick={(e)=>{ if(e.target===e.currentTarget) togglePlay(); }}>

            {/* Top gradient bar */}
            <div className="ctrl-top-bar">
              {fsMode&&(
                <button className="ctrl-back" onClick={goSeries}>
                  <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
              )}
              <div className="ctrl-top-titles">
                {series&&<div className="ctrl-series">{series.name}</div>}
                {episodes[curEp]&&<div className="ctrl-ep">Bölüm {curEp+1} — {episodes[curEp].title}</div>}
              </div>
            </div>

            {/* Center big play icon (shown when paused) */}
            {!playing&&ready&&(
              <button className="center-play" onClick={togglePlay}>
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </button>
            )}

            {/* Bottom controls */}
            <div className="ctrl-bottom-wrap">
              {/* Progress bar */}
              <div
                ref={progRef}
                className="prog-track"
                onClick={onProgressClick}
                onMouseMove={onProgressMove}
                onMouseLeave={()=>setSeekHover(null)}
              >
                <div className="prog-bg"/>
                <div className="prog-fill" style={{width:`${pct}%`}}/>
                <div className="prog-thumb" style={{left:`${pct}%`}}/>
                {seekHover!==null&&dur>0&&(
                  <div className="seek-tip" style={{left:`${(seekHover/dur)*100}%`}}>{fmt(seekHover)}</div>
                )}
              </div>

              {/* Button row */}
              <div className="ctrl-row">
                {/* LEFT */}
                <div className="ctrl-left">
                  <button className="cb" onClick={togglePlay} title={playing?'Duraklat (Space)':'Oynat (Space)'}>
                    {playing
                      ? <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                  </button>
                  {prevEp&&<button className="cb" title="Önceki Bölüm" onClick={()=>switchEp(prevEp.videoId,curEp-1)}>
                    <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                  </button>}
                  {nextEp&&<button className="cb" title="Sonraki Bölüm" onClick={()=>switchEp(nextEp.videoId,curEp+1)}>
                    <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zm2-12h2v12H8zm7 0v12l8.5-6z" style={{display:'none'}}/><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                  </button>}
                  <div className="vol-group">
                    <button className="cb" onClick={toggleMute} title="Ses (M)">
                      {muted||vol===0
                        ? <svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97V10.18l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>
                        : vol<50
                        ? <svg viewBox="0 0 24 24"><path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                        : <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>}
                    </button>
                    <div className="vol-slider-wrap">
                      <input type="range" min={0} max={100} value={muted?0:vol} className="vol-slider"
                        onChange={(e)=>setVolume(Number(e.target.value))}/>
                    </div>
                  </div>
                  <span className="time-txt">{fmt(curTime)} / {fmt(dur)}</span>
                </div>

                {/* RIGHT */}
                <div className="ctrl-right">
                  {/* Speed */}
                  <div className="pop-wrap">
                    <button className="cb cb-text" onClick={()=>{setShowSpeed(p=>!p);setShowCast(false);setShowSub(false);setShowEpPanel(false);}} title="Hız">
                      {speed===1?'Hız':'×'+speed}
                    </button>
                    {showSpeed&&(
                      <div className="pop-menu speed-menu">
                        <div className="pop-title">Oynatma Hızı</div>
                        {SPEEDS.map(s=>(
                          <button key={s} className={`pop-item${s===speed?' pop-active':''}`} onClick={()=>applySpeed(s)}>
                            {SPEED_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subtitle */}
                  <div className="pop-wrap">
                    <button className="cb" title="Altyazı" onClick={openSubtitles}>
                      <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H6v-2h6v2zm8-4H6V9h14v2z"/></svg>
                    </button>
                    {showSub&&(
                      <div className="pop-menu sub-menu">
                        <div className="pop-title">Altyazı</div>
                        <button className={`pop-item${activeSub===''?' pop-active':''}`} onClick={()=>selectSubtitle(null)}>
                          Kapalı
                        </button>
                        {subTracks.length>0
                          ? subTracks.map(t=>(
                              <button key={t.languageCode} className={`pop-item${activeSub===t.languageCode?' pop-active':''}`} onClick={()=>selectSubtitle(t)}>
                                {t.displayName || t.languageCode}
                              </button>
                            ))
                          : <p className="pop-desc">Bu video için altyazı bulunamadı veya yükleniyor…</p>}
                      </div>
                    )}
                  </div>

                  {/* Cast */}
                  <div className="pop-wrap">
                    <button className={`cb${castConnected?' pop-active':''}`} title="TV'ye Yansıt" onClick={()=>{setShowCast(p=>!p);setShowSpeed(false);setShowSub(false);setShowEpPanel(false);}}>
                      <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z"/></svg>
                    </button>
                    {showCast&&(
                      <div className="pop-menu cast-menu">
                        <div className="pop-title">TV'ye Yansıt</div>
                        {castConnected ? (
                          <>
                            <p className="pop-desc">Bağlandı: <strong>{castDeviceName||'TV'}</strong></p>
                            <button className="pop-link-btn" style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)'}} onClick={stopCast}>
                              Bağlantıyı Kes
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="pop-desc">{castReady ? 'Yakındaki Chromecast / Google TV cihazına aktarın.' : 'Chromecast aranıyor… Tarayıcınız desteklemiyorsa aşağıdaki bağlantıyı kullanın.'}</p>
                            {castReady&&<button className="pop-link-btn" onClick={startCast}>Cihaz Seç ve Yansıt</button>}
                            <a className="pop-link-btn" style={{marginTop:6,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)'}} href={ytUrl} target="_blank" rel="noopener noreferrer">YouTube'da Aç</a>
                            <button className="pop-link-btn" style={{marginTop:6,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)'}}
                              onClick={()=>{ navigator.clipboard?.writeText(ytUrl); setCastCopied(true); setTimeout(()=>setCastCopied(false),2000); }}>
                              {castCopied?'✓ Kopyalandı!':'Linki Kopyala'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Episodes panel toggle */}
                  <button className="cb" title="Bölümler" onClick={()=>{setShowEpPanel(p=>!p);closeAllPanels();}}>
                    <svg viewBox="0 0 24 24"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
                  </button>

                  {/* Fullscreen */}
                  <button className="cb" title="Tam Ekran (F)" onClick={toggleFs}>
                    {fsMode
                      ? <svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                      : <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── EPISODE PANEL (slide from right) ── */}
          <div className={`ep-drawer${showEpPanel?' ep-drawer-open':''}`}>
            <div className="ep-drawer-hd">
              <span>Bölümler {episodes.length>0&&<span className="ep-drawer-cnt">{episodes.length}</span>}</span>
              <button className="ep-drawer-close" onClick={()=>setShowEpPanel(false)}>
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
            <div className="ep-drawer-list">
              {episodes.map((ep,i)=>(
                <button key={ep.videoId+i} className={`ep-drawer-item${i===curEp?' ep-drawer-active':''}`} onClick={()=>switchEp(ep.videoId,i)}>
                  <div className="ep-drawer-thumb">
                    <img src={ep.thumbnail} alt={ep.title} loading="lazy"
                      onError={(ev)=>{(ev.target as HTMLImageElement).src=`https://img.youtube.com/vi/${ep.videoId}/mqdefault.jpg`;}}/>
                    {i===curEp&&<div className="ep-drawer-playing"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>}
                  </div>
                  <div className="ep-drawer-info">
                    <div className="ep-drawer-num">Bölüm {i+1}</div>
                    <div className="ep-drawer-title">{ep.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Below player strip */}
        {!fsMode&&(
          <div className="below-strip">
            <div className="below-meta">
              {series&&<div className="below-series">{series.name}</div>}
              {episodes[curEp]&&<h1 className="below-title">Bölüm {curEp+1} — {episodes[curEp].title}</h1>}
            </div>
            <div className="below-actions">
              {prevEp&&<button className="below-btn" onClick={()=>switchEp(prevEp.videoId,curEp-1)}>
                <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                Önceki
              </button>}
              {nextEp&&<button className="below-btn below-btn-primary" onClick={()=>switchEp(nextEp.videoId,curEp+1)}>
                Sonraki Bölüm
                <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
              </button>}
            </div>
          </div>
        )}
      </div>

      {!fsMode&&(
        <footer className="page-footer">
          <div className="footer-logo">{SITE_NAME}</div>
          <p>&copy; {yr} {SITE_NAME} &nbsp;|&nbsp;
            <a href="/" onClick={(e)=>{e.preventDefault();goHome();}}>Ana Sayfa</a>
            {series&&<>&nbsp;|&nbsp;<a href={`/series?slug=${encodeURIComponent(slug)}`} onClick={(e)=>{e.preventDefault();goSeries();}}>{series.name}</a></>}
          </p>
        </footer>
      )}
    </>
  );
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
:root{--red:#e50914;--bg:#0a0a0a;--surface:#181818;--border:rgba(255,255,255,0.1);--text:#e5e5e5;--text2:#aaa;--text3:#666}
body{font-family:'Outfit',-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased}
a{text-decoration:none;color:inherit}button{cursor:pointer;border:none;background:none;font-family:inherit;color:inherit}img{display:block;max-width:100%}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}

/* NAV */
.top-nav{position:sticky;top:0;z-index:200;background:rgba(10,10,10,0.96);border-bottom:1px solid var(--border);backdrop-filter:blur(16px)}
.nav-inner{max-width:1400px;margin:0 auto;padding:0 20px;height:58px;display:flex;align-items:center;gap:14px}
.nav-logo{font-size:1.4rem;font-weight:900;color:var(--red);letter-spacing:-0.04em;flex-shrink:0}
.nav-back{display:flex;align-items:center;gap:6px;border:1px solid var(--border);color:var(--text2);font-size:0.82rem;font-weight:600;padding:7px 14px;border-radius:3px;transition:all 0.2s;white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis}
.nav-back:hover{border-color:rgba(229,9,20,0.5);color:#fff;background:rgba(229,9,20,0.08)}
.nav-back svg{width:14px;height:14px;fill:currentColor;flex-shrink:0}

/* PAGE */
.page-wrap{max-width:1400px;margin:0 auto;padding:0 0 24px}

/* ═══ PLAYER BOX ═══ */
.player-box{position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden;user-select:none;-webkit-user-select:none}
.player-box.fullscreen{position:fixed;inset:0;z-index:9999;width:100vw;height:100vh;aspect-ratio:unset}

/* YouTube iframe */
.yt-div{position:absolute;inset:0;width:100%;height:100%}
.yt-div iframe{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border:none!important}

/* Loading */
.yt-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;z-index:5}
.yt-spinner{width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:var(--red);border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* Skip feedback */
.skip-fb{position:absolute;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.7);border-radius:50px;padding:12px 20px;font-size:1rem;font-weight:700;color:#fff;z-index:20;pointer-events:none;animation:skipFade 0.8s ease forwards}
.skip-fb svg{width:22px;height:22px;fill:currentColor}
.skip-fb-L{left:8%}
.skip-fb-R{right:8%}
@keyframes skipFade{0%{opacity:0;transform:translateY(-50%) scale(0.85)}15%{opacity:1;transform:translateY(-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-50%) scale(0.95)}}

/* ═══ CONTROLS OVERLAY ═══ */
.ctrl-overlay{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;justify-content:space-between;transition:opacity 0.3s;cursor:default}
.ctrl-hidden{opacity:0;pointer-events:none;cursor:none}

.ctrl-top-bar{background:linear-gradient(to bottom,rgba(0,0,0,0.75) 0%,transparent 100%);padding:16px 20px 40px;display:flex;align-items:flex-start;gap:12px}
.ctrl-back{width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.2s}
.ctrl-back:hover{background:rgba(229,9,20,0.7)}
.ctrl-back svg{width:18px;height:18px;fill:#fff}
.ctrl-top-titles{}
.ctrl-series{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--red);margin-bottom:2px}
.ctrl-ep{font-size:0.92rem;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw}

/* Center play */
.center-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;transition:background 0.2s,transform 0.15s}
.center-play:hover{background:rgba(255,255,255,0.25);transform:translate(-50%,-50%) scale(1.08)}
.center-play svg{width:32px;height:32px;fill:#fff;margin-left:4px}

/* Bottom */
.ctrl-bottom-wrap{background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.6) 60%,transparent 100%);padding:0 16px 14px}

/* Progress bar */
.prog-track{position:relative;height:20px;display:flex;align-items:center;cursor:pointer;margin-bottom:4px}
.prog-track:hover .prog-bg{height:5px}
.prog-track:hover .prog-fill{height:5px}
.prog-track:hover .prog-thumb{opacity:1}
.prog-bg{position:absolute;left:0;right:0;height:3px;background:rgba(255,255,255,0.25);border-radius:3px;transition:height 0.15s}
.prog-fill{position:absolute;left:0;height:3px;background:var(--red);border-radius:3px;transition:height 0.15s,width 0s}
.prog-thumb{position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;transform:translateX(-50%);top:50%;margin-top:-7px;opacity:0;transition:opacity 0.15s;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,0.5)}
.seek-tip{position:absolute;bottom:22px;transform:translateX(-50%);background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:0.72rem;font-weight:700;padding:3px 8px;border-radius:3px;pointer-events:none;white-space:nowrap}

/* Control buttons row */
.ctrl-row{display:flex;align-items:center;justify-content:space-between;gap:4px;min-height:40px}
.ctrl-left,.ctrl-right{display:flex;align-items:center;gap:2px}

/* Control button */
.cb{width:38px;height:38px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);transition:color 0.15s,background 0.15s;flex-shrink:0}
.cb:hover{color:#fff;background:rgba(255,255,255,0.1)}
.cb svg{width:20px;height:20px;fill:currentColor;pointer-events:none}
.cb-text{width:auto;padding:0 10px;font-size:0.8rem;font-weight:700;letter-spacing:0.04em;min-width:46px;justify-content:center}

/* Volume */
.vol-group{display:flex;align-items:center}
.vol-slider-wrap{width:0;overflow:hidden;transition:width 0.2s;display:flex;align-items:center}
.vol-group:hover .vol-slider-wrap{width:72px}
.vol-slider{-webkit-appearance:none;appearance:none;width:72px;height:4px;border-radius:4px;background:rgba(255,255,255,0.3);outline:none;cursor:pointer}
.vol-slider::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.5)}

/* Time */
.time-txt{font-size:0.78rem;font-weight:600;color:rgba(255,255,255,0.8);white-space:nowrap;padding:0 6px;letter-spacing:0.02em}

/* ═══ POP MENUS ═══ */
.pop-wrap{position:relative}
.pop-menu{position:absolute;bottom:calc(100% + 10px);right:0;background:rgba(18,18,18,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px;min-width:180px;backdrop-filter:blur(16px);box-shadow:0 12px 40px rgba(0,0,0,0.7);z-index:50}
.pop-title{font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:var(--text2);padding:4px 8px 8px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px}
.pop-item{display:block;width:100%;text-align:left;padding:9px 12px;font-size:0.85rem;font-weight:600;color:var(--text2);border-radius:4px;transition:background 0.15s,color 0.15s;cursor:pointer;border:none;background:none;font-family:inherit}
.pop-item:hover{background:rgba(255,255,255,0.08);color:#fff}
.pop-active{color:#fff!important;background:rgba(229,9,20,0.2)!important}
.pop-active::after{content:'✓';float:right;color:var(--red)}
.pop-desc{font-size:0.78rem;color:var(--text2);line-height:1.6;padding:8px 8px 10px}
.pop-link-btn{display:block;width:100%;padding:9px 12px;font-size:0.82rem;font-weight:700;color:#fff;background:var(--red);border-radius:4px;text-align:center;transition:background 0.15s;font-family:inherit;cursor:pointer;border:none}
.pop-link-btn:hover{background:#c40812}

/* speed, sub, cast menu positioning */
.speed-menu{min-width:160px}
.sub-menu,.cast-menu{min-width:220px;right:0}

/* ═══ EPISODE DRAWER ═══ */
.ep-drawer{position:absolute;top:0;right:-340px;width:340px;height:100%;background:rgba(12,12,12,0.97);backdrop-filter:blur(20px);border-left:1px solid rgba(255,255,255,0.1);z-index:30;display:flex;flex-direction:column;transition:right 0.3s cubic-bezier(0.4,0,0.2,1)}
.ep-drawer-open{right:0}
.ep-drawer-hd{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;font-size:0.9rem;font-weight:800;color:#fff}
.ep-drawer-cnt{background:var(--red);color:#fff;font-size:0.68rem;padding:2px 7px;border-radius:10px;margin-left:8px;font-weight:700}
.ep-drawer-close{width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--text2);transition:background 0.15s,color 0.15s}
.ep-drawer-close:hover{background:rgba(255,255,255,0.08);color:#fff}
.ep-drawer-close svg{width:18px;height:18px;fill:currentColor}
.ep-drawer-list{overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:#333 transparent}
.ep-drawer-item{display:flex;align-items:center;gap:10px;padding:10px 14px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;transition:background 0.15s;font-family:inherit}
.ep-drawer-item:hover{background:rgba(255,255,255,0.05)}
.ep-drawer-active{background:rgba(229,9,20,0.1)!important;border-left:3px solid var(--red)}
.ep-drawer-thumb{position:relative;width:88px;flex-shrink:0;aspect-ratio:16/9;overflow:hidden;border-radius:3px;background:#1a1a1a}
.ep-drawer-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ep-drawer-playing{position:absolute;inset:0;background:rgba(229,9,20,0.65);display:flex;align-items:center;justify-content:center}
.ep-drawer-playing svg{width:20px;height:20px;fill:#fff}
.ep-drawer-info{flex:1;min-width:0}
.ep-drawer-num{font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--red);margin-bottom:3px}
.ep-drawer-title{font-size:0.78rem;font-weight:600;color:var(--text);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Below strip */
.below-strip{padding:14px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)}
.below-meta{flex:1;min-width:0}
.below-series{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--red);margin-bottom:3px}
.below-title{font-size:1.05rem;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.below-actions{display:flex;gap:8px;flex-shrink:0}
.below-btn{display:inline-flex;align-items:center;gap:7px;font-family:'Outfit',sans-serif;font-size:0.84rem;font-weight:700;padding:9px 18px;border-radius:3px;border:1px solid var(--border);color:var(--text2);transition:all 0.2s;cursor:pointer;background:none}
.below-btn:hover{background:rgba(255,255,255,0.07);color:#fff}
.below-btn svg{width:14px;height:14px;fill:currentColor}
.below-btn-primary{background:var(--red);color:#fff;border-color:var(--red)}
.below-btn-primary:hover{background:#c40812;border-color:#c40812;color:#fff}

/* Footer */
.page-footer{border-top:1px solid var(--border);padding:22px 20px;max-width:1400px;margin:0 auto}
.page-footer p{font-size:0.78rem;color:var(--text3)}
.page-footer a{color:var(--text3);transition:color 0.2s}
.page-footer a:hover{color:var(--text2)}
.footer-logo{font-size:1.2rem;font-weight:900;color:var(--red);margin-bottom:6px;display:inline-block}

/* ═══ MOBILE ═══ */
@media(max-width:640px){
  .ctrl-ep{font-size:0.8rem;max-width:50vw}
  .center-play{width:56px;height:56px}
  .center-play svg{width:24px;height:24px}
  .time-txt{display:none}
  .vol-group:hover .vol-slider-wrap{width:52px}
  .ep-drawer{width:min(300px,85vw);right:calc(-1 * min(300px,85vw))}
  .below-title{font-size:0.9rem}
  .pop-menu{min-width:160px;right:0}
}
@media(max-width:480px){
  .ctrl-top-bar{padding:10px 12px 30px}
  .ctrl-bottom-wrap{padding:0 10px 10px}
  .cb{width:34px;height:34px}
  .cb svg{width:18px;height:18px}
}
`;
