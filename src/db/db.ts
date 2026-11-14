import Dexie, { type EntityTable } from 'dexie'
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
  }
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
