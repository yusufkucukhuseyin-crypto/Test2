import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, FileDown, Printer } from 'lucide-react'
import { db } from '../db/db'
import type { Customer, Order, Settings } from '../db/types'
import { productTypeOf } from '../lib/domain'
import { contactText, fmtDate } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { resolveAccent } from '../lib/color'
import { saveNodeAsHtml } from '../lib/printfile'
import { Button, Segmented, cx } from '../components/ui'

/**
 * Seçilen siparişleri A4'e çoklu yazdırma: sayfa başına 6 (2×3) ya da 4 (2×2) sipariş kartı.
 * Yalnızca içerik (fiyat yok); kartlar kesim çizgisiyle ayrılır.
 */
type Layout = '6' | '4'
const LAYOUT_KEY = 'luma-toplu-yazdir'
const PAGE_MARGIN_MM = 8
const SHEET_W = 210 - 2 * PAGE_MARGIN_MM // 194 mm
const SHEET_H = 297 - 2 * PAGE_MARGIN_MM // 281 mm
const MM = 96 / 25.4

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === '4' ? '4' : '6'
  } catch {
    return '6'
  }
}

// Bu sayfa açıkken A4 kenar boşluğu
const PRINT_CSS = `@page { size: A4; margin: ${PAGE_MARGIN_MM}mm; }
@media screen { .luma-sheet { zoom: var(--z, 1); } }
@media print { .luma-sheet { box-shadow: none !important; margin: 0 !important; } }`

export default function PrintOrders() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const settings = useSettings()
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params])
  const [layout, setLayoutState] = useState<Layout>(readLayout)
  const [zoom, setZoom] = useState(1)
  const [overflow, setOverflow] = useState<string[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)
  const sheetsRef = useRef<HTMLDivElement>(null)

  const setLayout = (l: Layout) => {
    setLayoutState(l)
    try {
      localStorage.setItem(LAYOUT_KEY, l)
    } catch {
      /* yalnızca bu oturum */
    }
  }

  const data = useLiveQuery(async () => {
    const orders = (await db.orders.bulkGet(ids)).filter((o): o is Order => Boolean(o))
    orders.sort((a, b) => (a.deliveryDate + (a.deliveryTime ?? '99')).localeCompare(b.deliveryDate + (b.deliveryTime ?? '99')) || a.no - b.no)
    const customers = new Map((await db.customers.bulkGet([...new Set(orders.map((o) => o.customerId))])).filter(Boolean).map((c) => [c!.id, c!]))
    const boxIds = [...new Set(orders.flatMap((o) => (o.boxes ?? []).map((b) => b.itemId)))]
    const boxNames = new Map((await db.stockItems.bulkGet(boxIds)).filter(Boolean).map((b) => [b!.id, b!.name]))
    return { orders, customers, boxNames }
  }, [ids.join(',')])

  // Ekranda sayfayı genişliğe sığdır (sayfa veriler yüklendikten sonra çizilir)
  const ready = Boolean(settings && data)
  useEffect(() => {
    if (!ready || !wrapRef.current) return
    const ro = new ResizeObserver(([e]) => setZoom(Math.min(1, (e.contentRect.width - 4) / (SHEET_W * MM))))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [ready])

  useEffect(() => {
    if (!settings) return
    const a = resolveAccent(settings)
    const r = document.documentElement.style
    r.setProperty('--accent', a.accent)
    r.setProperty('--accent-soft', a.soft)
    r.setProperty('--accent-ink', a.ink)
  }, [settings])

  // Karta sığmayan içerik var mı
  useLayoutEffect(() => {
    if (!sheetsRef.current) return
    const over: string[] = []
    sheetsRef.current.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 2) over.push(el.dataset.card!)
    })
    setOverflow(over)
  }, [data, layout])

  if (!settings || !data) return null
  const per = layout === '6' ? 6 : 4
  const rows = layout === '6' ? 3 : 2
  const pages: Order[][] = []
  for (let i = 0; i < data.orders.length; i += per) pages.push(data.orders.slice(i, i + per))
  const embedded = Boolean(import.meta.env.VITE_EMBED)

  return (
    <div className="min-h-dvh bg-cream print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="sticky top-0 z-10 border-b border-line bg-white/90 px-4 py-3 backdrop-blur print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<ArrowLeft size={16} />} onClick={() => nav(-1)}>
            Geri
          </Button>
          <div className="mr-auto text-sm text-muted">
            {data.orders.length} sipariş · {pages.length} sayfa
          </div>
          <Segmented<Layout>
            value={layout}
            onChange={setLayout}
            options={[
              { value: '6', label: 'Sayfada 6' },
              { value: '4', label: 'Sayfada 4' },
            ]}
          />
          <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
            Yazdır
          </Button>
          {embedded && (
            <Button
              icon={<FileDown size={16} />}
              onClick={() =>
                sheetsRef.current && saveNodeAsHtml(sheetsRef.current, 'Siparişler', `siparisler-${data.orders.length}.html`, PRINT_CSS)
              }
            >
              Dosya olarak kaydet
            </Button>
          )}
        </div>
        {overflow.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-amber-800" data-testid="overflow-warning">
            <AlertTriangle size={16} />
            {overflow.length} siparişin içeriği karta sığmadı (#{overflow.join(', #')}).
            {layout === '6' ? ' “Sayfada 4” düzenini deneyin.' : ''}
          </div>
        )}
      </div>

      <div ref={wrapRef} className="px-2 py-4 print:p-0">
        <div ref={sheetsRef}>
          {pages.map((group, i) => (
            <div
              key={i}
              className="luma-sheet mx-auto mb-4 grid bg-white text-ink shadow-sm"
              data-testid="print-sheet"
              style={
                {
                  '--z': zoom,
                  width: `${SHEET_W}mm`,
                  height: `${SHEET_H}mm`,
                  gridTemplateColumns: '1fr 1fr',
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  breakAfter: i < pages.length - 1 ? 'page' : 'auto',
                  pageBreakAfter: i < pages.length - 1 ? 'always' : 'auto',
                } as React.CSSProperties
              }
            >
              {Array.from({ length: per }, (_, k) => {
                const o = group[k]
                return o ? (
                  <OrderCard key={o.id} order={o} customer={data.customers.get(o.customerId)} settings={settings} boxNames={data.boxNames} big={layout === '4'} />
                ) : (
                  <div key={`bos-${k}`} className="border border-dashed border-stone-200" />
                )
              })}
            </div>
          ))}
          {!data.orders.length && <p className="text-center text-muted">Yazdırılacak sipariş bulunamadı.</p>}
        </div>
      </div>
    </div>
  )
}

