import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { endOfMonth, startOfMonth } from 'date-fns'
import { AlertTriangle, CalendarDays, Check, ClipboardList, Gift, Package, Plus, Sparkles, Wallet } from 'lucide-react'
import { db } from '../db/db'
import { loadDemoData } from '../db/seed'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { isOpen, productTypeOf, specialDayText, taskCovers, taskEnd, upcomingSpecialDays } from '../lib/domain'
import { fmtDate, isoDate, money, num, shiftDay, today } from '../lib/format'
import { OrderRow } from '../components/shared'
import { Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, cx, useToast } from '../components/ui'

export default function Dashboard() {
  const settings = useSettings()
  const data = useCoreData()
  const toast = useToast()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const stock = useLiveQuery(() => db.stockItems.toArray(), [])
  const t = today()

  const view = useMemo(() => {
    if (!data || !settings) return null
    const active = data.orders.filter((o) => o.status !== 'iptal')
    const week = shiftDay(t, 7)
    const todays = active.filter((o) => o.deliveryDate === t).sort(sortByDelivery)
    const upcoming = active.filter((o) => o.deliveryDate > t && o.deliveryDate <= week && isOpen(o.status)).sort(sortByDelivery)
    const overdue = active.filter((o) => o.deliveryDate < t && isOpen(o.status)).sort(sortByDelivery)
    const quotes = active.filter((o) => o.status === 'teklif' && o.deliveryDate >= t).sort(sortByDelivery)
    const open = active.filter((o) => isOpen(o.status))
    const receivable = active.reduce((s, o) => s + Math.max(0, o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0)), 0)
    const ms = isoDate(startOfMonth(new Date()))
    const me = isoDate(endOfMonth(new Date()))
    const monthRevenue = active.filter((o) => o.deliveryDate >= ms && o.deliveryDate <= me).reduce((s, o) => s + o.agreedPrice, 0)
    const specials = upcomingSpecialDays(data.customers, settings.reminderDays)
    return { todays, upcoming, overdue, quotes, open, receivable, monthRevenue, specials }
  }, [data, settings, t])

  if (!settings || !data || !view) return null

  const orderById = new Map(data.orders.map((o) => [o.id, o]))
  const todayTasks = (tasks ?? [])
    .filter((x) => taskCovers(x, t) && orderById.get(x.orderId)?.status !== 'iptal')
    .sort((a, b) => Number(a.done) - Number(b.done) || (orderById.get(a.orderId)?.deliveryDate ?? '').localeCompare(orderById.get(b.orderId)?.deliveryDate ?? ''))
  const lateTasks = (tasks ?? []).filter((x) => !x.done && taskEnd(x) < t && isOpen(orderById.get(x.orderId)?.status ?? 'iptal'))
  const lowStock = (stock ?? []).filter((s) => s.minQuantity !== undefined && s.minQuantity > 0 && s.quantity <= s.minQuantity)

  const empty = data.orders.length === 0 && data.customers.length === 0

  return (
    <div>
      <PageHeader
        title="Merhaba 👋"
        subtitle={fmtDate(t, 'd MMMM yyyy, EEEE')}
        actions={
          <LinkButton to="/siparisler/yeni" variant="primary" icon={<Plus size={18} />} className="hidden md:inline-flex">
            Yeni sipariş
          </LinkButton>
        }
      />

      {empty && (
        <Card className="mb-4 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={22} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg">Hoş geldiniz!</div>
              <p className="text-sm text-muted">
                İlk siparişinizi ekleyerek başlayabilir ya da uygulamayı tanımak için örnek verileri yükleyebilirsiniz. Örnek
                verileri daha sonra Ayarlar’dan tek tuşla silebilirsiniz.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  await loadDemoData()
                  toast('Örnek veriler yüklendi')
                }}
              >
                Örnek verilerle dene
              </Button>
              <LinkButton to="/siparisler/yeni" variant="primary">
                İlk siparişi ekle
              </LinkButton>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bugün teslim" value={view.todays.length} sub={view.todays.length ? undefined : 'Teslim yok'} />
        <Stat label="7 gün içinde" value={view.upcoming.length} sub={`${view.open.length} açık sipariş`} />
        <Stat label="Bekleyen tahsilat" value={money(view.receivable)} tone={view.receivable > 0 ? 'text-red-600' : undefined} />
        <Stat label="Bu ay ciro" value={money(view.monthRevenue)} sub="Teslim tarihine göre" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {view.overdue.length > 0 && (
            <Card className="overflow-hidden border-red-200">
              <CardHeader title={<span className="text-red-700">Tarihi geçmiş, kapanmamış siparişler</span>} icon={<AlertTriangle size={18} />} />
              <p className="-mt-1 px-4 pb-2 text-xs text-muted">Teslim edildiyse durumunu güncelleyin.</p>
              <div className="divide-y divide-line border-t border-line">
                {view.overdue.map((o) => (
                  <OrderRow key={o.id} order={o} customer={data.customerById.get(o.customerId)} settings={settings} paid={data.paidByOrder.get(o.id) ?? 0} />
                ))}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader
              title="Bugünün teslimleri"
              icon={<ClipboardList size={18} />}
              action={
                <Link to="/siparisler?g=bugun" className="text-sm text-accent-ink">
                  Tümü
                </Link>
              }
            />
            {view.todays.length ? (
              <div className="divide-y divide-line border-t border-line">
                {view.todays.map((o) => (
                  <OrderRow key={o.id} order={o} customer={data.customerById.get(o.customerId)} settings={settings} paid={data.paidByOrder.get(o.id) ?? 0} showDate={false} />
                ))}
              </div>
            ) : (
              <div className="px-4 pb-4 text-sm text-muted">Bugün teslim edilecek sipariş yok.</div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Önümüzdeki 7 gün"
              icon={<CalendarDays size={18} />}
              action={
                <Link to="/takvim" className="text-sm text-accent-ink">
                  Takvim
                </Link>
              }
            />
            {view.upcoming.length ? (
              <div className="divide-y divide-line border-t border-line">
                {view.upcoming.map((o) => (
                  <OrderRow key={o.id} order={o} customer={data.customerById.get(o.customerId)} settings={settings} paid={data.paidByOrder.get(o.id) ?? 0} />
                ))}
              </div>
            ) : (
              <div className="px-4 pb-4 text-sm text-muted">Önümüzdeki 7 günde teslim yok.</div>
            )}
          </Card>

          {view.quotes.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader title="Onay bekleyen teklifler" />
              <div className="divide-y divide-line border-t border-line">
                {view.quotes.map((o) => (
                  <OrderRow key={o.id} order={o} customer={data.customerById.get(o.customerId)} settings={settings} paid={data.paidByOrder.get(o.id) ?? 0} />
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Bugünün işleri"
              icon={<Check size={18} />}
              action={
                <Link to="/planlama" className="text-sm text-accent-ink">
                  Plan
                </Link>
              }
            />
            <div className="px-2 pb-3">
              {todayTasks.length ? (
                todayTasks.map((x) => {
                  const o = orderById.get(x.orderId)
                  const pt = o ? productTypeOf(settings, o.productType) : undefined
                  return (
                    <button
                      type="button"
                      key={x.id}
                      onClick={() => db.tasks.update(x.id, { done: !x.done })}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50"
                    >
                      <span
                        className={cx(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                          x.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300',
                        )}
                      >
                        {x.done && <Check size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cx('block truncate text-[15px]', x.done && 'text-muted line-through')}>{x.name}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                          {pt && <span className="h-2 w-2 rounded-full" style={{ background: pt.color }} />}
                          {o ? data.customerById.get(o.customerId)?.name : ''} · teslim {o ? fmtDate(o.deliveryDate, 'd MMM') : ''}
                        </span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="px-2 text-sm text-muted">Bugün için planlanmış iş yok.</div>
              )}
              {lateTasks.length > 0 && (
                <Link to="/planlama" className="mx-2 mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle size={16} /> {lateTasks.length} iş adımı gecikmiş görünüyor
                </Link>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Yaklaşan özel günler" icon={<Gift size={18} />} />
            <div className="px-4 pb-4">
              {view.specials.length ? (
                <ul className="space-y-3">
                  {view.specials.map((u) => (
                    <li key={u.special.id} className="flex items-start gap-3">
                      <div
                        className={cx(
                          'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none',
                          u.inDays <= 7 ? 'bg-accent text-white' : 'bg-accent-soft text-accent-ink',
                        )}
                      >
                        <span className="text-base font-semibold">{u.inDays}</span>
                        <span className="text-[10px]">gün</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/musteriler/${u.customer.id}`} className="font-medium hover:underline">
                          {u.customer.name}
                        </Link>
                        <div className="text-sm text-muted">
                          {specialDayText(u)} · {fmtDate(u.date, 'd MMMM')}
                        </div>
                        <Link to={`/siparisler/yeni?musteri=${u.customer.id}&tarih=${u.date}`} className="text-xs font-medium text-accent-ink">
                          + Sipariş oluştur
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">
                  Önümüzdeki {settings.reminderDays} günde özel gün yok. Müşteri kartlarına doğum günü, yıl dönümü gibi tarihleri
                  ekleyince burada hatırlatılır.
                </div>
              )}
            </div>
          </Card>

          {view.receivable > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Wallet size={20} className="text-accent" />
                <div className="flex-1">
                  <div className="text-sm text-muted">Tahsil edilecek</div>
                  <div className="text-lg font-semibold tabular-nums">{money(view.receivable)}</div>
                </div>
                <LinkButton size="sm" to="/siparisler?g=tum&kalan=1">
                  Listele
                </LinkButton>
              </div>
            </Card>
          )}

          {lowStock.length > 0 && (
            <Card>
              <CardHeader
                title="Azalan stoklar"
                icon={<Package size={18} />}
                action={
                  <Link to="/stok" className="text-sm text-accent-ink">
                    Stok
                  </Link>
                }
              />
              <ul className="space-y-1.5 px-4 pb-4 text-sm">
                {lowStock.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-red-600">
                      {num(s.quantity)} {s.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {!empty && data.orders.length === 0 && <EmptyState title="Henüz sipariş yok" />}
        </div>
      </div>
    </div>
  )
}
