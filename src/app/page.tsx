'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import HomePage from '@/components/HomePage';
import LoginPage from '@/components/LoginPage';
import SeriesPage from '@/components/SeriesPage';
import PlayerPage from '@/components/PlayerPage';
import ProfilePage from '@/components/ProfilePage';

export default function Page() {
  const { currentPage, isLoggedIn, login, navigate } = useAppStore();

  // Sayfa yüklendiğinde localStorage'dan kullanıcıyı geri yükle
  useEffect(() => {
    if (!isLoggedIn) {
      try {
        const saved = localStorage.getItem('megax_user');
        if (saved) {
          const user = JSON.parse(saved);
          if (user?.id) login(user);
        }
      } catch {
        localStorage.removeItem('megax_user');
      }
    }
  }, []);

  // Hash-based SPA routing
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as typeof currentPage;
      if (['home', 'login', 'player', 'series', 'profile'].includes(hash)) {
        navigate(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [navigate]);

  useEffect(() => {
    window.location.hash = currentPage;
    const titles: Record<string, string> = {
      home:    'MegaXtoon — Where Cartoon Lovers Unite',
      login:   'Giriş Yap — MegaXtoon',
      profile: 'Profilim — MegaXtoon',
      series:  'Diziler — MegaXtoon',
      player:  'Şimdi İzleniyor — MegaXtoon',
    };
    document.title = titles[currentPage] ?? 'MegaXtoon';
  }, [currentPage]);

  switch (currentPage) {
    case 'login':   return <LoginPage />;
    case 'series':  return <SeriesPage />;
    case 'player':  return <PlayerPage />;
    case 'profile': return <ProfilePage />;
    case 'home':
    default:        return <HomePage />;
  }
}
