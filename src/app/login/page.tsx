'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setHata('');
    setYukleniyor(true);

    try {
      // Kendi giriş API'nizin adresini buraya yazın
      const response = await fetch('https://auth.megaxtoon.eu/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sifre })
      });

      const data = await response.json();

      if (data.success && data.token) {
        // DİKKAT: Token'ı "megax_token" ismiyle kaydediyoruz
        localStorage.setItem('megax_token', data.token);
        
        // Başarılıysa dashboard sayfasına yönlendir
        router.push('/dashboard');
      } else {
        setHata(data.message || 'Giriş başarısız oldu.');
      }
    } catch (err) {
      setHata('Sunucuya ulaşılamıyor. CORS veya DNS hatası olabilir.');
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Giriş Yap</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input 
          type="email" 
          placeholder="E-posta" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          style={{ padding: '10px' }}
        />
        <input 
          type="password" 
          placeholder="Şifre" 
          value={sifre} 
          onChange={(e) => setSifre(e.target.value)} 
          required 
          style={{ padding: '10px' }}
        />
        <button 
          type="submit" 
          disabled={yukleniyor}
          style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {yukleniyor ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </button>
        {hata && <p style={{ color: 'red', fontSize: '14px' }}>{hata}</p>}
      </form>
      
      {/* TEST İÇİN: Gerçek login API'niz yoksa test etmek için bu butona basın */}
      <button 
        onClick={() => {
          localStorage.setItem('megax_token', 'test_12345_gecerli_token');
          router.push('/dashboard');
        }}
        style={{ marginTop: '15px', padding: '10px', width: '100%', background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        (Test İçin) Direkt Token ile Geç
      </button>
    </div>
  );
}