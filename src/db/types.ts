export type ID = string

/** Sipariş durumu */
export type OrderStatus = 'onaylandi' | 'teslim' | 'iptal'

export interface SpecialDay {
  id: ID
  /** Kutlama türü: Doğum günü, Yıl dönümü ... */
  type: string
  /** Kimin için: "Kızı Elif", "Kendisi" ... */
  person: string
  month: number // 1-12
  day: number // 1-31
  year?: number
  note?: string
}

export interface Customer {
  id: ID
  name: string
  /** Telefon (bilinmiyorsa boş) */
  phone: string
  /** WhatsApp kullanıcı adı (numara bilinmediğinde) */
  whatsapp?: string
  instagram?: string
  address?: string
  source?: string
  allergies?: string
  notes?: string
  specialDays: SpecialDay[]
  createdAt: number
  updatedAt: number
}

export interface OrderBox {
  /** StockItem.id (Kutu kategorisi) */
  itemId: string
  qty: number
}

export interface PriceExtra {
  id: ID
  label: string
  amount: number
}

export interface Order {
  id: ID
  no: number
  customerId: ID
  /** ProductType.key */
  productType: string
  /** Kutlama türü */
  occasion?: string
  /** Kişi sayısı (kişi bazlı ürünlerde) ya da adet */
  amount?: number
  tiers?: number
  cakeType?: string
  creamType?: string
  /** Virgülle ayrılmış birden çok iç dolgu */
  filling?: string
  /** @deprecated artık formda yok; eski kayıtlarda kalabilir */
  theme?: string
  cakeText?: string
  /** Tebrik kartı yazısı */
  cardText?: string
  designNotes?: string
  /** @deprecated artık kullanılmıyor */
  designApproved?: boolean
  notes?: string
  deliveryDate: string // yyyy-MM-dd
  deliveryTime?: string // HH:mm
  deliveryMethod: 'gelal' | 'adres'
  deliveryAddress?: string
  /** Sipariş anındaki dilim (kişi) / adet fiyatı — fiyat listesinden gelir */
  unitPrice?: number
  extras: PriceExtra[]
  /** Adrese teslim ücreti */
  deliveryFee?: number
  /** İndirim (₺) */
  discount?: number
  /** Ürün için anlaşılan tutar (ekstralar, teslimat ve indirim hariç) */
  basePrice?: number
  /** Ücretsiz (ikram / hediye) sipariş: tutar 0, değeri raporlarda görünür */
  free?: boolean
  /** Siparişte kullanılan kutular (stoktan düşülür) */
  boxes?: OrderBox[]
  /** Fiyat listesine göre değer (ürün + ekstralar + teslimat − indirim) */
  calculatedTotal: number
  /** Müşterinin ödeyeceği toplam: anlaşılan tutar + ekstralar + teslimat − indirim (ücretsizse 0) */
  agreedPrice: number
  status: OrderStatus
  createdAt: number
  updatedAt: number
}

export type PaymentKind = 'kapora' | 'odeme' | 'iade'

export interface Payment {
  id: ID
  orderId: ID
  kind: PaymentKind
  amount: number
  date: string // yyyy-MM-dd
  method: string
  note?: string
  createdAt: number
}

/** referans: müşterinin gönderdiği, taslak: karşılıklı paylaşılan, onay: onaylanan tasarım, final: bitmiş ürün */
export type ImageKind = 'referans' | 'taslak' | 'onay' | 'final'

export interface OrderImage {
  id: ID
  orderId: ID
  kind: ImageKind
  blob: Blob
  thumb: Blob
  caption?: string
  /** 1 = katalogda göster */
  inCatalog: 0 | 1
  productType?: string
  createdAt: number
}

export interface Task {
  id: ID
  orderId: ID
  name: string
  /** Toplam iş süresi (dakika) */
  minutes: number
  /** Teslimden en geç kaç gün önce bitmeli (0 = teslim günü) */
  offset: number
  /** Günlere dağıtım: yyyy-MM-dd -> dakika */
  alloc: Record<string, number>
  /** alloc'tan türetilir: ilk gün */
  start: string
  /** alloc'tan türetilir: ilk ile son gün arası takvim günü */
  days: number
  done: boolean
  sort: number
  /** Elle taşındı: otomatik yeniden planlamada yerinde kalır */
  manual?: boolean
  /** Ürün şablonundan geldi */
  tpl?: boolean
}

export interface StockItem {
  id: ID
  name: string
  category?: string
  unit: string
  quantity: number
  /** Ağırlıklı ortalama birim maliyet */
  unitCost: number
  minQuantity?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export type StockMoveType = 'giris' | 'cikis' | 'sayim'

export interface StockMove {
  id: ID
  itemId: ID
  type: StockMoveType
  /** giris/cikis için miktar, sayim için yeni miktar */
  quantity: number
  /** Hareket anındaki birim maliyet */
  unitCost: number
  date: string
  orderId?: ID
  note?: string
  /** Siparişin kutu seçiminden otomatik oluştu */
  auto?: 'kutu'
  createdAt: number
}

export interface TaskTemplate {
  name: string
  /** Teslimden en geç kaç gün önce yapılmalı (0 = teslim günü) */
  offset: number
  /** Siparişten bağımsız sabit süre (dakika) */
  fixedMin: number
  /** Kişi / adet başına ek süre (dakika) */
  perUnitMin: number
}

/** Fiyat listesindeki bir ürün / pasta türü */
export interface ProductType {
  key: string
  label: string
  /** İçerik / açıklama */
  desc?: string
  /** Fiyatlandırma birimi: kişi (dilim) ya da adet */
  unit: 'kişi' | 'adet'
  /** Dilim (kişi) ya da adet fiyatı */
  unitPrice: number
  /** @deprecated eski sürümden kalma */
  capacityWeight?: number
  color: string
  hasTiers: boolean
  /** @deprecated üretim planı kaldırıldı */
  tasks?: TaskTemplate[]
}

export interface OptionLists {
  cakeTypes: string[]
  creamTypes: string[]
  fillings: string[]
  themes: string[]
  occasions: string[]
  specialDayTypes: string[]
  sources: string[]
  paymentMethods: string[]
  extras: string[]
  stockUnits: string[]
  stockCategories: string[]
}

export interface Settings {
  id: 'main'
  businessName: string
  /** Pazartesi..Pazar günlük kapasite (aynı gün teslim edilebilecek sipariş sayısı) */
  weekdayCapacity: number[]
  /** Belirli günler için kapasite (yyyy-MM-dd -> sipariş sayısı, 0 = kapalı) */
  capacityOverrides: Record<string, number>
  /** Belirli günler için not (Bayram, izin…) */
  dayNotes: Record<string, string>
  /** Kapasite birimi; eski sürümlerden geçişi anlamak için */
  capacityUnit?: 'saat' | 'siparis'
  /** Ayar verisi sürümü; tek seferlik geçişler için */
  rev?: number
  productTypes: ProductType[]
  options: OptionLists
  reminderDays: number
  nextOrderNo: number
  /** Renk teması anahtarı; 'ozel' ise accentColor kullanılır */
  accent: string
  /** Özel tema rengi (#rrggbb), logodan çıkarılır ya da elle seçilir */
  accentColor?: string
  /** Firma logosu (data URL) */
  logo?: string
  /** Son yedek alma zamanı (ms) */
  lastBackupAt?: number
}
