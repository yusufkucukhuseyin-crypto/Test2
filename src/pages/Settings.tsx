import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ImageUp, Trash2, X } from 'lucide-react'
import { db } from '../db/db'
import { ACCENTS } from '../db/defaults'
import { setDayCapacity, updateSettings } from '../db/actions'
import { wipeAll } from '../db/backup'
import { BackupButton, RestoreButton } from '../components/Backup'
import { InstallCard } from '../components/AppInstall'
import { loadDemoData } from '../db/seed'
import type { OptionLists, Settings } from '../db/types'
import { useSettings } from '../lib/hooks'
import { WEEKDAYS, fmtDate, shiftDay, today } from '../lib/format'
import { dominantColor, paletteFromHex, processLogo, resolveAccent } from '../lib/color'
import { Button, Card, CardHeader, Field, IconButton, Input, NumberInput, PageHeader, cx, useToast } from '../components/ui'
import { ask, tell } from '../components/confirm'

type Draft = Pick<Settings, 'businessName' | 'ownerName' | 'weekdayCapacity' | 'options' | 'reminderDays'>

const OPTION_LABELS: [keyof OptionLists, string][] = [
  ['cakeTypes', 'Kek cinsleri'],
  ['creamTypes', 'Krema cinsleri'],
  ['fillings', 'İç dolgu / içerikler'],
  ['occasions', 'Kutlama türleri'],
  ['extras', 'Fiyat ekstraları'],
  ['specialDayTypes', 'Özel gün türleri'],
  ['sources', 'Müşteri kaynakları'],
  ['paymentMethods', 'Ödeme yöntemleri'],
  ['stockCategories', 'Stok kategorileri'],
  ['stockUnits', 'Stok birimleri'],
]

function pick(s: Settings): Draft {
  return {
    businessName: s.businessName,
    ownerName: s.ownerName ?? '',
    weekdayCapacity: s.weekdayCapacity,
    options: s.options,
    reminderDays: s.reminderDays,
  }
}

