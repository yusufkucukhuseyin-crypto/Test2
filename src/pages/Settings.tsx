import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Check, Download, Plus, Trash2, Upload, X } from 'lucide-react'
import { db } from '../db/db'
import { ACCENTS } from '../db/defaults'
import { updateSettings } from '../db/actions'
import { downloadBlob, exportBackup, importBackup, wipeAll } from '../db/backup'
import { loadDemoData } from '../db/seed'
import type { OptionLists, ProductType, Settings } from '../db/types'
import { useSettings } from '../lib/hooks'
import { WEEKDAYS, today, uid } from '../lib/format'
import { Button, Card, CardHeader, Field, IconButton, Input, NumberInput, PageHeader, Select, Toggle, cx, useToast } from '../components/ui'

type Draft = Pick<Settings, 'businessName' | 'weekdayCapacity' | 'productTypes' | 'options' | 'reminderDays'>

const OPTION_LABELS: [keyof OptionLists, string][] = [
  ['cakeTypes', 'Kek cinsleri'],
  ['creamTypes', 'Krema cinsleri'],
  ['fillings', 'İç dolgu / içerikler'],
  ['themes', 'Temalar'],
  ['occasions', 'Kutlama türleri'],
  ['extras', 'Fiyat ekstraları'],
  ['specialDayTypes', 'Özel gün türleri'],
  ['sources', 'Müşteri kaynakları'],
  ['paymentMethods', 'Ödeme yöntemleri'],
  ['stockCategories', 'Stok kategorileri'],
  ['stockUnits', 'Stok birimleri'],
]

const PALETTE = ['#d48a96', '#c79a5b', '#8fae8b', '#9a8cc2', '#8a9bb0', '#d9a066', '#6fa3a8', '#b47ab0', '#a3a35c', '#c46f5c']

function pick(s: Settings): Draft {
  return {
    businessName: s.businessName,
    weekdayCapacity: s.weekdayCapacity,
    productTypes: s.productTypes,
    options: s.options,
    reminderDays: s.reminderDays,
  }
}

