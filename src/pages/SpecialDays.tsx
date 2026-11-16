import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Gift, MessageCircle, Phone, Plus } from 'lucide-react'
import { useCoreData } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { specialDayText, upcomingSpecialDays } from '../lib/domain'
import { diffDays, fmtDate, telLink, today, waLink } from '../lib/format'
import { Card, EmptyState, PageHeader, Segmented, cx } from '../components/ui'

type Range = '7' | '30' | '90' | '365'

/** Müşterilerin yaklaşan özel günleri (doğum günü, yıl dönümü…) */
export default function SpecialDays() {
  const settings = useSettings()
  const data = useCoreData()
  const [range, setRange] = useState<Range>('30')

  const groups = useMemo(() => {
    if (!data) return []
    const list = upcomingSpecialDays(data.customers, Number(range))
    const m = new Map<string, typeof list>()
    for (const u of list) {
      const key = u.date.slice(0, 7)
      m.set(key, [...(m.get(key) ?? []), u])
    }
    return [...m.entries()]
  }, [data, range])

  if (!settings || !data) return null
  const t = today()
  const total = groups.reduce((s, [, l]) => s + l.length, 0)

  /** Bu kutlama için (tarihin bir hafta öncesi/sonrası) sipariş alınmış mı */
  const orderFor = (customerId: string, date: string) =>
    data.orders.find((o) => o.customerId === customerId && o.status !== 'iptal' && Math.abs(diffDays(o.deliveryDate, date)) <= 7)

  return (
    <div>
      <PageHeader title="Özel günler" subtitle="Müşterilerinizin yaklaşan doğum günü, yıl dönümü ve diğer kutlamaları" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: '7 gün' },
            { value: '30', label: '30 gün' },
            { value: '90', label: '3 ay' },
            { value: '365', label: '1 yıl' },
          ]}
        />
        <span className="text-sm text-muted">{total} özel gün</span>
      </div>

      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<Gift size={22} />}
            title="Bu aralıkta özel gün yok"
            text="Müşteri kartlarına doğum günü, yıl dönümü gibi tarihleri ekleyince burada listelenir."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([month, list]) => (
            <div key={month}>
              <div className="mb-1.5 px-1 text-sm font-semibold capitalize">{fmtDate(month + '-01', 'LLLL yyyy')}</div>
              <Card className="divide-y divide-line overflow-hidden">
                {list.map((u) => {
                  const o = orderFor(u.customer.id, u.date)
                  const c = u.customer
                  return (
                    <div key={u.special.id + u.date} className="flex items-start gap-3 px-4 py-3" data-testid="special-row">
                      <div
                        className={cx(
                          'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center leading-none',
                          u.inDays <= 7 ? 'bg-accent text-white' : 'bg-accent-soft text-accent-ink',
                        )}
                      >
                        {u.inDays === 0 ? (
                          <span className="text-xs font-semibold">Bugün</span>
                        ) : (
                          <>
                            <span className="text-base font-semibold">{u.inDays}</span>
                            <span className="text-[10px]">gün</span>
                          </>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link to={`/musteriler/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <div className="text-sm text-muted">
                          {specialDayText(u)} · {fmtDate(u.date, 'd MMMM EEEE')}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          {o ? (
                            <Link to={`/siparisler/${o.id}`} className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CalendarCheck size={15} /> Sipariş alındı ({fmtDate(o.deliveryDate, 'd MMM')})
                            </Link>
                          ) : (
                            <Link
                              to={`/siparisler/yeni?musteri=${c.id}&tarih=${u.date < t ? t : u.date}`}
                              className="inline-flex items-center gap-1 font-medium text-accent-ink"
                            >
                              <Plus size={15} /> Sipariş oluştur
                            </Link>
                          )}
                          {c.phone && (
                            <>
                              <a href={telLink(c.phone)} className="inline-flex items-center gap-1 text-muted hover:text-ink">
                                <Phone size={14} /> Ara
                              </a>
                              <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-ink">
                                <MessageCircle size={14} /> WhatsApp
                              </a>
                            </>
                          )}
                          {!c.phone && c.whatsapp && <span className="text-muted">WhatsApp: {c.whatsapp}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </Card>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Özel günler müşteri kartlarından eklenir. Takvimde de hediye simgesiyle görünür.
      </p>
    </div>
  )
}
