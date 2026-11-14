import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  Camera,
  Check,
  ChartGantt,
  Copy,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { db } from '../db/db'
import {
  addImages,
  addPayment,
  addStockMove,
  addTask,
  deleteOrder,
  deletePayment,
  deleteStockMove,
  regenerateTasks,
  setOrderStatus,
} from '../db/actions'
import type { ImageKind, Order, OrderImage, PaymentKind, Settings } from '../db/types'
import { STATUS, STATUS_ORDER, depositTotal, orderSummary, paidTotal, productTypeOf, taskEnd } from '../lib/domain'
import { fmtDate, fmtDateShort, money, num, relDay, telLink, today, waLink } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { CapacityHint, IMAGE_KINDS, StatusBadge, Thumb } from '../components/shared'
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
  Toggle,
  cx,
  useToast,
} from '../components/ui'
import { ask } from '../components/confirm'

type Tab = 'detay' | 'tasarim' | 'odeme' | 'uretim' | 'maliyet'

export default function OrderDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const settings = useSettings()
  const [tab, setTab] = useState<Tab>('detay')

  const data = useLiveQuery(async () => {
    const order = await db.orders.get(id)
    if (!order) return { order: null }
    const [customer, payments, images, tasks, moves] = await Promise.all([
      db.customers.get(order.customerId),
      db.payments.where('orderId').equals(id).sortBy('date'),
      db.images.where('orderId').equals(id).sortBy('createdAt'),
      db.tasks.where('orderId').equals(id).toArray(),
      db.stockMoves.where('orderId').equals(id).toArray(),
    ])
    return { order, customer, payments, images, tasks, moves }
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

  const { order, customer, payments = [], images = [], tasks = [], moves = [] } = data
  const pt = productTypeOf(settings, order.productType)
  const paid = paidTotal(payments)
  const balance = order.agreedPrice - paid
  const cost = moves.reduce((s, m) => s + m.quantity * m.unitCost, 0)

  const remove = async () => {
    if (!(await ask(`#${order.no} numaralı sipariş; görselleri, ödemeleri ve üretim adımlarıyla birlikte silinecek.`, { confirmLabel: 'Siparişi sil' }))) return
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
          {STATUS_ORDER.map((s, i) => {
            const idx = STATUS_ORDER.indexOf(order.status)
            const done = order.status !== 'iptal' && i <= idx
            return (
              <button
                type="button"
                key={s}
                onClick={() => changeStatus(s)}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
                  order.status === s ? 'bg-accent text-white' : done ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-stone-100',
                )}
              >
                {done && order.status !== s ? <Check size={14} /> : <span className="text-xs">{i + 1}</span>}
                {STATUS[s].label}
              </button>
            )
          })}
          <span className="mx-1 h-5 w-px shrink-0 bg-line" />
          <button
            type="button"
            onClick={() => changeStatus(order.status === 'iptal' ? 'teklif' : 'iptal')}
            className={cx(
              'shrink-0 rounded-full px-3 py-1.5 text-sm',
              order.status === 'iptal' ? 'bg-red-600 text-white' : 'text-red-600 hover:bg-red-50',
            )}
          >
            {order.status === 'iptal' ? 'İptal edildi (geri al)' : 'İptal et'}
          </button>
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
          <CapacityHint date={order.deliveryDate} />
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
          { value: 'uretim', label: 'Üretim planı', count: tasks.length },
          { value: 'maliyet', label: 'Malzeme / maliyet', count: moves.length },
        ]}
      />

      {tab === 'detay' && <DetailsTab order={order} customer={customer} />}
      {tab === 'tasarim' && <DesignTab order={order} images={images} />}
      {tab === 'odeme' && <PaymentsTab order={order} payments={payments} settings={settings} balance={balance} />}
      {tab === 'uretim' && <TasksTab order={order} tasks={tasks} />}
      {tab === 'maliyet' && <CostTab order={order} moves={moves} cost={cost} />}
    </div>
  )
}

/* ---------------- Detaylar ---------------- */

