import { db } from './db'
import {
  BOX_CATEGORY,
  CAKE_TYPES,
  CREAM_TYPES,
  DEFAULT_BOXES,
  DEFAULT_BOX_MIN,
  DEFAULT_DAILY_CAPACITY,
  FILLINGS,
  SETTINGS_REV,
  defaultSettings,
} from './defaults'
import type {
  Customer,
  ImageKind,
  Order,
  OrderImage,
  Payment,
  Settings,
  StockItem,
  StockMove,
} from './types'
import { today, uid } from '../lib/format'
import { processImage } from '../lib/image'

/* ---------------- Ayarlar ---------------- */

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('main')
  const defaults = defaultSettings()
  if (!existing) {
    await db.settings.put(defaults)
    await ensureBoxItems()
    return defaults
  }
  // Yeni sürümlerde eklenen alanları tamamla
  const merged: Settings = {
    ...defaults,
    ...existing,
    dayNotes: existing.dayNotes ?? {},
    options: { ...defaults.options, ...existing.options },
  }
  const rev = existing.rev ?? 1
  // Sürüm 2: "Torunlar Tavsiye" kaynağı eklendi, Magnolia ürün türü kaldırıldı
  if (rev < 2) {
    const sources = merged.options.sources
    if (!sources.includes('Torunlar Tavsiye')) {
      const at = sources.indexOf('Tavsiye')
      merged.options = {
        ...merged.options,
        sources: at >= 0 ? [...sources.slice(0, at + 1), 'Torunlar Tavsiye', ...sources.slice(at + 1)] : [...sources, 'Torunlar Tavsiye'],
      }
    }
    merged.productTypes = merged.productTypes.filter((p) => p.key !== 'magnolia')
  }
  // Sürüm 3: kek / krema / dolgu seçenekleri yenilendi, üretim planı kaldırıldı,
  // kapasite "aynı gün teslim edilecek sipariş sayısı" oldu (her gün 2, Pazar dahil)
  if (rev < 3) {
    merged.options = {
      ...merged.options,
      cakeTypes: CAKE_TYPES,
      creamTypes: CREAM_TYPES,
      fillings: FILLINGS,
      extras: merged.options.extras.filter((x) => x !== 'Teslimat ücreti'),
    }
    merged.productTypes = merged.productTypes.map((p) => {
      const { tasks: _tasks, capacityWeight: _cw, ...rest } = p
      return { ...rest, desc: p.desc ?? '' }
    })
    if (existing.capacityUnit !== 'siparis') {
      merged.capacityUnit = 'siparis'
      merged.weekdayCapacity = Array(7).fill(DEFAULT_DAILY_CAPACITY)
      // Elle kapatılan günler kalır; saat cinsinden özel kapasiteler ve örnek izin günü kalkar
      const notes = { ...merged.dayNotes }
      const overrides: Record<string, number> = {}
      for (const [d, v] of Object.entries(existing.capacityOverrides ?? {})) {
        if (notes[d] === 'İzin (örnek)') delete notes[d]
        else if (v === 0) overrides[d] = 0
      }
      merged.capacityOverrides = overrides
      merged.dayNotes = notes
    }
  }
  // Sürüm 4: kutu stoğu (Küçük / Orta / Büyük / Cupcake) — siparişte seçilen kutu stoktan düşer
  if (rev < 4) {
    if (!merged.options.stockCategories.includes(BOX_CATEGORY)) {
      merged.options = { ...merged.options, stockCategories: [BOX_CATEGORY, ...merged.options.stockCategories] }
    }
    await ensureBoxItems()
  }
  merged.rev = SETTINGS_REV
  if (JSON.stringify(merged) !== JSON.stringify(existing)) await db.settings.put(merged)
  return merged
}

