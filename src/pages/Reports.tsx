import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, format, startOfMonth } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '../db/db'
import { useCoreData } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { paidTotal, productTypeOf } from '../lib/domain'
import { money, num } from '../lib/format'
import { Card, CardHeader, IconButton, PageHeader, Stat, cx } from '../components/ui'

const compact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 })

export default function Reports() {
  const settings = useSettings()
  const data = useCoreData()
  const moves = useLiveQuery(() => db.stockMoves.toArray(), [])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const mk = format(month, 'yyyy-MM')

  const r = useMemo(() => {
    if (!data || !settings || !moves) return null
    const active = data.orders.filter((o) => o.status !== 'iptal')
    const inMonth = (d: string) => d.startsWith(mk)
    const monthOrders = active.filter((o) => inMonth(o.deliveryDate))
    const revenue = monthOrders.reduce((s, o) => s + o.agreedPrice, 0)
    const payments = [...data.paymentsByOrder.values()].flat()
    const collected = paidTotal(payments.filter((p) => inMonth(p.date)))
    const orderIds = new Set(monthOrders.map((o) => o.id))
    const cost = moves.filter((m) => m.type === 'cikis' && m.orderId && orderIds.has(m.orderId)).reduce((s, m) => s + m.quantity * m.unitCost, 0)
    const cancelled = data.orders.filter((o) => o.status === 'iptal' && inMonth(o.deliveryDate)).length

    // Son 12 ay
    const months = Array.from({ length: 12 }, (_, i) => format(addMonths(month, i - 11), 'yyyy-MM'))
    const series = months.map((m) => {
      const os = active.filter((o) => o.deliveryDate.startsWith(m))
      return { key: m, label: format(new Date(m + '-01T00:00'), 'MMM', { locale: tr }), value: os.reduce((s, o) => s + o.agreedPrice, 0), count: os.length }
    })
    const windowOrders = active.filter((o) => o.deliveryDate.slice(0, 7) >= months[0] && o.deliveryDate.slice(0, 7) <= months[11])

    const byType = new Map<string, { count: number; value: number }>()
    const byOccasion = new Map<string, number>()
    const byCustomer = new Map<string, { count: number; value: number }>()
    for (const o of windowOrders) {
      const t = byType.get(o.productType) ?? { count: 0, value: 0 }
      t.count++
      t.value += o.agreedPrice
      byType.set(o.productType, t)
      const oc = o.occasion || 'Belirtilmemiş'
      byOccasion.set(oc, (byOccasion.get(oc) ?? 0) + 1)
      const c = byCustomer.get(o.customerId) ?? { count: 0, value: 0 }
      c.count++
      c.value += o.agreedPrice
      byCustomer.set(o.customerId, c)
    }
    const receivables = active
      .map((o) => ({ o, bal: o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0) }))
      .filter((x) => x.bal > 0)
      .sort((a, b) => a.o.deliveryDate.localeCompare(b.o.deliveryDate))

    return {
      monthOrders,
      revenue,
      collected,
      cost,
      cancelled,
      series,
      types: [...byType.entries()].sort((a, b) => b[1].value - a[1].value),
      occasions: [...byOccasion.entries()].sort((a, b) => b[1] - a[1]),
      customers: [...byCustomer.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 10),
      receivables,
    }
  }, [data, settings, moves, mk, month])

  if (!settings || !data || !r) return null
  const monthName = format(month, 'LLLL yyyy', { locale: tr })
  const maxType = Math.max(1, ...r.types.map(([, v]) => v.value))
  const maxOcc = Math.max(1, ...r.occasions.map(([, v]) => v))

  return (
    <div>
      <PageHeader
        title="Raporlar"
        subtitle="Ciro, tahsilat ve en çok satanlar"
        actions={
          <div className="flex items-center gap-1">
            <IconButton label="Önceki ay" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft size={20} />
            </IconButton>
            <div className="min-w-[120px] text-center font-semibold capitalize">{monthName}</div>
            <IconButton label="Sonraki ay" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight size={20} />
            </IconButton>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ciro" value={money(r.revenue)} sub={`${r.monthOrders.length} sipariş · teslim tarihine göre`} />
        <Stat label="Tahsilat" value={money(r.collected)} sub="Bu ay alınan ödemeler" />
        <Stat label="Ortalama sipariş" value={money(r.monthOrders.length ? Math.round(r.revenue / r.monthOrders.length) : 0)} sub={r.cancelled ? `${r.cancelled} iptal` : undefined} />
        <Stat
          label="Malzeme maliyeti"
          value={money(r.cost)}
          sub={r.cost > 0 ? `Brüt kâr ${money(r.revenue - r.cost)}` : 'Siparişlere malzeme girilirse hesaplanır'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader title="Aylık ciro · son 12 ay" />
        <div className="px-2 pb-2">
          <RevenueChart series={r.series} selected={mk} onSelect={(k) => setMonth(new Date(k + '-01T00:00'))} />
        </div>
        <details className="border-t border-line px-4 py-2 text-sm">
          <summary className="cursor-pointer text-muted">Tablo olarak göster</summary>
          <table className="mt-2 w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">Ay</th>
                <th className="py-1 text-right font-medium">Sipariş</th>
                <th className="py-1 text-right font-medium">Ciro</th>
              </tr>
            </thead>
            <tbody>
              {r.series.map((s) => (
                <tr key={s.key} className="border-t border-line">
                  <td className="py-1 capitalize">{format(new Date(s.key + '-01T00:00'), 'LLLL yyyy', { locale: tr })}</td>
                  <td className="py-1 text-right">{s.count}</td>
                  <td className="py-1 text-right">{money(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ürünlere göre · son 12 ay" />
          <div className="space-y-3 px-4 pb-4">
            {r.types.map(([key, v]) => {
              const pt = productTypeOf(settings, key)
              return (
                <HBar
                  key={key}
                  label={
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: pt.color }} />
                      {pt.label}
                      <span className="text-muted">· {v.count} sipariş</span>
                    </span>
                  }
                  value={money(v.value)}
                  ratio={v.value / maxType}
                />
              )
            })}
            {!r.types.length && <div className="text-sm text-muted">Veri yok.</div>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Kutlama türleri · son 12 ay" />
          <div className="space-y-3 px-4 pb-4">
            {r.occasions.slice(0, 8).map(([k, v]) => (
              <HBar key={k} label={k} value={`${v} sipariş`} ratio={v / maxOcc} />
            ))}
            {!r.occasions.length && <div className="text-sm text-muted">Veri yok.</div>}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="En çok sipariş veren müşteriler · son 12 ay" />
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {r.customers.map(([cid, v], i) => (
                <tr key={cid} className="border-t border-line">
                  <td className="w-8 py-2 pl-4 text-muted">{i + 1}</td>
                  <td className="py-2">
                    <Link to={`/musteriler/${cid}`} className="hover:underline">
                      {data.customerById.get(cid)?.name ?? '—'}
                    </Link>
                  </td>
                  <td className="py-2 text-right text-muted">{v.count} sipariş</td>
                  <td className="py-2 pr-4 text-right font-medium">{money(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!r.customers.length && <div className="px-4 pb-4 text-sm text-muted">Veri yok.</div>}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={`Bekleyen tahsilatlar · ${money(r.receivables.reduce((s, x) => s + x.bal, 0))}`} />
          <table className="w-full text-sm tabular-nums">
            <tbody>
              {r.receivables.slice(0, 12).map(({ o, bal }) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="py-2 pl-4">
                    <Link to={`/siparisler/${o.id}`} className="hover:underline">
                      {data.customerById.get(o.customerId)?.name ?? '—'}
                    </Link>
                    <div className="text-xs text-muted">
                      #{o.no} · {format(new Date(o.deliveryDate + 'T00:00'), 'd MMM', { locale: tr })}
                    </div>
                  </td>
                  <td className="py-2 text-right text-muted">{money(o.agreedPrice)}</td>
                  <td className="py-2 pr-4 text-right font-medium text-red-600">{money(bal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!r.receivables.length && <div className="px-4 pb-4 text-sm text-muted">Bekleyen tahsilat yok. 🎉</div>}
        </Card>
      </div>
    </div>
  )
}

function HBar({ label, value, ratio }: { label: React.ReactNode; value: string; ratio: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-r bg-stone-100">
        <div className="h-full rounded-r bg-accent" style={{ width: `${Math.max(2, ratio * 100)}%` }} />
      </div>
    </div>
  )
}

function niceMax(v: number): number {
  if (v <= 0) return 1000
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p
  return 10 * p
}

function RevenueChart({
  series,
  selected,
  onSelect,
}: {
  series: { key: string; label: string; value: number; count: number }[]
  selected: string
  onSelect: (k: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  const H = 230
  const pad = { l: 44, r: 8, t: 22, b: 26 }
  const iw = Math.max(100, w - pad.l - pad.r)
  const ih = H - pad.t - pad.b
  const max = niceMax(Math.max(...series.map((s) => s.value)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const band = iw / series.length
  const bw = Math.min(24, band * 0.6)
  const y = (v: number) => pad.t + ih - (v / max) * ih
  const sel = series.findIndex((s) => s.key === selected)
  const tipIdx = hover ?? null

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={H} role="img" aria-label="Son 12 ayın aylık cirosu">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">
              {t >= 10000 ? compact.format(t) : num(t)}
            </text>
          </g>
        ))}
        {series.map((s, i) => {
          const x = pad.l + band * i + (band - bw) / 2
          const h = Math.max(0, (s.value / max) * ih)
          const r = Math.min(4, h)
          const top = pad.t + ih - h
          const isSel = i === sel
          return (
            <g key={s.key}>
              {h > 0 && (
                <path
                  d={`M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z`}
                  fill="var(--accent)"
                  opacity={isSel ? 1 : hover === i ? 0.75 : 0.42}
                />
              )}
              <text
                x={pad.l + band * i + band / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill={isSel ? 'var(--color-ink)' : 'var(--color-muted)'}
                fontWeight={isSel ? 600 : 400}
              >
                {s.label}
              </text>
              {isSel && s.value > 0 && (
                <text x={x + bw / 2} y={top - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)">
                  {compact.format(s.value)}
                </text>
              )}
              {/* geniş dokunma alanı */}
              <rect
                x={pad.l + band * i}
                y={pad.t}
                width={band}
                height={ih + pad.b}
                fill="transparent"
                className="cursor-pointer"
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onSelect(s.key)}
              />
            </g>
          )
        })}
        <line x1={pad.l} x2={pad.l + iw} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--color-muted)" strokeOpacity={0.4} strokeWidth={1} />
      </svg>
      {tipIdx !== null && (
        <div
          className={cx('pointer-events-none absolute z-10 rounded-xl border border-line bg-white px-3 py-2 text-sm shadow-lg')}
          style={{
            left: Math.min(Math.max(8, pad.l + band * tipIdx + band / 2 - 70), w - 148),
            top: Math.max(0, y(series[tipIdx].value) - 70),
            width: 140,
          }}
        >
          <div className="font-medium capitalize">{format(new Date(series[tipIdx].key + '-01T00:00'), 'LLLL yyyy', { locale: tr })}</div>
          <div className="tabular-nums">{money(series[tipIdx].value)}</div>
          <div className="text-xs text-muted">{series[tipIdx].count} sipariş</div>
        </div>
      )}
    </div>
  )
}