export default function SettingsPage() {
  const settings = useSettings()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>()
  const [openType, setOpenType] = useState<string | null>(null)

  useEffect(() => {
    if (settings && !draft) setDraft(pick(settings))
  }, [settings, draft])

  if (!settings || !draft) return null
  const dirty = JSON.stringify(pick(settings)) !== JSON.stringify(draft)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })
  const setType = (key: string, patch: Partial<ProductType>) =>
    set(
      'productTypes',
      draft.productTypes.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    )

  const save = async () => {
    await updateSettings(draft)
    toast('Ayarlar kaydedildi')
  }

  return (
    <div className="pb-20">
      <PageHeader
        title="Ayarlar"
        actions={
          <Button variant="primary" disabled={!dirty} onClick={save} icon={<Check size={18} />}>
            Kaydet
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">İşletme ve görünüm</h2>
          <Field label="İşletme adı">
            <Input value={draft.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <div className="mt-4">
            <div className="mb-2 text-[13px] font-medium text-muted">Renk teması</div>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  type="button"
                  key={a.key}
                  onClick={() => updateSettings({ accent: a.key })}
                  className={cx(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                    settings.accent === a.key ? 'border-ink' : 'border-line',
                  )}
                >
                  <span className="h-4 w-4 rounded-full" style={{ background: a.accent }} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Özel günleri kaç gün önceden hatırlat?" className="mt-4">
            <NumberInput value={draft.reminderDays} onChange={(v) => set('reminderDays', v ?? 21)} min={1} max={90} />
          </Field>
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-lg">Günlük kapasite</h2>
          <p className="mb-3 text-sm text-muted">
            Her gün en fazla kaç “pasta eşdeğeri” teslim edebileceğiniz. Ürünlerin kapasite ağırlığı aşağıdan ayarlanır (pasta = 1,
            cupcake = 0,5 gibi). Belirli bir günü Takvim’den ayrıca değiştirebilirsiniz; 0 = kapalı.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="text-center">
                <span className="mb-1 block text-xs text-muted">{d.slice(0, 3)}</span>
                <NumberInput
                  className="text-center"
                  value={draft.weekdayCapacity[i]}
                  min={0}
                  step={0.5}
                  onChange={(v) => {
                    const next = [...draft.weekdayCapacity]
                    next[i] = v ?? 0
                    set('weekdayCapacity', next)
                  }}
                />
              </label>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Ürün türleri, fiyatlar ve iş adımları (rota)"
          action={
            <Button
              size="sm"
              variant="soft"
              icon={<Plus size={16} />}
              onClick={() => {
                const key = 'u' + uid().slice(0, 6)
                set('productTypes', [
                  ...draft.productTypes,
                  {
                    key,
                    label: 'Yeni ürün',
                    unit: 'adet',
                    unitPrice: 0,
                    capacityWeight: 0.5,
                    color: PALETTE[draft.productTypes.length % PALETTE.length],
                    hasTiers: false,
                    tasks: [{ name: 'Hazırlık', offset: 0, days: 1 }],
                  },
                ])
                setOpenType(key)
              }}
            >
              Ürün ekle
            </Button>
          }
        />
        <p className="-mt-1 px-4 pb-3 text-sm text-muted">
          İş adımları, yeni sipariş oluşturulunca teslim tarihinden geriye doğru otomatik planlanır. “Kaç gün önce” 0 ise teslim günü
          yapılır.
        </p>
        <div className="divide-y divide-line border-t border-line">
          {draft.productTypes.map((p) => (
            <div key={p.key}>
              <button
                type="button"
                onClick={() => setOpenType(openType === p.key ? null : p.key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.color }} />
                <span className="flex-1 font-medium">{p.label}</span>
                <span className="text-sm text-muted tabular-nums">
                  {p.unitPrice} ₺/{p.unit} · ağırlık {p.capacityWeight} · {p.tasks.length} adım
                </span>
              </button>
              {openType === p.key && (
                <div className="space-y-4 bg-stone-50/60 px-4 pt-1 pb-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Field label="Ad">
                      <Input value={p.label} onChange={(e) => setType(p.key, { label: e.target.value })} />
                    </Field>
                    <Field label="Fiyat birimi">
                      <Select value={p.unit} onChange={(e) => setType(p.key, { unit: e.target.value as ProductType['unit'] })}>
                        <option value="kişi">Kişi başı</option>
                        <option value="adet">Adet</option>
                      </Select>
                    </Field>
                    <Field label={`Baz fiyat (₺/${p.unit})`}>
                      <NumberInput value={p.unitPrice} onChange={(v) => setType(p.key, { unitPrice: v ?? 0 })} />
                    </Field>
                    <Field label="Kapasite ağırlığı">
                      <NumberInput value={p.capacityWeight} step={0.1} onChange={(v) => setType(p.key, { capacityWeight: v ?? 0 })} />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex gap-1.5">
                      {PALETTE.map((c) => (
                        <button
                          type="button"
                          key={c}
                          aria-label={`Renk ${c}`}
                          onClick={() => setType(p.key, { color: c })}
                          className={cx('h-7 w-7 rounded-full border-2', p.color === c ? 'border-ink' : 'border-white')}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <Toggle checked={p.hasTiers} onChange={(v) => setType(p.key, { hasTiers: v })} label="Kat sayısı sorulsun" />
                  </div>

                  <div>
                    <div className="mb-2 text-[13px] font-medium text-muted">İş adımları</div>
                    <div className="space-y-2">
                      {p.tasks.map((t, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2">
                          <span className="w-5 text-center text-sm text-muted">{i + 1}</span>
                          <Input
                            className="h-10 min-w-[140px] flex-1"
                            value={t.name}
                            onChange={(e) => setType(p.key, { tasks: p.tasks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                          />
                          <label className="flex items-center gap-1 text-sm text-muted">
                            <NumberInput
                              className="h-10 w-16 text-center"
                              value={t.offset}
                              min={0}
                              onChange={(v) => setType(p.key, { tasks: p.tasks.map((x, j) => (j === i ? { ...x, offset: v ?? 0 } : x)) })}
                            />
                            gün önce
                          </label>
                          <label className="flex items-center gap-1 text-sm text-muted">
                            <NumberInput
                              className="h-10 w-16 text-center"
                              value={t.days}
                              min={1}
                              onChange={(v) => setType(p.key, { tasks: p.tasks.map((x, j) => (j === i ? { ...x, days: Math.max(1, v ?? 1) } : x)) })}
                            />
                            gün sürer
                          </label>
                          <div className="flex">
                            <IconButton
                              label="Yukarı"
                              disabled={i === 0}
                              onClick={() => {
                                const ts = [...p.tasks]
                                ;[ts[i - 1], ts[i]] = [ts[i], ts[i - 1]]
                                setType(p.key, { tasks: ts })
                              }}
                            >
                              <ArrowUp size={16} />
                            </IconButton>
                            <IconButton
                              label="Aşağı"
                              disabled={i === p.tasks.length - 1}
                              onClick={() => {
                                const ts = [...p.tasks]
                                ;[ts[i + 1], ts[i]] = [ts[i], ts[i + 1]]
                                setType(p.key, { tasks: ts })
                              }}
                            >
                              <ArrowDown size={16} />
                            </IconButton>
                            <IconButton label="Sil" onClick={() => setType(p.key, { tasks: p.tasks.filter((_, j) => j !== i) })}>
                              <Trash2 size={16} className="text-red-600" />
                            </IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-2">
                      <Button
                        size="sm"
                        icon={<Plus size={15} />}
                        onClick={() => setType(p.key, { tasks: [...p.tasks, { name: '', offset: 0, days: 1 }] })}
                      >
                        Adım ekle
                      </Button>
                      <DeleteType
                        productKey={p.key}
                        onDelete={() => set('productTypes', draft.productTypes.filter((x) => x.key !== p.key))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Seçenek listeleri" />
        <p className="-mt-1 px-4 pb-3 text-sm text-muted">Formlarda hızlı seçim için önerilen değerler. Formlarda yine de serbest yazabilirsiniz.</p>
        <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
          {OPTION_LABELS.map(([key, label]) => (
            <ListEditor key={key} label={label} values={draft.options[key]} onChange={(v) => set('options', { ...draft.options, [key]: v })} />
          ))}
        </div>
      </Card>

      <DataCard />

      {dirty && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6">
          <div className="flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm text-white shadow-lg">
            Kaydedilmemiş değişiklikler var
            <Button size="sm" variant="secondary" onClick={() => setDraft(pick(settings))}>
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

function DeleteType({ productKey, onDelete }: { productKey: string; onDelete: () => void }) {
  const used = useLiveQuery(() => db.orders.where('productType').equals(productKey).count(), [productKey])
  return (
    <Button
      size="sm"
      variant="danger"
      icon={<Trash2 size={15} />}
      disabled={!!used}
      title={used ? `${used} siparişte kullanılıyor` : undefined}
      onClick={() => confirm('Bu ürün türü silinsin mi?') && onDelete()}
    >
      {used ? `Siparişlerde kullanılıyor (${used})` : 'Ürün türünü sil'}
    </Button>
  )
}

function ListEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('')
  const add = () => {
    const v = text.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setText('')
  }
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pr-1 pl-3 text-sm">
            {v}
            <button
              type="button"
              aria-label={`${v} kaldır`}
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-stone-100"
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          className="h-9"
          value={text}
          placeholder="Yeni ekle…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button size="sm" disabled={!text.trim()} onClick={add}>
          Ekle
        </Button>
      </div>
    </div>
  )
}

function DataCard() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [storage, setStorage] = useState<{ persisted?: boolean; usage?: number; quota?: number }>({})
  const counts = useLiveQuery(async () => ({
    customers: await db.customers.count(),
    orders: await db.orders.count(),
    images: await db.images.count(),
  }))

  useEffect(() => {
    ;(async () => {
      const persisted = await navigator.storage?.persisted?.()
      const est = await navigator.storage?.estimate?.()
      setStorage({ persisted, usage: est?.usage, quota: est?.quota })
    })()
  }, [counts?.images])

  const mb = (b?: number) => (b === undefined ? '?' : `${(b / 1024 / 1024).toFixed(1)} MB`)

  return (
    <Card className="mt-4 p-4">
      <h2 className="font-display text-lg">Veriler ve yedekleme</h2>
      <p className="mt-1 text-sm text-muted">
        Bu sürümde tüm veriler <b>bu cihazın tarayıcısında</b> saklanır ve internetsiz çalışır. Telefonu değiştirmeden önce ya da
        düzenli olarak (haftada bir) yedek alın. Yedek dosyası fotoğrafları da içerir; başka bir cihazda “Yedeği geri yükle” ile
        açabilirsiniz.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Info label="Müşteri" value={counts?.customers ?? '–'} />
        <Info label="Sipariş" value={counts?.orders ?? '–'} />
        <Info label="Görsel" value={counts?.images ?? '–'} />
        <Info label="Kullanılan alan" value={mb(storage.usage)} />
      </div>
      <div className={cx('mt-3 rounded-xl px-3 py-2 text-sm', storage.persisted ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
        {storage.persisted
          ? 'Kalıcı depolama açık: tarayıcı verileri kendiliğinden silmez.'
          : 'Kalıcı depolama onaylanmadı. Uygulamayı ana ekrana ekleyin ve düzenli yedek alın.'}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<Download size={16} />}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              downloadBlob(await exportBackup(), `pastane-yedek-${today()}.json`)
              toast('Yedek indirildi')
            } finally {
              setBusy(false)
            }
          }}
        >
          Yedek al
        </Button>
        <Button icon={<Upload size={16} />} disabled={busy} onClick={() => fileRef.current?.click()}>
          Yedeği geri yükle
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            if (!confirm('Yedek geri yüklenirse bu cihazdaki TÜM mevcut verilerin yerini alır. Devam edilsin mi?')) return
            setBusy(true)
            try {
              await importBackup(f)
              toast('Yedek geri yüklendi')
              setTimeout(() => location.reload(), 600)
            } catch (err) {
              alert((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <div className="mb-2 text-sm font-medium">Deneme</div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await loadDemoData()
                toast('Örnek veriler eklendi')
              } finally {
                setBusy(false)
              }
            }}
          >
            Örnek veri ekle
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm('Tüm müşteriler, siparişler, görseller ve stok kayıtları silinecek. Emin misiniz?')) return
              if (!confirm('Bu işlem geri alınamaz. Önce yedek aldınız mı? Silmek için Tamam’a basın.')) return
              await wipeAll()
              toast('Tüm veriler silindi')
              setTimeout(() => location.reload(), 600)
            }}
          >
            Tüm verileri sil
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  )
}