/** Kutu kategorisinde hiç kalem yoksa varsayılan kutuları (stok 0) oluşturur */
async function ensureBoxItems() {
  const has = await db.stockItems.where('category').equals(BOX_CATEGORY).count()
  if (has) return
  const now = Date.now()
  await db.stockItems.bulkAdd(
    DEFAULT_BOXES.map((name, i) => ({
      id: uid(),
      name,
      category: BOX_CATEGORY,
      unit: 'adet',
      quantity: 0,
      unitCost: 0,
      minQuantity: DEFAULT_BOX_MIN,
      createdAt: now + i,
      updatedAt: now + i,
    })),
  )
}

export async function updateSettings(patch: Partial<Settings>) {
  await db.settings.update('main', patch)
}

/* ---------------- Müşteri ---------------- */

export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>

export async function saveCustomer(input: CustomerInput, id?: string): Promise<string> {
  const now = Date.now()
  if (id) {
    await db.customers.update(id, { ...input, updatedAt: now })
    return id
  }
  const newId = uid()
  await db.customers.add({ ...input, id: newId, createdAt: now, updatedAt: now })
  return newId
}

export async function deleteCustomer(id: string) {
  const orders = await db.orders.where('customerId').equals(id).count()
  if (orders > 0) throw new Error('Bu müşteriye ait siparişler var. Önce siparişleri silin.')
  await db.customers.delete(id)
}

/* ---------------- Sipariş ---------------- */

export type OrderInput = Omit<Order, 'id' | 'no' | 'createdAt' | 'updatedAt'>

export interface NewOrderExtras {
  deposit?: { amount: number; method: string; date: string }
  images?: { file: Blob; kind: ImageKind }[]
  copyImageIds?: string[]
}

export async function createOrder(input: OrderInput, extras: NewOrderExtras = {}): Promise<string> {
  const processed = await Promise.all((extras.images ?? []).map(async (i) => ({ ...(await processImage(i.file)), kind: i.kind })))
  const copies = extras.copyImageIds?.length ? await db.images.bulkGet(extras.copyImageIds) : []

  const newId = await db.transaction('rw', [db.orders, db.settings, db.payments, db.images], async () => {
    const settings = (await db.settings.get('main'))!
    const id = uid()
    const now = Date.now()
    // Başka cihazlardan gelen siparişlerle numara çakışmasın
    const maxNo = (await db.orders.orderBy('no').last())?.no ?? 0
    const no = Math.max(settings.nextOrderNo, maxNo + 1)
    const order: Order = { ...input, id, no, createdAt: now, updatedAt: now }
    await db.orders.add(order)
    await db.settings.update('main', { nextOrderNo: no + 1 })

    if (extras.deposit && extras.deposit.amount > 0) {
      await db.payments.add({
        id: uid(),
        orderId: id,
        kind: 'kapora',
        amount: extras.deposit.amount,
        method: extras.deposit.method,
        date: extras.deposit.date,
        createdAt: now,
      })
    }


    const imgs: OrderImage[] = processed.map((p, i) => ({
      id: uid(),
      orderId: id,
      kind: p.kind,
      blob: p.blob,
      thumb: p.thumb,
      inCatalog: 0,
      productType: order.productType,
      createdAt: now + i,
    }))
    for (const c of copies) {
      if (!c) continue
      imgs.push({
        id: uid(),
        orderId: id,
        kind: 'referans',
        blob: c.blob,
        thumb: c.thumb,
        caption: c.caption ? `Katalogdan: ${c.caption}` : 'Katalogdan seçilen model',
        inCatalog: 0,
        productType: order.productType,
        createdAt: now + imgs.length,
      })
    }
    if (imgs.length) await db.images.bulkAdd(imgs)
    return id
  })
  await syncOrderBoxes(newId)
  return newId
}

export async function updateOrder(id: string, input: OrderInput) {
  const prev = await db.orders.get(id)
  if (!prev) return
  await db.transaction('rw', [db.orders, db.images], async () => {
    await db.orders.update(id, { ...input, updatedAt: Date.now() })
    if (prev.productType !== input.productType) {
      await db.images.where('orderId').equals(id).modify({ productType: input.productType })
    }
  })
  await syncOrderBoxes(id)
}

/**
 * Siparişin kutu seçimini stoğa yansıtır: önceki otomatik kutu çıkışlarını geri alır, güncel seçimi düşer.
 * İptal edilen siparişin kutuları stoğa geri döner.
 */
