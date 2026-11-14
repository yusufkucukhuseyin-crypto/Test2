import type { ProductType, Settings } from './types'

export const DEFAULT_PRODUCT_TYPES: ProductType[] = [
  {
    key: 'pasta',
    label: 'Pasta',
    unit: 'kişi',
    unitPrice: 350,
    color: '#d48a96',
    hasTiers: true,
    tasks: [
      { name: 'Malzeme kontrolü', offset: 3, fixedMin: 30, perUnitMin: 0 },
      { name: 'Kek pişirme', offset: 2, fixedMin: 60, perUnitMin: 2 },
      { name: 'Dolgu ve krema', offset: 1, fixedMin: 45, perUnitMin: 1.5 },
      { name: 'Kaplama', offset: 1, fixedMin: 45, perUnitMin: 1.5 },
      { name: 'Süsleme ve paketleme', offset: 0, fixedMin: 60, perUnitMin: 2 },
    ],
  },
  {
    key: 'cupcake',
    label: 'Cupcake',
    unit: 'adet',
    unitPrice: 90,
    color: '#c79a5b',
    hasTiers: false,
    tasks: [
      { name: 'Pişirme', offset: 1, fixedMin: 45, perUnitMin: 1 },
      { name: 'Krema ve süsleme', offset: 0, fixedMin: 20, perUnitMin: 2 },
    ],
  },
  {
    key: 'kurabiye',
    label: 'Butik kurabiye',
    unit: 'adet',
    unitPrice: 80,
    color: '#8fae8b',
    hasTiers: false,
    tasks: [
      { name: 'Hamur ve pişirme', offset: 3, fixedMin: 60, perUnitMin: 0.5 },
      { name: 'Royal icing süsleme', offset: 1, fixedMin: 0, perUnitMin: 4 },
      { name: 'Paketleme', offset: 0, fixedMin: 15, perUnitMin: 0.5 },
    ],
  },
  {
    key: 'magnolia',
    label: 'Magnolia',
    unit: 'adet',
    unitPrice: 120,
    color: '#9a8cc2',
    hasTiers: false,
    tasks: [
      { name: 'Hazırlık', offset: 1, fixedMin: 30, perUnitMin: 2 },
      { name: 'Süsleme', offset: 0, fixedMin: 15, perUnitMin: 1 },
    ],
  },
  {
    key: 'diger',
    label: 'Diğer',
    unit: 'adet',
    unitPrice: 0,
    color: '#8a9bb0',
    hasTiers: false,
    tasks: [{ name: 'Hazırlık', offset: 0, fixedMin: 60, perUnitMin: 0 }],
  },
]

export function defaultSettings(): Settings {
  return {
    id: 'main',
    businessName: 'Luma Cakes',
    // Pazartesi..Pazar çalışma saati; Pazar kapalı
    weekdayCapacity: [8, 8, 8, 8, 8, 8, 0],
    capacityOverrides: {},
    dayNotes: {},
    capacityUnit: 'saat',
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
