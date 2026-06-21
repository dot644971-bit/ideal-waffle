'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginYonlendirici() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '';

  useEffect(() => {
    // Kullanıcıyı doğrudan PHP login sayfasına yönlendir.
    // PHP giriş yaptıktan sonra play.megaxtoon.eu?token=... ile geri döner.
    window.location.href = 'https://auth.megaxtoon.eu/login.php';
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: 'sans-serif',
      background: '#0a0a0a',
      color: '#e5e5e5',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ fontSize: '2rem' }}>⚡</div>
      <p style={{ fontSize: '1rem', color: '#a3a3a3' }}>Giriş sayfasına yönlendiriliyorsunuz...</p>
    </div>
  );
}

export default function LoginSayfasi() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        background: '#0a0a0a',
        color: '#a3a3a3'
      }}>
        Yükleniyor...
      </div>
    }>
      <LoginYonlendirici />
    </Suspense>
  );
}