export async function syncOrderBoxes(orderId: string) {
  await db.transaction('rw', [db.orders, db.stockItems, db.stockMoves], async () => {
    const order = await db.orders.get(orderId)
    const old = (await db.stockMoves.where('orderId').equals(orderId).toArray()).filter((m) => m.auto === 'kutu')
    const want = order && order.status !== 'iptal' ? (order.boxes ?? []).filter((b) => b.qty > 0) : []
    // Değişiklik yoksa dokunma
    const same =
      old.length === want.length && want.every((b) => old.some((m) => m.itemId === b.itemId && m.quantity === b.qty))
    if (same) return
    const oldDate = new Map(old.map((m) => [m.itemId, m.date]))
    for (const m of old) {
      const item = await db.stockItems.get(m.itemId)
      if (item) await db.stockItems.update(item.id, { quantity: item.quantity + m.quantity, updatedAt: Date.now() })
    }
    await db.stockMoves.bulkDelete(old.map((m) => m.id))
    for (const b of want) {
      const item = await db.stockItems.get(b.itemId)
      if (!item) continue
      await db.stockItems.update(item.id, { quantity: item.quantity - b.qty, updatedAt: Date.now() })
      await db.stockMoves.add({
        id: uid(),
        itemId: item.id,
        type: 'cikis',
        quantity: b.qty,
        unitCost: item.unitCost,
        date: oldDate.get(item.id) ?? today(),
        orderId,
        note: `Sipariş #${order!.no} kutusu`,
        auto: 'kutu',
        createdAt: Date.now(),
      })
    }
  })
}

export async function setOrderStatus(id: string, status: Order['status']) {
  await db.orders.update(id, { status, updatedAt: Date.now() })
  // İptalde kutular stoğa döner, geri alınınca yeniden düşer
  await syncOrderBoxes(id)
}

export async function deleteOrder(id: string) {
  await db.transaction('rw', [db.orders, db.payments, db.tasks, db.images, db.stockMoves, db.stockItems], async () => {
    // Siparişe yazılan malzeme kullanımlarını stoğa geri ekle
    const moves = await db.stockMoves.where('orderId').equals(id).toArray()
    for (const m of moves) {
      if (m.type === 'cikis') {
        const item = await db.stockItems.get(m.itemId)
        if (item) await db.stockItems.update(item.id, { quantity: item.quantity + m.quantity })
      }
    }
    await db.stockMoves.where('orderId').equals(id).delete()
    await db.payments.where('orderId').equals(id).delete()
    await db.tasks.where('orderId').equals(id).delete()
    await db.images.where('orderId').equals(id).delete()
    await db.orders.delete(id)
  })
}

/* ---------------- Ödeme ---------------- */

export async function addPayment(p: Omit<Payment, 'id' | 'createdAt'>) {
  await db.payments.add({ ...p, id: uid(), createdAt: Date.now() })
}

export async function deletePayment(id: string) {
  await db.payments.delete(id)
}

/* ---------------- Görseller ---------------- */

export async function addImages(orderId: string, files: Blob[], kind: ImageKind, productType?: string) {
  const now = Date.now()
  const processed = await Promise.all(files.map((f) => processImage(f)))
  await db.images.bulkAdd(
    processed.map((p, i) => ({
      id: uid(),
      orderId,
      kind,
      blob: p.blob,
      thumb: p.thumb,
      inCatalog: kind === 'final' ? 1 : 0,
      productType,
      createdAt: now + i,
    })),
  )
}

/* ---------------- Kapasite ---------------- */

/** Bir gün aralığının kapasitesini (sipariş sayısı) ayarlar (0 = kapalı). undefined -> haftalık varsayılana döner */
export async function setDayCapacity(dates: string[], count: number | undefined, note?: string) {
  const s = (await db.settings.get('main'))!
  const overrides = { ...s.capacityOverrides }
  const notes = { ...(s.dayNotes ?? {}) }
  for (const d of dates) {
    if (count === undefined) delete overrides[d]
    else overrides[d] = count
    if (note !== undefined) {
      if (note.trim()) notes[d] = note.trim()
      else delete notes[d]
    }
  }
  await db.settings.update('main', { capacityOverrides: overrides, dayNotes: notes })
}

