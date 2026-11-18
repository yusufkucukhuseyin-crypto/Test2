# Luma Cakes · Sipariş Atölyesi

Butik pastacılık için müşteri, sipariş, tasarım, takvim, üretim planı ve stok yönetimi uygulaması.
Telefonda ve tablette çalışan, ana ekrana eklenebilen bir web uygulamasıdır (PWA). İnternet bağlantısı
olmadan da çalışır.

## Özellikler

| Bölüm | Neler yapılabilir |
|---|---|
| **Ana sayfa** | Bugünün teslimleri, önümüzdeki 7 gün, tarihi geçmiş açık siparişler, kapasitesi aşılan günler, bekleyen tahsilat (dokununca liste), yedek hatırlatması; karşılamada adınız (“Merhaba Sabiş”) |
| **Siparişler** | Müşteri, ürün (fiyat listesinden), kişi sayısı / adet, kat, kek cinsi (Vanilya / Kakao), krema cinsi (Vanilyalı / Çikolatalı), iç dolgu (birden çok), pasta üstü yazı, tebrik kartı yazısı, tasarım beklentileri, teslim tarihi/saati, gel-al / adrese teslim (+ teslimat ücreti). **Anlaşılan tutar** fiyat listesinden (dilim fiyatı × kişi) otomatik gelir, elle değiştirilebilir; **toplam = anlaşılan tutar + ekstralar + teslimat − indirim**. **Ücretsiz (ikram)** işaretlenebilir. Siparişte kullanılan **kutular** seçilir ve stoktan düşer. Kapora ve ödemeler, kalan bakiye. Durum: Onaylandı / Teslim edildi / İptal edildi |
| **Yazdırma** | Sipariş detayında **Yazdır**: logolu A4 sipariş fişi (müşteri, teslim, içerik, yazılar, görseller, fiyat ve kalan ödeme). **Siparişler → Seç ve yazdır**: seçilen siparişlerin yalnızca içeriği, A4’e **6 (2×3) ya da 4 (2×2)** kart, kesim çizgili |
| **Fiyat listesi** | Pasta türleri, içerikleri ve dilim / adet fiyatları; **hızlı hesapla** (tür + kişi sayısı + indirim) ve bu fiyatla sipariş oluşturma |
| **Tasarım** | Siparişe görsel yükleme: müşteri referansı, taslak / görüşme, onaylanan tasarım, bitmiş ürün |
| **Müşteri kartları** | Telefon **ya da WhatsApp kullanıcı adı** (numara bilinmiyorsa), Instagram, **bizi nereden buldu** (listeden seçim), adres, alerji / diyet uyarısı, notlar, özel günler. Geçmiş siparişler görselleriyle; tek tuşla **“Tekrarla”** |
| **Özel günler** | Menüdeki ayrı sayfada müşterilerin yaklaşan doğum günü, yıl dönümü gibi kutlamaları (7 gün / 30 gün / 3 ay / 1 yıl); kimin, hangi kutlama, kaç gün kaldı, sipariş alındı mı. 7 gün içindekilerin sayısı menüde görünür |
| **Takvim** | Aylık görünüm; her gün teslim edilecek sipariş sayısına göre renklenir: **Uygun** (0), **Yoğun** (1), **Dolu** (2), **Kapasite aşıldı** (3+). Güne özel kapasite, not ve günü kapatma |
| **Katalog** | Bitmiş ürün fotoğrafları; ürün türüne göre filtre; **“Bu modelden sipariş”** |
| **Stok** | **Kutu stoğu** (Küçük / Orta / Büyük / Cupcake): siparişte seçilen kutu düşer, iptalde geri döner, en az seviyenin altına inince menüde Stok’un yanında uyarı sayısı. Malzeme miktarı ve birim maliyeti, alışta ağırlıklı ortalama maliyet, kullanım, sayım, minimum seviye uyarısı. Siparişe malzeme yazınca **maliyet ve brüt kâr** |
| **Raporlar** | **Tümü / Ücretli / Ücretsiz** süzgeci ve ücretsiz verilenlerin değeri; aylık ciro, tahsilat, ortalama sipariş, son 12 ay grafiği, ürün ve kutlama türü dağılımı, en çok sipariş veren müşteriler |
| **Ayarlar** | **Bulut eşitleme** (giriş / çıkış, durum), işletme adı, karşılama adı, **logo** (tema rengi logodan otomatik alınır) ve renk teması, günlük kapasite, kapalı günler, seçenek listeleri, yedek alma / geri yükleme |

Sol menü tablet ve bilgisayarda **küçültülebilir** (yalnızca simgeler) ya da **gizlenebilir**.

## Günlük kapasite

Kapasite, aynı gün teslim edilebilecek sipariş sayısıdır (varsayılan her gün 2, Pazar dahil). Takvim günleri bu sayıya göre
renklenir; kapasite dolu bir güne sipariş girerken form uyarır ve en yakın uygun günü önerir, ama kaydetmeye engel olmaz.
Tatil / izin günleri Takvim’den ya da *Ayarlar → Kapalı günler* bölümünden kapatılır (0 = kapalı).

