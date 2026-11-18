import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { db } from '../db/db'
import { addImages, createOrder, updateOrder, type OrderInput } from '../db/actions'
import type { ImageKind, OrderBox, OrderImage, OrderStatus, PriceExtra } from '../db/types'
import { BOX_CATEGORY } from '../db/defaults'
import { STATUS, calcTotal, extrasSum, orderBase, orderTotal, productTypeOf } from '../lib/domain'
import { money, num, parseDay, today, uid } from '../lib/format'
import { useBlobUrl, useSettings } from '../lib/hooks'
import { CustomerPicker, IMAGE_KINDS } from '../components/shared'
import { DayHint } from '../components/DayHint'
import {
  Button,
  Card,
  ChipSelect,
  ComboInput,
  MultiChipSelect,
  Field,
  IconButton,
  Input,
  NumberInput,
  PageHeader,
  Segmented,
  Select,
  Textarea,
  Toggle,
  cx,
  useToast,
} from '../components/ui'
import { tell } from '../components/confirm'

type Form = Omit<OrderInput, 'customerId'> & { customerId: string }

function emptyForm(date?: string): Form {
  return {
    customerId: '',
    productType: 'pasta',
    occasion: '',
    amount: undefined,
    tiers: 1,
    cakeType: '',
    creamType: '',
    filling: '',
    cakeText: '',
    cardText: '',
    designNotes: '',
    notes: '',
    deliveryDate: date ?? '',
    deliveryTime: '',
    deliveryMethod: 'gelal',
    deliveryAddress: '',
    unitPrice: undefined,
    extras: [],
    deliveryFee: undefined,
    discount: undefined,
    basePrice: undefined,
    free: false,
    boxes: [],
    calculatedTotal: 0,
    agreedPrice: 0,
    status: 'onaylandi',
  }
}

interface PendingImage {
  id: string
  file: File
  url: string
  kind: ImageKind
}

