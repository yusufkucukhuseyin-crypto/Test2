import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek, eachDayOfInterval, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Gift, Plus } from 'lucide-react'
import { db } from '../db/db'
import { updateSettings } from '../db/actions'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import {
  TONE_STYLE,
  capacityFor,
  dayLoad,
  loadTone,
  productTypeOf,
  specialDayText,
  taskCovers,
  upcomingSpecialDays,
  weekdayIndex,
} from '../lib/domain'
import { WEEKDAYS, WEEKDAYS_SHORT, fmtDate, isoDate, num, today } from '../lib/format'
import { OrderRow } from '../components/shared'
import { Button, Card, IconButton, LinkButton, NumberInput, PageHeader, cx } from '../components/ui'

export default function CalendarPage() {
  const settings = useSettings()
  const data = useCoreData()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(today())

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(month, { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }).map(isoDate),
    [month],
  )

  const specialsByDate = useMemo(() => {
    const m = new Map<string, ReturnType<typeof upcomingSpecialDays>>()
    if (!data) return m
    const from = days[0]
    for (const u of upcomingSpecialDays(data.customers, 45, from)) {
      const arr = m.get(u.date) ?? []
      arr.push(u)
      m.set(u.date, arr)
    }
    return m
  }, [data, days])

  if (!settings || !data) return null
  const t = today()
  const monthKey = format(month, 'yyyy-MM')
  const dayOrders = (d: string) => data.orders.filter((o) => o.deliveryDate === d && o.status !== 'iptal').sort(sortByDelivery)
  const selOrders = dayOrders(selected)
  const selLoad = dayLoad(settings, data.orders, selected)
  const selTasks = (tasks ?? []).filter((x) => taskCovers(x, selected))
  const override = settings.capacityOverrides[selected]

  const setCapacity = (v: number | undefined) => {
    const next = { ...settings.capacityOverrides }
    if (v === undefined || v === settings.weekdayCapacity[weekdayIndex(selected)]) delete next[selected]
    else next[selected] = v
    updateSettings({ capacityOverrides: next })
  }

  return (
    <div>
      <PageHeader
        title="Takvim"
        subtitle="Teslim günleri ve kapasite doluluğu"
        actions={
          <div className="flex items-center gap-1">
            <IconButton label="Önceki ay" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft size={20} />
            </IconButton>
            <div className="min-w-[130px] text-center font-semibold capitalize">{format(month, 'LLLL yyyy', { locale: tr })}</div>
            <IconButton label="Sonraki ay" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight size={20} />
            </IconButton>
            <Button
              size="sm"
              onClick={() => {
                setMonth(startOfMonth(new Date()))
                setSelected(t)
              }}
            >
              Bugün
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-stone-50 text-center text-xs font-medium text-muted">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const inMonth = d.startsWith(monthKey)
              const orders = dayOrders(d)
              const l = dayLoad(settings, data.orders, d)
              const tone = loadTone(l)
              const sp = specialsByDate.get(d)
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setSelected(d)}
                  className={cx(
                    'relative flex min-h-[68px] flex-col items-stretch gap-1 border-r border-b border-line p-1 text-left transition sm:min-h-[104px] sm:p-1.5',
                    !inMonth && 'bg-stone-50/70 text-stone-400',
                    selected === d ? 'bg-accent-soft/60 ring-2 ring-accent ring-inset' : 'hover:bg-stone-50',
                    d < t && 'opacity-70',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[13px]',
                        d === t && 'bg-accent font-semibold text-white',
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {sp && <Gift size={13} className="text-accent" />}
                  </div>
                  {(l.capacity > 0 || l.load > 0) && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-stone-200">
                      <div className={cx('h-full', TONE_STYLE[tone].bar)} style={{ width: `${Math.min(100, l.ratio * 100)}%` }} />
                    </div>
                  )}
                  {l.capacity === 0 && l.load === 0 && <div className="text-[10px] text-stone-400">kapalı</div>}
                  {/* Telefonda noktalar, tablette etiketler */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {orders.slice(0, 6).map((o) => (
                      <span
                        key={o.id}
                        className={cx('h-1.5 w-1.5 rounded-full', o.status === 'teklif' && 'opacity-40')}
                        style={{ background: productTypeOf(settings, o.productType).color }}
                      />
                    ))}
                  </div>
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {orders.slice(0, 3).map((o) => (
                      <span
                        key={o.id}
                        className={cx(
                          'truncate rounded px-1 py-0.5 text-[11px] leading-tight text-ink',
                          o.status === 'teklif' && 'border border-dashed border-stone-300 bg-transparent',
                        )}
                        style={o.status !== 'teklif' ? { background: productTypeOf(settings, o.productType).color + '33' } : undefined}
                      >
                        {o.deliveryTime ? `${o.deliveryTime} ` : ''}
                        {data.customerById.get(o.customerId)?.name.split(' ')[0]}
                      </span>
                    ))}
                    {orders.length > 3 && <span className="text-[11px] text-muted">+{orders.length - 3} daha</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted">
            {(['uygun', 'yogun', 'dolu', 'kapali'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cx('h-2 w-4 rounded-full', TONE_STYLE[k].bar)} />
                {TONE_STYLE[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded border border-dashed border-stone-400" /> Teklif (kesinleşmemiş)
            </span>
          </div>
        </Card>

        {/* Seçili gün */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-xl">{fmtDate(selected, 'd MMMM')}</div>
                <div className="text-sm text-muted">{WEEKDAYS[weekdayIndex(selected)]}</div>
              </div>
              <LinkButton size="sm" variant="primary" to={`/siparisler/yeni?tarih=${selected}`} icon={<Plus size={16} />}>
                Sipariş ekle
              </LinkButton>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span className={TONE_STYLE[loadTone(selLoad)].text}>
                    {num(selLoad.load)} / {num(selLoad.capacity)} dolu
                  </span>
                  {selLoad.tentative > 0 && <span className="text-muted">+{num(selLoad.tentative)} teklif</span>}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={cx('h-full', TONE_STYLE[loadTone(selLoad)].bar)}
                    style={{ width: `${Math.min(100, selLoad.ratio * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-[13px] text-muted">Bu günün kapasitesi</span>
                <NumberInput value={capacityFor(settings, selected)} onChange={setCapacity} min={0} step={0.5} />
              </label>
              {override !== undefined && (
                <Button onClick={() => setCapacity(undefined)}>Varsayılan ({settings.weekdayCapacity[weekdayIndex(selected)]})</Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">0 yazarsanız gün kapalı sayılır. Varsayılanlar Ayarlar’dan değiştirilebilir.</p>
          </Card>

          {specialsByDate.get(selected) && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Gift size={16} className="text-accent" /> Özel günler
              </div>
              {specialsByDate.get(selected)!.map((u) => (
                <div key={u.special.id} className="text-sm">
                  <b>{u.customer.name}</b> · {specialDayText(u)}
                </div>
              ))}
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-sm font-semibold">Teslimler ({selOrders.length})</div>
            {selOrders.length ? (
              <div className="divide-y divide-line">
                {selOrders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    customer={data.customerById.get(o.customerId)}
                    settings={settings}
                    paid={data.paidByOrder.get(o.id) ?? 0}
                    showDate={false}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 pb-4 text-sm text-muted">Bu gün teslim yok.</div>
            )}
          </Card>

          {selTasks.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold">Bu günün işleri</div>
              <ul className="space-y-1.5">
                {selTasks.map((x) => {
                  const o = data.orders.find((y) => y.id === x.orderId)
                  return (
                    <li key={x.id} className={cx('flex items-center gap-2 text-sm', x.done && 'text-muted line-through')}>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: o ? productTypeOf(settings, o.productType).color : '#ccc' }}
                      />
                      {x.name} — {o ? data.customerById.get(o.customerId)?.name : ''}
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
