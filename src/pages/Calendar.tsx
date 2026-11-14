import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek, eachDayOfInterval, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { AlertTriangle, ChevronLeft, ChevronRight, Gift, Lock, Plus } from 'lucide-react'
import { ordersWithWorkOn, replanOrders, setDayCapacity } from '../db/actions'
import { useCoreData, usePlanData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { productTypeOf, specialDayText, taskCovers, upcomingSpecialDays, weekdayIndex, capacityFor } from '../lib/domain'
import { WEEKDAYS, WEEKDAYS_SHORT, fmtDate, isoDate, today } from '../lib/format'
import { TONE, dayUsage, fmtHours, fmtMin, usageTone } from '../lib/schedule'
import { OrderRow } from '../components/shared'
import { ask, tell } from '../components/confirm'
import { Button, Card, IconButton, Input, LinkButton, NumberInput, PageHeader, cx, useToast } from '../components/ui'

export default function CalendarPage() {
  const settings = useSettings()
  const data = useCoreData()
  const plan = usePlanData()
  const toast = useToast()
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
    for (const u of upcomingSpecialDays(data.customers, 45, days[0])) {
      const arr = m.get(u.date) ?? []
      arr.push(u)
      m.set(u.date, arr)
    }
    return m
  }, [data, days])

  if (!settings || !data || !plan) return null
  const t = today()
  const monthKey = format(month, 'yyyy-MM')
  const dayOrders = (d: string) => data.orders.filter((o) => o.deliveryDate === d && o.status !== 'iptal').sort(sortByDelivery)
  const selOrders = dayOrders(selected)
  const selUsage = dayUsage(settings, plan.load, selected)
  const selTone = usageTone(selUsage)
  const selTasks = plan.tasks.filter((x) => taskCovers(x, selected))
  const defaultCap = settings.weekdayCapacity[weekdayIndex(selected)] ?? 0
  const isOverride = settings.capacityOverrides[selected] !== undefined

  /** Kapasiteyi değiştirir; o gündeki işler yeni kapasiteyi aşıyorsa yeniden yerleştirmeyi önerir */
  const changeCapacity = async (hours: number | undefined) => {
    await setDayCapacity([selected], hours)
    const newCap = Math.round((hours ?? defaultCap) * 60)
    if (selUsage.used > newCap) {
      const ids = await ordersWithWorkOn([selected])
      const ok = await ask(
        `${fmtDate(selected, 'd MMMM')} gününde ${fmtMin(selUsage.used)} iş planlı; yeni kapasite ${fmtHours(newCap)} saat.\nBu günde işi olan ${ids.length} siparişin işleri kapasiteye göre yeniden yerleştirilsin mi?`,
        { confirmLabel: 'Yeniden yerleştir', danger: false },
      )
      if (ok) await runReplan(ids)
    } else toast(hours === 0 ? 'Gün kapatıldı' : 'Kapasite güncellendi')
  }

  const runReplan = async (ids: string[] | null) => {
    const r = await replanOrders(ids, { includeManual: true })
    if (r.late.length) {
      const lines = r.late.map((l) => {
        const o = data.orders.find((x) => x.id === l.orderId)
        const c = o ? data.customerById.get(o.customerId)?.name : ''
        return `• ${c} (#${o?.no}) — ${o ? fmtDate(o.deliveryDate, 'd MMM') : ''}${l.earliest ? `, en erken ${fmtDate(l.earliest, 'd MMM EEE')}` : ''}`
      })
      await tell(`İşler yeniden yerleştirildi. Şu siparişler teslim tarihine kapasiteye sığmıyor:\n${lines.join('\n')}\n\nTeslim tarihini ileri almak için siparişi düzenleyin.`)
    } else toast(`${r.orders} siparişin işleri yeniden yerleştirildi`)
  }

  return (
    <div>
      <PageHeader
        title="Takvim"
        subtitle="Teslimler ve günlük üretim kapasitesi (saat)"
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

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
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
              const u = dayUsage(settings, plan.load, d)
              const tone = usageTone(u)
              const sp = specialsByDate.get(d)
              const note = settings.dayNotes?.[d]
              return (
                <button
                  type="button"
                  key={d}
                  data-date={d}
                  aria-label={fmtDate(d, 'd MMMM EEEE')}
                  onClick={() => setSelected(d)}
                  className={cx(
                    'relative flex min-h-[72px] flex-col items-stretch gap-1 border-r border-b border-line p-1 text-left transition sm:min-h-[108px] sm:p-1.5',
                    !inMonth && 'text-stone-400',
                    u.closed && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(120,113,108,0.08)_6px,rgba(120,113,108,0.08)_12px)]',
                    selected === d ? 'bg-accent-soft/60 ring-2 ring-accent ring-inset' : 'hover:bg-stone-50',
                    d < t && 'opacity-70',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cx(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px]',
                        d === t && 'bg-accent font-semibold text-white',
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {sp && <Gift size={13} className="text-accent" />}
                      {u.closed && <Lock size={12} className="text-stone-400" />}
                    </span>
                  </div>
                  {u.closed ? (
                    <div className={cx('truncate text-[10px] leading-tight', tone === 'asim' ? 'font-medium text-red-600' : 'text-stone-500')}>
                      {tone === 'asim' ? 'Kapalı · iş var!' : note || 'Kapalı'}
                    </div>
                  ) : d < t ? null : (
                    <>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200" title={`${fmtMin(u.used)} / ${fmtHours(u.cap)} sa`}>
                        <div className={cx('h-full', TONE[tone].bar)} style={{ width: `${Math.min(100, u.ratio * 100)}%` }} />
                      </div>
                      <div className={cx('hidden text-[10px] leading-tight sm:block', TONE[tone].text)}>
                        {fmtHours(u.used)}/{fmtHours(u.cap)} sa{note ? ` · ${note}` : ''}
                      </div>
                    </>
                  )}
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
                    {orders.slice(0, 2).map((o) => (
                      <span
                        key={o.id}
                        className={cx(
                          'truncate rounded px-1 py-0.5 text-[11px] leading-tight text-ink',
                          o.status === 'teklif' && 'border border-dashed border-stone-300 bg-transparent',
                        )}
                        style={o.status !== 'teklif' ? { background: productTypeOf(settings, o.productType).color + '33' } : undefined}
                      >
                        🎂 {data.customerById.get(o.customerId)?.name.split(' ')[0]}
                      </span>
                    ))}
                    {orders.length > 2 && <span className="text-[11px] text-muted">+{orders.length - 2} teslim</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted">
            {(['uygun', 'yogun', 'dolu', 'asim'] as const).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cx('h-2 w-4 rounded-full', TONE[k].bar)} />
                {TONE[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} /> Kapalı gün
            </span>
            <span>Çubuk: o gün planlanan üretim saati / günlük kapasite</span>
          </div>
        </Card>

        {/* Seçili gün */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-xl">{fmtDate(selected, 'd MMMM')}</div>
                <div className="text-sm text-muted">
                  {WEEKDAYS[weekdayIndex(selected)]}
                  {settings.dayNotes?.[selected] ? ` · ${settings.dayNotes[selected]}` : ''}
                </div>
              </div>
              <LinkButton size="sm" variant="primary" to={`/siparisler/yeni?tarih=${selected}`} icon={<Plus size={16} />}>
                Sipariş ekle
              </LinkButton>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-sm">
                <span className={TONE[selTone].text}>
                  {selUsage.closed ? 'Kapalı gün' : `${fmtMin(selUsage.used)} / ${fmtHours(selUsage.cap)} sa planlı`}
                </span>
                {!selUsage.closed && selUsage.cap > selUsage.used && <span className="text-muted">{fmtMin(selUsage.cap - selUsage.used)} boş</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div className={cx('h-full', TONE[selTone].bar)} style={{ width: `${Math.min(100, selUsage.ratio * 100)}%` }} />
              </div>
            </div>

            {selTone === 'asim' && selected >= t && (
              <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Bu güne kapasiteden fazla iş planlı{selUsage.closed ? ' (gün kapalı)' : ''}.
                </div>
                <Button size="sm" variant="primary" className="mt-2" onClick={async () => runReplan(await ordersWithWorkOn([selected]))}>
                  İşleri kapasiteye göre yeniden yerleştir
                </Button>
              </div>
            )}

            <CapacityEditor
              key={selected}
              current={capacityFor(settings, selected)}
              defaultCap={defaultCap}
              isOverride={isOverride}
              note={settings.dayNotes?.[selected] ?? ''}
              onSave={changeCapacity}
              onNote={(n) => setDayCapacity([selected], isOverride ? settings.capacityOverrides[selected] : undefined, n)}
            />
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

          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>Bu günün işleri</span>
              <Link to="/planlama" className="font-normal text-accent-ink">
                Üretim planı
              </Link>
            </div>
            {selTasks.length ? (
              <ul className="space-y-1.5">
                {selTasks.map((x) => {
                  const o = plan.orderById.get(x.orderId)
                  return (
                    <li key={x.id} className={cx('flex items-center gap-2 text-sm', x.done && 'text-muted line-through')}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o ? productTypeOf(settings, o.productType).color : '#ccc' }} />
                      <span className="min-w-0 flex-1 truncate">
                        {x.name} — {o ? data.customerById.get(o.customerId)?.name : ''}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">{fmtMin(x.alloc[selected] ?? 0)}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-sm text-muted">Bu güne planlanmış iş yok.</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function CapacityEditor({
  current,
  defaultCap,
  isOverride,
  note,
  onSave,
  onNote,
}: {
  current: number
  defaultCap: number
  isOverride: boolean
  note: string
  onSave: (hours: number | undefined) => void
  onNote: (n: string) => void
}) {
  const [hours, setHours] = useState<number | undefined>(current)
  const [noteDraft, setNoteDraft] = useState(note)
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="text-[13px] font-medium text-muted">Bu günün kapasitesi (çalışma saati)</div>
      <div className="flex flex-wrap items-center gap-2">
        <NumberInput className="w-24" value={hours} onChange={setHours} min={0} step={0.5} aria-label="Kapasite (saat)" />
        <Button variant="primary" disabled={hours === undefined || hours === current} onClick={() => onSave(hours === defaultCap ? undefined : hours)}>
          Kaydet
        </Button>
        {current > 0 ? (
          <Button
            icon={<Lock size={15} />}
            onClick={() => {
              setHours(0)
              onSave(0)
            }}
          >
            Günü kapat
          </Button>
        ) : (
          <Button
            onClick={() => {
              setHours(defaultCap)
              onSave(undefined)
            }}
          >
            Aç ({defaultCap} sa)
          </Button>
        )}
        {isOverride && current > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setHours(defaultCap)
              onSave(undefined)
            }}
          >
            Varsayılan ({defaultCap} sa)
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <Input className="h-10" placeholder="Not (Bayram, izin, fuar…)" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
        {noteDraft !== note && (
          <Button onClick={() => onNote(noteDraft)} className="h-10">
            Not kaydet
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">
        Kapalı (0 saat) günlere iş yerleştirilmez; o günlerin işleri önceki ya da sonraki açık günlere kayar. Birden fazla günü
        birlikte kapatmak için <Link to="/ayarlar" className="text-accent-ink underline">Ayarlar → Kapalı günler</Link>.
      </p>
    </div>
  )
}
