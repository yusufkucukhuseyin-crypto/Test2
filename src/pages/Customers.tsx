import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Search, UserPlus, Users } from 'lucide-react'
import { useCoreData } from '../lib/data'
import { useSettings } from '../lib/hooks'
import { upcomingSpecialDays } from '../lib/domain'
import { fmtDate, matches, money, trLower } from '../lib/format'
import { CustomerFormModal } from '../components/shared'
import { Avatar, Badge, Button, Card, EmptyState, PageHeader, Segmented } from '../components/ui'

type Sort = 'ad' | 'son' | 'harcama'

export default function Customers() {
  const data = useCoreData()
  const settings = useSettings()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('son')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => {
    if (!data) return []
    const upcoming = new Map(upcomingSpecialDays(data.customers, settings?.reminderDays ?? 21).map((u) => [u.customer.id, u]))
    const stats = new Map<string, { count: number; spent: number; last?: string }>()
    for (const o of data.orders) {
      if (o.status === 'iptal') continue
      const s = stats.get(o.customerId) ?? { count: 0, spent: 0 }
      s.count++
      s.spent += o.agreedPrice
      if (!s.last || o.deliveryDate > s.last) s.last = o.deliveryDate
      stats.set(o.customerId, s)
    }
    const list = data.customers
      .filter((c) => matches([c.name, c.phone, c.instagram, c.notes], q))
      .map((c) => ({ c, s: stats.get(c.id) ?? { count: 0, spent: 0 }, up: upcoming.get(c.id) }))
    list.sort((a, b) => {
      if (sort === 'ad') return trLower(a.c.name).localeCompare(trLower(b.c.name), 'tr')
      if (sort === 'harcama') return b.s.spent - a.s.spent
      return (b.s.last ?? '').localeCompare(a.s.last ?? '') || b.c.createdAt - a.c.createdAt
    })
    return list
  }, [data, q, sort, settings?.reminderDays])

  if (!data) return null

  return (
    <div>
      <PageHeader
        title="Müşteriler"
        subtitle={`${data.customers.length} kişi`}
        actions={
          <Button variant="primary" icon={<UserPlus size={18} />} onClick={() => setCreating(true)}>
            Yeni müşteri
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search size={18} className="text-muted" />
          <input
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-stone-400"
            placeholder="Ad, telefon, Instagram…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Segmented<Sort>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'son', label: 'Son sipariş' },
            { value: 'harcama', label: 'Harcama' },
            { value: 'ad', label: 'A–Z' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={22} />}
            title={data.customers.length ? 'Eşleşen müşteri yok' : 'Henüz müşteri yok'}
            text="Müşteri kartları siparişlerle birlikte de oluşturulabilir."
            action={
              <Button variant="primary" icon={<UserPlus size={18} />} onClick={() => setCreating(true)}>
                Yeni müşteri
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {rows.map(({ c, s, up }) => (
            <Link key={c.id} to={`/musteriler/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{c.name}</span>
                  {up && (
                    <Badge className="bg-accent-soft text-accent-ink">
                      <Gift size={12} /> {up.inDays === 0 ? 'Bugün' : `${up.inDays} gün`} · {up.special.type}
                    </Badge>
                  )}
                </div>
                <div className="truncate text-sm text-muted">
                  {c.phone}
                  {c.instagram ? ` · @${c.instagram}` : ''}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm">
                <div className="font-medium tabular-nums">{money(s.spent)}</div>
                <div className="text-xs text-muted">
                  {s.count} sipariş{s.last ? ` · ${fmtDate(s.last, 'd MMM yy')}` : ''}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
      <CustomerFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
