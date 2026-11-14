import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Customer, Order, Payment, Task } from '../db/types'
import { buildLoad, type Load } from './schedule'
import { paidTotal } from './domain'

export interface CoreData {
  orders: Order[]
  customers: Customer[]
  customerById: Map<string, Customer>
  paymentsByOrder: Map<string, Payment[]>
  paidByOrder: Map<string, number>
}

/** Siparişler, müşteriler ve ödemeler (canlı) */
export function useCoreData(): CoreData | undefined {
  return useLiveQuery(async () => {
    const [orders, customers, payments] = await Promise.all([
      db.orders.toArray(),
      db.customers.toArray(),
      db.payments.toArray(),
    ])
    const customerById = new Map(customers.map((c) => [c.id, c]))
    const paymentsByOrder = new Map<string, Payment[]>()
    for (const p of payments) {
      const arr = paymentsByOrder.get(p.orderId) ?? []
      arr.push(p)
      paymentsByOrder.set(p.orderId, arr)
    }
    const paidByOrder = new Map<string, number>()
    for (const [k, v] of paymentsByOrder) paidByOrder.set(k, paidTotal(v))
    return { orders, customers, customerById, paymentsByOrder, paidByOrder }
  }, [])
}

export function sortByDelivery(a: Order, b: Order): number {
  return (a.deliveryDate + (a.deliveryTime ?? '99')).localeCompare(b.deliveryDate + (b.deliveryTime ?? '99'))
}

export interface PlanData {
  orders: Order[]
  tasks: Task[]
  orderById: Map<string, Order>
  cancelled: Set<string>
  /** İptal edilmemiş siparişlerin günlük doluluğu (dakika) */
  load: Load
}

/** Kapasite planlaması için canlı veri */
export function usePlanData(): PlanData | undefined {
  return useLiveQuery(async () => {
    const [orders, tasks] = await Promise.all([db.orders.toArray(), db.tasks.toArray()])
    const cancelled = new Set(orders.filter((o) => o.status === 'iptal').map((o) => o.id))
    const live = tasks.filter((t) => !cancelled.has(t.orderId))
    return { orders, tasks: live, orderById: new Map(orders.map((o) => [o.id, o])), cancelled, load: buildLoad(live) }
  }, [])
}
