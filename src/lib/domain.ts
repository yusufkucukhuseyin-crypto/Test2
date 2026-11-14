import { addYears, differenceInCalendarDays, getDay, parseISO } from 'date-fns'
import type {
  Customer,
  Order,
  OrderStatus,
  Payment,
  ProductType,
  Settings,
  SpecialDay,
  Task,
} from '../db/types'
import { isoDate, parseDay, shiftDay, today, uid } from './format'

export const STATUS_ORDER: OrderStatus[] = [
  'teklif',
  'onaylandi',
  'kapora',
  'hazirlaniyor',
  'hazir',
  'teslim',
]

export const STATUS: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  teklif: { label: 'Teklif', cls: 'bg-stone-100 text-stone-700', dot: '#a8a29e' },
  onaylandi: { label: 'Onaylandı', cls: 'bg-sky-100 text-sky-800', dot: '#38bdf8' },
  kapora: { label: 'Kapora alındı', cls: 'bg-violet-100 text-violet-800', dot: '#a78bfa' },
  hazirlaniyor: { label: 'Hazırlanıyor', cls: 'bg-amber-100 text-amber-800', dot: '#f59e0b' },
  hazir: { label: 'Hazır', cls: 'bg-teal-100 text-teal-800', dot: '#14b8a6' },
  teslim: { label: 'Teslim edildi', cls: 'bg-emerald-100 text-emerald-800', dot: '#10b981' },
  iptal: { label: 'İptal', cls: 'bg-red-100 text-red-700', dot: '#ef4444' },
}

/** Kapasiteye dahil edilen (kesinleşmiş) durumlar */
export function isFirm(s: OrderStatus): boolean {
  return s !== 'teklif' && s !== 'iptal'
}

export function isOpen(s: OrderStatus): boolean {
  return s !== 'teslim' && s !== 'iptal'
}

export function productTypeOf(settings: Settings, key: string): ProductType {
  return (
    settings.productTypes.find((p) => p.key === key) ?? {
      key,
      label: key,
      unit: 'adet',
      unitPrice: 0,
      capacityWeight: 1,
      color: '#999999',
      hasTiers: false,
      tasks: [],
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

export function calcTotal(unitPrice: number | undefined, amount: number | undefined, extras: { amount: number }[]): number {
  const base = (unitPrice || 0) * (amount || 0)
  return base + extras.reduce((s, e) => s + (Number(e.amount) || 0), 0)
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

export interface DayLoad {
  load: number
  tentative: number
  count: number
  capacity: number
  ratio: number
}

export function dayLoad(settings: Settings, orders: Order[], date: string, excludeId?: string): DayLoad {
  let load = 0
  let tentative = 0
  let count = 0
  for (const o of orders) {
    if (o.deliveryDate !== date || o.id === excludeId) continue
    const w = productTypeOf(settings, o.productType).capacityWeight
    if (isFirm(o.status)) {
      load += w
      count++
    } else if (o.status === 'teklif') tentative += w
  }
  const capacity = capacityFor(settings, date)
  return { load, tentative, count, capacity, ratio: capacity > 0 ? load / capacity : load > 0 ? Infinity : 0 }
}

export function loadTone(l: DayLoad): 'bos' | 'uygun' | 'yogun' | 'dolu' | 'kapali' {
  if (l.capacity === 0) return l.load > 0 ? 'dolu' : 'kapali'
  if (l.ratio >= 1) return 'dolu'
  if (l.ratio >= 0.7) return 'yogun'
  if (l.load > 0) return 'uygun'
  return 'bos'
}

export const TONE_STYLE: Record<ReturnType<typeof loadTone>, { bar: string; text: string; label: string }> = {
  bos: { bar: 'bg-emerald-300', text: 'text-emerald-700', label: 'Boş' },
  uygun: { bar: 'bg-emerald-400', text: 'text-emerald-700', label: 'Uygun' },
  yogun: { bar: 'bg-amber-400', text: 'text-amber-700', label: 'Yoğun' },
  dolu: { bar: 'bg-red-400', text: 'text-red-700', label: 'Dolu' },
  kapali: { bar: 'bg-stone-300', text: 'text-stone-500', label: 'Kapalı' },
}

export function generateTasks(order: Pick<Order, 'id' | 'deliveryDate'>, pt: ProductType): Task[] {
  return pt.tasks.map((t, i) => ({
    id: uid(),
    orderId: order.id,
    name: t.name,
    start: shiftDay(order.deliveryDate, -t.offset),
    days: Math.max(1, t.days),
    done: false,
    sort: i,
  }))
}

export function taskEnd(t: Task): string {
  return shiftDay(t.start, t.days - 1)
}

export function taskCovers(t: Task, date: string): boolean {
  return t.start <= date && date <= taskEnd(t)
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
