import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID()
    } catch {
      /* güvenli olmayan bağlamda olabilir */
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const moneyFmt = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function money(n: number | undefined | null): string {
  return moneyFmt.format(n ?? 0)
}

const numFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 })
export function num(n: number | undefined | null): string {
  return numFmt.format(n ?? 0)
}

/** Yerel tarih -> yyyy-MM-dd */
export function isoDate(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

export function today(): string {
  return isoDate(new Date())
}

export function parseDay(s: string): Date {
  return parseISO(s)
}

export function shiftDay(s: string, days: number): string {
  return isoDate(addDays(parseISO(s), days))
}

export function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b))
}

export function fmtDate(s: string | undefined, pattern = 'd MMMM yyyy'): string {
  if (!s) return ''
  return format(parseISO(s), pattern, { locale: tr })
}

export function fmtDateShort(s: string | undefined): string {
  return fmtDate(s, 'd MMM EEE')
}

export function fmtDateTime(ts: number): string {
  return format(new Date(ts), 'd MMM yyyy HH:mm', { locale: tr })
}

/** "Bugün", "Yarın", "3 gün sonra", "2 gün önce" */
export function relDay(s: string): string {
  const d = diffDays(s, today())
  if (d === 0) return 'Bugün'
  if (d === 1) return 'Yarın'
  if (d === -1) return 'Dün'
  if (d > 1) return `${d} gün sonra`
  return `${-d} gün önce`
}

export function trLower(s: string): string {
  return s.toLocaleLowerCase('tr-TR')
}

export function matches(haystack: (string | undefined)[], needle: string): boolean {
  const n = trLower(needle.trim())
  if (!n) return true
  return haystack.some((h) => h && trLower(h).includes(n))
}

/** Telefon numarasını wa.me için normalize eder (TR varsayılan) */
export function waLink(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '90' + digits.slice(1)
  else if (digits.length === 10) digits = '90' + digits
  return `https://wa.me/${digits}`
}

/** Müşterinin kısa iletişim bilgisi: telefon, yoksa WhatsApp kullanıcı adı, yoksa Instagram */
export function contactText(c: { phone?: string; whatsapp?: string; instagram?: string }): string {
  if (c.phone?.trim()) return c.phone
  if (c.whatsapp?.trim()) return `WhatsApp: ${c.whatsapp.replace(/^@/, '')}`
  if (c.instagram?.trim()) return `Instagram: @${c.instagram.replace(/^@/, '')}`
  return ''
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('')
}

export const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
