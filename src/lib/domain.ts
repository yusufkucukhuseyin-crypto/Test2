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
import { isoDate, parseDay, shiftDay, today } from './format'

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

/** Görevin çalışıldığı son gün */
export function taskEnd(t: Task): string {
  const keys = Object.keys(t.alloc ?? {}).sort()
  return keys.length ? keys[keys.length - 1] : shiftDay(t.start, Math.max(1, t.days) - 1)
}

/** Görev o gün çalışılıyor mu (kapalı günler arada kalsa da yalnızca dağıtılan günler) */
export function taskCovers(t: Task, date: string): boolean {
  if (t.alloc && Object.keys(t.alloc).length) return date in t.alloc
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
