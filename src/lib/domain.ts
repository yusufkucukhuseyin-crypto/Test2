import { addYears, differenceInCalendarDays, getDay, parseISO } from 'date-fns'
import type {
  Customer,
  Order,
  OrderStatus,
  Payment,
  ProductType,
  Settings,
  SpecialDay,
} from '../db/types'
import { isoDate, parseDay, today } from './format'

/** Durum seçenekleri (İptal ayrıca gösterilir) */
export const STATUS_ORDER: OrderStatus[] = ['onaylandi', 'teslim']

export const STATUS: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  onaylandi: { label: 'Onaylandı', cls: 'bg-sky-100 text-sky-800', dot: '#38bdf8' },
  teslim: { label: 'Teslim edildi', cls: 'bg-emerald-100 text-emerald-800', dot: '#10b981' },
  iptal: { label: 'İptal edildi', cls: 'bg-red-100 text-red-700', dot: '#ef4444' },
}

/** Açık (henüz teslim edilmemiş, iptal olmayan) sipariş */
export function isOpen(s: OrderStatus): boolean {
  return s === 'onaylandi'
}

export function productTypeOf(settings: Settings, key: string): ProductType {
  return (
    settings.productTypes.find((p) => p.key === key) ?? {
      key,
      label: key.charAt(0).toLocaleUpperCase('tr-TR') + key.slice(1),
      unit: 'adet',
      unitPrice: 0,
      color: '#999999',
      hasTiers: false,
    }
  )
}

export function orderSummary(o: Order, pt: ProductType): string {
  const parts = [pt.label]
  if (o.amount) parts.push(pt.unit === 'kişi' ? `${o.amount} kişilik` : `${o.amount} adet`)
  if (o.tiers && o.tiers > 1) parts.push(`${o.tiers} kat`)
  return parts.join(' · ')
}

export function paidTotal(payments: Payment[]): number {
  return payments.reduce((s, p) => s + (p.kind === 'iade' ? -p.amount : p.amount), 0)
}

export function depositTotal(payments: Payment[]): number {
  return payments.filter((p) => p.kind === 'kapora').reduce((s, p) => s + p.amount, 0)
}

export interface PriceParts {
  unitPrice?: number
  amount?: number
  extras: { amount: number }[]
  deliveryFee?: number
  discount?: number
}

/** Dilim (kişi) fiyatı × kişi sayısı + ekstralar + teslimat ücreti − indirim */
export function calcTotal(p: PriceParts): number {
  const base = (p.unitPrice || 0) * (p.amount || 0)
  const extras = p.extras.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  return Math.max(0, base + extras + (p.deliveryFee || 0) - (p.discount || 0))
}

/** Pazartesi = 0 ... Pazar = 6 */
export function weekdayIndex(date: string): number {
  return (getDay(parseDay(date)) + 6) % 7
}

export function capacityFor(settings: Settings, date: string): number {
  const o = settings.capacityOverrides[date]
  if (o !== undefined) return o
  return settings.weekdayCapacity[weekdayIndex(date)] ?? 0
}

export interface UpcomingDay {
  customer: Customer
  special: SpecialDay
  date: string
  inDays: number
  age?: number
}

/** Önümüzdeki N gün içindeki özel günler */
export function upcomingSpecialDays(customers: Customer[], withinDays: number, from = today()): UpcomingDay[] {
  const base = parseISO(from)
  const out: UpcomingDay[] = []
  for (const c of customers) {
    for (const s of c.specialDays ?? []) {
      let d = new Date(base.getFullYear(), s.month - 1, s.day)
      if (differenceInCalendarDays(d, base) < 0) d = addYears(d, 1)
      const inDays = differenceInCalendarDays(d, base)
      if (inDays <= withinDays) {
        out.push({
          customer: c,
          special: s,
          date: isoDate(d),
          inDays,
          age: s.year ? d.getFullYear() - s.year : undefined,
        })
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays)
}

export function specialDayText(u: Pick<UpcomingDay, 'special' | 'age'>): string {
  const s = u.special
  const who = s.person && s.person.toLocaleLowerCase('tr-TR') !== 'kendisi' ? `${s.person} – ` : ''
  const age = u.age && u.age > 0 ? ` (${u.age}. yıl)` : ''
  return `${who}${s.type}${age}`
}
