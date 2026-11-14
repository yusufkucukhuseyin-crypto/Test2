import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Clock, MapPin, Plus, Search, Store, Trash2, UserPlus } from 'lucide-react'
import { db } from '../db/db'
import type { Customer, Order, OrderImage, OrderStatus, Settings, SpecialDay } from '../db/types'
import { saveCustomer, type CustomerInput } from '../db/actions'
import { STATUS, dayLoad, loadTone, orderSummary, productTypeOf, TONE_STYLE } from '../lib/domain'
import { fmtDateShort, matches, money, MONTHS, num, uid } from '../lib/format'
import { useBlobUrl, useSettings } from '../lib/hooks'
import { Avatar, Badge, Button, ComboInput, Field, IconButton, Input, Modal, NumberInput, Select, Textarea, cx, useToast } from './ui'

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS[status]
  return <Badge className={s.cls}>{s.label}</Badge>
}

export function ProductDot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

/* ---------------- Sipariş satırı ---------------- */

export function OrderRow({
  order,
  customer,
  settings,
  paid,
  showDate = true,
}: {
  order: Order
  customer?: Customer
  settings: Settings
  paid: number
  showDate?: boolean
}) {
  const pt = productTypeOf(settings, order.productType)
  const balance = order.agreedPrice - paid
  return (
    <Link
      to={`/siparisler/${order.id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100"
    >
      <div className="w-1 self-stretch rounded-full" style={{ background: pt.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{customer?.name ?? 'Müşteri silinmiş'}</span>
          <span className="text-xs text-muted">#{order.no}</span>
        </div>
        <div className="truncate text-sm text-muted">
          {orderSummary(order, pt)}
          {order.occasion ? ` · ${order.occasion}` : ''}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {showDate && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {fmtDateShort(order.deliveryDate)}
              {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
            </span>
          )}
          {!showDate && order.deliveryTime && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} />
              {order.deliveryTime}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            {order.deliveryMethod === 'adres' ? <MapPin size={12} /> : <Store size={12} />}
            {order.deliveryMethod === 'adres' ? 'Adrese teslim' : 'Gel-al'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={order.status} />
        <span className="text-sm font-medium tabular-nums text-ink">{money(order.agreedPrice)}</span>
        {balance > 0 && order.status !== 'iptal' && (
          <span className="text-xs tabular-nums text-red-600">Kalan {money(balance)}</span>
        )}
      </div>
    </Link>
  )
}

/* ---------------- Kapasite göstergesi ---------------- */

export function CapacityHint({ date, excludeId, extraWeight = 0 }: { date: string; excludeId?: string; extraWeight?: number }) {
  const settings = useSettings()
  const orders = useLiveQuery(() => db.orders.where('deliveryDate').equals(date).toArray(), [date])
  if (!settings || !orders || !date) return null
  const l = dayLoad(settings, orders, date, excludeId)
  const after = { ...l, load: l.load + extraWeight, ratio: l.capacity ? (l.load + extraWeight) / l.capacity : Infinity }
  const tone = loadTone(after)
  const st = TONE_STYLE[tone]
  return (
    <div className={cx('mt-1.5 flex items-center gap-2 text-xs', st.text)}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-200">
        <span className={cx('block h-full', st.bar)} style={{ width: `${Math.min(100, (after.ratio || 0) * 100)}%` }} />
      </span>
      {l.capacity === 0
        ? 'Bu gün kapalı (kapasite 0)'
        : `Bu gün: ${num(l.load)} / ${num(l.capacity)} dolu${l.tentative ? ` · +${num(l.tentative)} teklif` : ''}${
            after.ratio > 1 ? ' — kapasite aşılıyor!' : ''
          }`}
    </div>
  )
}

/* ---------------- Müşteri seçici ---------------- */

export function CustomerPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), [])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const selected = customers?.find((c) => c.id === value)

  const list = useMemo(
    () => (customers ?? []).filter((c) => matches([c.name, c.phone, c.instagram], q)).slice(0, 30),
    [customers, q],
  )

  if (selected && !open) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2">
        <Avatar name={selected.name} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{selected.name}</div>
          <div className="text-sm text-muted">{selected.phone}</div>
          {selected.allergies && <div className="text-xs font-medium text-red-600">⚠ {selected.allergies}</div>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Değiştir
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search size={18} className="text-muted" />
        <input
          autoFocus={open}
          className="h-11 flex-1 bg-transparent outline-none placeholder:text-stone-400"
          placeholder="Müşteri ara (ad, telefon)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {list.map((c) => (
          <button
            type="button"
            key={c.id}
            onClick={() => {
              onChange(c.id)
              setOpen(false)
              setQ('')
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-50"
          >
            <Avatar name={c.name} className="h-8 w-8 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px]">{c.name}</div>
              <div className="text-xs text-muted">{c.phone}</div>
            </div>
            {c.id === value && <Check size={18} className="text-accent" />}
          </button>
        ))}
        {customers && list.length === 0 && <div className="px-3 py-3 text-sm text-muted">Eşleşen müşteri yok.</div>}
      </div>
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-full items-center gap-2 border-t border-line px-3 py-3 text-[15px] font-medium text-accent-ink hover:bg-accent-soft/40"
      >
        <UserPlus size={18} /> Yeni müşteri ekle{q ? `: “${q}”` : ''}
      </button>
      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        initialName={q}
        onSaved={(id) => {
          onChange(id)
          setCreating(false)
          setOpen(false)
          setQ('')
        }}
      />
    </div>
  )
}

/* ---------------- Müşteri formu ---------------- */

function emptyCustomer(name = ''): CustomerInput {
  return { name, phone: '', instagram: '', address: '', source: '', allergies: '', notes: '', specialDays: [] }
}

export function CustomerFormModal({
  open,
  onClose,
  customer,
  initialName,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customer?: Customer
  initialName?: string
  onSaved?: (id: string) => void
}) {
  const settings = useSettings()
  const toast = useToast()
  const [form, setForm] = useState<CustomerInput>(() => (customer ? { ...customer } : emptyCustomer(initialName)))
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setForm(customer ? { ...customer } : emptyCustomer(initialName))
  }
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = form.name.trim() && form.phone.trim()

  const save = async () => {
    if (!valid) return
    const id = await saveCustomer(
      {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        instagram: form.instagram?.replace(/^@/, '').trim(),
        specialDays: form.specialDays.filter((s) => s.month && s.day),
      },
      customer?.id,
    )
    toast(customer ? 'Müşteri güncellendi' : 'Müşteri eklendi')
    onSaved?.(id)
    onClose()
  }

  const updateSpecial = (id: string, patch: Partial<SpecialDay>) =>
    set(
      'specialDays',
      form.specialDays.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Müşteriyi düzenle' : 'Yeni müşteri'}
      wide
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Ad soyad" required>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Telefon" required>
          <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="05xx xxx xx xx" />
        </Field>
        <Field label="Instagram kullanıcı adı">
          <Input value={form.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="@kullanici" />
        </Field>
        <Field label="Bizi nereden buldu?">
          <ComboInput options={settings?.options.sources ?? []} value={form.source} onChange={(v) => set('source', v)} />
        </Field>
        <Field label="Adres" className="md:col-span-2">
          <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="Alerji / diyet" hint="Siparişlerde uyarı olarak gösterilir" className="md:col-span-2">
          <Input value={form.allergies ?? ''} onChange={(e) => set('allergies', e.target.value)} placeholder="Örn. fındık alerjisi, glütensiz" />
        </Field>
        <Field label="Notlar" className="md:col-span-2">
          <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="font-medium">Özel günler</div>
            <div className="text-xs text-muted">Yaklaşınca ana sayfada hatırlatılır</div>
          </div>
          <Button
            size="sm"
            variant="soft"
            icon={<Plus size={16} />}
            onClick={() =>
              set('specialDays', [
                ...form.specialDays,
                { id: uid(), type: settings?.options.specialDayTypes[0] ?? 'Doğum günü', person: '', month: 0, day: 0 },
              ])
            }
          >
            Ekle
          </Button>
        </div>
        <div className="space-y-2">
          {form.specialDays.map((s) => (
            <div key={s.id} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-2 sm:grid-cols-[1.2fr_1.2fr_.7fr_1fr_.8fr_auto]">
              <ComboInput
                options={settings?.options.specialDayTypes ?? []}
                value={s.type}
                onChange={(v) => updateSpecial(s.id, { type: v })}
                placeholder="Tür"
              />
              <Input value={s.person} onChange={(e) => updateSpecial(s.id, { person: e.target.value })} placeholder="Kimin? (Kızı Elif)" />
              <NumberInput value={s.day || undefined} onChange={(v) => updateSpecial(s.id, { day: v ?? 0 })} placeholder="Gün" min={1} max={31} />
              <Select value={s.month || ''} onChange={(e) => updateSpecial(s.id, { month: Number(e.target.value) })}>
                <option value="">Ay</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              <NumberInput value={s.year} onChange={(v) => updateSpecial(s.id, { year: v })} placeholder="Yıl" />
              <IconButton label="Sil" onClick={() => set('specialDays', form.specialDays.filter((x) => x.id !== s.id))}>
                <Trash2 size={18} className="text-red-600" />
              </IconButton>
            </div>
          ))}
          {form.specialDays.length === 0 && <div className="text-sm text-muted">Henüz özel gün eklenmedi.</div>}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Görseller ---------------- */

export const IMAGE_KINDS: { value: OrderImage['kind']; label: string; hint: string }[] = [
  { value: 'referans', label: 'Müşteri referansı', hint: 'Müşterinin gönderdiği örnekler' },
  { value: 'taslak', label: 'Taslak / görüşme', hint: 'Karşılıklı paylaşılan görseller' },
  { value: 'onay', label: 'Onaylanan tasarım', hint: 'Son anlaşılan görsel' },
  { value: 'final', label: 'Bitmiş ürün', hint: 'Katalogda gösterilir' },
]

export function Thumb({ image, onClick, className }: { image: OrderImage; onClick?: () => void; className?: string }) {
  const url = useBlobUrl(image.thumb)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('group relative aspect-square overflow-hidden rounded-xl border border-line bg-stone-100', className)}
    >
      {url && <img src={url} alt={image.caption ?? ''} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />}
    </button>
  )
}

export function FullImage({ image }: { image: OrderImage }) {
  const url = useBlobUrl(image.blob)
  return url ? <img src={url} alt={image.caption ?? ''} className="max-h-[60dvh] w-full rounded-xl object-contain" /> : null
}
