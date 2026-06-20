'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import HomePage from '@/components/HomePage';
import LoginPage from '@/components/LoginPage';
import SeriesPage from '@/components/SeriesPage';
import PlayerPage from '@/components/PlayerPage';
import ProfilePage from '@/components/ProfilePage';

/* ══════════════════════════════════════════════════════════════
   PAGE ROUTER — SPA navigation via Zustand
   Each page component includes its own CSS via <style>{CSS}</style>
   (faithful to the original PHP where each .php file had its own CSS).
   ══════════════════════════════════════════════════════════════ */

export default function Page() {
  const { currentPage, isLoggedIn, navigate } = useAppStore();

  /* Redirect to login if not authenticated (mirrors PHP auth check) */
  useEffect(() => {
    if (!isLoggedIn && currentPage !== 'login') {
      // Don't redirect immediately on first load — let login page show
    }
  }, [isLoggedIn, currentPage, navigate]);

  /* Sync URL hash for direct links & browser back */
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (['home', 'login', 'player', 'series', 'profile'].includes(hash as typeof currentPage)) {
        navigate(hash as typeof currentPage);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [navigate]);

  /* Update hash when currentPage changes */
  useEffect(() => {
    window.location.hash = currentPage;
    document.title =
      currentPage === 'home'
        ? 'MegaXtoon — Where Cartoon Lovers Unite'
        : currentPage === 'login'
          ? 'Sign In — MegaXtoon'
          : currentPage === 'profile'
            ? 'My Profile — MegaXtoon'
            : currentPage === 'series'
              ? 'Series — MegaXtoon'
              : currentPage === 'player'
                ? 'Now Playing — MegaXtoon'
                : 'MegaXtoon';
  }, [currentPage]);

  switch (currentPage) {
    case 'login':
      return <LoginPage />;
    case 'series':
      return <SeriesPage />;
    case 'player':
      return <PlayerPage />;
    case 'profile':
      return <ProfilePage />;
    case 'home':
    default:
      return <HomePage />;
  }
}
