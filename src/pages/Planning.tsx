import { useCallback, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { startOfWeek } from 'date-fns'
import { AlertTriangle, CalendarCheck, Cake, Check, ChevronLeft, ChevronRight, ExternalLink, Lock, Trash2, Wand2 } from 'lucide-react'
import { db } from '../db/db'
import { moveTask, regenerateTasks, replanOrders, setTaskMinutes } from '../db/actions'
import type { Order, Settings, Task } from '../db/types'
import { useCoreData, usePlanData, sortByDelivery } from '../lib/data'
import { useMediaQuery, useSettings } from '../lib/hooks'
import { orderSummary, productTypeOf, taskEnd, weekdayIndex } from '../lib/domain'
import { WEEKDAYS_SHORT, diffDays, fmtDate, isoDate, shiftDay, today } from '../lib/format'
import { TONE, allocDays, dayUsage, fmtHours, fmtMin, taskIssue, usageTone, type Load } from '../lib/schedule'
import { ask, tell } from '../components/confirm'
import { Button, Card, EmptyState, Field, IconButton, Input, Modal, NumberInput, PageHeader, Segmented, Toggle, cx, useToast } from '../components/ui'

const LANE_H = 34

interface Drag {
  id: string
  startX: number
  dx: number
}

export default function Planning() {
  const settings = useSettings()
  const core = useCoreData()
  const plan = usePlanData()
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
  const [busy, setBusy] = useState(false)

  const [boxW, setBoxW] = useState(0)
  const boxRef = useRef<ResizeObserver | null>(null)
  const measure = useCallback((el: HTMLDivElement | null) => {
    boxRef.current?.disconnect()
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width))
    ro.observe(el)
    boxRef.current = ro
  }, [])
  const LABEL = wide ? 200 : 128
  // Sütunlar ekrana sığacak kadar genişler; en dar sınırın altında yatay kaydırma olur
  const minCol = wide ? (span === '7' ? 88 : 64) : span === '7' ? 70 : 58
  const COL = Math.max(minCol, boxW ? Math.floor((boxW - LABEL) / Number(span)) : minCol)
  const n = Number(span)
  const days = useMemo(() => Array.from({ length: n }, (_, i) => shiftDay(start, i)), [start, n])
  const end = days[days.length - 1]
  const t = today()

  const tasksByOrder = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const x of plan?.tasks ?? []) {
      const arr = m.get(x.orderId) ?? []
      arr.push(x)
      m.set(x.orderId, arr)
    }
    return m
  }, [plan])

  const rows = useMemo(() => {
    if (!plan) return []
    return plan.orders
      .filter((o) => o.status !== 'iptal' && (showDelivered || o.status !== 'teslim'))
      .filter(
        (o) =>
          (o.deliveryDate >= start && o.deliveryDate <= end) ||
          (tasksByOrder.get(o.id) ?? []).some((x) => x.start <= end && taskEnd(x) >= start),
      )
      .sort(sortByDelivery)
  }, [plan, tasksByOrder, start, end, showDelivered])

  // Uyarılar: önümüzdeki 30 günde kapasite aşımı ve teslime yetişmeyen siparişler
  const issues = useMemo(() => {
    if (!plan || !settings) return { over: [] as string[], late: [] as Order[] }
    const over: string[] = []
    for (let i = 0; i < 30; i++) {
      const d = shiftDay(t, i)
      if (usageTone(dayUsage(settings, plan.load, d)) === 'asim') over.push(d)
    }
    const late = plan.orders.filter(
      (o) => o.status !== 'iptal' && o.status !== 'teslim' && (tasksByOrder.get(o.id) ?? []).some((x) => taskIssue(x, o.deliveryDate, t) === 'gec'),
    )
    return { over, late }
  }, [plan, settings, tasksByOrder, t])

  if (!settings || !plan || !core) return null

  const onDown = (e: RPointerEvent, task: Task) => {
    if (task.done) return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ id: task.id, startX: e.clientX, dx: 0 })
  }
  const onMove = (e: RPointerEvent) => {
    if (drag) setDrag({ ...drag, dx: e.clientX - drag.startX })
  }
  const onUp = async (task: Task) => {
    if (!drag) {
      setEditing(task)
      return
    }
    const d = drag
    setDrag(null)
    if (Math.abs(d.dx) < 5) {
      setEditing(task)
      return
    }
    const delta = Math.round(d.dx / COL)
    if (delta !== 0) await moveTask(task.id, shiftDay(task.start, delta))
  }

  const replanAll = async () => {
    const ok = await ask(
      'Bugünden sonra teslim edilecek tüm açık siparişlerin bitmemiş işleri, günlük kapasitelere göre teslim tarihlerinden geriye doğru yeniden yerleştirilecek. Kapalı günler atlanır.\n\nÖncelik: kesinleşmiş siparişler, en yakın teslim tarihli olandan başlayarak; teklif aşamasındakiler kalan kapasiteye yerleşir. Elle taşıdığınız adımlar yerinde kalır.',
      { confirmLabel: 'Yeniden planla', danger: false },
    )
    if (!ok) return
    setBusy(true)
    try {
      const r = await replanOrders(null)
      if (r.late.length) {
        const lines = r.late.map((l) => {
          const o = plan.orderById.get(l.orderId)
          return `• ${o ? core.customerById.get(o.customerId)?.name : ''} (#${o?.no}) — teslim ${o ? fmtDate(o.deliveryDate, 'd MMM') : ''}${l.earliest ? `, en erken ${fmtDate(l.earliest, 'd MMM EEE')}` : ''}`
        })
        await tell(`${r.orders} sipariş yeniden planlandı. Şunlar teslim tarihine kapasiteye sığmıyor ve bugünden itibaren yerleştirildi:\n${lines.join('\n')}`)
      } else toast(`${r.orders} sipariş kapasiteye göre planlandı`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Üretim planı"
        subtitle="İşler teslimden geriye doğru günlük kapasiteye göre yerleşir · sürükleyerek başka güne alın"
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

      {(issues.over.length > 0 || issues.late.length > 0) && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1">
              {issues.over.length > 0 && (
                <div>
                  Kapasitesi aşılan günler: <b>{issues.over.slice(0, 5).map((d) => fmtDate(d, 'd MMM EEE')).join(', ')}</b>
                  {issues.over.length > 5 ? ` +${issues.over.length - 5}` : ''}
                </div>
              )}
              {issues.late.length > 0 && (
                <div>
                  Teslime yetişmeyen: <b>{issues.late.map((o) => `${core.customerById.get(o.customerId)?.name} (${fmtDate(o.deliveryDate, 'd MMM')})`).join(', ')}</b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          {fmtDate(start, 'd MMM')} – {fmtDate(end, 'd MMM yyyy')}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Toggle checked={showDelivered} onChange={setShowDelivered} label="Teslim edilenler" />
          <Button size="sm" variant="primary" icon={<CalendarCheck size={15} />} disabled={busy} onClick={replanAll}>
            Kapasiteye göre yeniden planla
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto" ref={measure}>
          <div style={{ width: LABEL + COL * n }} className="select-none">
            {/* Gün başlıkları + kapasite */}
            <div className="sticky top-0 z-10 flex border-b border-line bg-stone-50">
              <div style={{ width: LABEL }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-stone-50 px-3 py-2 text-xs font-medium text-muted">
                Sipariş
                <div className="mt-3 font-normal">Doluluk (saat)</div>
              </div>
              {days.map((d) => {
                const u = dayUsage(settings, plan.load, d)
                const tone = usageTone(u)
                return (
                  <div
                    key={d}
                    style={{ width: COL }}
                    className={cx(
                      'shrink-0 border-r border-line px-1.5 py-1.5 text-center',
                      d === t && 'bg-accent-soft',
                      u.closed && 'bg-stone-100',
                    )}
                    title={settings.dayNotes?.[d]}
                  >
                    <div className="text-[11px] text-muted">{WEEKDAYS_SHORT[weekdayIndex(d)]}</div>
                    <div className={cx('text-sm font-semibold', d === t && 'text-accent-ink')}>{Number(d.slice(8))}</div>
                    {u.closed ? (
                      <div className={cx('mt-1 flex items-center justify-center gap-0.5 text-[10px]', tone === 'asim' ? 'font-semibold text-red-600' : 'text-stone-500')}>
                        <Lock size={10} /> {tone === 'asim' ? 'iş var' : 'kapalı'}
                      </div>
                    ) : (
                      <>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                          <div className={cx('h-full', TONE[tone].bar)} style={{ width: `${Math.min(100, u.ratio * 100)}%` }} />
                        </div>
                        <div className={cx('mt-0.5 text-[10px] leading-tight tabular-nums', TONE[tone].text)}>
                          {fmtHours(u.used)}/{fmtHours(u.cap)}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {rows.length === 0 && (
              <EmptyState title="Bu aralıkta planlanacak iş yok" text="Siparişler oluşturulduğunda iş adımları ürün şablonuna göre kapasiteye yerleştirilir." />
            )}

            {rows.map((o) => (
              <GanttRow
                key={o.id}
                order={o}
                tasks={tasksByOrder.get(o.id) ?? []}
                customerName={core.customerById.get(o.customerId)?.name ?? ''}
                days={days}
                start={start}
                col={COL}
                label={LABEL}
                drag={drag}
                settings={settings}
                load={plan.load}
                onDown={onDown}
                onMove={onMove}
                onUp={onUp}
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
        Bir adımı sürükleyip bıraktığınızda bırakılan günden itibaren ilk boş kapasiteye yerleşir (kapalı ve dolu günler atlanır) ve
        “elle yerleştirildi” olarak işaretlenir. Dokunarak süresini değiştirebilir, tamamlandı işaretleyebilirsiniz. Adım süreleri ve
        sıraları Ayarlar’daki ürün şablonlarından gelir.
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
  settings,
  load,
  onDown,
  onMove,
  onUp,
  onGenerate,
}: {
  order: Order
  tasks: Task[]
  customerName: string
  days: string[]
  start: string
  col: number
  label: number
  drag: Drag | null
  settings: Settings
  load: Load
  onDown: (e: RPointerEvent, t: Task) => void
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
  const late = tasks.some((x) => taskIssue(x, order.deliveryDate, t) === 'gec')

  return (
    <div className={cx('flex border-b border-line', order.status === 'teslim' && 'opacity-60')}>
      <div style={{ width: label, minHeight: height }} className="sticky left-0 z-10 shrink-0 border-r border-line bg-white px-3 py-2">
        <Link to={`/siparisler/${order.id}`} className="block truncate text-sm font-medium hover:underline">
          {customerName}
        </Link>
        <div className="truncate text-xs text-muted">{orderSummary(order, pt)}</div>
        <div className={cx('text-xs', late ? 'font-medium text-red-600' : order.deliveryDate < t ? 'text-muted' : 'text-accent-ink')}>
          Teslim {fmtDate(order.deliveryDate, 'd MMM')}
          {order.deliveryTime ? ` ${order.deliveryTime}` : ''}
          {late ? ' · yetişmiyor' : ''}
        </div>
        {tasks.length === 0 && (
          <button type="button" onClick={onGenerate} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
            <Wand2 size={12} /> Plan oluştur
          </button>
        )}
      </div>
      <div className="relative shrink-0 overflow-hidden" style={{ width: col * days.length, height }}>
        {/* ızgara: kapalı günler taralı */}
        <div className="absolute inset-0 flex">
          {days.map((d) => (
            <div
              key={d}
              style={{ width: col }}
              className={cx(
                'shrink-0 border-r border-line/70',
                d === t && 'bg-accent-soft/40',
                dayUsage(settings, load, d).closed &&
                  'bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(120,113,108,0.10)_6px,rgba(120,113,108,0.10)_12px)]',
              )}
            />
          ))}
        </div>
        {/* teslim işareti */}
        {deliveryIdx >= 0 && deliveryIdx < days.length && (
          <div className="absolute top-0 bottom-0" style={{ left: deliveryIdx * col + col - 8, width: 2 }}>
            <div className="h-full w-0.5 bg-accent/60" />
            <Cake size={14} className="absolute top-1 -left-[6px] text-accent" />
          </div>
        )}
        {tasks.map((x) => {
          const lane = lanes.map.get(x.id) ?? 0
          const isDrag = drag?.id === x.id
          const delta = isDrag ? Math.round(drag.dx / col) : 0
          const issue = taskIssue(x, order.deliveryDate, t)
          const ad = allocDays(x)
          // Ardışık günleri tek parça çiz; kapalı gün araya girerse parça bölünür
          const segs: { from: string; to: string }[] = []
          for (const d of ad) {
            const last = segs[segs.length - 1]
            if (last && diffDays(d, last.to) === 1) last.to = d
            else segs.push({ from: d, to: d })
          }
          return segs.map((sg, si) => {
            const s = diffDays(sg.from, start) + delta
            const w = diffDays(sg.to, sg.from) + 1
            if (s + w < 0 || s > days.length) return null
            const mins = Object.entries(x.alloc)
              .filter(([d]) => d >= sg.from && d <= sg.to)
              .reduce((a, [, m]) => a + m, 0)
            return (
              <div
                key={x.id + si}
                data-bar={x.id}
                onPointerDown={(e) => onDown(e, x)}
                onPointerMove={onMove}
                onPointerUp={() => onUp(x)}
                onPointerCancel={() => onUp(x)}
                className={cx(
                  'absolute flex touch-none items-center gap-1 overflow-hidden rounded-lg px-2 text-xs font-medium text-ink shadow-sm transition-shadow',
                  x.done ? 'cursor-pointer opacity-55' : 'cursor-grab',
                  isDrag && 'z-20 cursor-grabbing shadow-lg ring-2 ring-accent',
                  issue === 'gec' && 'ring-2 ring-red-400',
                  x.manual && !isDrag && 'outline-1 outline-sky-400 outline-dashed',
                )}
                style={{
                  left: s * col + 3,
                  width: w * col - 6,
                  top: 6 + lane * LANE_H,
                  height: LANE_H - 6,
                  background: pt.color + (x.done ? '40' : '66'),
                  borderLeft: `3px solid ${pt.color}`,
                }}
                title={`${x.name} · ${fmtMin(x.minutes)}\n${ad.map((d) => `${fmtDate(d, 'd MMM EEE')}: ${fmtMin(x.alloc[d])}`).join('\n')}`}
              >
                {x.done && <Check size={12} className="shrink-0" />}
                <span className={cx('truncate', x.done && 'line-through')}>
                  {si === 0 ? x.name : '↳ ' + x.name}
                  <span className="ml-1 font-normal opacity-70">{fmtMin(mins)}</span>
                </span>
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const toast = useToast()
  const [form, setForm] = useState<{ name: string; minutes?: number; from: string; done: boolean } | null>(null)
  const [lastId, setLastId] = useState<string>()
  if (task && task.id !== lastId) {
    setLastId(task.id)
    setForm({ name: task.name, minutes: task.minutes, from: task.start, done: task.done })
  }
  if (!task || !form) return null
  const close = () => {
    setLastId(undefined)
    onClose()
  }
  const save = async () => {
    await db.tasks.update(task.id, { name: form.name.trim() || task.name, done: form.done })
    if ((form.minutes ?? 0) !== task.minutes) await setTaskMinutes(task.id, form.minutes ?? 0)
    if (form.from !== task.start && !form.done) await moveTask(task.id, form.from)
    close()
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
          <Field label="İş süresi (dakika)" hint={form.minutes ? fmtMin(form.minutes) : undefined}>
            <NumberInput value={form.minutes} onChange={(v) => setForm({ ...form, minutes: v })} min={0} step={15} />
          </Field>
          <Field label="Bu günden itibaren" hint="İlk boş kapasiteye yerleşir">
            <Input type="date" value={form.from} onChange={(e) => e.target.value && setForm({ ...form, from: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-sm">
          <div className="mb-1 text-xs text-muted">Şu anki dağılım</div>
          {allocDays(task).map((d) => (
            <div key={d} className="flex justify-between">
              <span>{fmtDate(d, 'd MMMM EEEE')}</span>
              <span className="tabular-nums">{fmtMin(task.alloc[d])}</span>
            </div>
          ))}
        </div>
        <Toggle checked={form.done} onChange={(v) => setForm({ ...form, done: v })} label="Tamamlandı" />
        {task.manual && (
          <Button
            size="sm"
            icon={<Wand2 size={15} />}
            onClick={async () => {
              await db.tasks.update(task.id, { manual: false })
              await replanOrders([task.orderId])
              toast('Adım otomatik plana döndü')
              close()
            }}
          >
            Otomatik plana döndür
          </Button>
        )}
        <Link to={`/siparisler/${task.orderId}`} className="block text-sm text-accent-ink underline" onClick={close}>
          <ExternalLink size={14} className="mr-1 inline" /> Siparişe git
        </Link>
      </div>
    </Modal>
  )
}
