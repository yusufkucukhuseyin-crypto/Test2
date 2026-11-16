import { useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  MapPin,
  Pencil,
  Printer,
  Store,
  Trash2,
} from 'lucide-react'
import { db } from '../db/db'
import {
  addImages,
  addPayment,
  addStockMove,
  deleteOrder,
  deletePayment,
  deleteStockMove,
  setOrderStatus,
} from '../db/actions'
import type { ImageKind, Order, OrderImage, PaymentKind, Settings } from '../db/types'
import { STATUS, depositTotal, orderSummary, paidTotal, productTypeOf } from '../lib/domain'
import { fmtDate, money, num, relDay, today } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { ContactInfo, IMAGE_KINDS, StatusBadge, Thumb } from '../components/shared'
import { ImageViewer } from '../components/ImageViewer'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  IconButton,
  Input,
  LinkButton,
  Modal,
  NumberInput,
  PageHeader,
  Select,
  Tabs,
  cx,
  useToast,
} from '../components/ui'
import { ask } from '../components/confirm'

type Tab = 'detay' | 'tasarim' | 'odeme' | 'maliyet'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const settings = useSettings()
  const [tab, setTab] = useState<Tab>('detay')

  const data = useLiveQuery(async () => {
    const order = await db.orders.get(id)
    if (!order) return { order: null }
    const [customer, payments, images, moves] = await Promise.all([
      db.customers.get(order.customerId),
      db.payments.where('orderId').equals(id).sortBy('date'),
      db.images.where('orderId').equals(id).sortBy('createdAt'),
      db.stockMoves.where('orderId').equals(id).toArray(),
    ])
    return { order, customer, payments, images, moves }
  }, [id])

  if (!settings || !data) return null
  if (!data.order)
    return (
      <EmptyState
        title="Sipariş bulunamadı"
        text="Silinmiş olabilir."
        action={<LinkButton to="/siparisler">Siparişlere dön</LinkButton>}
      />
    )

  const { order, customer, payments = [], images = [], moves = [] } = data
  const pt = productTypeOf(settings, order.productType)
  const paid = paidTotal(payments)
  const balance = order.agreedPrice - paid
  const cost = moves.reduce((s, m) => s + m.quantity * m.unitCost, 0)

  const remove = async () => {
    if (!(await ask(`#${order.no} numaralı sipariş; görselleri ve ödemeleriyle birlikte silinecek.`, { confirmLabel: 'Siparişi sil' }))) return
    await deleteOrder(order.id)
    toast('Sipariş silindi')
    nav('/siparisler', { replace: true })
  }

  const changeStatus = async (s: Order['status']) => {
    if (s === 'teslim' && balance > 0 && !(await ask(`Kalan ${money(balance)} ödeme var. Yine de teslim edildi olarak işaretlensin mi?`, { confirmLabel: 'Teslim edildi', danger: false }))) return
    await setOrderStatus(order.id, s)
    toast(`Durum: ${STATUS[s].label}`)
  }

  return (
    <div>
      <PageHeader
        back="/siparisler"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {customer?.name ?? 'Müşteri'} <span className="font-sans text-base text-muted">#{order.no}</span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: pt.color }} />
            {orderSummary(order, pt)}
            {order.occasion ? ` · ${order.occasion}` : ''}
            <StatusBadge status={order.status} />
          </span>
        }
        actions={
          <>
            <LinkButton to={`/siparisler/${order.id}/yazdir`} icon={<Printer size={16} />} size="sm" variant="primary">
              Yazdır
            </LinkButton>
            <LinkButton to={`/siparisler/${order.id}/duzenle`} icon={<Pencil size={16} />} size="sm">
              Düzenle
            </LinkButton>
            <LinkButton to={`/siparisler/yeni?kaynak=${order.id}`} icon={<Copy size={16} />} size="sm">
              Tekrarla
            </LinkButton>
            <IconButton label="Siparişi sil" onClick={remove}>
              <Trash2 size={18} className="text-red-600" />
            </IconButton>
          </>
        }
      />

      {customer?.allergies && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={18} /> <b>Alerji / diyet:</b> {customer.allergies}
        </div>
      )}

      {/* Durum adımları */}
      <Card className="mb-4 p-3">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          <span className="mr-1 shrink-0 text-sm text-muted">Durum:</span>
          {(['onaylandi', 'teslim', 'iptal'] as const).map((s) => (
            <button
              type="button"
              key={s}
              aria-pressed={order.status === s}
              onClick={() => order.status !== s && changeStatus(s)}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
                order.status === s
                  ? s === 'iptal'
                    ? 'bg-red-600 text-white'
                    : 'bg-accent text-white'
                  : s === 'iptal'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-muted hover:bg-stone-100',
              )}
            >
              {order.status === s && <Check size={14} />}
              {STATUS[s].label}
            </button>
          ))}
        </div>
      </Card>

      {/* Özet */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[13px] text-muted">Teslim</div>
          <div className="mt-1 font-semibold">
            {fmtDate(order.deliveryDate, 'd MMMM EEEE')}
            {order.deliveryTime ? `, ${order.deliveryTime}` : ''}
          </div>
          <div className="text-sm text-muted">
            {relDay(order.deliveryDate)} · {order.deliveryMethod === 'adres' ? 'Adrese teslim' : 'Gel-al'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[13px] text-muted">Anlaşılan tutar</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{money(order.agreedPrice)}</div>
          {order.calculatedTotal !== order.agreedPrice && (
            <div className="text-sm text-muted">Hesaplanan: {money(order.calculatedTotal)}</div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-[13px] text-muted">Ödeme</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-semibold tabular-nums">{money(paid)}</span>
            <span className="text-sm text-muted">alındı</span>
          </div>
          <div className={cx('text-sm font-medium tabular-nums', balance > 0 ? 'text-red-600' : 'text-emerald-700')}>
            {balance > 0 ? `Kalan ${money(balance)}` : balance < 0 ? `Fazla ödeme ${money(-balance)}` : 'Tamamı ödendi'}
          </div>
        </Card>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'detay', label: 'Detaylar' },
          { value: 'tasarim', label: 'Tasarım', count: images.length },
          { value: 'odeme', label: 'Ödemeler', count: payments.length },
          { value: 'maliyet', label: 'Malzeme / maliyet', count: moves.length },
        ]}
      />

      {tab === 'detay' && <DetailsTab order={order} customer={customer} unit={pt.unit} />}
      {tab === 'tasarim' && <DesignTab order={order} images={images} />}
      {tab === 'odeme' && <PaymentsTab order={order} payments={payments} settings={settings} balance={balance} />}
      {tab === 'maliyet' && <CostTab order={order} moves={moves} cost={cost} />}
    </div>
  )
}

