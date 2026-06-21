'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import HomePage from '@/components/HomePage';
import LoginPage from '@/components/LoginPage';
import SeriesPage from '@/components/SeriesPage';
import PlayerPage from '@/components/PlayerPage';
import ProfilePage from '@/components/ProfilePage';

// Token'ı URL'den okuyup store'a aktaran iç bileşen
// useSearchParams() Suspense içinde olmalı — bu yüzden ayrı bileşen
function TokenHandler() {
  const searchParams = useSearchParams();
  const { setToken } = useAppStore();

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      localStorage.setItem('megax_token', urlToken);
      if (setToken) setToken(urlToken);
      // Token'ı URL'den temizle (tarayıcı çubuğunda görünmesin)
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, setToken]);

  return null;
}

// Sayfa router bileşeni — Suspense DIŞINDA kalabilir
function PageRouter() {
  const { currentPage, isLoggedIn, navigate } = useAppStore();

  useEffect(() => {
    if (!isLoggedIn && currentPage !== 'login') {
      // Giriş yapılmamışsa login sayfasına yönlendir
    }
  }, [isLoggedIn, currentPage, navigate]);

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

  useEffect(() => {
    window.location.hash = currentPage;
    const titles: Record<string, string> = {
      home:    'MegaXtoon — Where Cartoon Lovers Unite',
      login:   'Sign In — MegaXtoon',
      profile: 'My Profile — MegaXtoon',
      series:  'Series — MegaXtoon',
      player:  'Now Playing — MegaXtoon',
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

// ANA EXPORT
// TokenHandler useSearchParams kullandığı için Suspense içinde sarmalanmalı.
// PageRouter ise Suspense dışında — sayfa gecikmesiz yüklenir.
export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <TokenHandler />
      </Suspense>
      <PageRouter />
    </>
  );
}
