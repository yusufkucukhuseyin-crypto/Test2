import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek, eachDayOfInterval, format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { AlertTriangle, ChevronLeft, ChevronRight, Gift, Lock, Plus } from 'lucide-react'
import { setDayCapacity } from '../db/actions'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { productTypeOf, specialDayText, upcomingSpecialDays, weekdayIndex, capacityFor } from '../lib/domain'
import { WEEKDAYS, WEEKDAYS_SHORT, fmtDate, isoDate, today } from '../lib/format'
import { TONE, countByDay, dayStatus, fmtCount } from '../lib/capacity'
import { OrderRow } from '../components/shared'
import { Button, Card, IconButton, Input, LinkButton, NumberInput, PageHeader, cx, useToast } from '../components/ui'

export default function CalendarPage() {
  const settings = useSettings()
  const data = useCoreData()
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

  if (!settings || !data) return null
  const t = today()
  const monthKey = format(month, 'yyyy-MM')
  const counts = countByDay(data.orders)
  const dayOrders = (d: string) => data.orders.filter((o) => o.deliveryDate === d && o.status !== 'iptal').sort(sortByDelivery)
  const selOrders = dayOrders(selected)
  const sel = dayStatus(settings, counts, selected)
  const defaultCap = settings.weekdayCapacity[weekdayIndex(selected)] ?? 0
  const isOverride = settings.capacityOverrides[selected] !== undefined

  const changeCapacity = async (count: number | undefined) => {
    await setDayCapacity([selected], count)
    toast(count === 0 ? 'Gün kapatıldı' : 'Kapasite güncellendi')
  }

  return (
    <div>
      <PageHeader
        title="Takvim"
        subtitle="Teslimler ve günlük doluluk (aynı gün teslim edilecek sipariş sayısı)"
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
              const st = dayStatus(settings, counts, d)
              const colored = d >= t && inMonth
              const sp = specialsByDate.get(d)
              const note = settings.dayNotes?.[d]
              return (
                <button
                  type="button"
                  key={d}
                  data-date={d}
                  data-tone={colored ? st.tone : undefined}
                  aria-label={`${fmtDate(d, 'd MMMM EEEE')}${colored ? ` · ${TONE[st.tone].label}` : ''}`}
                  onClick={() => setSelected(d)}
                  className={cx(
                    'relative flex min-h-[72px] flex-col items-stretch gap-1 border-r border-b border-line p-1 text-left transition sm:min-h-[108px] sm:p-1.5',
                    !inMonth && 'text-stone-400',
                    colored && TONE[st.tone].cell,
                    st.closed && 'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(120,113,108,0.08)_6px,rgba(120,113,108,0.08)_12px)]',
                    selected === d ? 'ring-2 ring-accent ring-inset' : 'hover:brightness-[0.97]',
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
                      {st.closed && <Lock size={12} className="text-stone-400" />}
                    </span>
                  </div>
                  {colored && (
                    <div className={cx('truncate text-[10px] leading-tight font-medium', TONE[st.tone].text)}>
                      {st.closed ? (st.count ? 'Kapalı · sipariş var!' : note || 'Kapalı') : `${TONE[st.tone].label}${st.count ? ` · ${st.count}/${st.cap}` : ''}`}
                      {!st.closed && note ? <span className="hidden sm:inline"> · {note}</span> : null}
                    </div>
                  )}
                  {/* Telefonda noktalar, tablette etiketler */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {orders.slice(0, 6).map((o) => (
                      <span
                        key={o.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: productTypeOf(settings, o.productType).color }}
                      />
                    ))}
                  </div>
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {orders.slice(0, 2).map((o) => (
                      <span
                        key={o.id}
                        className="truncate rounded bg-white/80 px-1 py-0.5 text-[11px] leading-tight text-ink"
                        style={{ borderLeft: `3px solid ${productTypeOf(settings, o.productType).color}` }}
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
                <span className={cx('h-2.5 w-2.5 rounded-full', TONE[k].dot)} />
                {TONE[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} /> Kapalı gün
            </span>
            <span>Günlük kapasite: {settings.weekdayCapacity[0]} sipariş (Ayarlar’dan değişir)</span>
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

            <div className="mt-4 flex items-center gap-2">
              <span className={cx('rounded-full px-2.5 py-1 text-sm font-medium', TONE[sel.tone].chip)}>{TONE[sel.tone].label}</span>
              <span className="text-sm text-muted">{sel.closed ? 'Kapalı gün' : fmtCount(sel)}</span>
            </div>

            {sel.tone === 'asim' && selected >= t && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                {sel.closed ? 'Gün kapalı ama teslim edilecek sipariş var.' : `Bu güne kapasiteden fazla sipariş girildi (${fmtCount(sel)}).`}
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
  onSave: (count: number | undefined) => void
  onNote: (n: string) => void
}) {
  const [hours, setHours] = useState<number | undefined>(current)
  const [noteDraft, setNoteDraft] = useState(note)
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div className="text-[13px] font-medium text-muted">Bu günün kapasitesi (sipariş sayısı)</div>
      <div className="flex flex-wrap items-center gap-2">
        <NumberInput className="w-24" value={hours} onChange={setHours} min={0} step={1} aria-label="Kapasite (sipariş)" />
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
            Aç ({defaultCap} sipariş)
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
            Varsayılan ({defaultCap} sipariş)
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
        Kapalı (0) günler takvimde taralı görünür ve sipariş girerken uyarı verilir. Birden fazla günü birlikte kapatmak için <Link to="/ayarlar" className="text-accent-ink underline">Ayarlar → Kapalı günler</Link>.
      </p>
    </div>
  )
}
