import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, FileDown, Printer } from 'lucide-react'
import { db } from '../db/db'
import { saveNodeAsHtml } from '../lib/printfile'
import type { OrderImage } from '../db/types'
import { STATUS, depositTotal, orderBase, paidTotal, productTypeOf } from '../lib/domain'
import { fmtDate, money } from '../lib/format'
import { blobToDataURL } from '../lib/image'
import { useSettings } from '../lib/hooks'
import { resolveAccent } from '../lib/color'
import { Button, cx } from '../components/ui'

const IMG_ORDER: OrderImage['kind'][] = ['onay', 'taslak', 'referans', 'final']
const IMG_LABEL: Record<OrderImage['kind'], string> = {
  onay: 'Onaylanan tasarım',
  taslak: 'Taslak',
  referans: 'Müşteri referansı',
  final: 'Bitmiş ürün',
}

export default function PrintOrder() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const settings = useSettings()
  const sheetRef = useRef<HTMLDivElement>(null)
  const [imgs, setImgs] = useState<{ id: string; kind: OrderImage['kind']; src: string }[]>([])

  const data = useLiveQuery(async () => {
    const order = await db.orders.get(id)
    if (!order) return { order: null }
    const [customer, payments, images, boxItems] = await Promise.all([
      db.customers.get(order.customerId),
      db.payments.where('orderId').equals(id).toArray(),
      db.images.where('orderId').equals(id).toArray(),
      db.stockItems.bulkGet((order.boxes ?? []).map((b) => b.itemId)),
    ])
    const boxes = (order.boxes ?? []).map((b, i) => `${boxItems[i]?.name ?? 'Kutu'} × ${b.qty}`).join(', ')
    return { order, customer, payments, images, boxes }
  }, [id])

  // Görseller dosyaya da gömülebilsin diye data URL olarak (en fazla 3; önce onaylanan tasarım)
  useEffect(() => {
    if (!data?.order) return
    const chosen = [...(data.images ?? [])].sort((a, b) => IMG_ORDER.indexOf(a.kind) - IMG_ORDER.indexOf(b.kind) || a.createdAt - b.createdAt).slice(0, 3)
    let alive = true
    Promise.all(chosen.map(async (i) => ({ id: i.id, kind: i.kind, src: await blobToDataURL(i.blob) }))).then((x) => alive && setImgs(x))
    return () => {
      alive = false
    }
  }, [data])

  useEffect(() => {
    if (!settings) return
    const a = resolveAccent(settings)
    const r = document.documentElement.style
    r.setProperty('--accent', a.accent)
    r.setProperty('--accent-soft', a.soft)
    r.setProperty('--accent-ink', a.ink)
  }, [settings])

  if (!settings || !data) return null
  if (!data.order) return <div className="p-6">Sipariş bulunamadı.</div>

  const { order, customer, payments = [] } = data
  const pt = productTypeOf(settings, order.productType)
  const paid = paidTotal(payments)
  const deposit = depositTotal(payments)
  const balance = order.agreedPrice - paid
  const unitWord = pt.unit === 'kişi' ? 'kişilik' : 'adet'
  const embedded = Boolean(import.meta.env.VITE_EMBED)

  const saveAsFile = async () => {
    if (sheetRef.current) await saveNodeAsHtml(sheetRef.current, `Sipariş #${order.no}`, `siparis-${order.no}.html`)
  }

  return (
    <div className="min-h-dvh bg-cream print:bg-white">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white/90 px-4 py-3 backdrop-blur print:hidden">
        <Button icon={<ArrowLeft size={16} />} onClick={() => nav(`/siparisler/${order.id}`)}>
          Geri
        </Button>
        <div className="flex-1" />
        <Button variant="primary" icon={<Printer size={16} />} onClick={() => window.print()}>
          Yazdır
        </Button>
        {embedded && (
          <Button icon={<FileDown size={16} />} onClick={saveAsFile}>
            Dosya olarak kaydet
          </Button>
        )}
      </div>
      {embedded && (
        <p className="mx-auto max-w-[820px] px-4 pt-3 text-sm text-muted print:hidden">
          Önizlemede yazdırma penceresi açılmazsa “Dosya olarak kaydet” ile fişi kaydedip açın ve oradan yazdırın.
        </p>
      )}

      <div className="px-4 py-4 print:p-0">
        <div
          ref={sheetRef}
          className="mx-auto max-w-[820px] rounded-2xl border border-line bg-white p-6 text-[14px] leading-snug text-ink shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          {/* Başlık */}
          <div className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: 'var(--accent)' }}>
            <div className="flex items-center gap-3">
              {settings.logo && <img src={settings.logo} alt="" className="h-14 w-14 object-contain" />}
              <div>
                <div className="font-display text-2xl leading-tight">{settings.businessName}</div>
                <div className="text-xs tracking-wide text-muted uppercase">Sipariş fişi</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold">#{order.no}</div>
              <div className="text-xs text-muted">Kayıt: {fmtDate(new Date(order.createdAt).toISOString().slice(0, 10), 'd MMM yyyy')}</div>
              <div className={cx('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium', STATUS[order.status].cls)}>{STATUS[order.status].label}</div>
            </div>
          </div>

          {customer?.allergies && (
            <div className="mt-3 rounded-lg border-2 border-red-500 px-3 py-2 font-semibold text-red-700">⚠ Alerji / diyet: {customer.allergies}</div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Box title="Müşteri">
              <div className="text-base font-semibold">{customer?.name ?? '—'}</div>
              {customer?.phone && <div>{customer.phone}</div>}
              {customer?.whatsapp && <div>WhatsApp: {customer.whatsapp}</div>}
              {customer?.instagram && <div>Instagram: @{customer.instagram}</div>}
            </Box>
            <Box title="Teslim">
              <div className="text-base font-semibold">
                {fmtDate(order.deliveryDate, 'd MMMM yyyy EEEE')}
                {order.deliveryTime ? `, ${order.deliveryTime}` : ''}
              </div>
              <div>{order.deliveryMethod === 'adres' ? 'Adrese teslim' : 'Gel-al (müşteri alacak)'}</div>
              {order.deliveryMethod === 'adres' && order.deliveryAddress && <div className="whitespace-pre-wrap">{order.deliveryAddress}</div>}
            </Box>
          </div>

          <Box title="Ürün" className="mt-4">
            <div className="text-base font-semibold">
              {pt.label}
              {order.amount ? ` · ${order.amount} ${unitWord}` : ''}
              {order.tiers && order.tiers > 1 ? ` · ${order.tiers} kat` : ''}
              {order.occasion ? ` · ${order.occasion}` : ''}
            </div>
            <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
              <Row k="Kek cinsi" v={order.cakeType} />
              <Row k="Krema cinsi" v={order.creamType} />
              <Row k="İç dolgu" v={order.filling} />
              <Row k="Pasta üstü yazı" v={order.cakeText && `“${order.cakeText}”`} />
              <Row k="Tebrik kartı" v={order.cardText && `“${order.cardText}”`} />
              <Row k="Kutu" v={data.boxes} />
              <Row k="Tasarım" v={order.designNotes} />
              <Row k="Notlar" v={order.notes} />
            </dl>
          </Box>

          {imgs.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {imgs.map((i) => (
                <figure key={i.id} className="break-inside-avoid">
                  <img src={i.src} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                  <figcaption className="mt-1 text-center text-xs text-muted">{IMG_LABEL[i.kind]}</figcaption>
                </figure>
              ))}
            </div>
          )}

          <Box title="Fiyat ve ödeme" className="mt-4 break-inside-avoid">
            <div className="space-y-1">
              {order.free ? (
                <Money k={`${pt.label}${order.amount ? ` · ${order.amount} ${unitWord}` : ''}`} v="Ücretsiz" strong />
              ) : (
                <>
                  <Money k={`Anlaşılan tutar · ${pt.label}${order.amount ? ` · ${order.amount} ${unitWord}` : ''}`} v={money(orderBase(order))} />
                  {order.extras.map((e) => (
                    <Money key={e.id} k={e.label || 'Ekstra'} v={money(e.amount)} />
                  ))}
                  {!!order.deliveryFee && <Money k="Adrese teslim ücreti" v={money(order.deliveryFee)} />}
                  {!!order.discount && <Money k="İndirim" v={`−${money(order.discount)}`} />}
                  <Money k="Toplam" v={money(order.agreedPrice)} strong />
                  {deposit > 0 && <Money k="Alınan kapora" v={money(deposit)} />}
                  {paid - deposit > 0 && <Money k="Diğer ödemeler" v={money(paid - deposit)} />}
                  <Money k={balance > 0 ? 'Kalan' : 'Ödeme'} v={balance > 0 ? money(balance) : 'Tamamı ödendi'} strong />
                </>
              )}
            </div>
          </Box>

          <div className="mt-6 grid grid-cols-2 gap-8 text-xs text-muted">
            <div className="border-t border-line pt-1">Hazırlayan</div>
            <div className="border-t border-line pt-1">Teslim alan</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Box({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-line p-3', className)}>
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</div>
      {children}
    </section>
  )
}

function Row({ k, v }: { k: string; v?: ReactNode }) {
  if (v === undefined || v === null || v === '') return null
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="whitespace-pre-wrap">{v}</dd>
    </>
  )
}

function Money({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-3', strong && 'border-t border-line pt-1 text-base font-semibold')}>
      <span className={strong ? '' : 'text-muted'}>{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  )
}
