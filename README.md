# Luma Cakes · Sipariş Atölyesi

Butik pastacılık için müşteri, sipariş, tasarım, takvim, üretim planı ve stok yönetimi uygulaması.
Telefonda ve tablette çalışan, ana ekrana eklenebilen bir web uygulamasıdır (PWA). İnternet bağlantısı
olmadan da çalışır.

## Özellikler

| Bölüm | Neler yapılabilir |
|---|---|
| **Ana sayfa** | Bugünün teslimleri, önümüzdeki 7 gün, bugünün işleri (tek dokunuşla tamamlandı), yaklaşan özel günler, bekleyen tahsilat, azalan stoklar |
| **Siparişler** | Müşteri, ürün (pasta, cupcake, butik kurabiye, magnolia…), kişi sayısı / adet, kat, kek, krema, iç dolgu, tema, pasta yazısı, tasarım beklentileri, teslim tarihi/saati, gel-al / adrese teslim. Kişi başı fiyat + ekstralar (figür, oyuncak, özel malzeme) ile **otomatik fiyat hesabı** ve ayrı **anlaşılan tutar**. Kapora ve ödemeler, kalan bakiye. Aşamalar: Teklif → Onaylandı → Kapora alındı → Hazırlanıyor → Hazır → Teslim edildi / İptal |
| **Tasarım** | Siparişe görsel yükleme: müşteri referansı, taslak / görüşme, onaylanan tasarım, bitmiş ürün. Tasarım onayı işareti |
| **Müşteri kartları** | İletişim, Instagram, adres, alerji / diyet uyarısı, notlar, özel günler (doğum günü, yıl dönümü…). Geçmiş siparişlerin tüm detayları ve görselleriyle birlikte; tek tuşla **“Tekrarla”** |
| **Hatırlatmalar** | Müşterinin özel günü yaklaşınca ana sayfada kimin, hangi kutlama olduğu ve kaç gün kaldığı gösterilir; oradan doğrudan sipariş açılır |
| **Takvim** | Aylık görünüm, her gün için kapasite doluluğu (uygun / yoğun / dolu / kapalı), seçili günün teslimleri ve işleri, güne özel kapasite |
| **Kapasite** | Haftanın her günü için varsayılan kapasite; ürün başına kapasite ağırlığı (pasta = 1, cupcake = 0,5…). Sipariş girerken o günün doluluğu ve aşım uyarısı |
| **Üretim planı (Gantt)** | Her ürün türünün iş adımları (rota) teslim tarihinden geriye doğru otomatik planlanır. Adımları **sürükle-bırak** ile taşıma, sağ kenarından çekerek süre uzatma, günlük iş yükü, teslim tarihini aşan adım uyarısı |
| **Katalog** | Bitmiş ürün fotoğrafları; ürün türüne göre filtre; **“Bu modelden sipariş”** |
| **Stok** | Malzeme miktarı ve birim maliyeti, alışta ağırlıklı ortalama maliyet, kullanım, sayım, hareket geçmişi, minimum seviye uyarısı. Siparişe malzeme yazınca **maliyet ve brüt kâr** |
| **Raporlar** | Aylık ciro, tahsilat, ortalama sipariş, son 12 ay grafiği, ürün ve kutlama türü dağılımı, en çok sipariş veren müşteriler, bekleyen tahsilatlar |
| **Ayarlar** | İşletme adı, renk teması, kapasite, ürün türleri / fiyatlar / iş adımları, seçenek listeleri (kek, krema, dolgu…), yedek alma / geri yükleme, örnek veri |

## Verilerin saklanması (önemli)

Bu ilk sürümde veriler **kullanılan cihazın tarayıcısında** (IndexedDB) saklanır:

- İnternetsiz çalışır, hızlıdır, hiçbir sunucuya veri gönderilmez.
- Telefon ve tablet **şimdilik birbirini otomatik görmez.** Bir cihazdan diğerine geçmek için
  *Ayarlar → Yedek al* ile alınan dosyayı diğer cihazda *Yedeği geri yükle* ile açın (fotoğraflar dahildir).
- Düzenli yedek almanız önerilir.

Bir sonraki aşamada bulut senkronizasyonu (ör. Supabase) eklenerek telefon ve tablet aynı verileri anlık
görebilir. Veri modeli buna hazır kuruldu (tüm kayıtlarda benzersiz kimlik ve güncellenme zamanı var).

## Geliştirme

```bash
npm install
npm run dev       # geliştirme sunucusu
npm run build     # üretim derlemesi (dist/)
npm run preview   # derlemeyi yerelde çalıştır
```

Teknolojiler: React 19, TypeScript, Vite, Tailwind CSS 4, Dexie (IndexedDB), date-fns, vite-plugin-pwa.

## Yayına alma

`npm run build` çıktısı (`dist/`) statik dosyalardır; Vercel, Netlify, Cloudflare Pages veya GitHub Pages
gibi herhangi bir statik barındırma servisine yüklenebilir. Uygulama göreli yollar ve `#/` adresleri
kullandığı için ek sunucu ayarı gerekmez. PWA (ana ekrana ekleme, internetsiz çalışma) için HTTPS gerekir.

### Telefona / tablete yükleme

- **iPhone / iPad (Safari):** Paylaş → *Ana Ekrana Ekle*
- **Android (Chrome):** ⋮ menü → *Uygulamayı yükle* / *Ana ekrana ekle*

## Klasör yapısı

```
src/
  db/          veri modeli (types), veritabanı (Dexie), işlemler, yedekleme, örnek veri
  lib/         biçimlendirme, iş kuralları (kapasite, plan, hatırlatma), görsel sıkıştırma
  components/  ortak arayüz parçaları, yerleşim, müşteri formu, görsel görüntüleyici
  pages/       ekranlar
```
