import { db } from './db'
import { DEFAULT_PRODUCT_TYPES, defaultSettings } from './defaults'
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
import { today, uid } from '../lib/format'
import { productTypeOf } from '../lib/domain'
import { buildLoad, fillForward, planSteps, templateTasks, withAlloc, type Alloc } from '../lib/schedule'
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
    dayNotes: existing.dayNotes ?? {},
    options: { ...defaults.options, ...existing.options },
  }
  // Eski sürüm: kapasite "günlük pasta adedi" idi -> çalışma saatine geç
  if (!existing.capacityUnit) {
    merged.capacityUnit = 'saat'
    merged.weekdayCapacity = defaults.weekdayCapacity
    merged.capacityOverrides = Object.fromEntries(
      Object.entries(existing.capacityOverrides ?? {}).filter(([, v]) => v === 0),
    )
    merged.productTypes = existing.productTypes.map((p) => {
      const def = DEFAULT_PRODUCT_TYPES.find((d) => d.key === p.key)
      return {
        ...p,
        tasks: p.tasks.map((t) => {
          if ('fixedMin' in t) return t
          const old = t as { name: string; offset: number; days?: number }
          return (
            def?.tasks.find((d) => d.name === old.name) ?? {
              name: old.name,
              offset: old.offset,
              fixedMin: 60 * (old.days || 1),
              perUnitMin: 0,
            }
          )
        }),
      }
    })
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

  const newId = await db.transaction('rw', [db.orders, db.settings, db.payments, db.images], async () => {
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
  // İş adımlarını ürün şablonundan oluşturup kapasiteye göre yerleştir
  await regenerateTasks(newId)
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
  // Ürün ya da büyüklük değiştiyse adımlar şablondan yeniden; yalnızca tarih değiştiyse yeniden yerleştir
  if (prev.productType !== input.productType || (prev.amount ?? 0) !== (input.amount ?? 0)) {
    await regenerateTasks(id)
  } else if (prev.deliveryDate !== input.deliveryDate) {
    await replanOrders([id], { includeManual: true })
  }
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

/** Bitmemiş şablon adımlarını silip şablondan yeniden oluşturur ve kapasiteye göre yerleştirir */
export async function regenerateTasks(orderId: string) {
  const settings = (await db.settings.get('main'))!
  const order = await db.orders.get(orderId)
  if (!order) return
  await db.transaction('rw', db.tasks, async () => {
    const existing = await db.tasks.where('orderId').equals(orderId).toArray()
    const doneNames = new Set(existing.filter((t) => t.done).map((t) => t.name))
    await db.tasks.bulkDelete(existing.filter((t) => !t.done && t.tpl !== false).map((t) => t.id))
    const fresh = templateTasks(order, productTypeOf(settings, order.productType)).filter((t) => !doneNames.has(t.name))
    await db.tasks.bulkAdd(fresh)
  })
  await replanOrders([orderId], { includeManual: true })
}

export interface ReplanResult {
  orders: number
  late: { orderId: string; earliest?: string | null }[]
}

/**
 * Siparişlerin bitmemiş adımlarını kapasiteye göre yeniden yerleştirir.
 * ids verilmezse bugün ve sonrasında teslim edilecek tüm açık siparişler.
 * Elle taşınmış adımlar (manual) includeManual verilmedikçe yerinde kalır.
 * Sıra: önce kesinleşmiş siparişler (teklifler en son), kendi içinde en yakın teslim tarihli olan önce.
 * Her sipariş kendi teslim tarihinden geriye doğru yerleşir; böylece acil siparişler kapasiteyi önce alır.
 */
export async function replanOrders(
  ids: string[] | null,
  opts: { includeManual?: boolean; allowPast?: boolean } = {},
): Promise<ReplanResult> {
  return db.transaction('rw', [db.tasks, db.orders, db.settings], async () => {
    const settings = (await db.settings.get('main'))!
    const [orders, tasks] = await Promise.all([db.orders.toArray(), db.tasks.toArray()])
    const t = today()
    const cancelled = new Set(orders.filter((o) => o.status === 'iptal').map((o) => o.id))
    const targets = orders
      .filter((o) =>
        ids ? ids.includes(o.id) && o.status !== 'iptal' : o.status !== 'iptal' && o.status !== 'teslim' && o.deliveryDate >= t,
      )
      // Öncelik: kesinleşmiş siparişler tekliflerden önce; sonra en yakın teslim tarihi (EDD)
      .sort(
        (a, b) =>
          Number(a.status === 'teklif') - Number(b.status === 'teklif') ||
          a.deliveryDate.localeCompare(b.deliveryDate) ||
          a.no - b.no,
      )
    const targetIds = new Set(targets.map((o) => o.id))
    const movable = (x: Task) => targetIds.has(x.orderId) && !x.done && (opts.includeManual || !x.manual)
    let load = buildLoad(tasks.filter((x) => !movable(x) && !cancelled.has(x.orderId)))
    const result: ReplanResult = { orders: 0, late: [] }
    for (const o of targets) {
      const ts = tasks.filter((x) => x.orderId === o.id && movable(x)).sort((a, b) => a.sort - b.sort)
      if (!ts.length) continue
      const minDate = opts.allowPast || o.deliveryDate < t ? null : t
      const plan = planSteps(
        settings,
        ts.map((x) => ({ key: x.id, name: x.name, minutes: x.minutes, offset: x.offset })),
        o.deliveryDate,
        load,
        minDate,
      )
      load = plan.load
      result.orders++
      if (plan.late) result.late.push({ orderId: o.id, earliest: plan.earliest })
      await db.tasks.bulkPut(ts.map((x) => withAlloc({ ...x, manual: false }, plan.allocs[x.id] ?? {})))
    }
    return result
  })
}

/** Adımı elle taşır: seçilen günden itibaren boş kapasiteye ileriye doğru yerleşir */
export async function moveTask(taskId: string, from: string) {
  await db.transaction('rw', [db.tasks, db.orders, db.settings], async () => {
    const settings = (await db.settings.get('main'))!
    const task = await db.tasks.get(taskId)
    if (!task) return
    const cancelled = new Set((await db.orders.where('status').equals('iptal').toArray()).map((o) => o.id))
    const others = (await db.tasks.toArray()).filter((x) => x.id !== taskId && !cancelled.has(x.orderId))
    const alloc: Alloc = fillForward(settings, buildLoad(others), task.minutes, from)
    await db.tasks.put(withAlloc({ ...task, manual: true }, alloc))
  })
}

/** Adımın süresini değiştirir ve yeniden yerleştirir */
export async function setTaskMinutes(taskId: string, minutes: number) {
  const task = await db.tasks.get(taskId)
  if (!task) return
  await db.tasks.update(taskId, { minutes })
  if (task.manual) await moveTask(taskId, task.start)
  else await replanOrders([task.orderId])
}

/** Siparişe şablon dışı adım ekler (seçilen günden itibaren yerleşir) */
export async function addTask(t: { orderId: string; name: string; from: string; minutes: number }) {
  const count = await db.tasks.where('orderId').equals(t.orderId).count()
  const id = uid()
  await db.tasks.add({
    id,
    orderId: t.orderId,
    name: t.name,
    minutes: t.minutes,
    offset: 0,
    alloc: {},
    start: t.from,
    days: 1,
    done: false,
    sort: count,
    tpl: false,
  })
  await moveTask(id, t.from)
}

/** Bir gün aralığının kapasitesini ayarlar (0 = kapalı). undefined -> haftalık varsayılana döner */
export async function setDayCapacity(dates: string[], hours: number | undefined, note?: string) {
  const s = (await db.settings.get('main'))!
  const overrides = { ...s.capacityOverrides }
  const notes = { ...(s.dayNotes ?? {}) }
  for (const d of dates) {
    if (hours === undefined) delete overrides[d]
    else overrides[d] = hours
    if (note !== undefined) {
      if (note.trim()) notes[d] = note.trim()
      else delete notes[d]
    }
  }
  await db.settings.update('main', { capacityOverrides: overrides, dayNotes: notes })
}

/** Verilen günlerde planlı (bitmemiş) adımları olan açık siparişler */
export async function ordersWithWorkOn(dates: string[]): Promise<string[]> {
  const set = new Set(dates)
  const tasks = await db.tasks.toArray()
  return [...new Set(tasks.filter((t) => !t.done && Object.keys(t.alloc ?? {}).some((d) => set.has(d))).map((t) => t.orderId))]
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
