'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Kullanıcı verisi tipi
interface KullaniciVerisi {
  id: number;
  isim: string;
  email: string;
}

// Asıl işlemlerin yapıldığı iç bileşen
function DashboardIcerik() {
  const [kullanici, setKullanici] = useState<KullaniciVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const oturumuBaslat = async () => {
      let token = localStorage.getItem('megax_token');
      const urlToken = searchParams.get('token');

      // ADIM 1: URL'den token geldi mi kontrol et (auth.megaxtoon.eu'dan yönlendirme)
      if (urlToken) {
        localStorage.setItem('megax_token', urlToken);
        token = urlToken;
        
        // URL'deki ?token=... kısmını tarayıcı çubuğundan gizle (güvenlik)
        window.history.replaceState({}, '', window.location.pathname);
      }

      // ADIM 2: Hala token yoksa giriş yapılmamıştır
      if (!token) {
        setHata('Giriş yapılmamış. Lütfen giriş sayfasına gidin.');
        setYukleniyor(false);
        return;
      }

      // ADIM 3: PHP'ye token'ı gönder ve doğrula
      try {
        const response = await fetch(`https://auth.megaxtoon.eu/token_verify.php?token=${encodeURIComponent(token)}`);

        if (!response.ok) {
          throw new Error('Sunucu hatası: ' + response.status);
        }

        const data = await response.json();

        if (data.success) {
          setKullanici(data.user);
        } else {
          // Token geçersizse localStorage'ı temizle
          localStorage.removeItem('megax_token');
          setHata(data.message || 'Token doğrulanamadı.');
        }
      } catch (err) {
        console.error('Doğrulama hatası:', err);
        setHata('Sunucuya ulaşılamıyor.');
        localStorage.removeItem('megax_token');
      } finally {
        setYukleniyor(false);
      }
    };

    oturumuBaslat();
  }, [searchParams, router]);

  // --- EKRAN ÇİZİMİ ---

  if (yukleniyor) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', fontSize: '20px' }}>
        Token doğrulanıyor, lütfen bekleyin...
      </div>
    );
  }

  if (hata) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ color: 'red' }}>{hata}</h2>
        <button 
          onClick={() => window.location.href = 'https://auth.megaxtoon.eu/login.php'}
          style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          Giriş Sayfasına Git
        </button>
      </div>
    );
  }

  if (!kullanici) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}>Kullanıcı bilgisi bulunamadı.</div>;
  }

  // BAŞARILI GİRİŞ EKRANI
  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', background: '#f9f9f9' }}>
      <h1 style={{ color: '#333', borderBottom: '2px solid #0070f3', paddingBottom: '10px' }}>
        Hoş Geldiniz!
      </h1>
      
      <div style={{ marginTop: '20px', fontSize: '16px', lineHeight: '1.6' }}>
        <p><strong>İsim:</strong> {kullanici.isim}</p>
        <p><strong>E-posta:</strong> {kullanici.email}</p>
        <p><strong>ID:</strong> {kullanici.id}</p>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', background: '#d4edda', color: '#155724', borderRadius: '5px', border: '1px solid #c3e6cb' }}>
        ✅ Sistem başarıyla çalıştı! Token alındı, doğrulandı ve sayfa çökmedi.
      </div>

      <button 
        onClick={() => {
          localStorage.removeItem('megax_token');
          window.location.href = 'https://auth.megaxtoon.eu/cikis.php'; // Kendi çıkış linkiniz
        }}
        style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}
      >
        Güvenli Çıkış Yap
      </button>
    </div>
  );
}

// ANA EXPORT: React #310 (Suspense) hatasını önleyen wrapper
export default function AnaSayfa() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', fontSize: '20px' }}>
        Sayfa bileşenleri hazırlanıyor...
      </div>
    }>
      <DashboardIcerik />
    </Suspense>
  );
}