'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 1. KULLANICI VERİSİ TİPİ
interface KullaniciVerisi {
  id: number;
  isim: string;
  email: string;
}

// 2. ASIL İÇERİK BİLEŞENİ (useSearchParams burada kullanılıyor)
function DashboardIcerik() {
  const [kullanici, setKullanici] = useState<KullaniciVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hataMesaji, setHataMesaji] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams(); // DİKKAT: Bu yüzden Suspense lazım

  useEffect(() => {
    const tokenDogrula = async () => {
      let token = localStorage.getItem('megax_token');

      // Eğer localde yoksa, URL'den (auth.megaxtoon.eu'dan yönlendirme) gelmiş olabilir
      if (!token) {
        const urlToken = searchParams.get('token');
        if (urlToken) {
          localStorage.setItem('megax_token', urlToken);
          token = urlToken;
          // URL'deki ?token=... kısmını sil (güvenlik ve temizlik için)
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // Hala token yoksa giriş yapmamışsayız
      if (!token) {
        setHataMesaji('Token bulunamadı. Lütfen giriş yapın.');
        setYukleniyor(false);
        return;
      }

      try {
        // PHP'ye token'ı gönder
        const response = await fetch(`https://auth.megaxtoon.eu/token_verify.php?token=${encodeURIComponent(token)}`);

        if (!response.ok) {
          throw new Error(`Sunucu Hatası: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setKullanici(data.user);
        } else {
          localStorage.removeItem('megax_token');
          setHataMesaji(data.message || 'Token geçersiz.');
        }
      } catch (err) {
        console.error('Hata Detayı:', err);
        setHataMesaji('Sunucuya ulaşılamıyor.');
        localStorage.removeItem('megax_token');
      } finally {
        setYukleniyor(false);
      }
    };

    tokenDogrula();
  }, [router, searchParams]);

  // --- EKRANA ÇİZİM KISIMLARI ---

  if (yukleniyor) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><h2>Token doğrulanıyor...</h2></div>;
  }

  if (hataMesaji) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ color: 'red' }}>{hataMesaji}</h2>
        <button onClick={() => router.push('/login')} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>Giriş Yap</button>
      </div>
    );
  }

  if (!kullanici) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><h2>Veri yüklenemedi.</h2></div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h1>Hoş Geldiniz, {kullanici.isim}!</h1>
        <p><strong>E-posta:</strong> {kullanici.email}</p>
        <p style={{ color: 'green', marginTop: '20px' }}>✅ Sayfa başarıyla açıldı!</p>
        
        <button 
          onClick={() => {
            localStorage.removeItem('megax_token');
            window.location.href = 'https://auth.megaxtoon.eu/cikis.php'; // Kendi çıkış linkiniz
          }}
          style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

// 3. ANA DOSYA EXPORT (SUSPENSE İLE SARMALAMA - REACT #310 HATASINI ÇÖZER)
export default function DashboardPage() {
  return (
    // React error #310'ı çözen sihirli kelime: Suspense
    <Suspense fallback={
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Sayfa hazırlanıyor...</h2>
      </div>
    }>
      <DashboardIcerik />
    </Suspense>
  );
}