export default function SettingsPage() {
  const settings = useSettings()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>()

  useEffect(() => {
    if (settings && !draft) setDraft(pick(settings))
  }, [settings, draft])

  if (!settings || !draft) return null
  const dirty = JSON.stringify(pick(settings)) !== JSON.stringify(draft)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })

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

      <InstallCard className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-display text-lg">İşletme ve görünüm</h2>
          <Field label="İşletme adı">
            <Input value={draft.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <Field label="Karşılama adı" hint={`Ana sayfada “Merhaba${draft.ownerName?.trim() ? ` ${draft.ownerName.trim()}` : ''} 👋” olarak görünür`} className="mt-3">
            <Input value={draft.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} placeholder="Örn. Sabiş" />
          </Field>
          <BrandEditor settings={settings} />
          <Field label="Özel günleri kaç gün önceden hatırlat?" className="mt-4">
            <NumberInput integer value={draft.reminderDays} onChange={(v) => set('reminderDays', v ?? 21)} />
          </Field>
        </Card>

        <Card className="p-4">
          <h2 className="font-display text-lg">Günlük kapasite (sipariş sayısı)</h2>
          <p className="mb-3 text-sm text-muted">
            Aynı gün teslim edebileceğiniz sipariş sayısı. Takvimde: hiç sipariş yoksa <b>Uygun</b>, kapasiteden azsa <b>Yoğun</b>,
            kapasite kadarsa <b>Dolu</b>, fazlaysa <b>Kapasite aşıldı</b>. Kapasite dolu olsa da sipariş girebilirsiniz; yalnızca uyarı
            verilir. 0 olan gün kapalıdır.
          </p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="text-center">
                <span className="mb-1 block text-xs text-muted">{d.slice(0, 3)}</span>
                <NumberInput
                  integer
                  className="text-center"
                  value={draft.weekdayCapacity[i]}
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
        <CardHeader title="Seçenek listeleri" />
        <p className="-mt-1 px-4 pb-3 text-sm text-muted">
          Formlardaki seçenekler. Kek ve krema cinsi yalnızca bu listeden seçilir; iç dolguda listede olmayan bir içerik de
          eklenebilir. Ürün türleri ve fiyatlar <b>Fiyat listesi</b> sayfasındadır.
        </p>
        <div className="grid gap-4 border-t border-line p-4 md:grid-cols-2">
          {OPTION_LABELS.map(([key, label]) => (
            <ListEditor key={key} label={label} values={draft.options[key]} onChange={(v) => set('options', { ...draft.options, [key]: v })} />
          ))}
        </div>
      </Card>

      <ClosuresCard settings={settings} />

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

/** Logo yükleme ve renk teması. Logo yüklenince baskın rengi tema rengi olur. */
function BrandEditor({ settings }: { settings: Settings }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const current = resolveAccent(settings)
  const custom = settings.accentColor ? paletteFromHex(settings.accentColor) : null

  const onLogo = async (file: File) => {
    setBusy(true)
    try {
      const logo = await processLogo(file)
      const color = await dominantColor(logo)
      await updateSettings({ logo, accent: 'ozel', accentColor: color })
      toast('Logo yüklendi; tema renkleri logodan alındı')
    } catch (e) {
      await tell((e as Error).message || 'Logo okunamadı')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-medium text-muted">Logo</div>
        <div className="flex flex-wrap items-center gap-3">
          {settings.logo ? (
            <img src={settings.logo} alt="Logo" className="h-16 w-16 rounded-full bg-white object-contain ring-1 ring-line" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line text-muted">
              <ImageUp size={22} />
            </div>
          )}
          <Button icon={<ImageUp size={16} />} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Yükleniyor…' : settings.logo ? 'Logoyu değiştir' : 'Logo yükle'}
          </Button>
          {settings.logo && (
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => updateSettings({ logo: undefined })}>
              Kaldır
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Logo dosyası"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onLogo(f)
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">Menüde ve yazdırılan sipariş fişinde görünür. Yüklenince tema rengi logodan otomatik seçilir.</p>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-medium text-muted">Renk teması</div>
        <div className="flex flex-wrap gap-2">
          {custom && (
            <button
              type="button"
              onClick={() => updateSettings({ accent: 'ozel' })}
              className={cx(
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm',
                settings.accent === 'ozel' ? 'border-ink' : 'border-line',
              )}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: custom.accent }} />
              {settings.logo ? 'Logodan' : 'Özel'}
            </button>
          )}
          {ACCENTS.map((a) => (
            <button
              type="button"
              key={a.key}
              onClick={() => updateSettings({ accent: a.key })}
              className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm', settings.accent === a.key ? 'border-ink' : 'border-line')}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: a.accent }} />
              {a.label}
            </button>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm">
            <input
              type="color"
              className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
              value={settings.accentColor ?? current.accent}
              onChange={(e) => updateSettings({ accent: 'ozel', accentColor: e.target.value })}
              aria-label="Özel renk seç"
            />
            Renk seç
          </label>
        </div>
      </div>
    </>
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

/** Tatil / izin gibi kapalı gün aralıkları ve güne özel kapasiteler */
function ClosuresCard({ settings }: { settings: Settings }) {
  const toast = useToast()
  const t = today()
  const [from, setFrom] = useState(t)
  const [to, setTo] = useState(t)
  const [count, setCount] = useState<number | undefined>(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const list = Object.entries(settings.capacityOverrides)
    .filter(([d]) => d >= t)
    .sort((a, b) => a[0].localeCompare(b[0]))

  const range = (a: string, b: string) => {
    const out: string[] = []
    const [s, e] = a <= b ? [a, b] : [b, a]
    for (let d = s; d <= e && out.length < 370; d = shiftDay(d, 1)) out.push(d)
    return out
  }

  const add = async () => {
    if (count === undefined) return
    setBusy(true)
    try {
      const dates = range(from, to)
      await setDayCapacity(dates, count, note)
      toast(count === 0 ? `${dates.length} gün kapatıldı` : `${dates.length} günün kapasitesi ${count} sipariş oldu`)
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4 p-4">
      <h2 className="font-display text-lg">Kapalı günler ve özel kapasiteler</h2>
      <p className="mt-1 mb-3 text-sm text-muted">
        Tatil, bayram ya da izin günleri için kapasiteyi 0 yapın (gün kapanır) veya o günlere özel bir sipariş sayısı verin.
        Kapalı günler takvimde taralı görünür; sipariş girerken uyarı verilir.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_110px_1.4fr_auto]">
        <Field label="Başlangıç">
          <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </Field>
        <Field label="Bitiş">
          <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </Field>
        <Field label="Kapasite">
          <NumberInput integer value={count} onChange={setCount} />
        </Field>
        <Field label="Not">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Bayram tatili" />
        </Field>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button variant="primary" className="w-full" disabled={busy || count === undefined} onClick={add}>
            {count === 0 ? 'Kapat' : 'Uygula'}
          </Button>
        </div>
      </div>
      {list.length > 0 && (
        <div className="mt-4 divide-y divide-line rounded-xl border border-line">
          {list.map(([d, h]) => (
            <div key={d} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                {fmtDate(d, 'd MMMM yyyy, EEEE')}
                {settings.dayNotes?.[d] && <span className="text-muted"> · {settings.dayNotes[d]}</span>}
              </span>
              <span className={cx('tabular-nums', h === 0 ? 'text-stone-500' : 'text-ink')}>{h === 0 ? 'Kapalı' : `${h} sipariş`}</span>
              <IconButton
                label="Kaldır"
                onClick={async () => {
                  await setDayCapacity([d], undefined, '')
                  toast('Varsayılan kapasiteye dönüldü')
                }}
              >
                <X size={16} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function DataCard() {
  const toast = useToast()
  const settings = useSettings()
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
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BackupButton />
        <RestoreButton />
        <span className="text-sm text-muted">
          Son yedek: {settings?.lastBackupAt ? fmtDate(new Date(settings.lastBackupAt).toISOString().slice(0, 10), 'd MMMM yyyy') : 'hiç alınmadı'}
        </span>
      </div>
      {import.meta.env.VITE_EMBED && (
        <div className="mt-3 rounded-xl bg-accent-soft/60 px-3 py-2 text-sm text-accent-ink">
          <b>Uygulamaya geçerken:</b> burada “Yedek al” ile dosyayı kaydedin, telefona yüklediğiniz uygulamada Ayarlar → “Yedeği geri
          yükle” ile açın. Tüm müşteri, sipariş ve görselleriniz taşınır.
        </div>
      )}
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
              if (!(await ask('Tüm müşteriler, siparişler, görseller ve stok kayıtları silinecek.', { confirmLabel: 'Devam' }))) return
              if (!(await ask('Bu işlem geri alınamaz. Önce yedek aldınız mı?', { confirmLabel: 'Tüm verileri sil' }))) return
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
