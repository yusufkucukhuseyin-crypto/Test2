import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList, Plus, Search } from 'lucide-react'
import { endOfWeek, startOfWeek } from 'date-fns'
import { STATUS, STATUS_ORDER, isOpen } from '../lib/domain'
import { TONE, dayUsage, fmtHours, usageTone } from '../lib/schedule'
import { fmtDate, isoDate, matches, relDay, today } from '../lib/format'
import { useCoreData, usePlanData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { OrderRow } from '../components/shared'
import { Card, EmptyState, LinkButton, PageHeader, Segmented, Select, cx } from '../components/ui'
import type { OrderStatus } from '../db/types'

type Range = 'acik' | 'bugun' | 'hafta' | 'tum' | 'gecmis'

export default function Orders() {
  const settings = useSettings()
  const data = useCoreData()
  const plan = usePlanData()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const range = (params.get('g') as Range) ?? 'acik'
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [type, setType] = useState('')
  const [unpaid, setUnpaid] = useState(params.get('kalan') === '1')

  const filtered = useMemo(() => {
    if (!data) return []
    const t = today()
    const ws = isoDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
    const we = isoDate(endOfWeek(new Date(), { weekStartsOn: 1 }))
    const list = data.orders.filter((o) => {
      const c = data.customerById.get(o.customerId)
      if (!matches([c?.name, c?.phone, String(o.no), o.theme, o.occasion, o.cakeText, o.designNotes], q)) return false
      if (status && o.status !== status) return false
      if (type && o.productType !== type) return false
      if (unpaid && (o.status === 'iptal' || o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0) <= 0)) return false
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
  }, [data, q, range, status, type, unpaid])

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

  return (
    <div>
      <PageHeader
        title="Siparişler"
        subtitle={`${filtered.length} sipariş`}
        actions={
          <LinkButton to="/siparisler/yeni" variant="primary" icon={<Plus size={18} />}>
            Yeni sipariş
          </LinkButton>
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
              'col-span-2 h-9 rounded-xl border px-3 text-sm sm:col-span-1',
              unpaid ? 'border-red-300 bg-red-50 text-red-700' : 'border-line bg-white text-ink',
            )}
          >
            Kalan ödemesi olanlar
          </button>
        </div>
      </div>

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
            const u = plan ? dayUsage(settings, plan.load, date) : null
            const tone = u ? TONE[usageTone(u)] : null
            return (
              <div key={date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <div className={cx('text-sm font-semibold', date < t && isOpen(orders[0].status) ? 'text-red-600' : 'text-ink')}>
                    {fmtDate(date, 'd MMMM EEEE')}
                    <span className="ml-2 font-normal text-muted">{relDay(date)}</span>
                  </div>
                  {date >= t && u && tone && (
                    <span className={cx('text-xs', tone.text)} title="O günün üretim doluluğu">
                      {u.closed ? 'Kapalı gün' : `${fmtHours(u.used)}/${fmtHours(u.cap)} sa dolu`}
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
                    />
                  ))}
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
