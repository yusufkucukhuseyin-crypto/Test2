import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { endOfMonth, startOfMonth } from 'date-fns'
import { History, Minus, Package, PackagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { addStockMove, deleteStockItem, deleteStockMove, saveStockItem } from '../db/actions'
import type { StockItem, StockMove } from '../db/types'
import { useSettings } from '../lib/hooks'
import { fmtDate, isoDate, matches, money, num, today } from '../lib/format'
import {
  Badge,
  Button,
  Card,
  ComboInput,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  NumberInput,
  PageHeader,
  Select,
  Stat,
  Textarea,
  Toggle,
  cx,
  useToast,
} from '../components/ui'
import { ask } from '../components/confirm'

type MoveKind = StockMove['type']
const MOVE_LABEL: Record<MoveKind, string> = { giris: 'Alış / giriş', cikis: 'Kullanım / çıkış', sayim: 'Sayım' }

export default function Stock() {
  const settings = useSettings()
  const items = useLiveQuery(() => db.stockItems.orderBy('name').toArray(), [])
  const moves = useLiveQuery(() => db.stockMoves.toArray(), [])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null)
  const [moving, setMoving] = useState<{ item: StockItem; type: MoveKind } | null>(null)
  const [history, setHistory] = useState<StockItem | null>(null)

  const isLow = (s: StockItem) => s.minQuantity !== undefined && s.minQuantity > 0 && s.quantity <= s.minQuantity

  const list = useMemo(
    () =>
      (items ?? []).filter(
        (s) => matches([s.name, s.category, s.notes], q) && (!cat || s.category === cat) && (!lowOnly || isLow(s)),
      ),
    [items, q, cat, lowOnly],
  )

  if (!settings || !items || !moves) return null

  const totalValue = items.reduce((s, i) => s + Math.max(0, i.quantity) * i.unitCost, 0)
  const lowCount = items.filter(isLow).length
  const ms = isoDate(startOfMonth(new Date()))
  const me = isoDate(endOfMonth(new Date()))
  const monthBuy = moves.filter((m) => m.type === 'giris' && m.date >= ms && m.date <= me && m.note !== 'Açılış stoğu').reduce((s, m) => s + m.quantity * m.unitCost, 0)
  const monthUse = moves.filter((m) => m.type === 'cikis' && m.date >= ms && m.date <= me).reduce((s, m) => s + m.quantity * m.unitCost, 0)
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[]

  return (
    <div>
      <PageHeader
        title="Stok"
        subtitle="Hammadde miktarları ve maliyetleri"
        actions={
          <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing('new')}>
            Malzeme ekle
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Stok değeri" value={money(totalValue)} sub={`${items.length} malzeme`} />
        <Stat label="Azalan" value={lowCount} tone={lowCount ? 'text-red-600' : undefined} sub="Minimum seviyenin altında" />
        <Stat label="Bu ay alış" value={money(monthBuy)} />
        <Stat label="Bu ay kullanım" value={money(monthUse)} sub="Siparişlere yazılan" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search size={18} className="text-muted" />
          <input className="h-11 flex-1 bg-transparent outline-none placeholder:text-stone-400" placeholder="Malzeme ara…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Toggle checked={lowOnly} onChange={setLowOnly} label="Sadece azalanlar" />
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={22} />}
            title={items.length ? 'Eşleşen malzeme yok' : 'Henüz malzeme yok'}
            text="Un, şeker, tereyağı, kutu gibi malzemeleri ekleyin. Alış yaptıkça miktar ve ortalama maliyet güncellenir."
            action={
              <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing('new')}>
                Malzeme ekle
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          <div className="hidden grid-cols-[1fr_120px_120px_120px_170px] gap-3 bg-stone-50 px-4 py-2 text-xs font-medium text-muted md:grid">
            <span>Malzeme</span>
            <span className="text-right">Miktar</span>
            <span className="text-right">Birim maliyet</span>
            <span className="text-right">Değer</span>
            <span />
          </div>
          {list.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[1fr_120px_120px_120px_170px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  {isLow(s) && <Badge className="bg-red-100 text-red-700">Azaldı</Badge>}
                </div>
                <div className="text-xs text-muted">
                  {s.category}
                  {s.minQuantity ? ` · min ${num(s.minQuantity)} ${s.unit}` : ''}
                </div>
              </div>
              <div className={cx('text-right tabular-nums md:order-none', isLow(s) && 'text-red-600', s.quantity < 0 && 'font-semibold')}>
                {num(s.quantity)} {s.unit}
                <div className="text-xs text-muted md:hidden">
                  {money(s.unitCost)}/{s.unit} · {money(Math.max(0, s.quantity) * s.unitCost)}
                </div>
              </div>
              <div className="hidden text-right tabular-nums md:block">{money(s.unitCost)}</div>
              <div className="hidden text-right tabular-nums md:block">{money(Math.max(0, s.quantity) * s.unitCost)}</div>
              <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                <Button size="sm" variant="soft" icon={<PackagePlus size={15} />} onClick={() => setMoving({ item: s, type: 'giris' })}>
                  Alış
                </Button>
                <IconButton label="Kullanım" onClick={() => setMoving({ item: s, type: 'cikis' })}>
                  <Minus size={18} />
                </IconButton>
                <IconButton label="Geçmiş" onClick={() => setHistory(s)}>
                  <History size={18} />
                </IconButton>
                <IconButton label="Düzenle" onClick={() => setEditing(s)}>
                  <Pencil size={17} />
                </IconButton>
              </div>
            </div>
          ))}
        </Card>
      )}

      <ItemModal item={editing} onClose={() => setEditing(null)} units={settings.options.stockUnits} categories={settings.options.stockCategories} />
      <MoveModal state={moving} onClose={() => setMoving(null)} />
      <HistoryModal item={history} onClose={() => setHistory(null)} onCount={(item) => { setHistory(null); setMoving({ item, type: 'sayim' }) }} />
    </div>
  )
}