export default function OrderForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const toast = useToast()
  const settings = useSettings()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<Form>(() => {
    const f = emptyForm(params.get('tarih') ?? undefined)
    // Fiyat listesindeki "Bu fiyatla sipariş oluştur"dan gelen değerler
    const num = (k: string) => (params.get(k) ? Number(params.get(k)) || undefined : undefined)
    return { ...f, productType: params.get('tur') ?? f.productType, amount: num('kisi'), discount: num('indirim') }
  })
  const [loaded, setLoaded] = useState(!isEdit && !params.get('kaynak'))
  // Anlaşılan tutar elle değiştirilene kadar fiyat listesinden (dilim fiyatı × kişi) gelir
  const [baseTouched, setBaseTouched] = useState(isEdit)
  // Düzenlemede siparişin şu anda stoktan düşülmüş kutuları (kalan stok hesabı için)
  const [origBoxes, setOrigBoxes] = useState<OrderBox[]>([])
  const boxItems = useLiveQuery(() => db.stockItems.where('category').equals(BOX_CATEGORY).sortBy('createdAt'), [])
  const [deposit, setDeposit] = useState<{ amount?: number; method: string; date: string }>({
    method: '',
    date: today(),
  })
  const [pending, setPending] = useState<PendingImage[]>([])
  // Düzenlemede siparişin mevcut görselleri: kaldırılanlar ve türü değişenler kayıtta uygulanır
  const existingImages = useLiveQuery(
    () => (isEdit && id ? db.images.where('orderId').equals(id).sortBy('createdAt') : Promise.resolve([] as OrderImage[])),
    [id, isEdit],
  )
  const [removedImages, setRemovedImages] = useState<string[]>([])
  const [kindChanges, setKindChanges] = useState<Record<string, ImageKind>>({})
  const [copyImageId] = useState(params.get('gorsel') ?? undefined)
  const [addSpecial, setAddSpecial] = useState(false)
  const [specialPerson, setSpecialPerson] = useState('')
  const [specialDate, setSpecialDate] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Düzenleme ya da kopyalama için yükle
  useEffect(() => {
    const src = id ?? params.get('kaynak')
    if (!src) return
    db.orders.get(src).then((o) => {
      if (!o) return
      const { id: _i, no: _n, createdAt: _c, updatedAt: _u, ...rest } = o
      if (isEdit) {
        setForm({ ...rest, basePrice: orderBase(o), boxes: o.boxes ?? [] })
        setOrigBoxes(o.status !== 'iptal' ? (o.boxes ?? []) : [])
      }
      else
        setForm({
          ...emptyForm(params.get('tarih') ?? undefined),
          // Katalogdan model seçildiyse müşteri kopyalanmaz
          customerId: params.get('musteri') ?? (params.get('gorsel') ? '' : o.customerId),
          productType: o.productType,
          occasion: o.occasion,
          amount: o.amount,
          tiers: o.tiers,
          cakeType: o.cakeType,
          creamType: o.creamType,
          filling: o.filling,
          designNotes: o.designNotes,
          unitPrice: o.unitPrice,
          extras: o.extras.map((e) => ({ ...e, id: uid() })),
        })
      setLoaded(true)
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Yeni siparişte müşteri parametresi
  useEffect(() => {
    const m = params.get('musteri')
    if (!isEdit && m && !params.get('kaynak')) set('customerId', m)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Varsayılan birim fiyat ve ödeme yöntemi
  useEffect(() => {
    if (!settings || !loaded) return
    if (!isEdit && !settings.productTypes.some((p) => p.key === form.productType) && settings.productTypes[0]) {
      // Varsayılan tür fiyat listesinde yoksa ilk türü seç
      const first = settings.productTypes[0]
      setForm((f) => ({ ...f, productType: first.key, unitPrice: first.unitPrice, tiers: first.hasTiers ? f.tiers || 1 : undefined }))
    } else if (form.unitPrice === undefined && !isEdit) set('unitPrice', productTypeOf(settings, form.productType).unitPrice)
    if (!deposit.method) setDeposit((d) => ({ ...d, method: settings.options.paymentMethods[0] ?? 'Nakit' }))
  }, [settings, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Müşteri adresini adrese teslimde öner
  useEffect(() => {
    if (form.deliveryMethod !== 'adres' || form.deliveryAddress || !form.customerId) return
    db.customers.get(form.customerId).then((c) => c?.address && set('deliveryAddress', c.address))
  }, [form.deliveryMethod, form.customerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fee = form.deliveryMethod === 'adres' ? form.deliveryFee || 0 : 0
  // Fiyat listesine göre değer (ücretsiz siparişlerde raporlanan değer)
  const calc = useMemo(
    () => calcTotal({ unitPrice: form.unitPrice, amount: form.amount, extras: form.extras, deliveryFee: fee, discount: form.discount }),
    [form.unitPrice, form.amount, form.extras, fee, form.discount],
  )
  const listBase = (form.unitPrice || 0) * (form.amount || 0)
  useEffect(() => {
    if (!baseTouched) set('basePrice', listBase)
  }, [listBase, baseTouched])
  const base = form.basePrice ?? listBase
  // Toplam = anlaşılan tutar + ekstralar + teslimat − indirim
  const total = orderTotal({ base, extras: form.extras, deliveryFee: fee, discount: form.discount, free: form.free })

  useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!settings) return null
  const pt = productTypeOf(settings, form.productType)
  const occasionIsSpecial = Boolean(form.occasion && /doğum|yıl dönümü|yildonumu/i.test(form.occasion))
  const valid = form.customerId && form.deliveryDate && form.productType

  const changeType = (key: string) => {
    const next = productTypeOf(settings, key)
    setForm((f) => ({ ...f, productType: key, unitPrice: next.unitPrice, tiers: next.hasTiers ? f.tiers || 1 : undefined }))
  }

  const updateExtra = (eid: string, patch: Partial<PriceExtra>) =>
    set(
      'extras',
      form.extras.map((e) => (e.id === eid ? { ...e, ...patch } : e)),
    )

  const onFiles = (files: FileList | null) => {
    if (!files) return
    // FileList input temizlenince boşalır; hemen kopyala
    const added = Array.from(files).map((file) => ({ id: uid(), file, url: URL.createObjectURL(file), kind: 'referans' as ImageKind }))
    setPending((p) => [...p, ...added])
  }

  const save = async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const input: OrderInput = {
        ...form,
        calculatedTotal: calc,
        basePrice: form.free ? listBase : base,
        free: Boolean(form.free),
        agreedPrice: total,
        boxes: (form.boxes ?? []).filter((b) => b.qty > 0),
        extras: form.extras.filter((e) => e.label || e.amount),
        tiers: pt.hasTiers ? form.tiers : undefined,
        deliveryAddress: form.deliveryMethod === 'adres' ? form.deliveryAddress : '',
        deliveryFee: form.deliveryMethod === 'adres' ? form.deliveryFee || 0 : 0,
        discount: form.discount || 0,
      }
      if (isEdit && id) {
        await updateOrder(id, input)
        // Görseller: kaldırılanlar, türü değişenler, yeni eklenenler
        if (removedImages.length) await db.images.bulkDelete(removedImages)
        for (const [imgId, kind] of Object.entries(kindChanges)) {
          if (removedImages.includes(imgId)) continue
          await db.images.update(imgId, { kind, ...(kind === 'final' ? { inCatalog: 1 as const } : {}) })
        }
        for (const kind of new Set(pending.map((p) => p.kind))) {
          await addImages(id, pending.filter((p) => p.kind === kind).map((p) => p.file), kind, input.productType)
        }
        toast('Sipariş güncellendi')
        nav(`/siparisler/${id}`, { replace: true })
      } else {
        const newId = await createOrder(input, {
          deposit: deposit.amount && !form.free ? { amount: deposit.amount, method: deposit.method, date: deposit.date } : undefined,
          images: pending.map((p) => ({ file: p.file, kind: p.kind })),
          copyImageIds: copyImageId ? [copyImageId] : undefined,
        })
        if (addSpecial && occasionIsSpecial) {
          const c = await db.customers.get(form.customerId)
          const d = parseDay(specialDate || form.deliveryDate)
          if (c) {
            await db.customers.update(c.id, {
              specialDays: [
                ...(c.specialDays ?? []),
                {
                  id: uid(),
                  type: form.occasion!.includes('oğum') ? 'Doğum günü' : form.occasion!,
                  person: specialPerson || 'Kendisi',
                  month: d.getMonth() + 1,
                  day: d.getDate(),
                },
              ],
              updatedAt: Date.now(),
            })
          }
        }
        toast(`Sipariş kaydedildi`)
        nav(`/siparisler/${newId}`, { replace: true })
      }
    } catch (e) {
      await tell((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const balance = total - (deposit.amount || 0)
  const boxQty = (itemId: string) => form.boxes?.find((b) => b.itemId === itemId)?.qty ?? 0
  const setBoxQty = (itemId: string, qty: number) =>
    set('boxes', [...(form.boxes ?? []).filter((b) => b.itemId !== itemId), ...(qty > 0 ? [{ itemId, qty }] : [])])

  return (
    <div className="pb-20 md:pb-0">
      <PageHeader
        back
        title={isEdit ? 'Siparişi düzenle' : 'Yeni sipariş'}
        subtitle={params.get('kaynak') && !isEdit ? 'Önceki siparişten kopyalandı — tarihi ve detayları kontrol edin' : undefined}
        actions={
          <div className="hidden gap-2 md:flex">
            <Button onClick={() => nav(-1)}>Vazgeç</Button>
            <Button variant="primary" disabled={!valid || saving} onClick={save}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Section title="Müşteri">
            <CustomerPicker value={form.customerId} onChange={(v) => set('customerId', v)} />
          </Section>

          <Section title="Ürün">
            <div className="mb-3 flex flex-wrap gap-2">
              {/* Ayarlardan kaldırılmış türdeki eski sipariş düzenlenirken o tür de görünsün */}
              {(settings.productTypes.some((p) => p.key === form.productType) ? settings.productTypes : [...settings.productTypes, pt]).map((p) => (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => changeType(p.key)}
                  className={cx(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[15px] transition',
                    form.productType === p.key ? 'border-accent bg-accent-soft font-medium text-accent-ink' : 'border-line bg-white',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
            {pt.desc && <p className="-mt-1 mb-3 text-sm text-muted">{pt.desc}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label={pt.unit === 'kişi' ? 'Kişi sayısı' : 'Adet'}>
                <NumberInput value={form.amount} onChange={(v) => set('amount', v)} min={0} />
              </Field>
              {pt.hasTiers && (
                <Field label="Kat sayısı">
                  <NumberInput value={form.tiers} onChange={(v) => set('tiers', v)} min={1} max={8} />
                </Field>
              )}
            </div>
            <Field label="Kutlama türü" className="mt-3" group>
              <ChipSelect options={settings.options.occasions} value={form.occasion} onChange={(v) => set('occasion', v)} />
            </Field>
            <Field label="Kutu (seçilen kutu stoktan 1 adet düşülür)" className="mt-3" group>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                {(boxItems ?? []).map((item) => {
                  const qty = boxQty(item.id)
                  const on = qty > 0
                  const available = item.quantity + (origBoxes.find((b) => b.itemId === item.id)?.qty ?? 0)
                  const left = available - qty
                  const low = item.minQuantity !== undefined && item.minQuantity > 0 && left <= item.minQuantity
                  return (
                    <button
                      type="button"
                      key={item.id}
                      data-box={item.name}
                      aria-pressed={on}
                      onClick={() => setBoxQty(item.id, on ? 0 : 1)}
                      className={cx(
                        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition',
                        on ? 'border-accent bg-accent-soft/60' : 'border-line bg-white hover:bg-stone-50',
                      )}
                    >
                      <span
                        className={cx(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                          on ? 'border-accent bg-accent text-white' : 'border-stone-300 bg-white',
                        )}
                      >
                        {on && <Check size={14} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-tight">
                          {item.name}
                          {qty > 1 && <span className="text-muted"> ×{qty}</span>}
                        </span>
                        <span className={cx('block text-xs', left < 0 ? 'font-medium text-red-600' : low ? 'font-medium text-amber-700' : 'text-muted')}>
                          Stok {num(available)}
                          {on && ` → ${num(left)}`}
                          {left < 0 ? ' · yetmiyor' : low ? ' · azaldı' : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {boxItems && boxItems.length === 0 && (
                <p className="text-sm text-muted">
                  Stok’ta “{BOX_CATEGORY}” kategorisinde kalem yok. <Link to="/stok" className="underline">Stok</Link> sayfasından kutu ekleyin.
                </p>
              )}
            </Field>
          </Section>

          <Section title="İçerik">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Kek cinsi" group>
                <ChipSelect allowCustom={false} options={settings.options.cakeTypes} value={form.cakeType} onChange={(v) => set('cakeType', v)} />
              </Field>
              <Field label="Krema cinsi" group>
                <ChipSelect allowCustom={false} options={settings.options.creamTypes} value={form.creamType} onChange={(v) => set('creamType', v)} />
              </Field>
              <Field label="İç dolgu / içerikler (birden çok seçilebilir)" className="md:col-span-2" group>
                <MultiChipSelect options={settings.options.fillings} value={form.filling} onChange={(v) => set('filling', v)} />
              </Field>
              <Field label="Pasta üstü yazı">
                <Input value={form.cakeText ?? ''} onChange={(e) => set('cakeText', e.target.value)} placeholder="Örn. İyi ki doğdun Elif" />
              </Field>
              <Field label="Tebrik kartı yazısı">
                <Textarea
                  className="min-h-[44px]"
                  rows={2}
                  value={form.cardText ?? ''}
                  onChange={(e) => set('cardText', e.target.value)}
                  placeholder="Karta yazılacak mesaj"
                />
              </Field>
            </div>
          </Section>

          <Section title="Model / tasarım">
            <Field label="Tasarımla ilgili beklentiler">
              <Textarea
                value={form.designNotes ?? ''}
                onChange={(e) => set('designNotes', e.target.value)}
                placeholder="Renkler, figürler, referans açıklaması…"
              />
            </Field>
            {(
              <div className="mt-4">
                <div className="mb-2 text-[13px] font-medium text-muted">Görseller</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {(existingImages ?? [])
                    .filter((img) => !removedImages.includes(img.id))
                    .map((img) => (
                      <ExistingImage
                        key={img.id}
                        image={img}
                        kind={kindChanges[img.id] ?? img.kind}
                        onKind={(k) => setKindChanges((x) => ({ ...x, [img.id]: k }))}
                        onRemove={() => setRemovedImages((x) => [...x, img.id])}
                      />
                    ))}
                  {pending.map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.url} alt="" className="aspect-square w-full rounded-xl border border-line object-cover" />
                      <button
                        type="button"
                        aria-label="Kaldır"
                        onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}
                        className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow"
                      >
                        <X size={14} />
                      </button>
                      <select
                        value={p.kind}
                        onChange={(e) =>
                          setPending((x) => x.map((y) => (y.id === p.id ? { ...y, kind: e.target.value as ImageKind } : y)))
                        }
                        className="mt-1 w-full rounded-lg border border-line bg-white px-1 py-1 text-xs"
                      >
                        {IMAGE_KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm text-muted hover:border-accent hover:text-accent-ink"
                  >
                    <ImagePlus size={22} />
                    Görsel ekle
                  </button>
                </div>
                {copyImageId && !isEdit && <div className="mt-2 text-xs text-muted">Katalogdan seçilen model referans olarak eklenecek.</div>}
                {isEdit && (removedImages.length > 0 || pending.length > 0) && (
                  <div className="mt-2 text-xs text-muted">Görsel değişiklikleri “Kaydet”e basınca uygulanır.</div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </Section>

          <Section title="Teslimat">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teslim tarihi" required>
                <Input type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
              </Field>
              <Field label="Saat">
                <Input type="time" value={form.deliveryTime ?? ''} onChange={(e) => set('deliveryTime', e.target.value)} />
              </Field>
            </div>
            {form.status !== 'iptal' && (
              <DayHint settings={settings} date={form.deliveryDate} excludeOrderId={id} onPickDate={(d) => set('deliveryDate', d)} />
            )}
            <div className="mt-3">
              <Segmented
                value={form.deliveryMethod}
                onChange={(v) => set('deliveryMethod', v)}
                options={[
                  { value: 'gelal', label: 'Gel-al' },
                  { value: 'adres', label: 'Adrese teslim' },
                ]}
              />
            </div>
            {form.deliveryMethod === 'adres' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
                <Field label="Teslimat adresi">
                  <Textarea className="min-h-[64px]" value={form.deliveryAddress ?? ''} onChange={(e) => set('deliveryAddress', e.target.value)} />
                </Field>
                <Field label="Adrese teslim ücreti" hint="Toplama eklenir">
                  <NumberInput integer value={form.deliveryFee} onChange={(v) => set('deliveryFee', v)} placeholder="₺" />
                </Field>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Fiyat">
            <Toggle checked={Boolean(form.free)} onChange={(v) => set('free', v)} label="Ücretsiz (ikram / hediye)" />
            {form.free ? (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                Bu sipariş <b>ücretsiz</b> kaydedilir; ödeme beklenmez. Fiyat listesine göre değeri <b>{money(calc)}</b> — raporlarda
                “Ücretsiz” olarak süzülebilir.
              </p>
            ) : (
              <>
                <Field
                  label="Anlaşılan tutar"
                  className="mt-3"
                  hint={
                    listBase > 0
                      ? `Fiyat listesine göre ${pt.label} · ${form.amount || 0} ${pt.unit === 'kişi' ? 'kişilik' : 'adet'}: ${money(listBase)}`
                      : form.amount
                        ? 'Fiyat listesinde bu ürünün fiyatı yok; tutarı yazın.'
                        : 'Kişi sayısını girince fiyat listesinden gelir; dilerseniz elle yazın.'
                  }
                >
                  <div className="flex gap-2">
                    <NumberInput
                      integer
                      value={form.basePrice}
                      onChange={(v) => {
                        setBaseTouched(true)
                        set('basePrice', v ?? 0)
                      }}
                      placeholder="₺"
                    />
                    {baseTouched && listBase > 0 && form.basePrice !== listBase && (
                      <Button
                        onClick={() => {
                          setBaseTouched(false)
                          set('basePrice', listBase)
                        }}
                      >
                        = Fiyat listesi
                      </Button>
                    )}
                  </div>
                </Field>
                {isEdit && form.unitPrice !== undefined && form.unitPrice !== pt.unitPrice && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <span>Fiyat listesi bu sipariş kaydedildikten sonra değişti.</span>
                    <button
                      type="button"
                      className="font-medium underline"
                      onClick={() => {
                        set('unitPrice', pt.unitPrice)
                        setBaseTouched(false)
                      }}
                    >
                      Güncel listeyle hesapla
                    </button>
                  </div>
                )}
                <div className="mt-4 border-t border-line pt-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted">Ekstralar (aksesuar, oyuncak, özel malzeme…)</span>
                </div>
                <div className="space-y-2">
                  {form.extras.map((e) => (
                    <div key={e.id} className="flex gap-2">
                      <div className="flex-1">
                        <ComboInput
                          options={settings.options.extras}
                          value={e.label}
                          onChange={(v) => updateExtra(e.id, { label: v })}
                          placeholder="Açıklama"
                        />
                      </div>
                      <NumberInput
                        integer
                        className="w-28"
                        value={e.amount || undefined}
                        onChange={(v) => updateExtra(e.id, { amount: v ?? 0 })}
                        placeholder="₺"
                      />
                      <IconButton label="Sil" onClick={() => set('extras', form.extras.filter((x) => x.id !== e.id))}>
                        <Trash2 size={18} className="text-red-600" />
                      </IconButton>
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant="soft"
                    icon={<Plus size={16} />}
                    onClick={() => set('extras', [...form.extras, { id: uid(), label: '', amount: 0 }])}
                  >
                    Ekstra ekle
                  </Button>
                </div>
                </div>
                <Field label="İndirim" className="mt-3" hint="Toplamdan düşülür">
                  <NumberInput integer value={form.discount} onChange={(v) => set('discount', v)} placeholder="₺" />
                </Field>
                <div className="mt-4 space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm" data-testid="price-summary">
                  <Row label="Anlaşılan tutar" value={money(base)} />
                  {extrasSum(form.extras) > 0 && <Row label="Ekstralar" value={money(extrasSum(form.extras))} />}
                  {fee > 0 && <Row label="Adrese teslim" value={money(fee)} />}
                  {!!form.discount && <Row label="İndirim" value={`−${money(form.discount)}`} />}
                  <Row label={<b className="text-ink">Toplam</b>} value={<b>{money(total)}</b>} />
                </div>
              </>
            )}

            {!isEdit && !form.free && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="mb-2 text-[13px] font-medium text-muted">Alınan kapora</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput integer value={deposit.amount} onChange={(v) => setDeposit((d) => ({ ...d, amount: v }))} placeholder="Tutar ₺" />
                  <Select value={deposit.method} onChange={(e) => setDeposit((d) => ({ ...d, method: e.target.value }))}>
                    {settings.options.paymentMethods.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </Select>
                </div>
                {!!deposit.amount && (
                  <div className="mt-2 text-sm">
                    Kalan: <b className="tabular-nums">{money(balance)}</b>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Durum ve notlar">
            <Field label="Sipariş durumu" group>
              <Segmented<OrderStatus>
                full
                value={form.status}
                onChange={(v) => set('status', v)}
                options={(['onaylandi', 'teslim', 'iptal'] as const).map((s) => ({ value: s, label: STATUS[s].label }))}
              />
            </Field>
            <Field label="Notlar" className="mt-3">
              <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
            {!isEdit && occasionIsSpecial && (
              <div className="mt-4 rounded-xl bg-accent-soft/50 p-3">
                <Toggle checked={addSpecial} onChange={setAddSpecial} label="Bu kutlamayı müşterinin özel günlerine ekle (her yıl hatırlat)" />
                {addSpecial && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Input value={specialPerson} onChange={(e) => setSpecialPerson(e.target.value)} placeholder="Kimin? (Kızı Elif)" />
                    <Input
                      type="date"
                      value={specialDate || form.deliveryDate}
                      onChange={(e) => setSpecialDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Telefon için sabit kaydet çubuğu */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white px-4 py-3 md:hidden">
        <Button className="flex-1" onClick={() => nav(-1)}>
          Vazgeç
        </Button>
        <Button className="flex-[2]" variant="primary" disabled={!valid || saving} onClick={save}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-display text-lg text-ink">{title}</h2>
      {children}
    </Card>
  )
}

/** Düzenlemede siparişin kayıtlı görseli: türü değiştirilebilir ya da kaldırılabilir */
function ExistingImage({
  image,
  kind,
  onKind,
  onRemove,
}: {
  image: OrderImage
  kind: ImageKind
  onKind: (k: ImageKind) => void
  onRemove: () => void
}) {
  const url = useBlobUrl(image.thumb)
  return (
    <div className="relative" data-testid="existing-image">
      {url ? (
        <img src={url} alt={image.caption ?? ''} className="aspect-square w-full rounded-xl border border-line object-cover" />
      ) : (
        <div className="aspect-square w-full rounded-xl border border-line bg-stone-100" />
      )}
      <button
        type="button"
        aria-label="Görseli kaldır"
        onClick={onRemove}
        className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow"
      >
        <X size={14} />
      </button>
      <select
        value={kind}
        onChange={(e) => onKind(e.target.value as ImageKind)}
        aria-label="Görsel türü"
        className="mt-1 w-full rounded-lg border border-line bg-white px-1 py-1 text-xs"
      >
        {IMAGE_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
