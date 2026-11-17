import Dexie, { type DBCore, type DBCoreMutateRequest, type DBCoreTable, type EntityTable, type Table } from 'dexie'
import { shiftDay } from '../lib/format'
import type {
  Customer,
  Order,
  OrderImage,
  Payment,
  Settings,
  StockItem,
  StockMove,
  Task,
} from './types'

export class AppDB extends Dexie {
  customers!: EntityTable<Customer, 'id'>
  orders!: EntityTable<Order, 'id'>
  payments!: EntityTable<Payment, 'id'>
  images!: EntityTable<OrderImage, 'id'>
  tasks!: EntityTable<Task, 'id'>
  stockItems!: EntityTable<StockItem, 'id'>
  stockMoves!: EntityTable<StockMove, 'id'>
  settings!: EntityTable<Settings, 'id'>
  /** Buluta gönderilmeyi bekleyen değişiklikler (kayıt başına bir satır) */
  outbox!: EntityTable<OutboxEntry, 'key'>
  /** Eşitleme durumu (son çekilen zaman, yüklenen fotoğraflar…) */
  syncmeta!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('pastane-yonetim')
    this.version(1).stores({
      customers: 'id, name, phone, updatedAt',
      orders: 'id, no, customerId, deliveryDate, status, productType, updatedAt',
      payments: 'id, orderId, date',
      images: 'id, orderId, kind, inCatalog, createdAt',
      tasks: 'id, orderId, start',
      stockItems: 'id, name, category',
      stockMoves: 'id, itemId, orderId, date',
      settings: 'id',
    })
    // Sürüm 2: görevler gün sayısı yerine dakika ve günlere dağıtım (kapasite bazlı plan)
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((t: Task & { days?: number }) => {
            if (t.alloc) return
            const days = Math.max(1, t.days || 1)
            t.minutes = 60 * days
            t.offset = 0
            t.tpl = true
            t.alloc = {}
            for (let i = 0; i < days; i++) t.alloc[shiftDay(t.start, i)] = 60
          }),
      )
    // Sürüm 3: sipariş durumları üçe indi (Onaylandı / Teslim edildi / İptal)
    this.version(3)
      .stores({})
      .upgrade((tx) => tx.table('orders').toCollection().modify((o: Order) => normalizeOrder(o)))
    // Sürüm 4: bulut eşitleme için gönderim kuyruğu ve eşitleme bilgileri
    this.version(4).stores({ outbox: 'key, at', syncmeta: 'key' })
    this.use(outboxMiddleware)
  }
}

/** Buluta eşitlenen tablolar */
export const SYNC_TABLES = ['customers', 'orders', 'payments', 'images', 'stockItems', 'stockMoves', 'settings'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]
const SYNCED = new Set<string>(SYNC_TABLES)

export interface OutboxEntry {
  /** tbl + "\u0001" + id */
  key: string
  tbl: SyncTable
  id: string
  op: 'put' | 'del'
  at: number
}

export const outboxKey = (tbl: string, id: string) => `${tbl}\u0001${id}`

/**
 * Eşitlenen tablolardaki her ekleme / güncelleme / silmeyi, aynı işlem (transaction) içinde
 * gönderim kuyruğuna yazar. Eşitlemenin kendi yazdıkları ("syncmeta" tablosunu da içeren işlemler)
 * kuyruğa alınmaz.
 */
const outboxMiddleware = {
  stack: 'dbcore' as const,
  name: 'luma-outbox',
  create(down: DBCore): DBCore {
    return {
      ...down,
      transaction(stores, mode, options) {
        const remote = stores.includes('syncmeta')
        const track = mode === 'readwrite' && !remote && stores.some((s) => SYNCED.has(s))
        const trans = down.transaction(track && !stores.includes('outbox') ? [...stores, 'outbox'] : stores, mode, options)
        ;(trans as unknown as { __lumaRemote?: boolean }).__lumaRemote = remote
        return trans
      },
      table(name) {
        const table = down.table(name)
        if (!SYNCED.has(name)) return table
        const wrapped: DBCoreTable = {
          ...table,
          async mutate(req: DBCoreMutateRequest) {
            const t = req.trans as unknown as { __lumaRemote?: boolean; mode?: string }
            // Eşitlemenin kendi yazdıkları ve veritabanı yükseltmeleri kuyruğa alınmaz
            if (t.__lumaRemote || t.mode === 'versionchange') return table.mutate(req)
            let removed: string[] = []
            if (req.type === 'deleteRange') {
              const r = await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } })
              removed = r.result as string[]
            } else if (req.type === 'delete') {
              removed = req.keys as string[]
            }
            const res = await table.mutate(req)
            const at = Date.now()
            const entries: OutboxEntry[] = []
            if (req.type === 'add' || req.type === 'put') {
              const keys = new Set<string>()
              ;(res.results ?? req.keys ?? []).forEach((k) => k !== undefined && keys.add(String(k)))
              req.values.forEach((v: { id?: string }) => v?.id !== undefined && keys.add(String(v.id)))
              if (req.type === 'put' && req.updates) req.updates.keys.forEach((k) => keys.add(String(k)))
              keys.forEach((id) => entries.push({ key: outboxKey(name, id), tbl: name as SyncTable, id, op: 'put', at }))
            } else {
              removed.forEach((k) => entries.push({ key: outboxKey(name, String(k)), tbl: name as SyncTable, id: String(k), op: 'del', at }))
            }
            if (entries.length) await down.table('outbox').mutate({ type: 'put', trans: req.trans, values: entries })
            return res
          },
        }
        return wrapped
      },
    }
  },
}

/** Eski sürümlerden gelen sipariş durumlarını yeni üç duruma çevirir */
export function normalizeOrder(o: Order): Order {
  const s = o.status as string
  if (s !== 'onaylandi' && s !== 'teslim' && s !== 'iptal') o.status = 'onaylandi'
  return o
}

export const db = new AppDB()

export const ALL_TABLES = [
  'customers',
  'orders',
  'payments',
  'images',
  'tasks',
  'stockItems',
  'stockMoves',
  'settings',
] as const