function ItemModal({
  item,
  onClose,
  units,
  categories,
}: {
  item: StockItem | 'new' | null
  onClose: () => void
  units: string[]
  categories: string[]
}) {
  const toast = useToast()
  const isNew = item === 'new'
  const blank = { name: '', category: '', unit: units[0] ?? 'kg', minQuantity: undefined as number | undefined, notes: '', quantity: undefined as number | undefined, totalCost: undefined as number | undefined }
  const [form, setForm] = useState(blank)
  const [last, setLast] = useState<StockItem | 'new' | null>(null)
  if (item !== last) {
    setLast(item)
    if (item === 'new') setForm(blank)
    else if (item) setForm({ ...blank, name: item.name, category: item.category ?? '', unit: item.unit, minQuantity: item.minQuantity, notes: item.notes ?? '' })
  }
  if (!item) return null

  const save = async () => {
    if (!form.name.trim()) return
    await saveStockItem(
      {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        minQuantity: form.minQuantity,
        notes: form.notes,
        quantity: isNew ? form.quantity : undefined,
        unitCost: isNew && form.quantity ? (form.totalCost ?? 0) / form.quantity : undefined,
      },
      isNew ? undefined : item.id,
    )
    toast(isNew ? 'Malzeme eklendi' : 'Malzeme güncellendi')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Yeni malzeme' : 'Malzemeyi düzenle'}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={async () => {
                if (!(await ask(`${item.name} ve tüm hareketleri silinsin mi?`, { confirmLabel: 'Sil' }))) return
                await deleteStockItem(item.id)
                onClose()
              }}
            >
              Sil
            </Button>
          )}
          <Button variant="primary" disabled={!form.name.trim()} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Malzeme adı" className="col-span-2" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Kategori">
          <ComboInput options={categories} value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
        </Field>
        <Field label="Birim">
          <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
            {units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </Field>
        <Field label="Minimum seviye" hint="Altına düşünce uyarı verir">
          <NumberInput value={form.minQuantity} onChange={(v) => setForm({ ...form, minQuantity: v })} />
        </Field>
        {isNew && (
          <>
            <div />
            <Field label={`Mevcut miktar (${form.unit})`}>
              <NumberInput value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            </Field>
            <Field label="Toplam maliyeti (₺)" hint={form.quantity && form.totalCost ? `Birim: ${money(form.totalCost / form.quantity)}/${form.unit}` : undefined}>
              <NumberInput value={form.totalCost} onChange={(v) => setForm({ ...form, totalCost: v })} />
            </Field>
          </>
        )}
        <Field label="Not" className="col-span-2">
          <Textarea className="min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  )
}