function OrderCard({
  order,
  customer,
  settings,
  boxNames,
  big,
}: {
  order: Order
  customer?: Customer
  settings: Settings
  boxNames: Map<string, string>
  big: boolean
}) {
  const pt = productTypeOf(settings, order.productType)
  const unit = pt.unit === 'kişi' ? 'kişilik' : 'adet'
  const boxes = (order.boxes ?? []).map((b) => `${boxNames.get(b.itemId) ?? 'Kutu'}${b.qty > 1 ? ` ×${b.qty}` : ''}`).join(', ')
  return (
    <div
      data-card={order.no}
      className={cx('overflow-hidden border border-dashed border-stone-400 p-[4mm] leading-snug', big ? 'text-[10.5pt]' : 'text-[9pt]')}
      style={{ breakInside: 'avoid' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={cx('font-semibold', big ? 'text-[13pt]' : 'text-[11pt]')}>
            <span className="text-muted">#{order.no}</span> {customer?.name ?? '—'}
          </div>
          {customer && <div className="text-muted">{contactText(customer)}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold">{fmtDate(order.deliveryDate, 'd MMM EEE')}</div>
          <div>{order.deliveryTime || ''}</div>
        </div>
      </div>
      <div className="mt-0.5">
        {order.deliveryMethod === 'adres' ? `Adrese teslim${order.deliveryAddress ? `: ${order.deliveryAddress}` : ''}` : 'Gel-al'}
      </div>
      {customer?.allergies && <div className="mt-1 font-semibold text-red-700">⚠ Alerji / diyet: {customer.allergies}</div>}
      <div className="my-[2mm] border-t border-stone-300" />
      <div className="font-semibold">
        {pt.label}
        {order.amount ? ` · ${order.amount} ${unit}` : ''}
        {order.tiers && order.tiers > 1 ? ` · ${order.tiers} kat` : ''}
        {order.occasion ? ` · ${order.occasion}` : ''}
        {order.status === 'iptal' ? ' · İPTAL' : ''}
      </div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-[2.5mm] gap-y-[0.6mm]">
        <Line k="Kek" v={order.cakeType} />
        <Line k="Krema" v={order.creamType} />
        <Line k="İç dolgu" v={order.filling} />
        <Line k="Yazı" v={order.cakeText && `“${order.cakeText}”`} />
        <Line k="Kart" v={order.cardText && `“${order.cardText}”`} />
        <Line k="Kutu" v={boxes} />
        <Line k="Tasarım" v={order.designNotes} />
        <Line k="Not" v={order.notes} />
      </dl>
    </div>
  )
}

function Line({ k, v }: { k: string; v?: ReactNode }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="whitespace-pre-wrap">{v}</dd>
    </>
  )
}