function DetailsTab({ order, customer }: { order: Order; customer?: import('../db/types').Customer }) {
  const rows: [string, ReactNode][] = [
    ['Kek cinsi', order.cakeType],
    ['Krema cinsi', order.creamType],
    ['İç dolgu / içerikler', order.filling],
    ['Tema', order.theme],
    ['Pasta üstü yazı', order.cakeText && `“${order.cakeText}”`],
    ['Kat sayısı', order.tiers],
    ['Tasarım beklentileri', order.designNotes],
    ['Tasarım onayı', order.designApproved ? '✓ Onaylandı' : 'Onay bekliyor'],
    ['Teslimat adresi', order.deliveryMethod === 'adres' ? order.deliveryAddress : undefined],
    ['Notlar', order.notes],
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
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
        {order.extras.length > 0 && (
          <div className="border-t border-line px-4 py-3">
            <div className="mb-1 text-sm text-muted">Ekstralar</div>
            {order.extras.map((e) => (
              <div key={e.id} className="flex justify-between text-[15px]">
                <span>{e.label}</span>
                <span className="tabular-nums">{money(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
      {customer && (
        <Card className="p-4">
          <div className="text-[13px] text-muted">Müşteri</div>
          <Link to={`/musteriler/${customer.id}`} className="mt-1 block text-lg font-semibold hover:underline">
            {customer.name}
          </Link>
          <div className="text-muted">{customer.phone}</div>
          {customer.instagram && <div className="text-sm text-muted">@{customer.instagram}</div>}
          <div className="mt-3 flex gap-2">
            <a href={telLink(customer.phone)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm">
              <Phone size={16} /> Ara
            </a>
            <a
              href={waLink(customer.phone)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
        </Card>
      )}
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
        <Toggle
          checked={!!order.designApproved}
          onChange={(v) => db.orders.update(order.id, { designApproved: v, updatedAt: Date.now() })}
          label="Tasarım müşteriyle onaylandı"
        />
        {order.designNotes && <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{order.designNotes}</p>}
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

/* ---------------- Üretim planı ---------------- */

function TasksTab({ order, tasks }: { order: Order; tasks: import('../db/types').Task[] }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [date, setDate] = useState(order.deliveryDate)
  const sorted = useMemo(() => [...tasks].sort((a, b) => a.start.localeCompare(b.start) || a.sort - b.sort), [tasks])

  return (
    <Card>
      <CardHeader
        title="İş adımları"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={<RotateCcw size={15} />}
              onClick={async () => {
                if (tasks.length && !(await ask('Mevcut adımlar silinip ürün şablonundan yeniden oluşturulsun mu?', { confirmLabel: 'Yeniden oluştur' }))) return
                await regenerateTasks(order.id)
                toast('Plan şablondan oluşturuldu')
              }}
            >
              Şablondan oluştur
            </Button>
            <LinkButton size="sm" to="/planlama" icon={<ChartGantt size={15} />}>
              Gantt
            </LinkButton>
          </div>
        }
      />
      <div className="divide-y divide-line border-t border-line">
        {sorted.map((t) => {
          const late = taskEnd(t) > order.deliveryDate
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                aria-label={t.done ? 'Yapılmadı olarak işaretle' : 'Yapıldı olarak işaretle'}
                onClick={() => db.tasks.update(t.id, { done: !t.done })}
                className={cx(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition',
                  t.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300',
                )}
              >
                {t.done && <Check size={16} />}
              </button>
              <InlineInput
                className={cx('min-w-0 flex-1 bg-transparent text-[15px] outline-none', t.done && 'text-muted line-through')}
                value={t.name}
                onSave={(v) => db.tasks.update(t.id, { name: v })}
              />
              <input
                type="date"
                value={t.start}
                onChange={(e) => e.target.value && db.tasks.update(t.id, { start: e.target.value })}
                className={cx('h-9 rounded-lg border px-2 text-sm', late ? 'border-red-300 text-red-700' : 'border-line')}
              />
              <select
                value={t.days}
                onChange={(e) => db.tasks.update(t.id, { days: Number(e.target.value) })}
                className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d} gün
                  </option>
                ))}
              </select>
              <IconButton label="Sil" onClick={() => db.tasks.delete(t.id)}>
                <Trash2 size={16} className="text-stone-400" />
              </IconButton>
              <div className="basis-full pl-10 text-xs text-muted">
                {fmtDateShort(t.start)}
                {t.days > 1 ? ` → ${fmtDateShort(taskEnd(t))}` : ''}
                {late && <span className="ml-2 font-medium text-red-600">Teslim tarihinden sonra!</span>}
              </div>
            </div>
          )
        })}
        {!tasks.length && <EmptyState title="Plan yok" text="Şablondan oluşturun veya adım ekleyin." />}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-line p-4">
        <Input className="min-w-[160px] flex-1" placeholder="Yeni adım (örn. Figür hazırlığı)" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          disabled={!name.trim() || !date}
          onClick={async () => {
            await addTask({ orderId: order.id, name: name.trim(), start: date, days: 1, done: false })
            setName('')
          }}
        >
          Ekle
        </Button>
      </div>
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
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
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

/** Yazarken değil, alandan çıkınca kaydeden metin kutusu */
function InlineInput({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [v, setV] = useState(value)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setV(value)
  }
  return (
    <input
      className={className}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}
