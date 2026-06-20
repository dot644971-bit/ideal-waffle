'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { getSeriesBySlug } from '@/lib/config';
import type { Series, Episode } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════
   YOUTUBE IFRAME API TYPES
══════════════════════════════════════════════════════════════ */
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: typeof YT;
    cast?: any;
    chrome?: any;
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace YT {
  export enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  export class Player {
    constructor(elementId: string, opts?: {
      events?: {
        onReady?: (e: { target: Player }) => void;
        onStateChange?: (e: { data: PlayerState; target: Player }) => void;
        onError?: (e: { data: number; target: Player }) => void;
      };
    });
    getDuration(): number;
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    setVolume(volume: number): void;
    getVolume(): number;
    mute(): void;
    unMute(): void;
    setPlaybackRate(rate: number): void;
    getVideoLoadedFraction(): number;
    getOption(module: string, option: string): any;
    setOption(module: string, option: string, value: any): void;
    loadModule(module: string): void;
    unloadModule(module: string): void;
    destroy(): void;
  }
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function fmt(s: number): string {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function generateDemoEpisodes(seriesName: string): Episode[] {
  const eps: Episode[] = [];
  for (let i = 1; i <= 10; i++) {
    eps.push({
      videoId: 'dQw4w9WgXcQ',
      title: seriesName + ' — Episode ' + i,
      description: 'Episode description will appear here.',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      position: i - 1,
    });
  }
  return eps;
}

/* ══════════════════════════════════════════════════════════════
   ICON SVG PATHS
══════════════════════════════════════════════════════════════ */
const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
const ICON_VOL = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>';
const ICON_MUTE = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
const ICON_FS = '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>';
const ICON_UFS = '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>';
const SPEED_LIST = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function PlayerPage() {
  const pageParams = useAppStore((s) => s.pageParams);
  const navigate = useAppStore((s) => s.navigate);

  const slug = (pageParams.slug || '').trim();
  const videoId = (pageParams.video || '').trim();
  const epIdx = parseInt(pageParams.ep || '0', 10) || 0;

  const series = useMemo<Series | undefined>(() => getSeriesBySlug(slug), [slug]);
  const episodes = useMemo<Episode[]>(() => {
    if (!series) return [];
    return generateDemoEpisodes(series.name);
  }, [series]);

  const currentEp = episodes[epIdx] || episodes[0];
  const nextEp = episodes[epIdx + 1] || null;
  const prevEp = epIdx > 0 ? (episodes[epIdx - 1] || null) : null;
  const totalEps = episodes.length;
  const epTitle = currentEp?.title || (series?.name + ' — Episode ' + (epIdx + 1));

  /* ── Refs ── */
  const videoAreaRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const cpHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const subPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const castScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── State ── */
  const [cpReady, setCpReady] = useState(false);
  const [cpIsPlaying, setCpIsPlaying] = useState(false);
  const [cpIsMuted, setCpIsMuted] = useState(false);
  const [cpDuration, setCpDuration] = useState(0);
  const [cpProgressDragging, setCpProgressDragging] = useState(false);
  const [cpNextShown, setCpNextShown] = useState(false);
  const [cpNextDismissed, setCpNextDismissed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [controlsOn, setControlsOn] = useState(true);
  const [spinnerShow, setSpinnerShow] = useState(false);
  const [flashState, setFlashState] = useState<'idle' | 'pop' | 'out'>('idle');
  const [flashIconSvg, setFlashIconSvg] = useState(ICON_PLAY);
  const [seekLeftShow, setSeekLeftShow] = useState(false);
  const [seekRightShow, setSeekRightShow] = useState(false);
  const [filledPct, setFilledPct] = useState(0);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [timeTipText, setTimeTipText] = useState('0:00');
  const [timeTipLeft, setTimeTipLeft] = useState('0%');
  const [timeTipVisible, setTimeTipVisible] = useState(false);
  const [playIconSvg, setPlayIconSvg] = useState(ICON_PLAY);
  const [volIconSvg, setVolIconSvg] = useState(ICON_VOL);
  const [volValue, setVolValue] = useState(100);
  const [fsIconSvg, setFsIconSvg] = useState(ICON_FS);
  const [cpIsFS, setCpIsFS] = useState(false);
  const [cpCurrentSpeed, setCpCurrentSpeed] = useState(1);
  const [speedIdx, setSpeedIdx] = useState(2);

  // Panels
  const [settOpen, setSettOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [epOpen, setEpOpen] = useState(false);
  const [embedErrShow, setEmbedErrShow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarIconPath, setSidebarIconPath] = useState('m9 18 6-6-6-6');
  const [playing, setPlaying] = useState(false);

  // Subtitles
  const [subTrackList, setSubTrackList] = useState<{ id: string; label: string }[]>([
    { id: 'off', label: 'Kapalı' },
  ]);
  const [activeSubTrack, setActiveSubTrack] = useState('off');
  const [audioTrackList, setAudioTrackList] = useState<{ id: string; label: string }[]>([
    { id: 'default', label: 'Orijinal' },
  ]);
  const [activeAudioTrack, setActiveAudioTrack] = useState('default');
  const [subOverlayText, setSubOverlayText] = useState('');
  const [subOverlayHasText, setSubOverlayHasText] = useState(false);

  // Cast
  const [castModalOpen, setCastModalOpen] = useState(false);
  const [castScanView, setCastScanView] = useState(true);
  const [castDeviceView, setCastDeviceView] = useState(false);
  const [castDeviceList, setCastDeviceList] = useState<any[]>([]);
  const [castNoDevices, setCastNoDevices] = useState(false);
  const [castConnectedBanner, setCastConnectedBanner] = useState(false);
  const [castConnectedDeviceName, setCastConnectedDeviceName] = useState('—');
  const [castBtnClass, setCastBtnClass] = useState('cast-idle');
  const [castSession, setCastSession] = useState<any>(null);
  const [castDeviceName, setCastDeviceName] = useState<string | null>(null);
  const [castMode, setCastMode] = useState<string | null>(null);

  // Subtitle customization
  const [scpOpen, setScpOpen] = useState(false);
  const [scpState, setScpState] = useState({
    fontSize: 100,
    textOpacity: 100,
    bgOpacity: 55,
    textColor: '#ffffff',
    bgColorRgb: '0,0,0',
  });

  // Toast
  const [toasts, setToasts] = useState<string[]>([]);

  /* ── Toast helper ── */
  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, msg]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((_, i) => i !== prev.indexOf(msg)));
    }, 2800);
  }, []);

  /* ── Redirect if no series or no video ── */
  useEffect(() => {
    if (!series || !videoId) {
      navigate('home');
    }
  }, [series, videoId, navigate]);

  const isValid = !!(series && videoId);

  /* ── Helper functions (declared first to avoid "accessed before declared") ── */
  const renderSubTrackList = (tracks: any[]) => {
    const list: { id: string; label: string }[] = [{ id: 'off', label: 'Kapalı' }];
    if (!tracks || !tracks.length) {
      const langs = [
        { id: 'tr', label: 'Türkçe' },
        { id: 'en', label: 'İngilizce' },
        { id: 'de', label: 'Almanca' },
      ];
      langs.forEach((l) => list.push({ id: l.id, label: l.label }));
      setSubTrackList(list);
      return;
    }
    tracks.forEach((t: any) => {
      list.push({
        id: t.languageCode,
        label: t.languageName || t.displayName || t.languageCode,
      });
    });
    setSubTrackList(list);
  };

  const renderAudioTrackList = (tracks: any[]) => {
    const list: { id: string; label: string }[] = [{ id: 'default', label: 'Orijinal' }];
    if (!tracks || !tracks.length) {
      setAudioTrackList(list);
      return;
    }
    tracks.forEach((t: any) => {
      list.push({
        id: t.languageCode || t.id,
        label: t.displayName || t.languageName || (t.languageCode || 'Unknown'),
      });
    });
    setAudioTrackList(list);
  };

  const closeAllPanels = () => {
    setSettOpen(false); setSubOpen(false); setEpOpen(false);
  };

  const startSubtitlePolling = () => {
    clearInterval(subPollTimerRef.current);
    subPollTimerRef.current = setInterval(() => {
      if (activeSubTrack === 'off') {
        clearInterval(subPollTimerRef.current);
        setSubOverlayText('');
        setSubOverlayHasText(false);
        return;
      }
      try {
        const iframe = document.getElementById('yt-iframe') as HTMLIFrameElement | null;
        if (!iframe?.contentDocument) return;
        let captionWin = iframe.contentDocument.querySelector('.captions-text');
        if (!captionWin) captionWin = iframe.contentDocument.querySelector('.ytp-caption-segment');
        if (captionWin && captionWin.textContent?.trim()) {
          setSubOverlayText(captionWin.textContent.trim());
          setSubOverlayHasText(true);
        } else {
          setSubOverlayText('');
          setSubOverlayHasText(false);
        }
      } catch {
        // Cross-origin
      }
    }, 300);
  };

  const selectSubTrack = (id: string, label: string) => {
    setActiveSubTrack(id);
    try {
      if (id === 'off') {
        ytPlayerRef.current?.unloadModule('captions');
        setSubOverlayText('');
        setSubOverlayHasText(false);
        showToast('Altyazı: Kapalı');
      } else {
        ytPlayerRef.current?.loadModule('captions');
        ytPlayerRef.current?.setOption('captions', 'track', { languageCode: id });
        showToast('Altyazı: ' + label);
        startSubtitlePolling();
      }
    } catch {
      showToast('Altyazı: ' + label);
    }
    closeAllPanels();
  };

  const selectAudioTrack = (id: string, label: string) => {
    setActiveAudioTrack(id);
    try {
      if (id === 'default') {
        ytPlayerRef.current?.setOption('audioTrack', 'track', {});
      } else {
        ytPlayerRef.current?.setOption('audioTrack', 'track', { languageCode: id });
      }
      showToast('Ses: ' + label);
    } catch {
      showToast('Ses: ' + label);
    }
    closeAllPanels();
  };

  const doFlashFn = useCallback((isPlaying: boolean) => {
    setFlashIconSvg(isPlaying ? ICON_PLAY : ICON_PAUSE);
    setFlashState('pop');
    clearTimeout(doFlashTimerRef.current);
    doFlashTimerRef.current = setTimeout(() => {
      setFlashState('out');
      setTimeout(() => setFlashState('idle'), 180);
    }, 600);
  }, []);

  const hideControlsFn = useCallback(() => {
    if (!cpIsPlaying) return;
    if (settOpen || subOpen || epOpen) return;
    setControlsVisible(false);
    setTopbarHidden(true);
    setControlsOn(false);
  }, [cpIsPlaying, settOpen, subOpen, epOpen]);

  const showControlsFn = useCallback(() => {
    setControlsVisible(true);
    setTopbarHidden(false);
    setControlsOn(true);
    clearTimeout(cpHideTimerRef.current);
    cpHideTimerRef.current = setTimeout(hideControlsFn, 3500);
  }, [hideControlsFn]);

  /* ── YouTube API init ── */
  useEffect(() => {
    if (!isValid) return;
    // Load YouTube IFrame API script
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    const ytReadyHandler = () => {
      ytPlayerRef.current = new YT.Player('yt-iframe', {
        events: {
          onReady: (e) => {
            setCpReady(true);
            const dur = e.target.getDuration() || 0;
            setCpDuration(dur);
            e.target.setVolume(100);
          },
          onStateChange: (e) => {
            const s = e.data;
            if (s === YT.PlayerState.PLAYING) {
              setCpIsPlaying(true);
              setPlayIconSvg(ICON_PAUSE);
              setFlashIconSvg(ICON_PAUSE);
              setSpinnerShow(false);
              const dur = e.target.getDuration() || 0;
              setCpDuration(dur);
              setPlaying(true);
            } else if (s === YT.PlayerState.PAUSED) {
              setCpIsPlaying(false);
              setPlayIconSvg(ICON_PLAY);
              setFlashIconSvg(ICON_PLAY);
              setPlaying(false);
              showControlsFn();
            } else if (s === YT.PlayerState.BUFFERING) {
              setSpinnerShow(true);
            } else if (s === YT.PlayerState.ENDED) {
              setCpIsPlaying(false);
              setPlayIconSvg(ICON_PLAY);
              setFlashIconSvg(ICON_PLAY);
              setPlaying(false);
              if (nextEp && !cpNextDismissed) {
                setTimeout(() => {
                  navigate('player', { slug, video: nextEp.videoId, ep: String(epIdx + 1) });
                }, 3000);
              }
            }
            if (s !== YT.PlayerState.BUFFERING) {
              setSpinnerShow(false);
            }
          },
          onError: (e) => {
            if ([101, 150].includes(e.data)) {
              setEmbedErrShow(true);
            }
          },
        },
      });
    };

    (window as any).onYouTubeIframeAPIReady = ytReadyHandler;

    return () => {
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
        ytPlayerRef.current = null;
      }
      delete (window as any).onYouTubeIframeAPIReady;
    };
  }, [isValid, showControlsFn, nextEp, cpNextDismissed, navigate]);

  /* ── Load caption tracks after player ready ── */
  useEffect(() => {
    if (!cpReady || !isValid) return;
    const loadTracks = () => {
      try {
        const captionModule = ytPlayerRef.current?.getOption('captions', 'tracklist');
        if (!captionModule) {
          setTimeout(loadTracks, 1500);
          return;
        }
        renderSubTrackList(captionModule);
      } catch {
        setTimeout(loadTracks, 2000);
      }
    };
    loadTracks();

    try {
      const audioTracks = ytPlayerRef.current?.getOption('audioTrack', 'tracklist');
      renderAudioTrackList(audioTracks);
    } catch {}
  }, [cpReady, isValid]);

  /* ── Progress loop ── */
  useEffect(() => {
    if (!cpReady) return;
    loopTimerRef.current = setInterval(() => {
      if (!cpReady || !ytPlayerRef.current || cpProgressDragging) return;
      const cur = ytPlayerRef.current.getCurrentTime() || 0;
      const dur = cpDuration || ytPlayerRef.current.getDuration() || 1;
      const pct = (cur / dur) * 100;
      setFilledPct(pct);
      setCurrentTime(cur);
      try { setBufferedPct(ytPlayerRef.current.getVideoLoadedFraction() * 100); } catch {}
      if (!cpNextDismissed && dur > 60 && (dur - cur) <= 30 && !cpNextShown) {
        setCpNextShown(true);
      }
    }, 500);
    return () => { if (loopTimerRef.current) clearInterval(loopTimerRef.current); };
  }, [cpReady, cpDuration, cpProgressDragging, cpNextDismissed, cpNextShown]);

  /* ── Playback controls ── */
  const cpTogglePlay = useCallback(() => {
    if (!cpReady) return;
    if (cpIsPlaying) {
      ytPlayerRef.current?.pauseVideo();
      showControlsFn();
    } else {
      ytPlayerRef.current?.playVideo();
    }
    doFlashFn(!cpIsPlaying);
  }, [cpReady, cpIsPlaying, showControlsFn, doFlashFn]);

  const cpSeek = useCallback((s: number) => {
    if (!cpReady) return;
    ytPlayerRef.current?.seekTo(Math.max(0, (ytPlayerRef.current.getCurrentTime() || 0) + s), true);
    showControlsFn();
  }, [cpReady, showControlsFn]);

  const flashSeek = useCallback((dir: 'left' | 'right') => {
    if (dir === 'left') {
      setSeekLeftShow(true);
      setTimeout(() => setSeekLeftShow(false), 600);
    } else {
      setSeekRightShow(true);
      setTimeout(() => setSeekRightShow(false), 600);
    }
  }, []);

  const cpToggleMute = useCallback(() => {
    if (!cpReady) return;
    if (cpIsMuted) {
      ytPlayerRef.current?.unMute();
      setCpIsMuted(false);
      setVolIconSvg(ICON_VOL);
      setVolValue(ytPlayerRef.current?.getVolume() || 100);
    } else {
      ytPlayerRef.current?.mute();
      setCpIsMuted(true);
      setVolIconSvg(ICON_MUTE);
    }
  }, [cpReady, cpIsMuted]);

  const onVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolValue(val);
    if (!cpReady) return;
    ytPlayerRef.current?.setVolume(val);
    const isMuted = val === 0;
    setCpIsMuted(isMuted);
    setVolIconSvg(isMuted ? ICON_MUTE : ICON_VOL);
    if (!isMuted) ytPlayerRef.current?.unMute();
    else ytPlayerRef.current?.mute();
  }, [cpReady]);

  /* ── Progress bar drag ── */
  const getProgressPct = (e: React.MouseEvent | React.TouchEvent): number => {
    const el = document.getElementById('progressBar');
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const onProgressMouseDown = (e: React.MouseEvent) => {
    setCpProgressDragging(true);
    const pct = getProgressPct(e);
    setFilledPct(pct * 100);
    setTimeTipText(fmt(pct * cpDuration));
    setTimeTipLeft(Math.max(3, Math.min(97, pct * 100)) + '%');
    setTimeTipVisible(true);

    const onMove = (ev: MouseEvent) => {
      const el = document.getElementById('progressBar');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      setFilledPct(p * 100);
      setTimeTipText(fmt(p * cpDuration));
      setTimeTipLeft(Math.max(3, Math.min(97, p * 100)) + '%');
      setCurrentTime(p * cpDuration);
    };
    const onUp = (ev: MouseEvent) => {
      setCpProgressDragging(false);
      const el = document.getElementById('progressBar');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      ytPlayerRef.current?.seekTo(cpDuration * p, true);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const onProgressMouseMove = (e: React.MouseEvent) => {
    const pct = getProgressPct(e);
    setTimeTipText(fmt(pct * cpDuration));
    setTimeTipLeft(Math.max(3, Math.min(97, pct * 100)) + '%');
  };

  const onProgressTouchStart = (e: React.TouchEvent) => {
    setCpProgressDragging(true);
    const pct = getProgressPct(e);
    setFilledPct(pct * 100);
  };

  const onProgressTouchMove = (e: React.TouchEvent) => {
    const pct = getProgressPct(e);
    setFilledPct(pct * 100);
    setCurrentTime(pct * cpDuration);
  };

  const onProgressTouchEnd = (e: React.TouchEvent) => {
    setCpProgressDragging(false);
    const pct = getProgressPct(e);
    ytPlayerRef.current?.seekTo(cpDuration * pct, true);
  };

  /* ── Speed ── */
  const cpSetSpeed = useCallback((val: number) => {
    setCpCurrentSpeed(val);
    if (cpReady) ytPlayerRef.current?.setPlaybackRate(val);
    const idx = SPEED_LIST.indexOf(val);
    setSpeedIdx(idx >= 0 ? idx : 0);
    closeAllPanels();
    showToast('Hız: ' + (val === 1 ? 'Normal' : val + 'x'));
  }, [cpReady, showToast]);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEED_LIST.length;
    setSpeedIdx(next);
    cpSetSpeed(SPEED_LIST[next]);
  }, [speedIdx, cpSetSpeed]);

  /* ── Panels ── */
  const toggleSettPanel = () => {
    setSettOpen(!settOpen); setSubOpen(false); setEpOpen(false);
  };
  const toggleSubPanel = () => {
    setSubOpen(!subOpen); setSettOpen(false); setEpOpen(false);
  };
  const toggleEpPanel = () => {
    setEpOpen(!epOpen); setSettOpen(false); setSubOpen(false);
  };

  /* ── Fullscreen ── */
  const cpToggleFS = useCallback(() => {
    const target = document.getElementById('videoArea');
    if (!target) return;
    if (!cpIsFS) {
      if (target.requestFullscreen) target.requestFullscreen();
      else if ((target as any).webkitRequestFullscreen) (target as any).webkitRequestFullscreen();
      setCpIsFS(true);
      setFsIconSvg(ICON_UFS);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      setCpIsFS(false);
      setFsIconSvg(ICON_FS);
    }
  }, [cpIsFS]);

  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setCpIsFS(false);
        setFsIconSvg(ICON_FS);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  /* ── Sidebar toggle ── */
  const toggleSidebar = () => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    setSidebarIconPath(next ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6');
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '');
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); cpTogglePlay(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); cpSeek(-10); flashSeek('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); cpSeek(10); flashSeek('right'); }
      else if (e.key === 'f' || e.key === 'F') cpToggleFS();
      else if (e.key === 'm' || e.key === 'M') cpToggleMute();
      else if (e.key === 'Escape') { closeAllPanels(); if (scpOpen) setScpOpen(false); if (castModalOpen) setCastModalOpen(false); }
      else if (e.key === 'c' || e.key === 'C') toggleSubPanel();
      else if (e.key === 'e' || e.key === 'E') toggleEpPanel();
      else if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey) setCastModalOpen(true);
      else if (e.shiftKey && e.key === 'ArrowRight' && nextEp) navigate('player', { slug, video: nextEp.videoId, ep: String(epIdx + 1) });
      else if (e.shiftKey && e.key === 'ArrowLeft' && prevEp) navigate('player', { slug, video: prevEp.videoId, ep: String(epIdx - 1) });
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [cpTogglePlay, cpSeek, flashSeek, cpToggleFS, cpToggleMute, toggleSubPanel, toggleEpPanel, nextEp, prevEp, slug, epIdx, navigate, scpOpen, castModalOpen]);

  /* ── Mobile double tap seek ── */
  const onCenterTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      clearTimeout(tapTimerRef.current);
      const x = e.changedTouches[0].clientX;
      const r = videoAreaRef.current?.getBoundingClientRect();
      if (r) {
        if (x < r.left + r.width / 2) { cpSeek(-10); flashSeek('left'); }
        else { cpSeek(10); flashSeek('right'); }
      }
    } else {
      tapTimerRef.current = setTimeout(() => { cpTogglePlay(); }, 250);
    }
    lastTapRef.current = now;
    e.preventDefault();
  };

  /* ── Subtitle customization ── */
  const scpSetTextColor = (color: string) => {
    setScpState((s) => ({ ...s, textColor: color }));
  };
  const scpSetBgColor = (rgb: string) => {
    setScpState((s) => ({ ...s, bgColorRgb: rgb }));
  };
  const scpReset = () => {
    setScpState({ fontSize: 100, textOpacity: 100, bgOpacity: 55, textColor: '#ffffff', bgColorRgb: '0,0,0' });
    showToast('Altyazı ayarları sıfırlandı');
  };
  const scpApplyAndClose = () => {
    setScpOpen(false);
    showToast('Altyazı ayarları uygulandı');
  };

  // Subtitle overlay style
  const subOverlayStyle: React.CSSProperties = {
    fontSize: scpState.bgColorRgb === 'transparent' ? undefined : `clamp(${0.9 * scpState.fontSize / 100}rem, ${2 * scpState.fontSize / 100}vw, ${1.15 * scpState.fontSize / 100}rem)`,
    color: scpState.textColor,
    opacity: scpState.textOpacity / 100,
    background: scpState.bgColorRgb === 'transparent' ? 'transparent' : `rgba(${scpState.bgColorRgb}, ${scpState.bgOpacity / 100})`,
  };

  // Preview style
  const scpPreviewStyle: React.CSSProperties = {
    fontSize: (1.05 * scpState.fontSize / 100) + 'rem',
    color: scpState.textColor,
    opacity: scpState.textOpacity / 100,
    background: scpState.bgColorRgb === 'transparent' ? 'transparent' : `rgba(${scpState.bgColorRgb}, ${scpState.bgOpacity / 100})`,
    fontWeight: 600,
    textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7)',
    lineHeight: '1.5',
    padding: '4px 10px',
    borderRadius: '3px',
  };

  /* ── Cast ── */
  const openCastModal = () => {
    setCastModalOpen(true);
    setCastScanView(true);
    setCastDeviceView(false);
    castStartScan();
  };
  const closeCastModal = () => {
    setCastModalOpen(false);
    clearTimeout(castScanTimerRef.current);
  };

  const castStartScan = () => {
    if (castSession) {
      setCastScanView(false);
      setCastDeviceView(true);
      return;
    }
    castScanTimerRef.current = setTimeout(() => {
      setCastScanView(false);
      setCastDeviceView(true);
      if (!castSession) {
        const fallbackDevices = [
          { id: 'chrome_cast', name: 'Chrome ile Yayınla', type: 'Tarayıcı Cast (Ctrl+Shift+U)', action: 'chrome' },
          { id: 'airplay', name: 'AirPlay (Safari/macOS)', type: 'Apple AirPlay', action: 'airplay' },
        ];
        setCastDeviceList(fallbackDevices);
        setCastNoDevices(false);
      }
    }, 2200);
  };

  const castConnectDevice = (dev: any) => {
    if (dev.action === 'chrome') {
      const t = Math.floor(ytPlayerRef.current?.getCurrentTime() || 0);
      const ytUrl = 'https://www.youtube.com/watch?v=' + videoId + (t > 0 ? '&t=' + t : '');
      window.open(ytUrl, '_blank');
      showToast("YouTube'u açtı — Cast için Ctrl+Shift+U kullanın");
      closeCastModal();
    } else if (dev.action === 'airplay') {
      showToast('Safari veya macOS Safari ile AirPlay kullanın');
      closeCastModal();
    }
  };

  const castStop = () => {
    setCastSession(null);
    setCastDeviceName(null);
    setCastMode(null);
    setCastBtnClass('cast-idle');
    setCastConnectedBanner(false);
    closeCastModal();
    showToast('Cast durduruldu');
  };

  /* ── Click outside panels ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#settBtn') && !target.closest('#settPanel')) setSettOpen(false);
      if (!target.closest('#subBtn') && !target.closest('#subPanel')) setSubOpen(false);
      if (!target.closest('#epPickBtn') && !target.closest('#epPanel')) setEpOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* ── Navigate to episode helper ── */
  const goToEp = (ep: Episode, idx: number) => {
    navigate('player', { slug, video: ep.videoId, ep: String(idx) });
  };

  const iframeSrc = `https://www.youtube.com/embed/${videoId}?controls=0&rel=0&modestbranding=1&playsinline=1&autoplay=0&enablejsapi=1&cc_load_policy=0&iv_load_policy=3`;

  if (!isValid) return null;

  return (
    <>
      <style>{PLAYER_CSS}</style>

      <div className="page-shell">

        {/* TOP BAR */}
        <div className={`topbar${topbarHidden ? ' hidden' : ''}`}>
          <span className="tb-logo">MegaXtoon</span>
          <button
            className="tb-back"
            onClick={() => navigate('series', { slug })}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Geri</span>
          </button>
          <span className="tb-title">{series.name}</span>
          <span className="tb-ep-badge">E{epIdx + 1}/{totalEps}</span>
        </div>

        {/* MAIN AREA */}
        <div className="main-area">

          {/* VIDEO AREA */}
          <div
            className={`video-area${controlsOn ? ' controls-on' : ''}${playing ? ' playing' : ''}`}
            id="videoArea"
            ref={videoAreaRef}
            onMouseEnter={showControlsFn}
            onMouseLeave={() => { if (cpIsPlaying) { clearTimeout(cpHideTimerRef.current); hideControlsFn(); } }}
          >
            {/* YouTube iframe */}
            <iframe
              id="yt-iframe"
              className="yt-iframe"
              src={iframeSrc}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              title={epTitle}
            />

            {/* Subtitle overlay */}
            <div
              className={`sub-overlay${subOverlayHasText ? ' has-text' : ''}`}
              style={subOverlayStyle}
            >
              {subOverlayText}
            </div>

            {/* PLAYER OVERLAY */}
            <div
              className={`cp${controlsVisible ? ' visible' : ''}`}
              id="cpEl"
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.cbtn') || target.closest('.progress') ||
                    target.closest('.cp-panel') || target.closest('.ep-panel') ||
                    target.closest('.next-card') || target.closest('.cp-back') ||
                    target.closest('.cp-ep-num')) return;
                if (settOpen || subOpen || epOpen) { closeAllPanels(); return; }
                cpTogglePlay();
              }}
              onMouseMove={showControlsFn}
            >
              {/* TOP */}
              <div className="cp-top">
                <button className="cp-back" onClick={() => navigate('series', { slug })}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span className="cp-series-title">{series.name}</span>
                <span className="cp-ep-num">Bölüm {epIdx + 1}</span>
              </div>

              {/* CENTER */}
              <div className="cp-center" id="cpCenter" onTouchEnd={onCenterTouchEnd}>
                <div className={`cp-flash${flashState === 'pop' ? ' pop' : flashState === 'out' ? ' out' : ''}`} id="cpFlash">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: flashIconSvg }} />
                </div>
              </div>

              {/* SEEK INDICATORS */}
              <div className={`seek-ind left${seekLeftShow ? ' show' : ''}`} id="seekLeft">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/><path d="m9 18-6-6 6-6"/></svg>
                <span>10s</span>
              </div>
              <div className={`seek-ind right${seekRightShow ? ' show' : ''}`} id="seekRight">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/><path d="m15 6 6 6-6 6"/></svg>
                <span>10s</span>
              </div>

              {/* SPINNER */}
              <div className={`spinner${spinnerShow ? ' show' : ''}`}><div className="spinner-ring"></div></div>

              {/* BOTTOM CONTROLS */}
              <div className="cp-bottom">
                {/* Progress */}
                <div
                  className="progress"
                  id="progressBar"
                  role="slider"
                  aria-label="Video ilerlemesi"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(filledPct)}
                  onMouseDown={onProgressMouseDown}
                  onMouseMove={onProgressMouseMove}
                  onTouchStart={onProgressTouchStart}
                  onTouchMove={onProgressTouchMove}
                  onTouchEnd={onProgressTouchEnd}
                  onMouseEnter={() => setTimeTipVisible(true)}
                  onMouseLeave={() => setTimeTipVisible(false)}
                >
                  <div className="track">
                    <div className="buffered-bar" style={{ width: bufferedPct + '%' }} />
                    <div className="filled-bar" style={{ width: filledPct + '%' }} />
                    <div className="thumb-dot" style={{ left: filledPct + '%' }} />
                  </div>
                  <div
                    className="time-tip"
                    style={{ left: timeTipLeft, opacity: timeTipVisible ? 1 : 0 }}
                  >
                    {timeTipText}
                  </div>
                </div>

                {/* Controls row */}
                <div className="controls">
                  {/* Play/Pause */}
                  <button className="cbtn" onClick={cpTogglePlay} aria-label="Oynat/Duraklat">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: playIconSvg }} />
                  </button>

                  {/* Prev Ep */}
                  {prevEp && (
                    <button className="cbtn" title="Önceki Bölüm" onClick={() => goToEp(prevEp, epIdx - 1)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                    </button>
                  )}

                  {/* Next Ep */}
                  {nextEp && (
                    <button className="cbtn" title="Sonraki Bölüm" onClick={() => goToEp(nextEp, epIdx + 1)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                  )}

                  {/* Volume */}
                  <div className="vol-wrap" id="volWrap">
                    <button className="cbtn" onClick={cpToggleMute} aria-label="Sessiz">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: volIconSvg }} />
                    </button>
                    <input
                      type="range"
                      className="vol-slider"
                      min={0}
                      max={100}
                      value={volValue}
                      onChange={onVolumeChange}
                      aria-label="Ses"
                    />
                  </div>

                  {/* Time */}
                  <div className="cp-time">
                    <span>{fmt(currentTime)}</span><span className="sep">/</span><span>{fmt(cpDuration)}</span>
                  </div>

                  {/* Center title */}
                  <div className="ep-center">
                    <span className="sname">{series.name}</span>
                    &nbsp;·&nbsp;Bölüm {epIdx + 1}
                  </div>

                  {/* RIGHT GROUP */}
                  <div className="cp-right">

                    {/* Episode Picker */}
                    <div style={{ position: 'relative' }}>
                      <button className="cbtn sm" id="epPickBtn" onClick={toggleEpPanel} title="Bölüm Seç" aria-label="Bölüm Seç">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                      </button>
                      <div className={`ep-panel${epOpen ? ' open' : ''}`} id="epPanel">
                        <div className="ep-panel-head">
                          <span>Bölüm Seç</span>
                          <span className="ep-panel-count">{totalEps} bölüm</span>
                        </div>
                        <div className="ep-panel-list" id="epPanelList">
                          {episodes.map((ep, i) => (
                            <button
                              key={i}
                              className={`ep-row${i === epIdx ? ' active' : ''}`}
                              onClick={() => goToEp(ep, i)}
                            >
                              <img
                                src={ep.thumbnail || ''}
                                alt={`Bölüm ${i + 1}`}
                                className="ep-row-thumb"
                                loading="lazy"
                                onError={(e) => { (e.target as HTMLImageElement).style.background = '#1a1a1a'; (e.target as HTMLImageElement).removeAttribute('src'); }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="ep-row-num">Bölüm {i + 1}</div>
                                <div className="ep-row-name">{ep.title}</div>
                              </div>
                              {i === epIdx && (
                                <div className="ep-row-play"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Subtitles / Audio */}
                    <div style={{ position: 'relative' }}>
                      <button className="cbtn sm" id="subBtn" onClick={toggleSubPanel} title="Altyazı / Ses (C)" aria-label="Altyazı">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M7 12h4m-4 4h10M13 12h4"/></svg>
                      </button>
                      <div className={`cp-panel${subOpen ? ' open' : ''}`} id="subPanel">
                        <div className="panel-head">Altyazı</div>
                        {subTrackList.map((t) => (
                          <div
                            key={t.id}
                            className={`panel-item${activeSubTrack === t.id ? ' active' : ''}`}
                            onClick={() => selectSubTrack(t.id, t.label)}
                          >
                            {t.label}
                          </div>
                        ))}
                        <div className="panel-divider"></div>
                        <div className="panel-head" style={{ borderBottom: 'none', paddingBottom: '2px' }}>Ses / Dublaj</div>
                        {audioTrackList.map((t) => (
                          <div
                            key={t.id}
                            className={`panel-item${activeAudioTrack === t.id ? ' active' : ''}`}
                            onClick={() => selectAudioTrack(t.id, t.label)}
                          >
                            {t.label}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subtitle Customize Button */}
                    <button className="cbtn sm" onClick={() => setScpOpen(true)} title="Altyazı Özelleştir" aria-label="Altyazı Özelleştir">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
                    </button>

                    {/* Speed */}
                    <div style={{ position: 'relative' }}>
                      <button className="cbtn sm" id="settBtn" onClick={toggleSettPanel} title="Hız & Kalite" aria-label="Ayarlar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      </button>
                      <div className={`cp-panel${settOpen ? ' open' : ''}`} id="settPanel">
                        <div className="panel-head">Oynatma Hızı</div>
                        {SPEED_LIST.map((sp) => (
                          <div
                            key={sp}
                            className={`panel-item${cpCurrentSpeed === sp ? ' active' : ''}`}
                            onClick={() => cpSetSpeed(sp)}
                          >
                            {sp === 1 ? 'Normal' : sp + 'x'}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Cast */}
                    <div className="cast-btn-wrap">
                      <button className={`cbtn ${castBtnClass}`} onClick={openCastModal} title="TV'de Yansıt" aria-label="TV'de Yansıt">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                          <path d="M2 12a9 9 0 0 1 8 8"/>
                          <path d="M2 16a5 5 0 0 1 4 4"/>
                          <line x1="2" y1="20" x2="2.01" y2="20"/>
                        </svg>
                      </button>
                    </div>

                    {/* Fullscreen */}
                    <button className="cbtn" onClick={cpToggleFS} aria-label="Tam Ekran" title="Tam Ekran (F)">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: fsIconSvg }} />
                    </button>

                  </div>{/* .cp-right */}
                </div>{/* .controls */}
              </div>{/* .cp-bottom */}
            </div>{/* .cp */}

            {/* Next Episode Card */}
            {nextEp && (
              <div className={`next-card${cpNextShown && !cpNextDismissed ? ' show' : ''}`}>
                <img src={nextEp.thumbnail || ''} alt="Sonraki bölüm" className="next-thumb" loading="lazy" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="next-label">Next Episode</div>
                  <div className="next-title">{nextEp.title}</div>
                  <div className="next-acts">
                    <button className="next-watch" onClick={() => goToEp(nextEp, epIdx + 1)}>Oynat</button>
                    <button className="next-close" onClick={() => setCpNextDismissed(true)}>✕</button>
                  </div>
                </div>
              </div>
            )}

            {/* Embed Error */}
            <div className={`embed-err${embedErrShow ? ' show' : ''}`}>
              <div className="embed-inner">
                <div className="embed-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="embed-title">Video Oynatılamıyor</div>
                <div className="embed-msg">Bu video gömülü olarak oynatılamıyor. YouTube'da izleyebilirsiniz.</div>
                <div className="embed-acts">
                  <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener" className="yt-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6a3 3 0 0 0-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
                    YouTube'da İzle
                  </a>
                  {nextEp && (
                    <button
                      className="next-watch"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}
                      onClick={() => goToEp(nextEp, epIdx + 1)}
                    >
                      Sonraki Bölüm
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar toggle button */}
            <button className="sidebar-toggle" onClick={toggleSidebar} title="Bölüm listesini gizle/göster">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={sidebarIconPath}/></svg>
            </button>

          </div>{/* .video-area */}

          {/* SIDEBAR — EPISODE LIST */}
          <div className={`sidebar${sidebarOpen ? '' : ' collapsed'}`} id="sidebar">
            <div className="sidebar-head">
              <div className="sidebar-label">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                Bölümler
              </div>
              <span className="sidebar-count">{totalEps}</span>
            </div>
            <div className="ep-list" id="epList">
              {episodes.map((ep, i) => (
                <button
                  key={i}
                  className={`ep-item${i === epIdx ? ' active' : ''}`}
                  onClick={() => goToEp(ep, i)}
                >
                  <img
                    src={ep.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 46'%3E%3Crect width='80' height='46' fill='%231a1a1a'/%3E%3C/svg%3E"}
                    alt={`Bölüm ${i + 1}`}
                    className="ep-thumb"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.background = '#1a1a1a'; (e.target as HTMLImageElement).removeAttribute('src'); }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ep-num">Bölüm {i + 1}</div>
                    <div className="ep-name">{ep.title}</div>
                  </div>
                  {i === epIdx && (
                    <div className="ep-play-ico"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>{/* .main-area */}

        {/* BOTTOM INFO BAR */}
        <div className="info-bar">
          <span className="info-series">{series.name}</span>
          <span className="info-sep">·</span>
          <span className="info-ep">{epTitle}</span>
          <div className="info-right">
            {prevEp && (
              <button className="info-nav" onClick={() => goToEp(prevEp, epIdx - 1)}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                <span>Önceki</span>
              </button>
            )}
            <button className="info-nav" onClick={() => navigate('series', { slug })}>
              <span>Tüm Bölümler</span>
            </button>
            {nextEp && (
              <button className="info-nav primary" onClick={() => goToEp(nextEp, epIdx + 1)}>
                <span>Sonraki</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            )}
          </div>
        </div>

      </div>{/* .page-shell */}

      {/* ══ CAST / TV'DE YANSIT MODAL ══ */}
      <div className={`cast-modal-overlay${castModalOpen ? ' open' : ''}`} onClick={closeCastModal} />
      <div className={`cast-modal${castModalOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="TV'de Yansıt">

        <div className="cast-modal-header">
          <div className="cast-modal-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
              <path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/>
              <line x1="2" y1="20" x2="2.01" y2="20"/>
            </svg>
            TV'de Yansıt
          </div>
          <button className="cast-modal-close" onClick={closeCastModal} aria-label="Kapat">✕</button>
        </div>

        {/* Scanning state */}
        {castScanView && (
          <div className="cast-scan-wrap">
            <div className="cast-scan-icon">
              <div className="cast-scan-ring"></div>
              <div className="cast-scan-ring"></div>
              <div className="cast-scan-ring"></div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>
              </svg>
            </div>
            <div className="cast-scan-text">Yakındaki cihazlar aranıyor…</div>
            <div className="cast-scan-sub">Chromecast, Smart TV veya uyumlu bir cihaz bağlı olmalı</div>
          </div>
        )}

        {/* Device list */}
        {castDeviceView && (
          <>
            {castConnectedBanner && (
              <div className="cast-connected-banner" style={{ display: castConnectedBanner ? '' : 'none' }}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>
                  <path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/>
                  <line x1="2" y1="20" x2="2.01" y2="20"/>
                </svg>
                <div className="cast-conn-text">
                  <div className="cast-conn-label">Yayınlanıyor</div>
                  <div className="cast-conn-device">{castConnectedDeviceName}</div>
                </div>
                <button className="cast-stop-btn" onClick={castStop}>Durdur</button>
              </div>
            )}

            <div className="cast-device-list">
              {castDeviceList.map((dev: any, i: number) => (
                <div key={i} className="cast-device-item" onClick={() => castConnectDevice(dev)}>
                  <div className="cast-device-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {dev.action === 'airplay'
                        ? <><path d="m5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/><polygon points="12 15 17 21 7 21"/></>
                        : <><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><path d="M2 12a9 9 0 0 1 8 8"/><path d="M2 16a5 5 0 0 1 4 4"/><line x1="2" y1="20" x2="2.01" y2="20"/></>
                      }
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cast-device-name">{dev.name}</div>
                    <div className="cast-device-type">{dev.type}</div>
                  </div>
                  <span className="cast-device-badge badge-available">Bağlan</span>
                </div>
              ))}
            </div>

            {castNoDevices && (
              <div className="cast-no-devices" style={{ display: castNoDevices ? '' : 'none' }}>
                <p>Uyumlu cihaz bulunamadı.<br />Chromecast veya Cast destekli TV'nizin aynı Wi-Fi ağında olduğundan emin olun.</p>
              </div>
            )}
          </>
        )}

        <div className="cast-modal-footer">
          <p>Google Cast destekli TV, Chromecast veya uyumlu cihazlara yansıtabilirsiniz.<br />
          <a href="https://support.google.com/chromecast" target="_blank" rel="noopener">Daha fazla bilgi →</a></p>
        </div>
      </div>

      {/* SUBTITLE CUSTOMIZATION OVERLAY + PANEL */}
      <div className={`scp-overlay${scpOpen ? ' open' : ''}`} onClick={() => setScpOpen(false)} />
      <div className={`sub-custom-panel${scpOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label="Altyazı Özelleştir">

        <div className="scp-header">
          <div className="scp-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M7 12h4m-4 4h10M13 12h4"/></svg>
            Altyazı Özelleştir
          </div>
          <button className="scp-close" onClick={() => setScpOpen(false)} aria-label="Kapat">✕</button>
        </div>

        <div className="scp-body">
          {/* Preview */}
          <div className="scp-preview">
            <span className="scp-preview-label">Önizleme</span>
            <span style={scpPreviewStyle}>Altyazı örnek metin</span>
          </div>

          {/* Font Size */}
          <div className="scp-row">
            <label className="scp-label">Yazı Boyutu</label>
            <div className="scp-slider-wrap">
              <input
                type="range"
                className="scp-slider"
                min={60}
                max={200}
                value={scpState.fontSize}
                step={5}
                onChange={(e) => setScpState((s) => ({ ...s, fontSize: parseInt(e.target.value) }))}
              />
              <span className="scp-val">{scpState.fontSize}%</span>
            </div>
          </div>

          {/* Text Opacity */}
          <div className="scp-row">
            <label className="scp-label">Yazı Saydamlığı</label>
            <div className="scp-slider-wrap">
              <input
                type="range"
                className="scp-slider"
                min={20}
                max={100}
                value={scpState.textOpacity}
                step={5}
                onChange={(e) => setScpState((s) => ({ ...s, textOpacity: parseInt(e.target.value) }))}
              />
              <span className="scp-val">{scpState.textOpacity}%</span>
            </div>
          </div>

          {/* Background Opacity */}
          <div className="scp-row">
            <label className="scp-label">Arka Plan Saydamlığı</label>
            <div className="scp-slider-wrap">
              <input
                type="range"
                className="scp-slider"
                min={0}
                max={100}
                value={scpState.bgOpacity}
                step={5}
                onChange={(e) => setScpState((s) => ({ ...s, bgOpacity: parseInt(e.target.value) }))}
              />
              <span className="scp-val">{scpState.bgOpacity}%</span>
            </div>
          </div>

          {/* Text Color */}
          <div className="scp-row">
            <label className="scp-label">Yazı Rengi</label>
            <div className="scp-swatches">
              {[
                { color: '#ffffff', title: 'Beyaz' },
                { color: '#ffff00', title: 'Sarı' },
                { color: '#00ff88', title: 'Yeşil' },
                { color: '#88ccff', title: 'Açık Mavi' },
                { color: '#ff9944', title: 'Turuncu' },
                { color: '#ff4488', title: 'Pembe' },
              ].map((sw) => (
                <div
                  key={sw.color}
                  className={`scp-swatch${scpState.textColor === sw.color ? ' active' : ''}`}
                  data-color={sw.color}
                  style={{ background: sw.color }}
                  onClick={() => scpSetTextColor(sw.color)}
                  title={sw.title}
                />
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div className="scp-row">
            <label className="scp-label">Arka Plan Rengi</label>
            <div className="scp-swatches">
              {[
                { rgb: '0,0,0', title: 'Siyah', bg: '#000000', border: 'rgba(255,255,255,0.3)' },
                { rgb: '20,20,50', title: 'Lacivert', bg: '#141432' },
                { rgb: '50,0,0', title: 'Koyu Kırmızı', bg: '#320000' },
                { rgb: '0,30,10', title: 'Koyu Yeşil', bg: '#001e0a' },
                { rgb: '255,255,255', title: 'Beyaz', bg: '#ffffff' },
                { rgb: 'transparent', title: 'Saydam', bg: undefined },
              ].map((sw) => (
                <div
                  key={sw.rgb}
                  className={`scp-swatch${scpState.bgColorRgb === sw.rgb ? ' active' : ''}`}
                  data-color={sw.rgb}
                  style={sw.bg
                    ? { background: sw.bg, borderColor: sw.border }
                    : { background: "repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 0 0/10px 10px" }}
                  onClick={() => scpSetBgColor(sw.rgb)}
                  title={sw.title}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="scp-footer">
          <button className="scp-btn scp-btn-reset" onClick={scpReset}>Sıfırla</button>
          <button className="scp-btn scp-btn-apply" onClick={scpApplyAndClose}>Uygula & Kapat</button>
        </div>
      </div>

      {/* TOASTS */}
      <div className="toast-wrap" id="toastWrap">
        {toasts.map((msg, i) => (
          <div key={i} className="toast">{msg}</div>
        ))}
      </div>

      {/* Google Cast SDK */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var s = document.createElement('script');
              s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
              s.async = true;
              document.head.appendChild(s);
            })();
          `,
        }}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   EXACT CSS FROM PHP FILE (lines 54–1081)
══════════════════════════════════════════════════════════════ */
const PLAYER_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --red:        #e50914;
  --red-neon:   #ff1020;
  --red-glow:   rgba(229,9,20,0.55);
  --red-dark:   #b20710;
  --red-dim:    rgba(229,9,20,0.15);
  --bg:         #000;
  --surface:    #111;
  --surface2:   #1c1c1c;
  --surface3:   #242424;
  --text:       #ffffff;
  --text2:      #b3b3b3;
  --text3:      #666;
  --border:     rgba(255,255,255,0.08);
  --border2:    rgba(255,255,255,0.14);
  --safe-top:   env(safe-area-inset-top,0px);
  --safe-bot:   env(safe-area-inset-bottom,0px);
}

html,body { height:100%; overflow:hidden; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Outfit', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
a { text-decoration:none; color:inherit; }
button { cursor:pointer; border:none; background:none; font-family:inherit; color:inherit; }

/* ══════════════════════════════════════
   FULL-PAGE LAYOUT
══════════════════════════════════════ */
.page-shell {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── TOP BAR ── */
.topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 300;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 14px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, transparent 100%);
  transition: opacity 0.3s;
}
.topbar.hidden { opacity: 0; pointer-events: none; }
.tb-logo {
  font-size: 1.45rem;
  font-weight: 900;
  color: var(--red-neon);
  letter-spacing: -0.04em;
  text-shadow: 0 0 18px var(--red-glow), 0 0 40px rgba(229,9,20,0.3);
  flex-shrink: 0;
}
.tb-back {
  display: inline-flex; align-items: center; gap: 6px;
  color: rgba(255,255,255,0.75);
  font-size: 0.8rem; font-weight: 600;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(6px);
  transition: all 0.2s;
  flex-shrink: 0;
}
.tb-back:hover { color:#fff; border-color:rgba(255,255,255,0.35); background:rgba(255,255,255,0.08); }
.tb-back svg { width:14px; height:14px; }
.tb-title {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tb-ep-badge {
  font-size: 0.72rem; font-weight: 800;
  color: var(--red-neon);
  background: var(--red-dim);
  border: 1px solid rgba(229,9,20,0.3);
  padding: 3px 10px;
  border-radius: 3px;
  flex-shrink: 0;
  text-shadow: 0 0 8px var(--red-glow);
}

/* ══════════════════════════════════════
   VIDEO + SIDEBAR LAYOUT
══════════════════════════════════════ */
.main-area {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ── VIDEO AREA ── */
.video-area {
  flex: 1;
  position: relative;
  background: #000;
  overflow: hidden;
  cursor: none;
}
.video-area.controls-on { cursor: default; }

.yt-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: #000;
  pointer-events: none;
}

/* ══════════════════════════════════════
   PLAYER OVERLAY CONTROLS
══════════════════════════════════════ */
.cp {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.75) 0%,
    rgba(0,0,0,0) 18%,
    rgba(0,0,0,0) 52%,
    rgba(0,0,0,0.72) 82%,
    rgba(0,0,0,0.96) 100%
  );
  opacity: 0;
  transition: opacity 0.22s ease;
  user-select: none;
  -webkit-user-select: none;
}
.cp.visible { opacity: 1; }

/* ── CP TOP ── */
.cp-top {
  display: flex; align-items: center;
  gap: 10px; padding: 14px 18px 0;
  pointer-events: auto;
}
.cp-back {
  display: flex; align-items: center; gap: 7px;
  color: rgba(255,255,255,0.85);
  font-size: 0.8rem; font-weight: 700;
  padding: 7px 0; transition: color 0.15s;
  text-decoration: none;
}
.cp-back:hover { color:#fff; }
.cp-back svg { width:20px; height:20px; }
.cp-series-title {
  font-size: 0.82rem; font-weight: 600;
  color: rgba(255,255,255,0.7);
  margin-right: auto;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 300px;
}
.cp-ep-num {
  font-size: 0.72rem; font-weight: 800;
  color: var(--red-neon);
  background: var(--red-dim);
  border: 1px solid rgba(229,9,20,0.25);
  padding: 3px 9px; border-radius: 3px;
  text-shadow: 0 0 8px var(--red-glow);
  flex-shrink: 0;
}

/* ── CP CENTER ── */
.cp-center {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: auto;
}
.cp-flash {
  position: absolute;
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(229,9,20,0.2);
  border: 2px solid rgba(229,9,20,0.4);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
  transform: scale(0); opacity: 0;
  transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s;
  pointer-events: none;
  box-shadow: 0 0 30px var(--red-glow);
}
.cp-flash.pop { transform: scale(1); opacity: 1; }
.cp-flash.out { transform: scale(1.25); opacity: 0; }
.cp-flash svg { width: 32px; height: 32px; }

/* Seek indicators */
.seek-ind {
  position: absolute; top:50%; transform:translateY(-50%);
  display:flex; flex-direction:column; align-items:center; gap:4px;
  pointer-events:none; opacity:0; transition:opacity 0.18s; z-index:12;
}
.seek-ind.left  { left:8%; }
.seek-ind.right { right:8%; }
.seek-ind.show  { opacity:1; }
.seek-ind svg { width:32px; height:32px; color:#fff; filter:drop-shadow(0 2px 8px rgba(0,0,0,0.9)); }
.seek-ind span { font-size:0.72rem; font-weight:800; color:#fff; text-shadow:0 1px 6px rgba(0,0,0,0.9); }

/* Spinner */
.spinner {
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  pointer-events:none; z-index:11; opacity:0; transition:opacity 0.3s;
}
.spinner.show { opacity:1; }
.spinner-ring {
  width:52px; height:52px;
  border:3px solid rgba(255,255,255,0.1);
  border-top-color: var(--red-neon);
  border-radius:50%;
  animation: spin 0.7s linear infinite;
  box-shadow: 0 0 20px var(--red-glow);
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ── CP BOTTOM ── */
.cp-bottom {
  margin-top: auto;
  padding: 0 18px 16px;
  display: flex; flex-direction: column; gap: 6px;
  pointer-events: auto;
}

/* PROGRESS */
.progress {
  position: relative;
  height: 18px; display: flex; align-items: flex-end;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.track {
  position: relative; width: 100%; height: 3px;
  background: rgba(255,255,255,0.2);
  transition: height 0.15s;
}
.progress:hover .track { height: 5px; }
.buffered-bar {
  position: absolute; left:0; top:0; bottom:0;
  background: rgba(255,255,255,0.3); width:0%; transition:width 0.4s;
}
.filled-bar {
  position: absolute; left:0; top:0; bottom:0;
  background: var(--red-neon);
  box-shadow: 0 0 8px var(--red-glow);
  width:0%; transition:width 0.1s linear;
}
.thumb-dot {
  position: absolute; top:50%;
  width:14px; height:14px;
  border-radius:50%; background:#fff;
  transform:translate(-50%,-50%) scale(0);
  box-shadow: 0 0 10px var(--red-glow), 0 2px 8px rgba(0,0,0,0.6);
  transition:transform 0.12s; pointer-events:none; left:0%;
}
.progress:hover .thumb-dot { transform:translate(-50%,-50%) scale(1); }
.time-tip {
  position: absolute; bottom:calc(100% + 10px); transform:translateX(-50%);
  background: rgba(10,10,10,0.96);
  color:#fff; font-size:0.72rem; font-weight:700;
  padding:3px 8px; border-radius:4px;
  border:1px solid rgba(229,9,20,0.3);
  white-space:nowrap; pointer-events:none;
  opacity:0; transition:opacity 0.12s; left:0%;
}
.progress:hover .time-tip { opacity:1; }

/* CONTROLS ROW */
.controls {
  display: flex; align-items: center; gap: 2px; padding-top: 4px;
}
.cbtn {
  background:none; border:none; color:#fff; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center;
  width:38px; height:38px; border-radius:4px;
  transition:color 0.15s, transform 0.1s, box-shadow 0.15s;
  flex-shrink:0; -webkit-tap-highlight-color:transparent;
  position: relative;
}
.cbtn:hover { color:rgba(255,255,255,0.9); }
.cbtn:active { transform:scale(0.88); }
.cbtn svg { width:22px; height:22px; display:block; }
.cbtn.sm svg { width:19px; height:19px; }

/* neon glow on active controls */
.cbtn.neon-active svg { filter: drop-shadow(0 0 6px var(--red-neon)); }

/* Volume */
.vol-wrap {
  display:flex; align-items:center; gap:4px;
  overflow:hidden; max-width:36px;
  transition:max-width 0.25s ease;
}
.vol-wrap:hover, .vol-wrap:focus-within { max-width:120px; }
.vol-slider {
  -webkit-appearance:none; appearance:none;
  width:72px; height:3px; border-radius:2px;
  background:rgba(255,255,255,0.25); outline:none;
  cursor:pointer; opacity:0; transition:opacity 0.2s; flex-shrink:0;
}
.vol-wrap:hover .vol-slider,
.vol-wrap:focus-within .vol-slider { opacity:1; }
.vol-slider::-webkit-slider-thumb {
  -webkit-appearance:none;
  width:13px; height:13px; border-radius:50%;
  background:#fff; cursor:pointer;
  box-shadow: 0 0 6px var(--red-glow);
}

/* Time */
.cp-time {
  font-size:0.78rem; font-weight:500;
  color:rgba(255,255,255,0.85);
  white-space:nowrap; margin:0 8px;
  font-variant-numeric:tabular-nums;
}
.cp-time .sep { color:rgba(255,255,255,0.35); margin:0 2px; }

/* Center ep title in bar */
.ep-center {
  flex:1; text-align:center;
  font-size:0.78rem; font-weight:600;
  color:rgba(255,255,255,0.65);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  padding:0 8px;
}
.ep-center .sname { color:rgba(255,255,255,0.85); }

/* RIGHT GROUP */
.cp-right {
  display:flex; align-items:center; gap:0; flex-shrink:0;
}

/* ── PANELS (Speed / Sub / Episode) ── */
.cp-panel {
  position:absolute; bottom:calc(100% + 10px); right:0;
  background: rgba(8,8,8,0.97);
  border:1px solid rgba(229,9,20,0.25);
  border-radius:6px;
  min-width:190px;
  z-index:30;
  transform:translateY(8px) scale(0.96);
  opacity:0; pointer-events:none;
  transition:transform 0.18s cubic-bezier(0.34,1.2,0.64,1), opacity 0.18s;
  box-shadow: 0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(229,9,20,0.1);
}
.cp-panel.open { transform:translateY(0) scale(1); opacity:1; pointer-events:auto; }
.panel-head {
  font-size:0.65rem; font-weight:900; text-transform:uppercase;
  letter-spacing:1px; color:var(--red-neon);
  padding:10px 14px 6px;
  text-shadow: 0 0 10px var(--red-glow);
  border-bottom:1px solid rgba(229,9,20,0.15);
}
.panel-item {
  display:flex; align-items:center; gap:8px;
  padding:8px 14px;
  font-size:0.8rem; color:rgba(255,255,255,0.6);
  cursor:pointer; transition:background 0.1s, color 0.1s;
}
.panel-item:hover { background:rgba(255,255,255,0.05); color:#fff; }
.panel-item.active { color:#fff; }
.panel-item.active::before {
  content:''; width:4px; height:4px; border-radius:50%;
  background:var(--red-neon);
  flex-shrink:0; margin-left:-5px;
  box-shadow: 0 0 6px var(--red-glow);
}
.panel-divider { height:1px; background:rgba(255,255,255,0.06); margin:4px 0; }

/* ── EPISODE PICKER PANEL (wide) ── */
.ep-panel {
  position:absolute; bottom:calc(100% + 10px); right:0;
  width:min(340px, 90vw);
  max-height:400px;
  background: rgba(8,8,8,0.97);
  border:1px solid rgba(229,9,20,0.25);
  border-radius:6px;
  z-index:30;
  display:flex; flex-direction:column;
  transform:translateY(8px) scale(0.96);
  opacity:0; pointer-events:none;
  transition:transform 0.2s cubic-bezier(0.34,1.2,0.64,1), opacity 0.2s;
  box-shadow: 0 8px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(229,9,20,0.1);
  overflow:hidden;
}
.ep-panel.open { transform:translateY(0) scale(1); opacity:1; pointer-events:auto; }
.ep-panel-head {
  padding:10px 14px 8px;
  font-size:0.65rem; font-weight:900; text-transform:uppercase;
  letter-spacing:1px; color:var(--red-neon);
  border-bottom:1px solid rgba(229,9,20,0.15);
  display:flex; align-items:center; justify-content:space-between;
  flex-shrink:0;
  text-shadow: 0 0 10px var(--red-glow);
}
.ep-panel-count {
  font-size:0.68rem; color:var(--text2); font-weight:500;
  text-transform:none; letter-spacing:0;
  text-shadow:none;
}
.ep-panel-list {
  overflow-y:auto; flex:1;
  scrollbar-width:thin;
  scrollbar-color:rgba(229,9,20,0.35) transparent;
}
.ep-panel-list::-webkit-scrollbar { width:3px; }
.ep-panel-list::-webkit-scrollbar-thumb { background:rgba(229,9,20,0.35); border-radius:4px; }
.ep-row {
  display:flex; align-items:center; gap:10px;
  padding:8px 12px; text-decoration:none;
  border-bottom:1px solid rgba(255,255,255,0.04);
  transition:background 0.12s;
  position:relative;
  cursor: pointer;
}
.ep-row:last-child { border-bottom:none; }
.ep-row:hover { background:rgba(255,255,255,0.04); }
.ep-row.active { background:rgba(229,9,20,0.08); }
.ep-row.active::before {
  content:''; position:absolute; left:0; top:0; bottom:0;
  width:3px; background:var(--red-neon);
  box-shadow: 0 0 8px var(--red-glow);
}
.ep-row-thumb {
  width:76px; height:44px; object-fit:cover;
  border-radius:3px; flex-shrink:0; background:#1a1a1a;
}
.ep-row-num { font-size:0.62rem; font-weight:800; color:var(--red-neon); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
.ep-row-name { font-size:0.76rem; color:rgba(255,255,255,0.6); line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ep-row.active .ep-row-name { color:#fff; }
.ep-row-play { margin-left:auto; flex-shrink:0; color:var(--red-neon); }
.ep-row-play svg { width:12px; height:12px; }

/* ── NEXT EPISODE CARD ── */
.next-card {
  position:absolute; bottom:88px; right:18px;
  background:rgba(10,10,10,0.97);
  border:1px solid rgba(229,9,20,0.3);
  border-radius:6px; padding:14px 16px;
  display:flex; align-items:center; gap:12px;
  max-width:270px;
  transform:translateX(calc(100% + 22px));
  transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);
  z-index:15;
  box-shadow: 0 0 0 1px rgba(229,9,20,0.1), 0 8px 32px rgba(0,0,0,0.7);
}
.next-card.show { transform:translateX(0); }
.next-thumb { width:70px; height:40px; object-fit:cover; border-radius:3px; background:#1a1a1a; flex-shrink:0; }
.next-label { font-size:0.62rem; font-weight:900; color:var(--red-neon); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px; text-shadow:0 0 8px var(--red-glow); }
.next-title { font-size:0.76rem; color:rgba(255,255,255,0.85); line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.next-acts { display:flex; gap:6px; margin-top:8px; }
.next-watch {
  font-size:0.72rem; font-weight:700; padding:5px 13px;
  border-radius:3px; background:var(--red-neon); color:#fff;
  text-decoration:none; transition:background 0.15s;
  box-shadow: 0 0 10px var(--red-glow);
  cursor: pointer; border: none;
}
.next-watch:hover { background:var(--red-dark); }
.next-close {
  background:none; border:1px solid rgba(255,255,255,0.18);
  color:rgba(255,255,255,0.45); border-radius:3px;
  font-size:0.7rem; font-weight:600; padding:5px 8px; cursor:pointer;
  transition:all 0.15s;
}
.next-close:hover { color:#fff; border-color:rgba(255,255,255,0.4); }

/* ── EMBED ERROR ── */
.embed-err {
  position:absolute; inset:0;
  background:rgba(0,0,0,0.96);
  display:flex; align-items:center; justify-content:center;
  z-index:30; opacity:0; pointer-events:none; transition:opacity 0.3s;
}
.embed-err.show { opacity:1; pointer-events:auto; }
.embed-inner { text-align:center; padding:32px; max-width:380px; }
.embed-icon {
  width:56px; height:56px; border-radius:50%;
  background:var(--red-dim); border:1px solid rgba(229,9,20,0.35);
  display:flex; align-items:center; justify-content:center;
  margin:0 auto 18px; color:var(--red-neon);
  box-shadow:0 0 20px var(--red-glow);
}
.embed-icon svg { width:26px; height:26px; }
.embed-title { font-size:1.1rem; font-weight:800; margin-bottom:10px; }
.embed-msg { font-size:0.83rem; color:var(--text2); line-height:1.65; margin-bottom:22px; }
.embed-acts { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.yt-btn {
  display:inline-flex; align-items:center; gap:8px; padding:10px 20px;
  background:#ff0000; color:#fff; border-radius:4px;
  text-decoration:none; font-size:0.85rem; font-weight:700;
  transition:background 0.2s;
}
.yt-btn:hover { background:#cc0000; }

/* ── RIPPLE ── */
.ripple {
  position:absolute; border-radius:50%;
  background:rgba(229,9,20,0.2);
  transform:scale(0);
  animation:ripple 0.5s ease-out forwards;
  pointer-events:none; z-index:12;
}
@keyframes ripple { to { transform:scale(4); opacity:0; } }

/* ══════════════════════════════════════
   SIDEBAR — EPISODE LIST
══════════════════════════════════════ */
.sidebar {
  width: 300px;
  flex-shrink: 0;
  background: var(--surface);
  border-left: 1px solid rgba(229,9,20,0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.25s ease;
}
.sidebar.collapsed { width: 0; }

.sidebar-head {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(229,9,20,0.1);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
  background: rgba(229,9,20,0.04);
}
.sidebar-label {
  font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:1px;
  color:var(--red-neon); display:flex; align-items:center; gap:7px;
  text-shadow: 0 0 10px var(--red-glow);
}
.sidebar-label svg { width:13px; height:13px; }
.sidebar-count {
  font-size:0.68rem; color:var(--text2);
  background:rgba(255,255,255,0.05); padding:2px 10px; border-radius:20px;
}

.ep-list {
  flex:1; overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:rgba(229,9,20,0.3) transparent;
}
.ep-list::-webkit-scrollbar { width:3px; }
.ep-list::-webkit-scrollbar-thumb { background:rgba(229,9,20,0.35); border-radius:4px; }

.ep-item {
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 14px; text-decoration:none;
  border-bottom:1px solid rgba(255,255,255,0.04);
  transition:background 0.12s; position:relative;
  cursor: pointer;
}
.ep-item:last-child { border-bottom:none; }
.ep-item:hover { background:rgba(255,255,255,0.04); }
.ep-item.active { background:rgba(229,9,20,0.08); }
.ep-item.active::before {
  content:''; position:absolute; left:0; top:0; bottom:0;
  width:3px; background:var(--red-neon);
  box-shadow:0 0 8px var(--red-glow);
}
.ep-thumb { width:80px; height:46px; object-fit:cover; border-radius:3px; flex-shrink:0; background:#1a1a1a; }
.ep-num { font-size:0.62rem; font-weight:800; color:var(--red-neon); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
.ep-name { font-size:0.78rem; color:rgba(255,255,255,0.6); line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.ep-item.active .ep-name { color:#fff; }
.ep-play-ico { margin-left:auto; flex-shrink:0; color:var(--red-neon); display:flex; align-items:center; }
.ep-play-ico svg { width:12px; height:12px; }

/* ── SIDEBAR TOGGLE BUTTON ── */
.sidebar-toggle {
  position:absolute; top:50%; right:0;
  transform:translateY(-50%);
  z-index:20; background:var(--surface);
  border:1px solid rgba(229,9,20,0.2);
  border-right:none; border-radius:6px 0 0 6px;
  width:22px; height:60px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--red-neon); transition:background 0.2s;
}
.sidebar-toggle:hover { background:rgba(229,9,20,0.08); }
.sidebar-toggle svg { width:14px; height:14px; }

/* ── BOTTOM INFO BAR ── */
.info-bar {
  height:52px;
  background: var(--surface);
  border-top:1px solid rgba(229,9,20,0.1);
  display:flex; align-items:center;
  padding:0 18px; gap:16px;
  flex-shrink:0;
}
.info-series { font-size:0.82rem; font-weight:700; color:rgba(255,255,255,0.85); }
.info-sep { color:rgba(255,255,255,0.2); }
.info-ep { font-size:0.8rem; color:var(--text2); }
.info-right { margin-left:auto; display:flex; gap:10px; }
.info-nav {
  display:inline-flex; align-items:center; gap:6px;
  padding:6px 14px; border-radius:4px;
  font-size:0.78rem; font-weight:600;
  border:1px solid rgba(255,255,255,0.14); color:rgba(255,255,255,0.7);
  background:rgba(255,255,255,0.04); text-decoration:none;
  transition:all 0.2s;
  cursor: pointer;
}
.info-nav:hover { background:rgba(255,255,255,0.1); color:#fff; border-color:rgba(255,255,255,0.28); }
.info-nav svg { width:12px; height:12px; }
.info-nav.primary { background:var(--red-neon); border-color:var(--red-neon); color:#fff; box-shadow:0 0 10px var(--red-glow); }
.info-nav.primary:hover { background:var(--red-dark); border-color:var(--red-dark); }

/* ══════════════════════════════════════
   SUBTITLE OVERLAY (real YT captions)
══════════════════════════════════════ */
.sub-overlay {
  position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
  z-index:9; pointer-events:none;
  font-size:clamp(0.9rem,2vw,1.15rem); font-weight:600;
  color:#fff; text-align:center;
  text-shadow:0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.7);
  line-height:1.6; max-width:80%;
  padding:4px 12px;
  background:rgba(0,0,0,0.55);
  border-radius:3px;
  white-space:pre-wrap;
  opacity:0; transition:opacity 0.2s;
}
.sub-overlay.has-text { opacity:1; }

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
.toast-wrap { position:fixed; bottom:70px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
.toast {
  background:rgba(10,10,10,0.97);
  border:1px solid rgba(229,9,20,0.3);
  border-radius:4px; padding:10px 16px;
  font-size:0.82rem; font-weight:600; color:#fff;
  box-shadow:0 4px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(229,9,20,0.1);
  animation:toastIn 0.22s ease, toastOut 0.22s ease 2.5s forwards;
  max-width:260px;
}
@keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
@keyframes toastOut { from { opacity:1; } to { opacity:0; transform:translateY(5px); } }

/* ══════════════════════════════════════
   MOBILE RESPONSIVE
══════════════════════════════════════ */
@media(max-width:768px) {
  .page-shell { flex-direction:column; }
  .main-area { flex-direction:column; }
  .sidebar { width:100% !important; height:220px; border-left:none; border-top:1px solid rgba(229,9,20,0.12); }
  .sidebar.collapsed { height:0; }
  .sidebar-toggle { display:none; }
  .ep-list { max-height:100%; }
  .info-bar { padding:0 12px; height:48px; }
  .info-nav span { display:none; }
  .topbar { height:52px; padding:0 12px; }
  .cp-bottom { padding:0 12px 12px; }
  .ep-panel { width:min(300px,95vw); }
  .next-card { bottom:80px; right:10px; }
}
@media(max-width:480px) {
  .cp-series-title { display:none; }
  .ep-center { display:none; }
  .cp-time { font-size:0.72rem; margin:0 4px; }
  .cbtn { width:34px; height:34px; }
  .cbtn svg { width:19px; height:19px; }
  .cbtn.sm svg { width:16px; height:16px; }
}

/* Neon red glow on progress filled bar pulse when playing */
@keyframes redPulse {
  0%,100% { box-shadow: 0 0 6px var(--red-glow); }
  50% { box-shadow: 0 0 14px var(--red-glow), 0 0 28px rgba(229,9,20,0.3); }
}
.playing .filled-bar { animation: redPulse 2.5s ease infinite; }

/* Scrollbar */
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--surface3); border-radius:4px; }
::-webkit-scrollbar-thumb:hover { background:var(--red); }

/* ══════════════════════════════════════
   CAST / TV'DE YANSIT BUTTON & MODAL
══════════════════════════════════════ */
.cast-btn-wrap { position: relative; }

/* Cast icon states */
.cbtn.cast-idle svg { color: rgba(255,255,255,0.85); }
.cbtn.cast-connecting svg { color: var(--red-neon); animation: castPulse 0.9s ease infinite; }
.cbtn.cast-active svg {
  color: var(--red-neon);
  filter: drop-shadow(0 0 6px var(--red-neon));
}
@keyframes castPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

/* Cast modal overlay */
.cast-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.65);
  z-index: 9997;
  opacity: 0; pointer-events: none;
  transition: opacity 0.22s;
  backdrop-filter: blur(4px);
}
.cast-modal-overlay.open { opacity: 1; pointer-events: auto; }

/* Cast modal */
.cast-modal {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(0.92);
  z-index: 9998;
  background: rgba(10,10,10,0.98);
  border: 1px solid rgba(229,9,20,0.3);
  border-radius: 12px;
  width: min(400px, 92vw);
  box-shadow: 0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(229,9,20,0.12);
  opacity: 0; pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.2,0.64,1);
  font-family: 'Outfit', sans-serif;
  overflow: hidden;
}
.cast-modal.open {
  opacity: 1; pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}

.cast-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(229,9,20,0.15);
}
.cast-modal-title {
  font-size: 0.8rem; font-weight: 900; text-transform: uppercase;
  letter-spacing: 1px; color: var(--red-neon);
  text-shadow: 0 0 10px var(--red-glow);
  display: flex; align-items: center; gap: 9px;
}
.cast-modal-title svg { width: 18px; height: 18px; }
.cast-modal-close {
  background: none; border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.5); border-radius: 4px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; line-height: 1;
  transition: all 0.15s;
}
.cast-modal-close:hover { color:#fff; border-color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.07); }

/* Cast scanning animation */
.cast-scan-wrap {
  padding: 28px 20px 10px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  text-align: center;
}
.cast-scan-icon {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: var(--red-dim);
  border: 2px solid rgba(229,9,20,0.35);
  display: flex; align-items: center; justify-content: center;
  color: var(--red-neon);
  position: relative;
  box-shadow: 0 0 24px var(--red-glow);
}
.cast-scan-icon svg { width: 34px; height: 34px; }
.cast-scan-ring {
  position: absolute; inset: -8px;
  border-radius: 50%;
  border: 2px solid rgba(229,9,20,0.25);
  animation: castRing 1.8s ease infinite;
}
.cast-scan-ring:nth-child(2) { inset: -16px; animation-delay: 0.4s; border-color: rgba(229,9,20,0.15); }
.cast-scan-ring:nth-child(3) { inset: -24px; animation-delay: 0.8s; border-color: rgba(229,9,20,0.08); }
@keyframes castRing { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.3);opacity:0} }

.cast-scan-text {
  font-size: 0.88rem; font-weight: 600;
  color: rgba(255,255,255,0.7); line-height: 1.5;
}
.cast-scan-sub {
  font-size: 0.75rem; color: rgba(255,255,255,0.35);
  margin-top: -8px;
}

/* Device list */
.cast-device-list {
  padding: 8px 12px 6px;
  display: flex; flex-direction: column; gap: 4px;
  max-height: 220px; overflow-y: auto;
}
.cast-device-item {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.cast-device-item:hover { background: rgba(229,9,20,0.07); border-color: rgba(229,9,20,0.2); }
.cast-device-item.connected { background: rgba(229,9,20,0.1); border-color: rgba(229,9,20,0.3); }
.cast-device-icon {
  width: 38px; height: 38px; border-radius: 8px;
  background: rgba(229,9,20,0.1); border: 1px solid rgba(229,9,20,0.2);
  display: flex; align-items: center; justify-content: center;
  color: var(--red-neon); flex-shrink: 0;
}
.cast-device-icon svg { width: 20px; height: 20px; }
.cast-device-name { font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.88); }
.cast-device-type { font-size: 0.72rem; color: rgba(255,255,255,0.35); margin-top: 1px; }
.cast-device-badge {
  margin-left: auto; flex-shrink: 0;
  font-size: 0.65rem; font-weight: 800;
  padding: 3px 8px; border-radius: 3px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.cast-device-badge.badge-connected {
  background: var(--red-dim); color: var(--red-neon);
  border: 1px solid rgba(229,9,20,0.3);
  text-shadow: 0 0 8px var(--red-glow);
}
.cast-device-badge.badge-available {
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.1);
}

/* Cast connected banner */
.cast-connected-banner {
  margin: 0 12px 12px;
  background: rgba(229,9,20,0.08);
  border: 1px solid rgba(229,9,20,0.25);
  border-radius: 7px;
  padding: 12px 16px;
  display: flex; align-items: center; gap: 12px;
}
.cast-connected-banner svg { width: 18px; height: 18px; color: var(--red-neon); flex-shrink: 0; }
.cast-conn-text { flex: 1; }
.cast-conn-label { font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: var(--red-neon); margin-bottom: 2px; text-shadow: 0 0 8px var(--red-glow); }
.cast-conn-device { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.85); }
.cast-stop-btn {
  padding: 7px 14px; border-radius: 5px;
  font-size: 0.75rem; font-weight: 700;
  background: rgba(229,9,20,0.12);
  border: 1px solid rgba(229,9,20,0.3);
  color: var(--red-neon); cursor: pointer;
  transition: all 0.15s; flex-shrink: 0;
}
.cast-stop-btn:hover { background: rgba(229,9,20,0.22); }

/* Cast modal footer */
.cast-modal-footer {
  padding: 10px 20px 18px;
  text-align: center;
}
.cast-modal-footer p {
  font-size: 0.72rem; color: rgba(255,255,255,0.25); line-height: 1.6;
}
.cast-modal-footer a { color: rgba(229,9,20,0.6); text-decoration: none; }
.cast-modal-footer a:hover { color: var(--red-neon); }

/* No devices message */
.cast-no-devices {
  padding: 10px 20px 20px;
  text-align: center;
  color: rgba(255,255,255,0.35);
  font-size: 0.8rem; line-height: 1.7;
}

/* ══════════════════════════════════════
   SUBTITLE CUSTOMIZATION PANEL
══════════════════════════════════════ */
.sub-custom-panel {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) scale(0.92);
  z-index: 9999;
  background: rgba(10,10,10,0.98);
  border: 1px solid rgba(229,9,20,0.3);
  border-radius: 10px;
  width: min(420px, 94vw);
  box-shadow: 0 20px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(229,9,20,0.12);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.2,0.64,1);
  font-family: 'Outfit', sans-serif;
}
.sub-custom-panel.open {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, -50%) scale(1);
}
.scp-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 9998;
  opacity: 0; pointer-events: none;
  transition: opacity 0.22s;
  backdrop-filter: blur(3px);
}
.scp-overlay.open { opacity: 1; pointer-events: auto; }

.scp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 1px solid rgba(229,9,20,0.15);
}
.scp-title {
  font-size: 0.78rem; font-weight: 900; text-transform: uppercase;
  letter-spacing: 1px; color: var(--red-neon);
  text-shadow: 0 0 10px var(--red-glow);
  display: flex; align-items: center; gap: 8px;
}
.scp-title svg { width: 15px; height: 15px; }
.scp-close {
  background: none; border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.5); border-radius: 4px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 1rem; line-height: 1;
  transition: all 0.15s;
}
.scp-close:hover { color: #fff; border-color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.07); }

.scp-body { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 18px; }

.scp-row { display: flex; flex-direction: column; gap: 8px; }
.scp-label {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: rgba(255,255,255,0.45);
}
.scp-slider-wrap { display: flex; align-items: center; gap: 12px; }
.scp-slider {
  flex: 1; -webkit-appearance: none; appearance: none;
  height: 4px; border-radius: 2px; outline: none; cursor: pointer;
  background: rgba(255,255,255,0.15);
}
.scp-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--red-neon); cursor: pointer;
  box-shadow: 0 0 8px var(--red-glow);
}
.scp-slider::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--red-neon); cursor: pointer; border: none;
  box-shadow: 0 0 8px var(--red-glow);
}
.scp-val {
  font-size: 0.78rem; font-weight: 700; color: var(--red-neon);
  min-width: 44px; text-align: right;
  font-variant-numeric: tabular-nums;
}

/* Preview box */
.scp-preview {
  background: rgba(0,0,0,0.7); border-radius: 6px;
  padding: 20px 16px; text-align: center;
  border: 1px solid rgba(255,255,255,0.06);
  position: relative; overflow: hidden;
  min-height: 64px; display: flex; align-items: center; justify-content: center;
}
.scp-preview-label {
  position: absolute; top: 6px; left: 10px;
  font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.8px; color: rgba(255,255,255,0.25);
}

/* Color swatches */
.scp-swatches { display: flex; gap: 8px; flex-wrap: wrap; }
.scp-swatch {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  transition: transform 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.scp-swatch:hover { transform: scale(1.15); }
.scp-swatch.active { border-color: var(--red-neon); box-shadow: 0 0 8px var(--red-glow); }

.scp-footer {
  padding: 0 20px 16px;
  display: flex; gap: 10px;
}
.scp-btn {
  flex: 1; padding: 10px; border-radius: 5px;
  font-size: 0.8rem; font-weight: 700; cursor: pointer;
  transition: all 0.15s;
}
.scp-btn-reset {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.65);
}
.scp-btn-reset:hover { background: rgba(255,255,255,0.1); color: #fff; }
.scp-btn-apply {
  background: var(--red-neon);
  border: 1px solid var(--red-neon);
  color: #fff;
  box-shadow: 0 0 12px var(--red-glow);
}
.scp-btn-apply:hover { background: var(--red-dark); border-color: var(--red-dark); }
`;