/* ---------------- Stok ---------------- */

export async function saveStockItem(
  input: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt' | 'quantity' | 'unitCost'> & {
    quantity?: number
    unitCost?: number
  },
  id?: string,
) {
  const now = Date.now()
  if (id) {
    const { quantity: _q, unitCost: _c, ...rest } = input
    await db.stockItems.update(id, { ...rest, updatedAt: now })
    return id
  }
  const newId = uid()
  await db.transaction('rw', [db.stockItems, db.stockMoves], async () => {
    await db.stockItems.add({
      ...input,
      quantity: input.quantity ?? 0,
      unitCost: input.unitCost ?? 0,
      id: newId,
      createdAt: now,
      updatedAt: now,
    })
    if (input.quantity) {
      await db.stockMoves.add({
        id: uid(),
        itemId: newId,
        type: 'giris',
        quantity: input.quantity,
        unitCost: input.unitCost ?? 0,
        date: today(),
        note: 'Açılış stoğu',
        createdAt: now,
      })
    }
  })
  return newId
}

/**
 * Stok hareketi ekler.
 * giris: quantity + totalCost -> ağırlıklı ortalama maliyet güncellenir
 * cikis: quantity düşer (siparişe bağlanabilir)
 * sayim: quantity yeni miktar olur
 */
export async function addStockMove(m: {
  itemId: string
  type: StockMove['type']
  quantity: number
  totalCost?: number
  date: string
  orderId?: string
  note?: string
}) {
  await db.transaction('rw', [db.stockItems, db.stockMoves], async () => {
    const item = await db.stockItems.get(m.itemId)
    if (!item) throw new Error('Malzeme bulunamadı')
    let quantity = item.quantity
    let unitCost = item.unitCost
    let moveCost = item.unitCost
    if (m.type === 'giris') {
      const total = m.totalCost ?? m.quantity * item.unitCost
      moveCost = m.quantity > 0 ? total / m.quantity : item.unitCost
      const newQty = quantity + m.quantity
      unitCost = newQty > 0 ? (Math.max(quantity, 0) * item.unitCost + total) / (Math.max(quantity, 0) + m.quantity) : moveCost
      quantity = newQty
    } else if (m.type === 'cikis') {
      quantity = quantity - m.quantity
    } else {
      quantity = m.quantity
    }
    await db.stockItems.update(item.id, { quantity, unitCost, updatedAt: Date.now() })
    await db.stockMoves.add({
      id: uid(),
      itemId: item.id,
      type: m.type,
      quantity: m.quantity,
      unitCost: moveCost,
      date: m.date,
      orderId: m.orderId,
      note: m.note,
      createdAt: Date.now(),
    })
  })
}

/** Hareketi geri alır (son hareketler için basit geri alma) */
export async function deleteStockMove(id: string) {
  await db.transaction('rw', [db.stockItems, db.stockMoves], async () => {
    const m = await db.stockMoves.get(id)
    if (!m) return
    const item = await db.stockItems.get(m.itemId)
    if (item) {
      if (m.type === 'cikis') await db.stockItems.update(item.id, { quantity: item.quantity + m.quantity })
      else if (m.type === 'giris') {
        const newQty = item.quantity - m.quantity
        const newCost =
          newQty > 0 ? Math.max(0, (item.quantity * item.unitCost - m.quantity * m.unitCost) / newQty) : item.unitCost
        await db.stockItems.update(item.id, { quantity: newQty, unitCost: newCost })
      }
    }
    await db.stockMoves.delete(id)
  })
}

export async function deleteStockItem(id: string) {
  await db.transaction('rw', [db.stockItems, db.stockMoves], async () => {
    await db.stockMoves.where('itemId').equals(id).delete()
    await db.stockItems.delete(id)
  })
}
