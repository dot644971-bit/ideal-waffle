'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import HomePage from '@/components/HomePage';
import SeriesPage from '@/components/SeriesPage';
import PlayerPage from '@/components/PlayerPage';
import ProfilePage from '@/components/ProfilePage';

export default function Page() {
  const { currentPage, navigate } = useAppStore();

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '') as typeof currentPage;
      if (['home', 'player', 'series', 'profile'].includes(hash)) {
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
      profile: 'Profilim — MegaXtoon',
      series:  'Diziler — MegaXtoon',
      player:  'Şimdi İzleniyor — MegaXtoon',
    };
    document.title = titles[currentPage] ?? 'MegaXtoon';
  }, [currentPage]);

  switch (currentPage) {
    case 'series':  return <SeriesPage />;
    case 'player':  return <PlayerPage />;
    case 'profile': return <ProfilePage />;
    case 'home':
    default:        return <HomePage />;
  }
}
