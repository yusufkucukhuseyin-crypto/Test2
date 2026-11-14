import { useMemo } from 'react'
import { AlertTriangle, CalendarCheck, Clock } from 'lucide-react'
import type { Order, Task } from '../db/types'
import { usePlanData } from '../lib/data'
import { productTypeOf } from '../lib/domain'
import { fmtDate, today } from '../lib/format'
import { useSettings } from '../lib/hooks'
import {
  buildLoad,
  capMin,
  earliestFeasibleDelivery,
  fmtMin,
  nextOpenDay,
  planBackward,
  taskIssue,
  templateSteps,
} from '../lib/schedule'
import { Button, cx } from './ui'

/**
 * Sipariş formunda: seçilen teslim tarihine kapasiteye göre yetişip yetişmediğini gösterir,
 * yetişmiyorsa en erken uygun (ileri) tarihi önerir.
 */
export function PlanHint({
  productType,
  amount,
  deliveryDate,
  excludeOrderId,
  onPickDate,
}: {
  productType: string
  amount?: number
  deliveryDate: string
  excludeOrderId?: string
  onPickDate: (d: string) => void
}) {
  const settings = useSettings()
  const data = usePlanData()
  const t = today()

  const r = useMemo(() => {
    if (!settings || !data) return null
    const pt = productTypeOf(settings, productType)
    const steps = templateSteps(pt, amount)
    const total = steps.reduce((s, x) => s + x.minutes, 0)
    // Düzenlenen siparişin bitmemiş işleri hesaba katılmaz (yeniden yerleşecek)
    const base = excludeOrderId ? buildLoad(data.tasks.filter((x) => x.orderId !== excludeOrderId || x.done)) : data.load
    const earliest = earliestFeasibleDelivery(settings, steps, base, t)
    if (!deliveryDate || deliveryDate < t) return { total, earliest, plan: null, closed: false, days: [] as [string, number][] }
    const plan = planBackward(settings, steps, deliveryDate, base, t)
    const perDay = new Map<string, number>()
    for (const a of Object.values(plan?.allocs ?? {})) for (const [d, m] of Object.entries(a)) perDay.set(d, (perDay.get(d) ?? 0) + m)
    return {
      total,
      earliest,
      plan,
      closed: capMin(settings, deliveryDate) === 0,
      days: [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    }
  }, [settings, data, productType, amount, deliveryDate, excludeOrderId, t])

  if (!r || !settings) return null

  if (!deliveryDate) {
    return r.earliest ? (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
        <CalendarCheck size={16} className="text-accent" />
        <span>
          Kapasiteye göre en erken teslim: <b>{fmtDate(r.earliest, 'd MMMM EEEE')}</b>
        </span>
        <Button size="sm" variant="soft" onClick={() => onPickDate(r.earliest!)}>
          Bu tarihi seç
        </Button>
      </div>
    ) : null
  }
  if (deliveryDate < t) return null

  return (
    <div className="mt-2 space-y-2">
      {r.closed && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700">
          <AlertTriangle size={16} />
          <span>
            Bu gün <b>kapalı</b>
            {settings.dayNotes?.[deliveryDate] ? ` (${settings.dayNotes[deliveryDate]})` : ''}. Teslim açık bir güne alınabilir.
          </span>
          <Button size="sm" onClick={() => onPickDate(nextOpenDay(settings, deliveryDate))}>
            {fmtDate(nextOpenDay(settings, deliveryDate), 'd MMM EEE')}
          </Button>
        </div>
      )}
      {r.plan ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <div className="flex items-center gap-2">
            <CalendarCheck size={16} />
            <span>
              Kapasiteye uygun · toplam iş <b>{fmtMin(r.total)}</b>
            </span>
          </div>
          {r.days.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.days.map(([d, m]) => (
                <span key={d} className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-emerald-800">
                  {fmtDate(d, 'd MMM EEE')} · {fmtMin(m)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Bu tarihe kapasite yetmiyor ({fmtMin(r.total)} iş; aradaki günler dolu ya da kapalı).
              {r.earliest && (
                <>
                  {' '}
                  Kapasiteye uyan en erken teslim: <b>{fmtDate(r.earliest, 'd MMMM EEEE')}</b>.
                </>
              )}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.earliest && (
              <Button size="sm" variant="primary" onClick={() => onPickDate(r.earliest!)}>
                {fmtDate(r.earliest, 'd MMM')} tarihine al
              </Button>
            )}
            <span className="text-xs text-amber-800">
              Bu tarihte bırakırsanız işler bugünden itibaren yerleşir, yetişmeyen adımlar kırmızı görünür.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Sipariş detayında plan durumu */
export function OrderPlanStatus({ order, tasks }: { order: Order; tasks: Task[] }) {
  const t = today()
  if (!tasks.length) return <div className="mt-1.5 text-xs text-muted">Üretim planı yok</div>
  const open = tasks.filter((x) => !x.done)
  const total = tasks.reduce((s, x) => s + x.minutes, 0)
  const late = open.some((x) => taskIssue(x, order.deliveryDate, t) === 'gec')
  const overdue = open.some((x) => taskIssue(x, order.deliveryDate, t) === 'gecikmis')
  const doneMin = tasks.filter((x) => x.done).reduce((s, x) => s + x.minutes, 0)
  return (
    <div className={cx('mt-1.5 flex items-center gap-1.5 text-xs', late ? 'text-red-700' : overdue ? 'text-amber-700' : 'text-emerald-700')}>
      <Clock size={13} />
      {late
        ? 'Plan teslime yetişmiyor'
        : overdue
          ? 'Geride kalmış iş var'
          : open.length
            ? `Plan zamanında · ${fmtMin(total - doneMin)} iş kaldı`
            : 'Tüm işler tamamlandı'}
    </div>
  )
}
