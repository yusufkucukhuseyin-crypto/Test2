import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Customer, Order, Payment } from '../db/types'
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