function MoveModal({ state, onClose }: { state: { item: StockItem; type: MoveKind } | null; onClose: () => void }) {
  const toast = useToast()
  const [qty, setQty] = useState<number>()
  const [cost, setCost] = useState<number>()
  const [costMode, setCostMode] = useState<'toplam' | 'birim'>('toplam')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [last, setLast] = useState<typeof state>(null)
  if (state !== last) {
    setLast(state)
    setQty(state?.type === 'sayim' ? state.item.quantity : undefined)
    setCost(undefined)
    setDate(today())
    setNote('')
  }
  if (!state) return null
  const { item, type } = state
  const total = type === 'giris' && qty ? (costMode === 'toplam' ? cost : (cost ?? 0) * qty) : undefined

  const save = async () => {
    if (qty === undefined || (type !== 'sayim' && qty <= 0)) return
    await addStockMove({ itemId: item.id, type, quantity: qty, totalCost: total, date, note })
    toast(`${MOVE_LABEL[type]} kaydedildi`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.name} · ${MOVE_LABEL[type]}`}
      footer={
        <>
          <Button onClick={onClose}>Vazgeç</Button>
          <Button variant="primary" disabled={qty === undefined} onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="mb-3 text-sm text-muted">
        Mevcut: <b className="text-ink">{num(item.quantity)} {item.unit}</b> · Ortalama maliyet {money(item.unitCost)}/{item.unit}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={type === 'sayim' ? `Sayılan miktar (${item.unit})` : `Miktar (${item.unit})`}>
          <NumberInput value={qty} onChange={setQty} autoFocus />
        </Field>
        <Field label="Tarih">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {type === 'giris' && (
          <>
            <Field label={costMode === 'toplam' ? 'Ödenen toplam (₺)' : `Birim fiyat (₺/${item.unit})`}>
              <NumberInput value={cost} onChange={setCost} />
            </Field>
            <Field label="Fiyat girişi">
              <Select value={costMode} onChange={(e) => setCostMode(e.target.value as 'toplam' | 'birim')}>
                <option value="toplam">Toplam tutar</option>
                <option value="birim">Birim fiyat</option>
              </Select>
            </Field>
          </>
        )}
        <Field label="Not" className="col-span-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'giris' ? 'Örn. Metro alışverişi' : ''} />
        </Field>
      </div>
      {type === 'giris' && qty && total !== undefined && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
          Birim: {money(total / qty)}/{item.unit} · Yeni ortalama:{' '}
          <b>{money(item.quantity + qty > 0 ? (Math.max(item.quantity, 0) * item.unitCost + total) / (Math.max(item.quantity, 0) + qty) : 0)}</b>
        </div>
      )}
      {type === 'cikis' && <p className="mt-3 text-xs text-muted">Bir siparişe yazmak için sipariş detayındaki “Malzeme / maliyet” sekmesini kullanın.</p>}
    </Modal>
  )
}

function HistoryModal({ item, onClose, onCount }: { item: StockItem | null; onClose: () => void; onCount: (i: StockItem) => void }) {
  const moves = useLiveQuery(
    async () => (item ? (await db.stockMoves.where('itemId').equals(item.id).toArray()).sort((a, b) => b.createdAt - a.createdAt) : []),
    [item?.id],
  )
  if (!item) return null
  return (
    <Modal open onClose={onClose} title={`${item.name} · Hareketler`} footer={<Button onClick={() => onCount(item)}>Sayım yap</Button>}>
      {moves && moves.length ? (
        <div className="-mx-5 divide-y divide-line">
          {moves.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{MOVE_LABEL[m.type]}</div>
                <div className="truncate text-xs text-muted">
                  {fmtDate(m.date)}
                  {m.note ? ` · ${m.note}` : ''}
                </div>
              </div>
              <div className={cx('text-right text-sm tabular-nums', m.type === 'cikis' ? 'text-red-600' : m.type === 'giris' ? 'text-emerald-700' : '')}>
                {m.type === 'cikis' ? '−' : m.type === 'giris' ? '+' : '='}
                {num(m.quantity)} {item.unit}
                {m.type !== 'sayim' && <div className="text-xs text-muted">{money(m.quantity * m.unitCost)}</div>}
              </div>
              {m.type !== 'sayim' && (
                <IconButton
                  label="Geri al"
                  onClick={async () => {
                    if (await ask('Bu hareket geri alınsın mı? Miktar ve maliyet düzeltilir.', { confirmLabel: 'Geri al' })) await deleteStockMove(m.id)
                  }}
                >
                  <Trash2 size={16} className="text-stone-400" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted">Hareket yok.</div>
      )}
    </Modal>
  )
}
