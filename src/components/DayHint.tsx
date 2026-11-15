import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck, Lock } from 'lucide-react'
import { db } from '../db/db'
import type { Settings } from '../db/types'
import { TONE, countByDay, dayStatus, nextAvailableDay } from '../lib/capacity'
import { fmtDate, today } from '../lib/format'
import { Button, cx } from './ui'

/**
 * Sipariş formunda seçilen teslim gününün doluluğu.
 * Kapasite dolmuşsa uyarır ve en yakın uygun günü önerir; yine de kaydetmeye izin verir.
 */
export function DayHint({
  settings,
  date,
  excludeOrderId,
  onPickDate,
}: {
  settings: Settings
  date: string
  excludeOrderId?: string
  onPickDate: (d: string) => void
}) {
  const orders = useLiveQuery(() => db.orders.toArray(), [])
  if (!orders) return null
  const counts = countByDay(orders, excludeOrderId)
  const t = today()

  if (!date) {
    const next = nextAvailableDay(settings, counts, t)
    if (!next) return null
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 p-3 text-sm">
        <CalendarCheck size={16} className="text-accent" />
        <span>
          En yakın uygun gün: <b>{fmtDate(next, 'd MMMM EEEE')}</b>
        </span>
        <Button size="sm" onClick={() => onPickDate(next)}>
          Bu tarihi seç
        </Button>
      </div>
    )
  }

  const st = dayStatus(settings, counts, date)
  const after = st.count + 1
  const full = st.closed || after > st.cap
  const next = full ? nextAvailableDay(settings, counts, date < t ? t : date) : null
  const note = settings.dayNotes?.[date]

  return (
    <div
      data-testid="day-hint"
      className={cx('mt-3 rounded-xl p-3 text-sm', full ? 'bg-amber-50 text-amber-900' : 'bg-stone-50 text-ink')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('rounded-full px-2 py-0.5 text-xs font-medium', TONE[st.tone].chip)}>
          {st.closed ? (
            <span className="inline-flex items-center gap-1">
              <Lock size={11} /> Kapalı gün
            </span>
          ) : (
            TONE[st.tone].label
          )}
        </span>
        <span>
          {st.closed
            ? `${fmtDate(date, 'd MMMM')} kapalı${note ? ` (${note})` : ''}.`
            : st.count === 0
              ? `${fmtDate(date, 'd MMMM')} için başka sipariş yok.`
              : `${fmtDate(date, 'd MMMM')} için ${st.count} sipariş var (kapasite ${st.cap}).`}
        </span>
      </div>
      {full && !st.closed && (
        <div className="mt-1.5">Bu siparişle o gün {after} sipariş olacak. Uygunsa yine de kaydedebilirsiniz.</div>
      )}
      {next && next !== date && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span>
            En yakın uygun gün: <b>{fmtDate(next, 'd MMMM EEEE')}</b>
          </span>
          <Button size="sm" onClick={() => onPickDate(next)}>
            {fmtDate(next, 'd MMM')} tarihine al
          </Button>
        </div>
      )}
    </div>
  )
}
