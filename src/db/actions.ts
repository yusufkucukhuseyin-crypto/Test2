import { db } from './db'
import { defaultSettings } from './defaults'
import type {
  Customer,
  ImageKind,
  Order,
  OrderImage,
  Payment,
  Settings,
  StockItem,
  StockMove,
  Task,
} from './types'
import { diffDays, shiftDay, today, uid } from '../lib/format'
import { generateTasks, productTypeOf } from '../lib/domain'
import { processImage } from '../lib/image'

/* ---------------- Ayarlar ---------------- */

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get('main')
  const defaults = defaultSettings()
  if (!existing) {
    await db.settings.put(defaults)
    return defaults
  }
  // Yeni sürümlerde eklenen alanları tamamla
  const merged: Settings = {
    ...defaults,
    ...existing,
    options: { ...defaults.options, ...existing.options },
  }
  if (JSON.stringify(merged) !== JSON.stringify(existing)) await db.settings.put(merged)
  return merged
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

  return db.transaction('rw', [db.orders, db.settings, db.payments, db.tasks, db.images], async () => {
    const settings = (await db.settings.get('main'))!
    const id = uid()
    const now = Date.now()
    const status =
      extras.deposit && extras.deposit.amount > 0 && (input.status === 'teklif' || input.status === 'onaylandi')
        ? 'kapora'
        : input.status
    const order: Order = { ...input, status, id, no: settings.nextOrderNo, createdAt: now, updatedAt: now }
    await db.orders.add(order)
    await db.settings.update('main', { nextOrderNo: settings.nextOrderNo + 1 })

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

    const pt = productTypeOf(settings, order.productType)
    if (order.status !== 'iptal') await db.tasks.bulkAdd(generateTasks(order, pt))

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
}

export async function updateOrder(id: string, input: OrderInput) {
  await db.transaction('rw', [db.orders, db.tasks, db.images], async () => {
    const prev = await db.orders.get(id)
    if (!prev) return
    await db.orders.update(id, { ...input, updatedAt: Date.now() })
    // Teslim tarihi değiştiyse bitmemiş işleri aynı miktarda kaydır
    if (prev.deliveryDate !== input.deliveryDate) {
      const delta = diffDays(input.deliveryDate, prev.deliveryDate)
      const tasks = await db.tasks.where('orderId').equals(id).toArray()
      await Promise.all(
        tasks.filter((t) => !t.done).map((t) => db.tasks.update(t.id, { start: shiftDay(t.start, delta) })),
      )
    }
    if (prev.productType !== input.productType) {
      await db.images.where('orderId').equals(id).modify({ productType: input.productType })
    }
  })
}

export async function setOrderStatus(id: string, status: Order['status']) {
  await db.orders.update(id, { status, updatedAt: Date.now() })
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
  await db.transaction('rw', [db.payments, db.orders], async () => {
    await db.payments.add({ ...p, id: uid(), createdAt: Date.now() })
    if (p.kind === 'kapora') {
      const o = await db.orders.get(p.orderId)
      if (o && (o.status === 'teklif' || o.status === 'onaylandi')) {
        await db.orders.update(o.id, { status: 'kapora', updatedAt: Date.now() })
      }
    }
  })
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

/* ---------------- Planlama ---------------- */

export async function regenerateTasks(orderId: string) {
  const settings = (await db.settings.get('main'))!
  const order = await db.orders.get(orderId)
  if (!order) return
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.where('orderId').equals(orderId).delete()
    await db.tasks.bulkAdd(generateTasks(order, productTypeOf(settings, order.productType)))
  })
}

export async function addTask(t: Omit<Task, 'id' | 'sort'>) {
  const count = await db.tasks.where('orderId').equals(t.orderId).count()
  await db.tasks.add({ ...t, id: uid(), sort: count })
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
