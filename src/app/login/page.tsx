'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function LoginPage() {
  const [mode, setMode]           = useState<'login' | 'register'>('login');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [hata, setHata]           = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);

  const { login, navigate } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata('');
    setYukleniyor(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body     = mode === 'login'
        ? { email, password }
        : { username, email, password };

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('megax_user', JSON.stringify(data.user));
        login(data.user);
        navigate('home');
      } else {
        setHata(data.message || 'Bir hata oluştu.');
      }
    } catch {
      setHata('Sunucuya ulaşılamıyor. Lütfen tekrar deneyin.');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at top, #1a0606 0%, transparent 60%), radial-gradient(ellipse at bottom, #06151a 0%, transparent 60%), #0a0a0a',
      padding: '20px',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'linear-gradient(180deg, #1a1a1a 0%, #222 100%)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: '18px',
        padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '6px', fontSize: '2rem', fontWeight: 900, color: '#e50914' }}>
          ⚡ MEGAXTOON
        </div>
        <p style={{ textAlign: 'center', color: '#a3a3a3', fontSize: '0.88rem', marginBottom: '28px' }}>
          Where cartoon lovers unite
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#2a2a2a', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
          {(['login', 'register'] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setHata(''); }} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
              background: mode === m ? '#e50914' : 'transparent',
              color:      mode === m ? '#fff'    : '#a3a3a3',
              boxShadow:  mode === m ? '0 4px 12px rgba(229,9,20,0.4)' : 'none',
              transition: 'all 0.18s',
            }}>
              {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          ))}
        </div>

        {/* Error */}
        {hata && (
          <div style={{
            padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
            background: 'rgba(229,9,20,0.15)', border: '1px solid rgba(229,9,20,0.4)',
            color: '#ff8888', fontSize: '0.85rem',
          }}>
            ⚠️ {hata}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
                Kullanıcı Adı
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="cartoon_fan_42" required minLength={3} maxLength={30}
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
              E-posta
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="sen@ornek.com" required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
              Şifre
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'En az 6 karakter' : '••••••••'} required minLength={6}
              style={inputStyle}
            />
          </div>

          <button type="submit" disabled={yukleniyor} style={{
            padding: '13px', background: yukleniyor ? '#7a0008' : '#e50914',
            border: 'none', borderRadius: '8px', color: '#fff',
            fontFamily: 'inherit', fontWeight: 700, fontSize: '0.95rem',
            cursor: yukleniyor ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s', marginTop: '4px',
          }}>
            {yukleniyor
              ? (mode === 'login' ? 'Giriş yapılıyor...' : 'Kayıt olunuyor...')
              : (mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur')}
          </button>
        </form>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px',
  background: '#2a2a2a', border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '8px', color: '#e5e5e5',
  fontFamily: 'inherit', fontSize: '0.92rem', outline: 'none',
  boxSizing: 'border-box',
};
