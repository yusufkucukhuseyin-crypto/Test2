# Luma Cakes · Sipariş Atölyesi

Butik pastacılık için müşteri, sipariş, tasarım, takvim, üretim planı ve stok yönetimi uygulaması.
Telefonda ve tablette çalışan, ana ekrana eklenebilen bir web uygulamasıdır (PWA). İnternet bağlantısı
olmadan da çalışır.

## Özellikler

| Bölüm | Neler yapılabilir |
|---|---|
| **Ana sayfa** | Bugünün teslimleri, önümüzdeki 7 gün, tarihi geçmiş açık siparişler, kapasitesi aşılan günler, yaklaşan özel günler, bekleyen tahsilat, azalan stoklar |
| **Siparişler** | Müşteri, ürün (fiyat listesinden), kişi sayısı / adet, kat, kek cinsi (Vanilya / Kakao), krema cinsi (Vanilyalı / Çikolatalı), iç dolgu (birden çok), pasta üstü yazı, tebrik kartı yazısı, tasarım beklentileri, teslim tarihi/saati, gel-al / adrese teslim (+ teslimat ücreti). Dilim fiyatı × kişi + ekstralar + teslimat − indirim ile **otomatik fiyat** ve ayrı **anlaşılan tutar**. Kapora ve ödemeler, kalan bakiye. Durum: Onaylandı / Teslim edildi / İptal edildi |
| **Yazdırma** | Sipariş detayında **Yazdır**: logolu A4 sipariş fişi (müşteri, teslim, içerik, yazılar, görseller, fiyat ve kalan ödeme) |
| **Fiyat listesi** | Pasta türleri, içerikleri ve dilim / adet fiyatları; **hızlı hesapla** (tür + kişi sayısı + indirim) ve bu fiyatla sipariş oluşturma |
| **Tasarım** | Siparişe görsel yükleme: müşteri referansı, taslak / görüşme, onaylanan tasarım, bitmiş ürün |
| **Müşteri kartları** | Telefon **ya da WhatsApp kullanıcı adı** (numara bilinmiyorsa), Instagram, adres, alerji / diyet uyarısı, notlar, özel günler. Geçmiş siparişler görselleriyle; tek tuşla **“Tekrarla”** |
| **Hatırlatmalar** | Müşterinin özel günü yaklaşınca ana sayfada kimin, hangi kutlama olduğu ve kaç gün kaldığı gösterilir |
| **Takvim** | Aylık görünüm; her gün teslim edilecek sipariş sayısına göre renklenir: **Uygun** (0), **Yoğun** (1), **Dolu** (2), **Kapasite aşıldı** (3+). Güne özel kapasite, not ve günü kapatma |
| **Katalog** | Bitmiş ürün fotoğrafları; ürün türüne göre filtre; **“Bu modelden sipariş”** |
| **Stok** | Malzeme miktarı ve birim maliyeti, alışta ağırlıklı ortalama maliyet, kullanım, sayım, minimum seviye uyarısı. Siparişe malzeme yazınca **maliyet ve brüt kâr** |
| **Raporlar** | Aylık ciro, tahsilat, ortalama sipariş, son 12 ay grafiği, ürün ve kutlama türü dağılımı, en çok sipariş veren müşteriler |
| **Ayarlar** | İşletme adı, **logo** (tema rengi logodan otomatik alınır) ve renk teması, günlük kapasite, kapalı günler, seçenek listeleri, yedek alma / geri yükleme |

Sol menü tablet ve bilgisayarda **küçültülebilir** (yalnızca simgeler) ya da **gizlenebilir**.

## Günlük kapasite

Kapasite, aynı gün teslim edilebilecek sipariş sayısıdır (varsayılan her gün 2, Pazar dahil). Takvim günleri bu sayıya göre
renklenir; kapasite dolu bir güne sipariş girerken form uyarır ve en yakın uygun günü önerir, ama kaydetmeye engel olmaz.
Tatil / izin günleri Takvim’den ya da *Ayarlar → Kapalı günler* bölümünden kapatılır (0 = kapalı).

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
  lib/         biçimlendirme, iş kuralları (kapasite, fiyat, hatırlatma), renk / logo, görsel sıkıştırma
  components/  ortak arayüz parçaları, yerleşim, müşteri formu, görsel görüntüleyici
  pages/       ekranlar
```
