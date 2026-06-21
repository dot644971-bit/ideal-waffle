'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// TypeScript tip tanımlaması
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

  useEffect(() => {
    const tokenDogrula = async () => {
      // 1. Token'ı oku (Login sayfasında "megax_token" olarak kaydetmiştik)
      const token = localStorage.getItem('megax_token');

      // 2. Eğer tarayıcıda token yoksa, sayfayı çökertmeden uyarı ver
      if (!token) {
        setHataMesaji('Bu sayfayı görmek için giriş yapmalısınız.');
        setYukleniyor(false);
        return;
      }

      try {
        // 3. PHP dosyasına token'ı URL ile güvenli bir şekilde gönder
        const response = await fetch(`https://auth.megaxtoon.eu/token_verify.php?token=${encodeURIComponent(token)}`);

        // 4. HTTP cevabı 200 (OK) değilse hata fırlat
        if (!response.ok) {
          throw new Error(`Sunucu Hatası: ${response.status}`);
        }

        const data = await response.json();

        // 5. PHP'den success=true dönüyorsa kullanıcıyı state'e kaydet
        if (data.success) {
          setKullanici(data.user);
        } else {
          // Token geçersizse (süresi dolmuşsa) localStorage'ı temizle
          localStorage.removeItem('megax_token');
          setHataMesaji(data.message || 'Token geçersiz, lütfen tekrar giriş yapın.');
        }
      } catch (err) {
        console.error('Token doğrulama detayı:', err);
        setHataMesaji('Sunucuya ulaşılamıyor. (auth.megaxtoon.eu adresi çökmüş veya CORS engeli olabilir)');
        localStorage.removeItem('megax_token');
      } finally {
        // 7. Ne olursa olsun yükleme durumunu bitir
        setYukleniyor(false);
      }
    };

    tokenDogrula();
  }, [router]);

  // --- REACT'İN ÇÖKMESİNİ ENGELLEYEN EKRAN ÇİZİM ŞARTLARI ---

  // Sayfa açıldı, API isteği atılıyor bekleniyor
  if (yukleniyor) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Token doğrulanıyor, lütfen bekleyin...</h2>
      </div>
    );
  }

  // API'den hata döndü veya token yok
  if (hataMesaji) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ color: 'red' }}>Hata: {hataMesaji}</h2>
        <button 
          onClick={() => router.push('/login')}
          style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
        >
          Giriş Sayfasına Dön
        </button>
      </div>
    );
  }

  // Kullanıcı verisi null ise (Güvenlik önlemi)
  if (!kullanici) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>Kullanıcı bilgisi yüklenemedi.</h2>
      </div>
    );
  }

  // --- HER ŞEY YOLUNDAYSA ASIL SAYFAYI ÇİZ ---
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        <h1>Hoş Geldiniz!</h1>
        <p><strong>İsim:</strong> {kullanici.isim}</p>
        <p><strong>E-posta:</strong> {kullanici.email}</p>
        <p><strong>ID:</strong> {kullanici.id}</p>
        
        <div style={{ marginTop: '30px' }}>
          <p>✅ Token başarılı bir şekilde doğrulandı ve sayfa çökmedi!</p>
        </div>

        <button 
          onClick={() => {
            localStorage.removeItem('megax_token');
            router.push('/login');
          }}
          style={{ marginTop: '20px', padding: '10px 20px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Çıkış Yap (Token Sil)
        </button>
      </div>
    </div>
  );
}