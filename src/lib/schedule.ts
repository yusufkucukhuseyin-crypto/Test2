/**
 * Kapasiteye göre üretim planlama.
 *
 * - Her günün kapasitesi çalışma saatidir (Ayarlar'da haftanın günlerine göre, Takvim'de güne özel; 0 = kapalı).
 * - Her iş adımının süresi = sabit süre + kişi/adet başına ek süre.
 * - Geriye doğru (tam zamanında) planlama: adımlar teslim tarihinden geriye, sırayla, boş kapasitesi olan
 *   günlere yerleşir. Bir adım bir güne sığmazsa önceki günlere bölünür; kapalı ve dolu günler atlanır.
 * - Bugünden önceye taşması gerekirse sipariş o tarihe yetişmez: işler bugünden itibaren ileriye doğru
 *   yerleştirilir ve kapasiteye uyan en erken teslim tarihi önerilir.
 */
import type { Order, ProductType, Settings, Task, TaskTemplate } from '../db/types'
import { capacityFor } from './domain'
import { diffDays, shiftDay, uid } from './format'

export type Load = Record<string, number>
export type Alloc = Record<string, number>

/** Bir güne bundan küçük iş parçası bölünmez (dakika) */
export const MIN_CHUNK = 30
const MAX_SPAN = 400

export function capMin(settings: Settings, date: string): number {
  return Math.round(capacityFor(settings, date) * 60)
}

export function stepMinutes(t: Pick<TaskTemplate, 'fixedMin' | 'perUnitMin'>, amount?: number): number {
  return Math.max(0, Math.round((t.fixedMin || 0) + (t.perUnitMin || 0) * (amount || 0)))
}

export function fmtMin(m: number): string {
  const total = Math.round(m)
  const h = Math.floor(total / 60)
  const mm = total % 60
  if (!h) return `${mm} dk`
  if (!mm) return `${h} sa`
  return `${h} sa ${mm} dk`
}

export function fmtHours(m: number): string {
  const h = Math.round((m / 60) * 10) / 10
  return h.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
}

/** alloc'tan başlangıç / gün sayısını türetir */
export function withAlloc<T extends Pick<Task, 'alloc' | 'start' | 'days'>>(t: T, alloc: Alloc): T {
  const keys = Object.keys(alloc).sort()
  if (!keys.length) return { ...t, alloc }
  return { ...t, alloc, start: keys[0], days: diffDays(keys[keys.length - 1], keys[0]) + 1 }
}

export function allocDays(t: Pick<Task, 'alloc'>): string[] {
  return Object.keys(t.alloc ?? {}).sort()
}

/** Görevlerin günlük doluluğu (dakika) */
export function buildLoad(tasks: Task[]): Load {
  const load: Load = {}
  for (const t of tasks) for (const [d, m] of Object.entries(t.alloc ?? {})) load[d] = (load[d] ?? 0) + m
  return load
}

export function freeMin(settings: Settings, load: Load, date: string): number {
  return Math.max(0, capMin(settings, date) - (load[date] ?? 0))
}

export interface DayUsage {
  used: number
  cap: number
  ratio: number
  closed: boolean
}

export function dayUsage(settings: Settings, load: Load, date: string): DayUsage {
  const cap = capMin(settings, date)
  const used = load[date] ?? 0
  return { used, cap, ratio: cap ? used / cap : used ? Infinity : 0, closed: cap === 0 }
}

export type Tone = 'bos' | 'uygun' | 'yogun' | 'dolu' | 'asim' | 'kapali'

export function usageTone(u: DayUsage): Tone {
  if (u.closed) return u.used > 0 ? 'asim' : 'kapali'
  if (u.used > u.cap) return 'asim'
  if (u.ratio >= 0.9) return 'dolu'
  if (u.ratio >= 0.6) return 'yogun'
  if (u.used > 0) return 'uygun'
  return 'bos'
}

export const TONE: Record<Tone, { bar: string; text: string; label: string }> = {
  bos: { bar: 'bg-emerald-300', text: 'text-emerald-700', label: 'Boş' },
  uygun: { bar: 'bg-emerald-400', text: 'text-emerald-700', label: 'Uygun' },
  yogun: { bar: 'bg-amber-400', text: 'text-amber-700', label: 'Yoğun' },
  dolu: { bar: 'bg-orange-500', text: 'text-orange-700', label: 'Dolu' },
  asim: { bar: 'bg-red-500', text: 'text-red-700', label: 'Kapasite aşıldı' },
  kapali: { bar: 'bg-stone-300', text: 'text-stone-500', label: 'Kapalı' },
}

/* ---------------- Yerleştirme ---------------- */

export interface Step {
  key: string
  name: string
  minutes: number
  offset: number
}

/** Geriye doğru doldurur; başarısızsa null. load'u yerinde günceller. */
function fillBackward(settings: Settings, load: Load, minutes: number, latest: string, minDate: string | null): Alloc | null {
  const alloc: Alloc = {}
  let day = latest
  if (minutes <= 0) {
    // Süresi olmayan adım: en geç açık güne işaretle
    for (let i = 0; i < MAX_SPAN; i++, day = shiftDay(day, -1)) {
      if (minDate && day < minDate) return null
      if (capMin(settings, day) > 0) return { [day]: 0 }
    }
    return null
  }
  let remaining = minutes
  for (let i = 0; i < MAX_SPAN && remaining > 0; i++, day = shiftDay(day, -1)) {
    if (minDate && day < minDate) return null
    const free = freeMin(settings, load, day)
    if (free >= Math.min(MIN_CHUNK, remaining)) {
      const take = Math.min(free, remaining)
      alloc[day] = take
      load[day] = (load[day] ?? 0) + take
      remaining -= take
    }
  }
  return remaining > 0 ? null : alloc
}

