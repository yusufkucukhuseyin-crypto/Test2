import type { Order, Settings } from '../db/types'
import { capacityFor } from './domain'
import { shiftDay } from './format'

/**
 * Kapasite = aynı gün teslim edilebilecek sipariş sayısı.
 * Varsayılan 2: hiç sipariş yoksa Uygun, 1 sipariş Yoğun, 2 sipariş Dolu, 3 ve üstü Kapasite aşıldı
 * (girilebilir, yalnızca uyarı verilir).
 */
export type Tone = 'uygun' | 'yogun' | 'dolu' | 'asim' | 'kapali'

export interface DayStatus {
  count: number
  cap: number
  tone: Tone
  closed: boolean
}

export const TONE: Record<Tone, { label: string; cell: string; chip: string; dot: string; text: string }> = {
  uygun: { label: 'Uygun', cell: 'bg-emerald-50', chip: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  yogun: { label: 'Yoğun', cell: 'bg-amber-50', chip: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', text: 'text-amber-700' },
  dolu: { label: 'Dolu', cell: 'bg-rose-100/70', chip: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', text: 'text-rose-700' },
  asim: { label: 'Kapasite aşıldı', cell: 'bg-red-100', chip: 'bg-red-600 text-white', dot: 'bg-red-600', text: 'text-red-700' },
  kapali: { label: 'Kapalı', cell: 'bg-stone-100', chip: 'bg-stone-200 text-stone-600', dot: 'bg-stone-400', text: 'text-stone-500' },
}

export function toneOf(count: number, cap: number): Tone {
  if (cap <= 0) return count > 0 ? 'asim' : 'kapali'
  if (count > cap) return 'asim'
  if (count === cap) return 'dolu'
  if (count > 0) return 'yogun'
  return 'uygun'
}

/** İptal edilmemiş siparişlerin teslim günlerine göre sayısı */
export function countByDay(orders: Order[], excludeOrderId?: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const o of orders) {
    if (o.status === 'iptal' || o.id === excludeOrderId) continue
    out[o.deliveryDate] = (out[o.deliveryDate] ?? 0) + 1
  }
  return out
}

export function dayStatus(settings: Settings, counts: Record<string, number>, date: string): DayStatus {
  const cap = capacityFor(settings, date)
  const count = counts[date] ?? 0
  return { count, cap, tone: toneOf(count, cap), closed: cap <= 0 }
}

/** Verilen günden itibaren kapasitesi dolmamış ilk gün */
export function nextAvailableDay(settings: Settings, counts: Record<string, number>, from: string, horizon = 180): string | null {
  for (let i = 0; i <= horizon; i++) {
    const d = shiftDay(from, i)
    const s = dayStatus(settings, counts, d)
    if (!s.closed && s.count < s.cap) return d
  }
  return null
}

/** "1/2 sipariş" */
export function fmtCount(s: Pick<DayStatus, 'count' | 'cap'>): string {
  return `${s.count}/${s.cap} sipariş`
}