## Verilerin saklanması ve bulut eşitleme

Kayıtlar önce **cihazdaki veritabanına** (IndexedDB) yazılır; uygulama internetsiz de çalışır.
**Ayarlar → Bulut eşitleme**’den giriş yapınca (e-posta + şifre) her değişiklik birkaç saniye içinde
**Supabase**’e gönderilir; telefon, tablet ve bilgisayarda aynı hesapla giriş yapınca aynı veriler görünür.

- Bir cihazda yapılan değişiklik açık olan diğer cihazlara birkaç saniye içinde gelir (Realtime Broadcast ile haber,
  ayrıca dakikada bir ve uygulama öne gelince kontrol).
- İnternet yokken değişiklikler kuyrukta bekler (menüde “Çevrimdışı · N bekliyor”), bağlantı gelince gönderilir.
- Fotoğraflar Supabase Storage’daki `images` alanına, kullanıcının klasörüne yüklenir.
- Aynı kayıt iki cihazda değişirse son gönderilen geçerli olur; gönderilmeyi bekleyen yerel değişiklik ezilmez.
- Bir hesapla bir cihazda ilk girişte: bulut boşsa cihazdakiler gönderilir; cihazda kayıt yoksa buluttakiler gelir;
  ikisinde de kayıt varsa “Birleştir / Buluttakileri kullan” diye sorulur.
- Yedek alma / geri yükleme (JSON, fotoğraflar dahil) yine kullanılabilir; giriş yapılmışken geri yüklenen yedek
  buluta da gönderilir.

Kurulum: Supabase projesinde `supabase/setup.sql` bir kez çalıştırılır (kayıtlar tablosu, satır düzeyi güvenlik,
fotoğraf alanı). Kullanıcılar panelden (*Authentication → Users → Add user*) eklenir; yeni hesap açma kapalıdır.
Proje adresi ve herkese açık (publishable) anahtar `src/lib/cloud.ts` içindedir.

## Geliştirme

```bash
npm install
npm run dev       # geliştirme sunucusu
npm run build     # üretim derlemesi (dist/)
npm run preview   # derlemeyi yerelde çalıştır
```

Teknolojiler: React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), date-fns, vite-plugin-pwa.

## Yayına alma (uygulama adresi)

Uygulama statik dosyalardan oluşur (`npm run build` → `dist/`), sunucu gerektirmez. Göreli yollar ve `#/` adresleri
kullandığı için herhangi bir klasörde çalışır. Ana ekrana ekleme ve internetsiz çalışma için **HTTPS** gerekir.

**GitHub Pages (hazır):** `.github/workflows/deploy-pages.yml`, deponun varsayılan dalına her gönderimde uygulamayı yayınlar.
Bir kerelik ayar: depoda *Settings → Pages → Build and deployment → Source: GitHub Actions*. Adres:
`https://<kullanıcı-adı>.github.io/<depo-adı>/`. İstenirse kendi alan adınız (ör. `uygulama.lumacakes.com.tr`) bağlanabilir.

Vercel, Netlify ya da Cloudflare Pages’e de `dist/` klasörü olduğu gibi yüklenebilir.

Yeni sürüm yayınlanınca açık uygulamada altta **“Uygulamanın yeni sürümü hazır → Yenile”** çıkar; form doldururken
sayfa kendiliğinden yenilenmez.

## Telefona / tablete yükleme

- **iPhone / iPad (Safari):** uygulama adresini açın → *Paylaş* → *Ana Ekrana Ekle* → *Ekle*
- **Android (Chrome):** adresi açın → uygulamadaki **Uygulamayı yükle** düğmesi ya da ⋮ menü → *Uygulamayı yükle*

Uygulama ilk açılışta bu adımları kendisi de gösterir. Ana ekrandan tam ekran açılır, iPhone/iPad’de açılış ekranı vardır,
Android’de simgeye basılı tutunca *Yeni sipariş / Takvim / Fiyat listesi* kısayolları çıkar.

### Verileri başka cihaza / uygulamaya taşıma

Veriler cihazda saklandığı için taşıma yedekle yapılır: eski yerde *Ayarlar → Yedek al* (telefonda Paylaş menüsünden
Dosyalar’a / Drive’a kaydedin), yeni yerde ilk açılışta **Yedekten geri yükle**. Fotoğraflar dahil her şey taşınır.
7 günden uzun süre yedek alınmazsa ana sayfa hatırlatır.

## Klasör yapısı

```
src/
  db/          veri modeli (types), veritabanı (Dexie), işlemler, yedekleme, örnek veri
  lib/         biçimlendirme, iş kuralları (kapasite, fiyat, hatırlatma), renk / logo, görsel sıkıştırma
  components/  ortak arayüz parçaları, yerleşim, müşteri formu, görsel görüntüleyici
  pages/       ekranlar
```
