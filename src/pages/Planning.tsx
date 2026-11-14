import { useMemo, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { startOfWeek } from 'date-fns'
import { Cake, Check, ChevronLeft, ChevronRight, ExternalLink, Trash2, Wand2 } from 'lucide-react'
import { db } from '../db/db'
import { regenerateTasks } from '../db/actions'
import type { Order, Settings, Task } from '../db/types'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useMediaQuery, useSettings } from '../lib/hooks'
import { TONE_STYLE, dayLoad, loadTone, orderSummary, productTypeOf, taskCovers, taskEnd, weekdayIndex } from '../lib/domain'
import { WEEKDAYS_SHORT, diffDays, fmtDate, isoDate, num, shiftDay, today } from '../lib/format'
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Toggle, cx, useToast } from '../components/ui'

const LANE_H = 34

interface Drag {
  id: string
  mode: 'move' | 'resize'
  startX: number
  dx: number
}

export default function Planning() {
  const settings = useSettings()
  const data = useCoreData()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const wide = useMediaQuery('(min-width: 768px)')
  const toast = useToast()
  // Tablette haftanın başından, telefonda dünden başla (dar ekranda geçmiş günler yer kaplamasın)
  const defaultStart = () =>
    window.matchMedia('(min-width: 768px)').matches ? isoDate(startOfWeek(new Date(), { weekStartsOn: 1 })) : shiftDay(today(), -1)
  const [start, setStart] = useState(defaultStart)
  const [span, setSpan] = useState<'7' | '14'>(() => (window.matchMedia('(min-width: 768px)').matches ? '14' : '7'))
  const [showDelivered, setShowDelivered] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)

  const COL = wide ? (span === '7' ? 100 : 76) : span === '7' ? 66 : 54
  const LABEL = wide ? 220 : 128
  const n = Number(span)
  const days = useMemo(() => Array.from({ length: n }, (_, i) => shiftDay(start, i)), [start, n])
  const end = days[days.length - 1]
  const t = today()

  const tasksByOrder = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const x of tasks ?? []) {
      const arr = m.get(x.orderId) ?? []
      arr.push(x)
      m.set(x.orderId, arr)
    }
    return m
  }, [tasks])

  const rows = useMemo(() => {
    if (!data) return []
    return data.orders
      .filter((o) => o.status !== 'iptal' && (showDelivered || o.status !== 'teslim'))
      .filter(
        (o) =>
          (o.deliveryDate >= start && o.deliveryDate <= end) ||
          (tasksByOrder.get(o.id) ?? []).some((x) => x.start <= end && taskEnd(x) >= start),
      )
      .sort(sortByDelivery)
  }, [data, tasksByOrder, start, end, showDelivered])

  if (!settings || !data || !tasks) return null

  const workload = days.map((d) => tasks.filter((x) => !x.done && taskCovers(x, d)).length)
  const maxWork = Math.max(1, ...workload)

  const onDown = (e: RPointerEvent, task: Task, mode: Drag['mode']) => {
    e.stopPropagation()
    const bar = (e.currentTarget as HTMLElement).closest('[data-bar]') as HTMLElement
    bar.setPointerCapture(e.pointerId)
    setDrag({ id: task.id, mode, startX: e.clientX, dx: 0 })
  }
  const onMove = (e: RPointerEvent) => {
    if (drag) setDrag({ ...drag, dx: e.clientX - drag.startX })
  }
  const onUp = async (task: Task) => {
    if (!drag) return
    const delta = Math.round(drag.dx / COL)
    const d = drag
    setDrag(null)
    if (Math.abs(d.dx) < 5) {
      if (d.mode === 'move') setEditing(task)
      return
    }
    if (delta === 0) return
    if (d.mode === 'move') {
      await db.tasks.update(task.id, { start: shiftDay(task.start, delta) })
    } else {
      await db.tasks.update(task.id, { days: Math.max(1, task.days + delta) })
    }
  }

  return (
    <div>
      <PageHeader
        title="Üretim planı"
        subtitle="İş adımlarını sürükleyerek taşıyın, sağ kenarından çekerek uzatın"
        actions={
          <div className="flex flex-wrap items-center gap-1">
            <IconButton label="Geri" onClick={() => setStart(shiftDay(start, -7))}>
              <ChevronLeft size={20} />
            </IconButton>
            <Button size="sm" onClick={() => setStart(defaultStart())}>
              Bugün
            </Button>
            <IconButton label="İleri" onClick={() => setStart(shiftDay(start, 7))}>
              <ChevronRight size={20} />
            </IconButton>
            <Segmented
              value={span}
              onChange={setSpan}
              options={[
                { value: '7', label: '1 hafta' },
                { value: '14', label: '2 hafta' },
              ]}
            />
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          {fmtDate(start, 'd MMM')} – {fmtDate(end, 'd MMM yyyy')}
        </div>
        <Toggle checked={showDelivered} onChange={setShowDelivered} label="Teslim edilenleri göster" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ width: LABEL + COL * n }} className="select-none">
            {/* Gün başlıkları */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-stone-50">
              <div style={{ width: LABEL }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-stone-50 px-3 py-2 text-xs font-medium text-muted">
                Sipariş
              </div>
              {days.map((d) => {
                const l = dayLoad(settings, data.orders, d)
                const tone = TONE_STYLE[loadTone(l)]
                return (
                  <div
                    key={d}
                    style={{ width: COL }}
                    className={cx('shrink-0 border-r border-line px-1 py-1.5 text-center', d === t && 'bg-accent-soft')}
                  >
                    <div className="text-[11px] text-muted">{WEEKDAYS_SHORT[weekdayIndex(d)]}</div>
                    <div className={cx('text-sm font-semibold', d === t && 'text-accent-ink')}>{Number(d.slice(8))}</div>
                    <div className={cx('text-[10px] leading-tight', tone.text)} title="Teslim kapasitesi">
                      {num(l.load)}/{num(l.capacity)}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* İş yükü satırı */}
            <div className="flex border-b border-line">
              <div style={{ width: LABEL }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-white px-3 py-1.5 text-xs text-muted">
                Günlük iş yükü
              </div>
              {days.map((d, i) => (
                <div key={d} style={{ width: COL }} className="flex shrink-0 items-end justify-center border-r border-line px-2 py-1.5">
                  <div className="flex w-full flex-col items-center gap-0.5">
                    <div className="flex h-6 w-full items-end">
                      <div className="w-full rounded-sm bg-accent/60" style={{ height: `${(workload[i] / maxWork) * 100}%`, minHeight: workload[i] ? 3 : 0 }} />
                    </div>
                    <span className="text-[10px] text-muted">{workload[i] || ''}</span>
                  </div>
                </div>
              ))}
            </div>

            {rows.length === 0 && (
              <EmptyState title="Bu aralıkta planlanacak iş yok" text="Siparişler oluşturulduğunda iş adımları ürün şablonuna göre otomatik eklenir." />
            )}

            {rows.map((o) => (
              <GanttRow
                key={o.id}
                order={o}
                tasks={tasksByOrder.get(o.id) ?? []}
                customerName={data.customerById.get(o.customerId)?.name ?? ''}
                days={days}
                start={start}
                col={COL}
                label={LABEL}
                drag={drag}
                onDown={onDown}
                onMove={onMove}
                onUp={onUp}
                settings={settings}
                onGenerate={async () => {
                  await regenerateTasks(o.id)
                  toast('Plan oluşturuldu')
                }}
              />
            ))}
          </div>
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">
        İpucu: Bir adıma dokunarak tamamlandı işaretleyebilir, adını ve süresini değiştirebilirsiniz. Adımlar ürün türüne göre
        Ayarlar’daki şablondan (rota) oluşturulur.
      </p>
      <TaskModal task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function GanttRow({
  order,
  tasks,
  customerName,
  days,
  start,
  col,
  label,
  drag,
  onDown,
  onMove,
  onUp,
  onGenerate,
  settings,
}: {
  settings: Settings
  order: Order
  tasks: Task[]
  customerName: string
  days: string[]
  start: string
  col: number
  label: number
  drag: Drag | null
  onDown: (e: RPointerEvent, t: Task, mode: Drag['mode']) => void
  onMove: (e: RPointerEvent) => void
  onUp: (t: Task) => void
  onGenerate: () => void
}) {
  const pt = productTypeOf(settings, order.productType)
  const t = today()

  // Çakışan adımları alt satırlara (lane) yerleştir
  const lanes = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.start.localeCompare(b.start) || a.sort - b.sort)
    const laneEnds: string[] = []
    const out = new Map<string, number>()
    for (const x of sorted) {
      let lane = laneEnds.findIndex((e) => e < x.start)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push('')
      }
      laneEnds[lane] = taskEnd(x)
      out.set(x.id, lane)
    }
    return { map: out, count: Math.max(1, laneEnds.length) }
  }, [tasks])

  const height = Math.max(76, lanes.count * LANE_H + 12)
  const deliveryIdx = diffDays(order.deliveryDate, start)

  return (
    <div className={cx('flex border-b border-line', order.status === 'teslim' && 'opacity-60')}>
      <div style={{ width: label, minHeight: height }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-white px-3 py-2">
        <Link to={`/siparisler/${order.id}`} className="block truncate text-sm font-medium hover:underline">
          {customerName}
        </Link>
        <div className="truncate text-xs text-muted">{orderSummary(order, pt)}</div>
        <div className={cx('text-xs', order.deliveryDate < t ? 'text-muted' : 'text-accent-ink')}>
          Teslim {fmtDate(order.deliveryDate, 'd MMM')}
          {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
        </div>
        {tasks.length === 0 && (
          <button type="button" onClick={onGenerate} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
            <Wand2 size={12} /> Plan oluştur
          </button>
        )}
      </div>
      <div className="relative shrink-0 overflow-hidden" style={{ width: col * days.length, height }}>
        {/* ızgara */}
        <div className="absolute inset-0 flex">
          {days.map((d) => (
            <div key={d} style={{ width: col }} className={cx('shrink-0 border-r border-line/70', d === t && 'bg-accent-soft/40')} />
          ))}
        </div>
        {/* teslim işareti */}
        {deliveryIdx >= 0 && deliveryIdx < days.length && (
          <div className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: deliveryIdx * col + col - 12, width: 12 }}>
            <div className="h-full w-0.5 bg-accent/50" />
            <Cake size={14} className="absolute top-1 text-accent" />
          </div>
        )}
        {tasks.map((x) => {
          const lane = lanes.map.get(x.id) ?? 0
          const isDrag = drag?.id === x.id
          const delta = isDrag ? Math.round(drag.dx / col) : 0
          const s = diffDays(x.start, start) + (isDrag && drag.mode === 'move' ? delta : 0)
          const w = Math.max(1, x.days + (isDrag && drag.mode === 'resize' ? delta : 0))
          const late = (isDrag && drag.mode === 'move' ? shiftDay(x.start, delta) : x.start) > order.deliveryDate ||
            taskEnd({ ...x, start: isDrag && drag.mode === 'move' ? shiftDay(x.start, delta) : x.start, days: w }) > order.deliveryDate
          return (
            <div
              key={x.id}
              data-bar
              onPointerDown={(e) => onDown(e, x, 'move')}
              onPointerMove={onMove}
              onPointerUp={() => onUp(x)}
              onPointerCancel={() => onUp(x)}
              className={cx(
                'absolute flex cursor-grab touch-none items-center gap-1 overflow-hidden rounded-lg px-2 text-xs font-medium text-ink shadow-sm transition-shadow',
                isDrag && 'z-20 cursor-grabbing shadow-lg ring-2 ring-accent',
                x.done && 'opacity-55',
                late && 'ring-2 ring-red-400',
              )}
              style={{
                left: s * col + 3,
                width: w * col - 6,
                top: 6 + lane * LANE_H,
                height: LANE_H - 6,
                background: pt.color + (x.done ? '40' : '66'),
                borderLeft: `3px solid ${pt.color}`,
              }}
              title={`${x.name} · ${fmtDate(x.start, 'd MMM')}${x.days > 1 ? ` – ${fmtDate(taskEnd(x), 'd MMM')}` : ''}`}
            >
              {x.done && <Check size={12} className="shrink-0" />}
              <span className={cx('truncate', x.done && 'line-through')}>{x.name}</span>
              <div
                onPointerDown={(e) => onDown(e, x, 'resize')}
                className="absolute top-0 right-0 bottom-0 w-3 cursor-ew-resize"
                aria-label="Süreyi değiştir"
              >
                <div className="absolute top-1/2 right-1 h-3 w-0.5 -translate-y-1/2 rounded bg-ink/30" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [form, setForm] = useState<Task | null>(null)
  const [lastId, setLastId] = useState<string>()
  if (task && task.id !== lastId) {
    setLastId(task.id)
    setForm(task)
  }
  if (!task || !form) return null
  const save = async () => {
    await db.tasks.update(task.id, { name: form.name, start: form.start, days: form.days, done: form.done })
    setLastId(undefined)
    onClose()
  }
  const close = () => {
    setLastId(undefined)
    onClose()
  }
  return (
    <Modal
      open
      onClose={close}
      title="İş adımı"
      footer={
        <>
          <Button
            variant="danger"
            icon={<Trash2 size={16} />}
            onClick={async () => {
              await db.tasks.delete(task.id)
              close()
            }}
          >
            Sil
          </Button>
          <Button variant="primary" onClick={save}>
            Kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Adım">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç">
            <Input type="date" value={form.start} onChange={(e) => e.target.value && setForm({ ...form, start: e.target.value })} />
          </Field>
          <Field label="Süre">
            <Select value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d} gün
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Toggle checked={form.done} onChange={(v) => setForm({ ...form, done: v })} label="Tamamlandı" />
        <Link to={`/siparisler/${task.orderId}`} className="inline-flex items-center gap-1 text-sm text-accent-ink underline" onClick={close}>
          <ExternalLink size={14} /> Siparişe git
        </Link>
      </div>
    </Modal>
  )
}