/* ---------------- Detaylar ---------------- */

function DetailsTab({ order, customer, unit }: { order: Order; customer?: import('../db/types').Customer; unit: 'kişi' | 'adet' }) {
  const rows: [string, ReactNode][] = [
    ['Kek cinsi', order.cakeType],
    ['Krema cinsi', order.creamType],
    ['İç dolgu / içerikler', order.filling],
    ['Pasta üstü yazı', order.cakeText && `“${order.cakeText}”`],
    ['Tebrik kartı yazısı', order.cardText && `“${order.cardText}”`],
    ['Kat sayısı', order.tiers],
    ['Tasarım beklentileri', order.designNotes],
    [
      'Teslimat türü',
      <span key="teslimat" className="inline-flex items-center gap-1.5">
        {order.deliveryMethod === 'adres' ? <MapPin size={16} className="text-muted" /> : <Store size={16} className="text-muted" />}
        {order.deliveryMethod === 'adres' ? 'Adrese teslim' : 'Gel-al (müşteri alacak)'}
      </span>,
    ],
    ['Teslimat adresi', order.deliveryMethod === 'adres' ? order.deliveryAddress || 'Adres girilmemiş' : undefined],
    ['Notlar', order.notes],
  ]
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <dl className="divide-y divide-line">
          {rows
            .filter(([, v]) => v !== undefined && v !== '' && v !== null)
            .map(([k, v]) => (
              <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-3 text-[15px] sm:grid-cols-[180px_1fr]">
                <dt className="text-muted">{k}</dt>
                <dd className="whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
        </dl>
        <PriceBreakdown order={order} unit={unit} />
      </Card>
      {customer && (
        <Card className="p-4">
          <div className="text-[13px] text-muted">Müşteri</div>
          <Link to={`/musteriler/${customer.id}`} className="mt-1 block text-lg font-semibold hover:underline">
            {customer.name}
          </Link>
          <ContactInfo customer={customer} />
        </Card>
      )}
    </div>
  )
}

/** Dilim fiyatı × kişi, ekstralar, teslimat ücreti, indirim ve toplam */
function PriceBreakdown({ order, unit }: { order: Order; unit: 'kişi' | 'adet' }) {
  const base = (order.unitPrice || 0) * (order.amount || 0)
  const line = (label: ReactNode, value: ReactNode, strong?: boolean, key?: string) => (
    <div key={key} className={cx('flex justify-between gap-3 text-[15px]', strong && 'font-semibold')}>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <div className="space-y-1 border-t border-line px-4 py-3">
      <div className="mb-1 text-sm text-muted">Fiyat</div>
      {line(`${unit === 'kişi' ? 'Dilim fiyatı' : 'Adet fiyatı'} ${money(order.unitPrice)} × ${order.amount || 0}`, money(base))}
      {order.extras.map((e) => line(e.label || 'Ekstra', money(e.amount), false, e.id))}
      {!!order.deliveryFee && line('Adrese teslim ücreti', money(order.deliveryFee))}
      {!!order.discount && line('İndirim', `−${money(order.discount)}`)}
      {line('Hesaplanan toplam', money(order.calculatedTotal))}
      {order.agreedPrice !== order.calculatedTotal && line('Anlaşılan tutar', money(order.agreedPrice), true)}
    </div>
  )
}

/* ---------------- Tasarım / görseller ---------------- */

function DesignTab({ order, images }: { order: Order; images: OrderImage[] }) {
  const toast = useToast()
  const [viewer, setViewer] = useState<OrderImage | null>(null)
  const [busy, setBusy] = useState<ImageKind | null>(null)
  const inputs = useRef<Partial<Record<ImageKind, HTMLInputElement | null>>>({})

  const upload = async (kind: ImageKind, fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    setBusy(kind)
    try {
      await addImages(order.id, files, kind, order.productType)
      toast(`${files.length} görsel eklendi`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="text-[13px] text-muted">Tasarım beklentileri</div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{order.designNotes || 'Not girilmemiş.'}</p>
      </Card>
      {IMAGE_KINDS.map((k) => {
        const list = images.filter((i) => i.kind === k.value)
        return (
          <Card key={k.value}>
            <CardHeader
              title={
                <span>
                  {k.label} <span className="font-normal text-muted">· {k.hint}</span>
                </span>
              }
              action={
                <Button size="sm" variant="soft" icon={<Camera size={16} />} disabled={busy === k.value} onClick={() => inputs.current[k.value]?.click()}>
                  {busy === k.value ? 'Yükleniyor…' : 'Ekle'}
                </Button>
              }
            />
            <input
              ref={(el) => {
                inputs.current[k.value] = el
              }}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(k.value, e.target.files)
                e.target.value = ''
              }}
            />
            <div className="px-4 pb-4">
              {list.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {list.map((img) => (
                    <div key={img.id} className="relative">
                      <Thumb image={img} onClick={() => setViewer(img)} className="w-full" />
                      {img.inCatalog === 1 && (
                        <Badge className="absolute bottom-1 left-1 bg-white/90 text-accent-ink">Katalog</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted">Görsel yok.</div>
              )}
            </div>
          </Card>
        )
      })}
      <ImageViewer image={viewer} onClose={() => setViewer(null)} />
    </div>
  )
}

/* ---------------- Ödemeler ---------------- */

const KIND_LABEL: Record<PaymentKind, string> = { kapora: 'Kapora', odeme: 'Ödeme', iade: 'İade' }

function PaymentsTab({
  order,
  payments,
  settings,
  balance,
}: {
  order: Order
  payments: import('../db/types').Payment[]
  settings: Settings
  balance: number
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ kind: PaymentKind; amount?: number; method: string; date: string; note: string }>({
    kind: 'odeme',
    method: settings.options.paymentMethods[0] ?? 'Nakit',
    date: today(),
    note: '',
  })
  const start = (kind: PaymentKind) => {
    setForm({ kind, amount: kind === 'iade' ? undefined : Math.max(0, balance), method: form.method, date: today(), note: '' })
    setOpen(true)
  }
  const save = async () => {
    if (!form.amount) return
    await addPayment({ orderId: order.id, kind: form.kind, amount: form.amount, method: form.method, date: form.date, note: form.note })
    toast(`${KIND_LABEL[form.kind]} kaydedildi`)
    setOpen(false)
  }

  return (
    <Card>
      <CardHeader
        title="Ödeme hareketleri"
        action={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => start('kapora')}>
              + Kapora
            </Button>
            <Button size="sm" variant="primary" onClick={() => start('odeme')}>
              + Ödeme
            </Button>
          </div>
        }
      />
      <div className="px-4 pb-2 text-sm text-muted">
        Kapora toplamı: <b className="text-ink">{money(depositTotal(payments))}</b>
      </div>
      {payments.length ? (
        <div className="divide-y divide-line border-t border-line">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge className={p.kind === 'kapora' ? 'bg-violet-100 text-violet-800' : p.kind === 'iade' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}>
                    {KIND_LABEL[p.kind]}
                  </Badge>
                  <span className="text-sm text-muted">
                    {fmtDate(p.date)} · {p.method}
                  </span>
                </div>
                {p.note && <div className="mt-0.5 text-sm text-muted">{p.note}</div>}
              </div>
              <div className={cx('font-medium tabular-nums', p.kind === 'iade' && 'text-red-600')}>
                {p.kind === 'iade' ? '−' : ''}
                {money(p.amount)}
              </div>
              <IconButton
                label="Sil"
                onClick={async () => {
                  if (await ask('Ödeme kaydı silinsin mi?', { confirmLabel: 'Sil' })) await deletePayment(p.id)
                }}
              >
                <Trash2 size={16} className="text-stone-400" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Henüz ödeme yok" text="Kapora veya ödeme ekleyin." />
      )}
      <div className="flex justify-end border-t border-line px-4 py-2">
        <Button size="sm" variant="ghost" onClick={() => start('iade')}>
          İade ekle
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${KIND_LABEL[form.kind]} ekle`}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Vazgeç</Button>
            <Button variant="primary" disabled={!form.amount} onClick={save}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tutar">
            <NumberInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} autoFocus />
          </Field>
          <Field label="Tarih">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Tür">
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PaymentKind })}>
              <option value="kapora">Kapora</option>
              <option value="odeme">Ödeme</option>
              <option value="iade">İade</option>
            </Select>
          </Field>
          <Field label="Yöntem">
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {settings.options.paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
          <Field label="Not" className="col-span-2">
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        {balance > 0 && <div className="mt-3 text-sm text-muted">Şu anki kalan: {money(balance)}</div>}
      </Modal>
    </Card>
  )
}

/* ---------------- Malzeme / maliyet ---------------- */

function CostTab({ order, moves, cost }: { order: Order; moves: import('../db/types').StockMove[]; cost: number }) {
  const toast = useToast()
  const items = useLiveQuery(() => db.stockItems.orderBy('name').toArray(), [])
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState<number>()
  const byId = new Map((items ?? []).map((i) => [i.id, i]))
  const selected = byId.get(itemId)
  const profit = order.agreedPrice - cost

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader title="Kullanılan malzemeler" />
        {moves.length ? (
          <div className="divide-y divide-line border-t border-line">
            {moves.map((m) => {
              const it = byId.get(m.itemId)
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{it?.name ?? 'Silinmiş malzeme'}</div>
                    <div className="text-xs text-muted">
                      {num(m.quantity)} {it?.unit} × {money(m.unitCost)}
                    </div>
                  </div>
                  <div className="tabular-nums">{money(m.quantity * m.unitCost)}</div>
                  <IconButton
                    label="Geri al"
                    onClick={async () => {
                      if (!(await ask('Kullanım geri alınsın mı? Miktar stoğa geri eklenir.', { confirmLabel: 'Geri al' }))) return
                      await deleteStockMove(m.id)
                    }}
                  >
                    <Trash2 size={16} className="text-stone-400" />
                  </IconButton>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="Malzeme girilmedi" text="Bu sipariş için stoktan düşülen malzemeleri ekleyin; maliyet ve kâr otomatik hesaplanır." />
        )}
        <div className="flex flex-wrap gap-2 border-t border-line p-4">
          <Select className="min-w-[180px] flex-1" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Malzeme seçin…</option>
            {(items ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({num(i.quantity)} {i.unit})
              </option>
            ))}
          </Select>
          <NumberInput className="w-28" value={qty} onChange={setQty} placeholder={selected?.unit ?? 'Miktar'} />
          <Button
            variant="primary"
            disabled={!itemId || !qty}
            onClick={async () => {
              await addStockMove({ itemId, type: 'cikis', quantity: qty!, date: today(), orderId: order.id, note: `Sipariş #${order.no}` })
              toast('Stoktan düşüldü')
              setQty(undefined)
            }}
          >
            Stoktan düş
          </Button>
        </div>
        {items && !items.length && (
          <div className="px-4 pb-4 text-sm text-muted">
            Önce <Link to="/stok" className="text-accent-ink underline">Stok</Link> sayfasından malzeme ekleyin.
          </div>
        )}
      </Card>
      <Card className="p-4">
        <div className="space-y-2 text-[15px]">
          <div className="flex justify-between">
            <span className="text-muted">Anlaşılan tutar</span>
            <span className="tabular-nums">{money(order.agreedPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Malzeme maliyeti</span>
            <span className="tabular-nums">−{money(cost)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold">
            <span>Brüt kâr</span>
            <span className={cx('tabular-nums', profit < 0 && 'text-red-600')}>{money(profit)}</span>
          </div>
          {order.agreedPrice > 0 && cost > 0 && (
            <div className="text-right text-sm text-muted">Kâr marjı %{Math.round((profit / order.agreedPrice) * 100)}</div>
          )}
        </div>
      </Card>
    </div>
  )
}

/** Alandan çıkınca kaydeden sayı kutusu */
