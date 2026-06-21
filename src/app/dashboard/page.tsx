'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // useSearchParams eklendi

interface KullaniciVerisi {
  id: number;
  isim: string;
  email: string;
}

export default function DashboardPage() {
  const [kullanici, setKullanici] = useState<KullaniciVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hataMesaji, setHataMesaji] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams(); // URL parametrelerini okumak için

  useEffect(() => {
    const tokenDogrula = async () => {
      let token = localStorage.getItem('megax_token');

      // 1. ADIM: EĞER LOCALSTORAGE'DA YOKSA, URL'DEN GELMİŞ OLABİLİR MI KONTROL ET
      if (!token) {
        const urlToken = searchParams.get('token');
        if (urlToken) {
          // URL'den token geldi, onu localStorage'a kaydet (sonraki girişler için)
          localStorage.setItem('megax_token', urlToken);
          token = urlToken;
          
          // URL'deki token'ı gizle (güvenlik için temiz URL yap)
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      // 2. ADIM: Hâlâ token yoksa, kullanıcı giriş yapmamış demektir
      if (!token) {
        setHataMesaji('Bu sayfayı görmek için giriş yapmalısınız. (Token bulunamadı)');
        setYukleniyor(false);
        return;
      }

      try {
        // 3. ADIM: PHP'ye token'ı gönder
        const response = await fetch(`https://auth.megaxtoon.eu/token_verify.php?token=${encodeURIComponent(token)}`);

        if (!response.ok) {
          throw new Error(`Sunucu Hatası: ${response.status}`);
        }

        const data = await response.json();

        // 4. ADIM: Sonuçları değerlendir
        if (data.success) {
          setKullanici(data.user);
        } else {
          // Token geçersizse sil
          localStorage.removeItem('megax_token');
          setHataMesaji(data.message || 'Token geçersiz veya süresi dolmuş.');
        }
      } catch (err) {
        console.error('Detaylı Hata:', err);
        setHataMesaji('Sunucuyla iletişim kurulamadı. AdBlock eklentisinin kapalı olduğundan emin olun.');
        localStorage.removeItem('megax_token');
      } finally {
        setYukleniyor(false);
      }
    };

    tokenDogrula();
  }, [router, searchParams]);

  // --- EKRAN ÇİZİMİ ---

  if (yukleniyor) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><h2>Token doğrulanıyor...</h2></div>;
  }

  if (hataMesaji) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ color: 'red' }}>{hataMesaji}</h2>
        <button onClick={() => router.push('/login')} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}>Giriş Sayfasına Dön</button>
      </div>
    );
  }

  if (!kullanici) {
    return <div style={{ textAlign: 'center', marginTop: '100px' }}><h2>Kullanıcı verisi yüklenemedi.</h2></div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h1>Hoş Geldiniz, {kullanici.isim}!</h1>
        <p><strong>E-posta:</strong> {kullanici.email}</p>
        <p style={{ color: 'green', marginTop: '20px' }}>✅ Başarıyla giriş yapıldı ve sayfa çökmedi!</p>
        
        <button 
          onClick={() => {
            localStorage.removeItem('megax_token');
            window.location.href = 'https://auth.megaxtoon.eu/logout.php'; // Çıkış işleminizi yapın
          }}
          style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}