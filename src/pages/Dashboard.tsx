import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { endOfMonth, startOfMonth } from 'date-fns'
import { AlertTriangle, CalendarDays, ClipboardList, Gift, Package, Plus, Sparkles, Wallet } from 'lucide-react'
import { db } from '../db/db'
import { loadDemoData } from '../db/seed'
import { useCoreData, sortByDelivery } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { isOpen, specialDayText, upcomingSpecialDays } from '../lib/domain'
import { countByDay, dayStatus } from '../lib/capacity'
import { fmtDate, isoDate, money, num, shiftDay, today } from '../lib/format'
import { OrderRow } from '../components/shared'
import { InstallCard } from '../components/AppInstall'
import { BackupReminder, RestoreButton } from '../components/Backup'
import { Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, Stat, cx, useToast } from '../components/ui'

export default function Dashboard() {
  const settings = useSettings()
  const data = useCoreData()
  const toast = useToast()
  const stock = useLiveQuery(() => db.stockItems.toArray(), [])
  const t = today()

  const view = useMemo(() => {
    if (!data || !settings) return null
    const active = data.orders.filter((o) => o.status !== 'iptal')
    const week = shiftDay(t, 7)
    const todays = active.filter((o) => o.deliveryDate === t).sort(sortByDelivery)
    const upcoming = active.filter((o) => o.deliveryDate > t && o.deliveryDate <= week && isOpen(o.status)).sort(sortByDelivery)
    const overdue = active.filter((o) => o.deliveryDate < t && isOpen(o.status)).sort(sortByDelivery)
    const open = active.filter((o) => isOpen(o.status))
    const receivable = active.reduce((s, o) => s + Math.max(0, o.agreedPrice - (data.paidByOrder.get(o.id) ?? 0)), 0)
    const ms = isoDate(startOfMonth(new Date()))
    const me = isoDate(endOfMonth(new Date()))
    const monthRevenue = active.filter((o) => o.deliveryDate >= ms && o.deliveryDate <= me).reduce((s, o) => s + o.agreedPrice, 0)
    const specials = upcomingSpecialDays(data.customers, settings.reminderDays)
    return { todays, upcoming, overdue, open, receivable, monthRevenue, specials }
  }, [data, settings, t])

  if (!settings || !data || !view) return null

  // Önümüzdeki 14 günde kapasitesi aşılan (ya da kapalı olup siparişi olan) günler
  const counts = countByDay(data.orders)
  const overDays = Array.from({ length: 14 }, (_, i) => shiftDay(t, i)).filter((d) => dayStatus(settings, counts, d).tone === 'asim')
  const lowStock = (stock ?? []).filter((s) => s.minQuantity !== undefined && s.minQuantity > 0 && s.quantity <= s.minQuantity)

  const empty = data.orders.length === 0 && data.customers.length === 0

  return (
    <div>
      <PageHeader
        title="Merhaba 👋"
        subtitle={fmtDate(t, 'd MMMM yyyy, EEEE')}
        actions={
          <div className="hidden md:block">
            <LinkButton to="/siparisler/yeni" variant="primary" icon={<Plus size={18} />}>
              Yeni sipariş
            </LinkButton>
          </div>
        }
      />

      <InstallCard dismissible className="mb-4" />

      {empty && (
        <Card className="mb-4 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Sparkles size={22} />
            </div>
            <div className="flex-1">
              <div className="font-display text-lg">Hoş geldiniz!</div>
              <p className="text-sm text-muted">
                İlk siparişinizi ekleyerek başlayabilirsiniz. Önizlemede ya da başka bir cihazda girdiğiniz kayıtları taşımak için
                oradan aldığınız yedek dosyasını <b>Yedekten geri yükle</b> ile açın.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <RestoreButton label="Yedekten geri yükle" />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
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

        </div>

        <div className="space-y-4">
          <BackupReminder settings={settings} hasData={data.orders.length > 0} />
          {overDays.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-semibold">Kapasite uyarısı</div>
                  <div>
                    Kapasiteden fazla sipariş olan günler:{' '}
                    {overDays.map((d) => `${fmtDate(d, 'd MMM')} (${counts[d] ?? 0} sipariş)`).join(', ')}
                  </div>
                  <Link to="/takvim" className="inline-block font-medium text-amber-900 underline">
                    Takvimi aç
                  </Link>
                </div>
              </div>
            </Card>
          )}

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
