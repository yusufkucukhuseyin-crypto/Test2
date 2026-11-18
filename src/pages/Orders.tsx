import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckSquare, ClipboardList, Plus, Printer, Search, X } from 'lucide-react'
import { endOfWeek, startOfWeek } from 'date-fns'
import { STATUS, STATUS_ORDER, isOpen } from '../lib/domain'
import { TONE, countByDay, dayStatus, fmtCount } from '../lib/capacity'
import { fmtDate, isoDate, matches, relDay, today, money } from '../lib/format'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { OrderRow } from '../components/shared'
import { Button, Card, EmptyState, LinkButton, PageHeader, Segmented, Select, cx } from '../components/ui'
import type { OrderStatus } from '../db/types'

type Range = 'acik' | 'bugun' | 'hafta' | 'tum' | 'gecmis'

export default function Orders() {
  const settings = useSettings()
  const data = useCoreData()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const range = (params.get('g') as Range) ?? 'acik'
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [type, setType] = useState('')
  const [unpaid, setUnpaid] = useState(params.get('kalan') === '1')
  const nav = useNavigate()
  // Yazdırmak için seçim modu
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const [freeOnly, setFreeOnly] = useState(false)

  const filtered = useMemo(() => {
    if (!data) return []
    const t = today()
    const ws = isoDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
    const we = isoDate(endOfWeek(new Date(), { weekStartsOn: 1 }))
    const list = data.orders.filter((o) => {
      const c = data.customerById.get(o.customerId)
      if (!matches([c?.name, c?.phone, c?.whatsapp, String(o.no), o.occasion, o.cakeText, o.cardText, o.designNotes, o.filling], q)) return false
      if (status && o.status !== status) return false
      if (type && o.productType !== type) return false
      if (unpaid && (o.status === 'iptal' || o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0) <= 0)) return false
      if (freeOnly && !o.free) return false
      switch (range) {
        case 'acik':
          return isOpen(o.status)
        case 'bugun':
          return o.deliveryDate === t && o.status !== 'iptal'
        case 'hafta':
          return o.deliveryDate >= ws && o.deliveryDate <= we && o.status !== 'iptal'
        case 'gecmis':
          return o.deliveryDate < t || o.status === 'teslim'
        default:
          return true
      }
    })
    list.sort(sortByDelivery)
    if (range === 'gecmis') list.reverse()
    return list
  }, [data, q, range, status, type, unpaid, freeOnly])

  const groups = useMemo(() => {
    const m = new Map<string, typeof filtered>()
    for (const o of filtered) {
      const arr = m.get(o.deliveryDate) ?? []
      arr.push(o)
      m.set(o.deliveryDate, arr)
    }
    return [...m.entries()]
  }, [filtered])

  if (!settings || !data) return null
  const t = today()
  const counts = countByDay(data.orders)

  return (
    <div>
      <PageHeader
        title="Siparişler"
        subtitle={`${filtered.length} sipariş`}
        actions={
          <>
            <Button
              icon={selecting ? <X size={18} /> : <CheckSquare size={18} />}
              onClick={() => {
                setSelecting(!selecting)
                setPicked([])
              }}
            >
              {selecting ? 'Seçimi kapat' : 'Seç ve yazdır'}
            </Button>
            <LinkButton to="/siparisler/yeni" variant="primary" icon={<Plus size={18} />}>
              Yeni sipariş
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search size={18} className="text-muted" />
          <input
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-stone-400"
            placeholder="Müşteri, telefon, sipariş no, tema…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmented<Range>
            value={range}
            onChange={(v) => setParams(v === 'acik' ? {} : { g: v }, { replace: true })}
            options={[
              { value: 'acik', label: 'Açık' },
              { value: 'bugun', label: 'Bugün' },
              { value: 'hafta', label: 'Bu hafta' },
              { value: 'gecmis', label: 'Geçmiş' },
              { value: 'tum', label: 'Tümü' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select className="h-9 text-sm sm:w-auto" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Tüm durumlar</option>
            {[...STATUS_ORDER, 'iptal' as const].map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
          <Select className="h-9 text-sm sm:w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tüm ürünler</option>
            {settings.productTypes.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setUnpaid(!unpaid)}
            className={cx(
              'h-9 rounded-xl border px-3 text-sm',
              unpaid ? 'border-red-300 bg-red-50 text-red-700' : 'border-line bg-white text-ink',
            )}
          >
            Kalan ödemesi olanlar
          </button>
          <button
            type="button"
            onClick={() => setFreeOnly(!freeOnly)}
            className={cx(
              'h-9 rounded-xl border px-3 text-sm',
              freeOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-line bg-white text-ink',
            )}
          >
            Ücretsiz
          </button>
        </div>
      </div>

      {unpaid && filtered.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-800" data-testid="unpaid-summary">
          <span>{filtered.length} siparişte kalan ödeme var</span>
          <b className="tabular-nums">
            {money(filtered.reduce((s, o) => s + Math.max(0, o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0)), 0))}
          </b>
        </div>
      )}
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="Sipariş bulunamadı"
            text={data.orders.length ? 'Filtreleri değiştirmeyi deneyin.' : 'İlk siparişinizi ekleyerek başlayın.'}
            action={
              <LinkButton to="/siparisler/yeni" variant="primary" icon={<Plus size={18} />}>
                Yeni sipariş
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, orders]) => {
            const st = dayStatus(settings, counts, date)
            const tone = TONE[st.tone]
            return (
              <div key={date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <div className={cx('text-sm font-semibold', date < t && isOpen(orders[0].status) ? 'text-red-600' : 'text-ink')}>
                    {fmtDate(date, 'd MMMM EEEE')}
                    <span className="ml-2 font-normal text-muted">{relDay(date)}</span>
                  </div>
                  {date >= t && (
                    <span className={cx('text-xs font-medium', tone.text)} title="O günün doluluğu">
                      {st.closed ? 'Kapalı gün' : `${tone.label} · ${fmtCount(st)}`}
                    </span>
                  )}
                </div>
                <Card className="divide-y divide-line overflow-hidden">
                  {orders.map((o) => (
                    <OrderRow
                      key={o.id}
                      order={o}
                      customer={data.customerById.get(o.customerId)}
                      settings={settings}
                      paid={data.paidByOrder.get(o.id) ?? 0}
                      showDate={false}
                      selected={picked.includes(o.id)}
                      onToggle={selecting ? () => toggle(o.id) : undefined}
                    />
                  ))}
                </Card>
              </div>
            )
          })}
        </div>
      )}
      {selecting && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6" data-testid="print-bar">
          <div className="flex w-full max-w-xl flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
            <span className="mr-auto">{picked.length ? `${picked.length} sipariş seçildi` : 'Yazdırılacak siparişlere dokunun'}</span>
            <button
              type="button"
              className="rounded-lg px-2 py-1.5 font-medium text-white/80 hover:bg-white/10"
              onClick={() => setPicked(picked.length === filtered.length ? [] : filtered.map((o) => o.id))}
            >
              {picked.length === filtered.length && filtered.length > 0 ? 'Seçimi temizle' : `Tümünü seç (${filtered.length})`}
            </button>
            <Button
              size="sm"
              variant="primary"
              icon={<Printer size={16} />}
              disabled={!picked.length}
              onClick={() => {
                // Teslim sırasına göre
                const ids = filtered.filter((o) => picked.includes(o.id)).map((o) => o.id)
                nav(`/siparisler/yazdir?ids=${ids.join(',')}`)
              }}
            >
              Yazdır
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
