import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, Check, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { updateSettings } from '../db/actions'
import type { ProductType } from '../db/types'
import { useSettings } from '../lib/hooks'
import { calcTotal } from '../lib/domain'
import { money, uid } from '../lib/format'
import { ask } from '../components/confirm'
import { Button, Card, CardHeader, Field, IconButton, Input, LinkButton, NumberInput, PageHeader, Segmented, cx, useToast } from '../components/ui'

const PALETTE = ['#d48a96', '#c79a5b', '#8fae8b', '#9a8cc2', '#8a9bb0', '#d9a066', '#6fa3a8', '#b47ab0', '#a3a35c', '#c46f5c']

/** Fiyat listesi: pasta türleri ve dilim (kişi) / adet fiyatları + hızlı fiyat hesaplama */
export default function PriceList() {
  const settings = useSettings()
  const toast = useToast()
  const [draft, setDraft] = useState<ProductType[]>()

  useEffect(() => {
    if (settings && !draft) setDraft(settings.productTypes)
  }, [settings, draft])

  if (!settings || !draft) return null
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.productTypes)
  const setRow = (key: string, patch: Partial<ProductType>) => setDraft(draft.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const add = () =>
    setDraft([
      ...draft,
      {
        key: 'u' + uid().slice(0, 8),
        label: '',
        desc: '',
        unit: 'kişi',
        unitPrice: 0,
        color: PALETTE[draft.length % PALETTE.length],
        hasTiers: true,
      },
    ])

  const save = async () => {
    const clean = draft
      .filter((p) => p.label.trim())
      .map((p) => ({ ...p, label: p.label.trim(), desc: p.desc?.trim() ?? '', unitPrice: p.unitPrice || 0, hasTiers: p.unit === 'kişi' }))
    await updateSettings({ productTypes: clean })
    setDraft(clean)
    toast('Fiyat listesi kaydedildi')
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Fiyat listesi"
        subtitle="Pasta türleri ve dilim fiyatları. Siparişte tür ve kişi sayısı seçilince tutar otomatik hesaplanır."
        actions={
          <Button variant="primary" disabled={!dirty} onClick={save} icon={<Check size={18} />}>
            Kaydet
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Ürünler ve fiyatlar"
            action={
              <Button size="sm" variant="soft" icon={<Plus size={16} />} onClick={add}>
                Tür ekle
              </Button>
            }
          />
          {/* Tablet / masaüstü: tablo başlığı */}
          <div className="hidden grid-cols-[28px_1.2fr_1.6fr_150px_130px_40px] gap-3 border-t border-line bg-stone-50 px-4 py-2 text-xs font-medium text-muted md:grid">
            <span />
            <span>Pasta türü</span>
            <span>İçerik / açıklama</span>
            <span>Birim</span>
            <span>Fiyat</span>
            <span />
          </div>
          <div className="divide-y divide-line border-t border-line md:border-t-0">
            {draft.map((p) => (
              <div
                key={p.key}
                data-row={p.label}
                className="grid grid-cols-[28px_1fr_40px] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[28px_1.2fr_1.6fr_150px_130px_40px]"
              >
                <label className="relative h-6 w-6 cursor-pointer overflow-hidden rounded-full" style={{ background: p.color }} title="Renk">
                  <input
                    type="color"
                    value={p.color}
                    onChange={(e) => setRow(p.key, { color: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label="Renk"
                  />
                </label>
                <Input
                  value={p.label}
                  onChange={(e) => setRow(p.key, { label: e.target.value })}
                  placeholder="Ör. Butik pasta"
                  aria-label="Pasta türü"
                />
                <div className="flex justify-end md:order-last">
                  <DeleteRow productKey={p.key} onDelete={() => setDraft(draft.filter((x) => x.key !== p.key))} />
                </div>
                <Input
                  className="col-span-3 md:col-span-1"
                  value={p.desc ?? ''}
                  onChange={(e) => setRow(p.key, { desc: e.target.value })}
                  placeholder="İçerik (ör. vanilya kek, çilekli, şeker hamuru kaplama)"
                  aria-label="İçerik"
                />
                <div className="col-span-3 grid grid-cols-2 gap-2 md:contents">
                  <Segmented<'kişi' | 'adet'>
                    value={p.unit}
                    onChange={(v) => setRow(p.key, { unit: v })}
                    options={[
                      { value: 'kişi', label: 'Dilim' },
                      { value: 'adet', label: 'Adet' },
                    ]}
                  />
                  <div className="relative">
                    <NumberInput
                      integer
                      className="pr-14"
                      value={p.unitPrice || undefined}
                      onChange={(v) => setRow(p.key, { unitPrice: v ?? 0 })}
                      placeholder="₺"
                      aria-label={`${p.label || 'Ürün'} fiyatı`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                      /{p.unit === 'kişi' ? 'dilim' : 'adet'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {draft.length === 0 && <div className="px-4 py-6 text-sm text-muted">Henüz ürün yok. “Tür ekle” ile başlayın.</div>}
          </div>
        </Card>

        <QuickCalc types={settings.productTypes} />
      </div>

      {dirty && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm text-white shadow-lg">
            Kaydedilmemiş değişiklikler var
            <Button size="sm" variant="secondary" onClick={() => setDraft(settings.productTypes)}>
              Geri al
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              Kaydet
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DeleteRow({ productKey, onDelete }: { productKey: string; onDelete: () => void }) {
  const used = useLiveQuery(() => db.orders.where('productType').equals(productKey).count(), [productKey])
  return (
    <IconButton
      label={used ? `${used} siparişte kullanılıyor, silinemez` : 'Sil'}
      disabled={!!used}
      onClick={async () => (await ask('Bu ürün fiyat listesinden silinsin mi?', { confirmLabel: 'Sil' })) && onDelete()}
    >
      <Trash2 size={18} className={used ? 'text-stone-300' : 'text-red-600'} />
    </IconButton>
  )
}

/** Tür + kişi sayısı + indirim ile hızlı fiyat (müşteriye fiyat verirken) */
function QuickCalc({ types }: { types: ProductType[] }) {
  const [key, setKey] = useState(types[0]?.key ?? '')
  const [amount, setAmount] = useState<number>()
  const [discount, setDiscount] = useState<number>()
  const pt = types.find((p) => p.key === key) ?? types[0]
  if (!pt) return null
  const base = (pt.unitPrice || 0) * (amount || 0)
  const total = calcTotal({ unitPrice: pt.unitPrice, amount, extras: [], discount })
  const qs = new URLSearchParams({ tur: pt.key, ...(amount ? { kisi: String(amount) } : {}), ...(discount ? { indirim: String(discount) } : {}) })

  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center gap-2 font-display text-lg">
        <Calculator size={18} className="text-accent" /> Hızlı hesapla
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pasta türü">
        {types.map((p) => (
          <button
            type="button"
            key={p.key}
            aria-pressed={p.key === pt.key}
            onClick={() => setKey(p.key)}
            className={cx(
              'flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition',
              p.key === pt.key ? 'border-accent bg-accent-soft font-medium text-accent-ink' : 'border-line bg-white',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={pt.unit === 'kişi' ? 'Kişi sayısı' : 'Adet'}>
          <NumberInput integer value={amount} onChange={setAmount} />
        </Field>
        <Field label="İndirim (₺)">
          <NumberInput integer value={discount} onChange={setDiscount} placeholder="₺" />
        </Field>
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">
            {pt.unit === 'kişi' ? 'Dilim fiyatı' : 'Adet fiyatı'} {money(pt.unitPrice)} × {amount || 0}
          </span>
          <span className="tabular-nums">{money(base)}</span>
        </div>
        {!!discount && (
          <div className="flex justify-between">
            <span className="text-muted">İndirim</span>
            <span className="tabular-nums">−{money(discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-semibold">
          <span>Toplam</span>
          <span className="tabular-nums" data-testid="calc-total">
            {money(total)}
          </span>
        </div>
      </div>
      {pt.desc && <p className="mt-2 text-xs text-muted">{pt.desc}</p>}
      <LinkButton to={`/siparisler/yeni?${qs}`} variant="primary" className="mt-3 w-full" icon={<Plus size={16} />}>
        Bu fiyatla sipariş oluştur
      </LinkButton>
    </Card>
  )
}
