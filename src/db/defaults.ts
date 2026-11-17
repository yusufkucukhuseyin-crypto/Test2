import type { ProductType, Settings } from './types'

/** Fiyat listesinin başlangıç hâli (kullanıcı Fiyat Listesi sayfasından düzenler) */
export const DEFAULT_PRODUCT_TYPES: ProductType[] = [
  { key: 'pasta', label: 'Pasta', desc: '', unit: 'kişi', unitPrice: 350, color: '#d48a96', hasTiers: true },
  { key: 'cupcake', label: 'Cupcake', desc: '', unit: 'adet', unitPrice: 90, color: '#c79a5b', hasTiers: false },
  { key: 'kurabiye', label: 'Butik kurabiye', desc: '', unit: 'adet', unitPrice: 80, color: '#8fae8b', hasTiers: false },
  { key: 'diger', label: 'Diğer', desc: '', unit: 'adet', unitPrice: 0, color: '#8a9bb0', hasTiers: false },
]

export const CAKE_TYPES = ['Vanilya', 'Kakao']
export const CREAM_TYPES = ['Vanilyalı', 'Çikolatalı']
export const FILLINGS = ['Çilek', 'Muz', 'Frambuaz', 'Orman Meyveli', 'Çikolata Sos', 'Antep Fıstığı', 'Damla Çikolata', 'Lotus']

/** Varsayılan günlük kapasite: aynı gün teslim edilebilecek sipariş sayısı */
export const DEFAULT_DAILY_CAPACITY = 2

/** Kutu stok kalemlerinin kategorisi: siparişte seçilen kutular stoktan düşer */
export const BOX_CATEGORY = 'Kutu'
export const DEFAULT_BOXES = ['Küçük kutu', 'Orta kutu', 'Büyük kutu', 'Cupcake kutusu']
/** Kutu stoğu bu sayının altına inince uyarılır (Stok’tan her kutu için değiştirilebilir) */
export const DEFAULT_BOX_MIN = 5

/** Ayar verisi sürümü. Artırınca ensureSettings içine geçişini ekleyin. */
export const SETTINGS_REV = 4

export function defaultSettings(): Settings {
  return {
    id: 'main',
    businessName: 'Luma Cakes',
    ownerName: 'Sabiş',
    // Pazartesi..Pazar: her gün aynı gün en fazla 2 sipariş
    weekdayCapacity: Array(7).fill(DEFAULT_DAILY_CAPACITY),
    capacityOverrides: {},
    dayNotes: {},
    capacityUnit: 'siparis',
    rev: SETTINGS_REV,
    productTypes: DEFAULT_PRODUCT_TYPES,
    reminderDays: 21,
    nextOrderNo: 1,
    accent: 'gul',
    options: {
      cakeTypes: CAKE_TYPES,
      creamTypes: CREAM_TYPES,
      fillings: FILLINGS,
      themes: ['Minimal', 'Çiçekli', 'Karakter', 'Vintage', 'Lambeth', 'Pastel'],
      occasions: [
        'Doğum günü',
        'Yıl dönümü',
        'Düğün',
        'Nişan',
        'Söz',
        'Baby shower',
        'Cinsiyet partisi',
        'Mezuniyet',
        'Kurumsal',
        'Diğer',
      ],
      specialDayTypes: ['Doğum günü', 'Evlilik yıl dönümü', 'Tanışma yıl dönümü', 'Anneler günü', 'Diğer'],
      sources: ['Instagram', 'WhatsApp', 'Telefon', 'Tavsiye', 'Torunlar Tavsiye', 'Eski müşteri', 'Diğer'],
      paymentMethods: ['Nakit', 'Havale/EFT', 'Kredi kartı'],
      extras: [
        'Figür / oyuncak',
        'Şeker hamuru figür',
        'Taze çiçek',
        'Altın varak',
        'Özel topper',
        'Özel iç malzeme',
        'Kutu / paketleme',
      ],
      stockUnits: ['kg', 'g', 'lt', 'ml', 'adet', 'paket', 'kutu'],
      stockCategories: ['Kutu', 'Un ve şeker', 'Süt ürünleri', 'Çikolata', 'Meyve', 'Süsleme', 'Ambalaj', 'Diğer'],
    },
  }
}

export interface AccentPreset {
  key: string
  label: string
  accent: string
  soft: string
  ink: string
}

export const ACCENTS: AccentPreset[] = [
  { key: 'gul', label: 'Gül', accent: '#c06c7b', soft: '#f7e4e7', ink: '#8e3f4e' },
  { key: 'kakao', label: 'Kakao', accent: '#8b5e4a', soft: '#f1e5dd', ink: '#5e3b2c' },
  { key: 'lavanta', label: 'Lavanta', accent: '#8470b0', soft: '#ece7f6', ink: '#56458a' },
  { key: 'adacayi', label: 'Adaçayı', accent: '#5f8a70', soft: '#e3eee6', ink: '#3c5f4a' },
  { key: 'altin', label: 'Altın', accent: '#a8833a', soft: '#f3ead6', ink: '#735823' },
]