/** İleriye doğru doldurur (her zaman yerleştirir). load'u yerinde günceller. */
export function fillForward(settings: Settings, load: Load, minutes: number, earliest: string): Alloc {
  const alloc: Alloc = {}
  let day = earliest
  if (minutes <= 0) {
    for (let i = 0; i < MAX_SPAN; i++, day = shiftDay(day, 1)) if (capMin(settings, day) > 0) return { [day]: 0 }
    return { [earliest]: 0 }
  }
  let remaining = minutes
  for (let i = 0; i < MAX_SPAN && remaining > 0; i++, day = shiftDay(day, 1)) {
    const free = freeMin(settings, load, day)
    if (free >= Math.min(MIN_CHUNK, remaining)) {
      const take = Math.min(free, remaining)
      alloc[day] = take
      load[day] = (load[day] ?? 0) + take
      remaining -= take
    }
  }
  // Ufukta kapasite bulunamadıysa kalanı son güne yaz (aşım olarak görünür)
  if (remaining > 0) alloc[earliest] = (alloc[earliest] ?? 0) + remaining
  return alloc
}

export function planBackward(
  settings: Settings,
  steps: Step[],
  delivery: string,
  base: Load,
  minDate: string | null,
): { allocs: Record<string, Alloc>; load: Load } | null {
  const load = { ...base }
  const allocs: Record<string, Alloc> = {}
  let nextStart = delivery
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]
    const target = shiftDay(delivery, -Math.max(0, s.offset))
    const latest = target < nextStart ? target : nextStart
    const a = fillBackward(settings, load, s.minutes, latest, minDate)
    if (!a) return null
    allocs[s.key] = a
    nextStart = Object.keys(a).sort()[0]
  }
  return { allocs, load }
}

export function planForward(
  settings: Settings,
  steps: Step[],
  from: string,
  base: Load,
): { allocs: Record<string, Alloc>; load: Load; earliestDelivery: string } {
  const load = { ...base }
  const allocs: Record<string, Alloc> = {}
  let earliest = from
  let delivery = from
  for (const s of steps) {
    const a = fillForward(settings, load, s.minutes, earliest)
    allocs[s.key] = a
    const keys = Object.keys(a).sort()
    const end = keys[keys.length - 1]
    earliest = end
    const need = shiftDay(end, Math.max(0, s.offset))
    if (need > delivery) delivery = need
  }
  return { allocs, load, earliestDelivery: nextOpenDay(settings, delivery) }
}

export function nextOpenDay(settings: Settings, date: string): string {
  let d = date
  for (let i = 0; i < 60; i++, d = shiftDay(d, 1)) if (capMin(settings, d) > 0) return d
  return date
}

/** Bugünden itibaren kapasiteye uyan en erken teslim tarihi */
export function earliestFeasibleDelivery(settings: Settings, steps: Step[], base: Load, from: string, horizon = 120): string | null {
  let d = from
  for (let i = 0; i < horizon; i++, d = shiftDay(d, 1)) {
    if (capMin(settings, d) === 0) continue
    if (planBackward(settings, steps, d, base, from)) return d
  }
  return null
}

export interface PlanResult {
  allocs: Record<string, Alloc>
  load: Load
  /** Teslim tarihine yetişmiyor (ileriye planlandı) */
  late: boolean
  /** Kapasiteye uyan en erken teslim tarihi (yalnızca late ise) */
  earliest?: string | null
}

/** Önce tam zamanında (geriye) dener; sığmazsa bugünden ileriye yerleştirir. */
export function planSteps(settings: Settings, steps: Step[], delivery: string, base: Load, today: string | null): PlanResult {
  const back = planBackward(settings, steps, delivery, base, today)
  if (back) return { ...back, late: false }
  const from = today ?? delivery
  const fwd = planForward(settings, steps, from, base)
  return { allocs: fwd.allocs, load: fwd.load, late: true, earliest: earliestFeasibleDelivery(settings, steps, base, from) ?? fwd.earliestDelivery }
}

/** Ürün şablonundan (henüz planlanmamış) görevler */
export function templateTasks(order: Pick<Order, 'id' | 'deliveryDate' | 'amount'>, pt: ProductType): Task[] {
  return pt.tasks.map((t, i) => ({
    id: uid(),
    orderId: order.id,
    name: t.name,
    minutes: stepMinutes(t, order.amount),
    offset: t.offset,
    alloc: {},
    start: order.deliveryDate,
    days: 1,
    done: false,
    sort: i,
    tpl: true,
  }))
}

export function templateSteps(pt: ProductType, amount?: number): Step[] {
  return pt.tasks.map((t, i) => ({ key: String(i), name: t.name, minutes: stepMinutes(t, amount), offset: t.offset }))
}

/** Görev teslimden sonra mı bitiyor / gecikmiş mi */
export function taskIssue(t: Task, delivery: string, today: string): 'gec' | 'gecikmis' | null {
  if (t.done) return null
  const days = allocDays(t)
  if (!days.length) return null
  if (days[days.length - 1] > delivery) return 'gec'
  if (days[0] < today) return 'gecikmis'
  return null
}
