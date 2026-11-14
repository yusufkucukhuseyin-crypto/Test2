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
| **Takvim** | Aylık görünüm, her gün planlanan üretim saati / kapasite (uygun / yoğun / dolu / aşıldı / kapalı), seçili günün teslimleri ve işleri, güne özel kapasite ve not, tek tuşla günü kapatma |
| **Kapasite planlama** | Haftanın her günü için **çalışma saati**; tatil / izin için tarih aralığıyla **kapalı gün** (0 saat). İş adımları teslimden geriye doğru boş kapasiteye **yayılır**, kapalı ve dolu günler atlanır; sığmayan sipariş için **kapasiteye uyan en erken ileri teslim tarihi** önerilir |
| **Üretim planı (Gantt)** | Her ürünün iş adımları (rota) ve süreleri (sabit + kişi/adet başına) şablondan gelir. Günlük doluluk başlığı, kapalı günler taralı, adımları **sürükle-bırak** ile taşıma (bırakılan günden itibaren ilk boş kapasiteye yerleşir), “Kapasiteye göre yeniden planla”, kapasite aşımı ve teslime yetişmeyen sipariş uyarıları |
| **Katalog** | Bitmiş ürün fotoğrafları; ürün türüne göre filtre; **“Bu modelden sipariş”** |
| **Stok** | Malzeme miktarı ve birim maliyeti, alışta ağırlıklı ortalama maliyet, kullanım, sayım, hareket geçmişi, minimum seviye uyarısı. Siparişe malzeme yazınca **maliyet ve brüt kâr** |
| **Raporlar** | Aylık ciro, tahsilat, ortalama sipariş, son 12 ay grafiği, ürün ve kutlama türü dağılımı, en çok sipariş veren müşteriler, bekleyen tahsilatlar |
| **Ayarlar** | İşletme adı, renk teması, kapasite, ürün türleri / fiyatlar / iş adımları, seçenek listeleri (kek, krema, dolgu…), yedek alma / geri yükleme, örnek veri |

## Kapasite planlama nasıl çalışır?

1. **Kapasite:** Ayarlar’da haftanın her günü için üretime ayrılan saat girilir (varsayılan Pzt–Cmt 8 saat, Pazar kapalı).
   Takvim’den tek bir günün, Ayarlar → *Kapalı günler* bölümünden bir tarih aralığının kapasitesi değiştirilir; 0 saat = kapalı.
2. **İş adımları (rota):** Her ürün türünün adımları sırayla yapılır. Her adımın süresi = sabit dakika + kişi/adet başına
   dakika; “teslimden en geç kaç gün önce bitsin” sınırı vardır (0 = teslim günü).
3. **Yerleştirme:** Yeni siparişte adımlar teslim tarihinden geriye doğru, sırası korunarak boş kapasitesi olan günlere
   yerleşir. Bir adım bir güne sığmazsa önceki günlere bölünür; kapalı ve dolu günler atlanır.
4. **Sığmayan sipariş:** Bugünden önceye taşması gerekirse sipariş o tarihe yetişmez; form bunu kaydetmeden önce gösterir ve
   kapasiteye uyan **en erken ileri tarihi** önerir. Yine de kaydedilirse işler bugünden itibaren yerleşir ve kırmızı görünür.
5. **Değişiklik olunca:** Bir gün kapatılınca ya da kapasite azalınca o günlerde işi olan siparişlerin yeniden yerleştirilmesi
   önerilir. Üretim planı ekranındaki “Kapasiteye göre yeniden planla” tüm açık siparişleri yeniden yerleştirir; elle
   taşınan adımlar yerinde kalır.

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
