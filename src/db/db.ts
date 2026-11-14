import Dexie, { type EntityTable } from 'dexie'
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
