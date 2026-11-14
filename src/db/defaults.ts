import type { ProductType, Settings } from './types'

export const DEFAULT_PRODUCT_TYPES: ProductType[] = [
  {
    key: 'pasta',
    label: 'Pasta',
    unit: 'kişi',
    unitPrice: 350,
    capacityWeight: 1,
    color: '#d48a96',
    hasTiers: true,
    tasks: [
      { name: 'Malzeme kontrolü', offset: 3, days: 1 },
      { name: 'Kek pişirme', offset: 2, days: 1 },
      { name: 'Dolgu ve krema', offset: 1, days: 1 },
      { name: 'Kaplama', offset: 1, days: 1 },
      { name: 'Süsleme ve paketleme', offset: 0, days: 1 },
    ],
  },
  {
    key: 'cupcake',
    label: 'Cupcake',
    unit: 'adet',
    unitPrice: 90,
    capacityWeight: 0.5,
    color: '#c79a5b',
    hasTiers: false,
    tasks: [
      { name: 'Pişirme', offset: 1, days: 1 },
      { name: 'Krema ve süsleme', offset: 0, days: 1 },
    ],
  },
  {
    key: 'kurabiye',
    label: 'Butik kurabiye',
    unit: 'adet',
    unitPrice: 80,
    capacityWeight: 0.5,
    color: '#8fae8b',
    hasTiers: false,
    tasks: [
      { name: 'Hamur ve pişirme', offset: 3, days: 1 },
      { name: 'Royal icing süsleme', offset: 2, days: 2 },
      { name: 'Paketleme', offset: 0, days: 1 },
    ],
  },
  {
    key: 'magnolia',
    label: 'Magnolia',
    unit: 'adet',
    unitPrice: 120,
    capacityWeight: 0.3,
    color: '#9a8cc2',
    hasTiers: false,
    tasks: [
      { name: 'Hazırlık', offset: 1, days: 1 },
      { name: 'Süsleme', offset: 0, days: 1 },
    ],
  },
  {
    key: 'diger',
    label: 'Diğer',
    unit: 'adet',
    unitPrice: 0,
    capacityWeight: 0.5,
    color: '#8a9bb0',
    hasTiers: false,
    tasks: [{ name: 'Hazırlık', offset: 0, days: 1 }],
  },
]

export function defaultSettings(): Settings {
  return {
    id: 'main',
    businessName: 'Luma Cakes',
    weekdayCapacity: [3, 3, 3, 3, 4, 4, 2],
    capacityOverrides: {},
    productTypes: DEFAULT_PRODUCT_TYPES,
    reminderDays: 21,
    nextOrderNo: 1,
    accent: 'gul',
    options: {
      cakeTypes: ['Vanilyalı', 'Kakaolu', 'Red velvet', 'Havuçlu', 'Limonlu', 'Frambuazlı', 'Muzlu'],
      creamTypes: [
        'Mascarpone krema',
        'Çikolatalı ganaj',
        'Beyaz çikolatalı ganaj',
        'Krem şanti',
        'Swiss meringue buttercream',
        'Cream cheese',
      ],
      fillings: ['Çilek', 'Muz', 'Frambuaz', 'Orman meyveli', 'Karamel', 'Fındık pralin', 'Antep fıstığı', 'Bisküvi'],
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
      sources: ['Instagram', 'WhatsApp', 'Telefon', 'Tavsiye', 'Eski müşteri', 'Diğer'],
      paymentMethods: ['Nakit', 'Havale/EFT', 'Kredi kartı'],
      extras: [
        'Figür / oyuncak',
        'Şeker hamuru figür',
        'Taze çiçek',
        'Altın varak',
        'Özel topper',
        'Özel iç malzeme',
        'Kutu / paketleme',
        'Teslimat ücreti',
      ],
      stockUnits: ['kg', 'g', 'lt', 'ml', 'adet', 'paket', 'kutu'],
      stockCategories: ['Un ve şeker', 'Süt ürünleri', 'Çikolata', 'Meyve', 'Süsleme', 'Ambalaj', 'Diğer'],
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
