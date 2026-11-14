import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, AtSign, Copy, Gift, MapPin, MessageCircle, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteCustomer } from '../db/actions'
import type { OrderImage } from '../db/types'
import { orderSummary, paidTotal, productTypeOf, specialDayText, upcomingSpecialDays, depositTotal } from '../lib/domain'
import { fmtDate, money, telLink, waLink } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { CustomerFormModal, StatusBadge, Thumb } from '../components/shared'
import { ImageViewer } from '../components/ImageViewer'
import { Avatar, Button, Card, CardHeader, EmptyState, IconButton, LinkButton, PageHeader, Stat, useToast } from '../components/ui'
import { ask, tell } from '../components/confirm'

export default function CustomerDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const settings = useSettings()
  const [editing, setEditing] = useState(false)
  const [viewer, setViewer] = useState<OrderImage | null>(null)

  const data = useLiveQuery(async () => {
    const customer = await db.customers.get(id)
    if (!customer) return { customer: null }
    const orders = (await db.orders.where('customerId').equals(id).toArray()).sort((a, b) =>
      b.deliveryDate.localeCompare(a.deliveryDate),
    )
    const ids = orders.map((o) => o.id)
    const [payments, images] = await Promise.all([
      db.payments.where('orderId').anyOf(ids).toArray(),
      db.images.where('orderId').anyOf(ids).toArray(),
    ])
    return { customer, orders, payments, images }
  }, [id])

  if (!settings || !data) return null
  if (!data.customer)
    return <EmptyState title="Müşteri bulunamadı" action={<LinkButton to="/musteriler">Müşterilere dön</LinkButton>} />

  const { customer: c, orders = [], payments = [], images = [] } = data
  const active = orders.filter((o) => o.status !== 'iptal')
  const spent = active.reduce((s, o) => s + o.agreedPrice, 0)
  const balance = active.reduce(
    (s, o) => s + Math.max(0, o.agreedPrice - paidTotal(payments.filter((p) => p.orderId === o.id))),
    0,
  )
  const specials = upcomingSpecialDays([c], 366)

  const remove = async () => {
    if (!(await ask(`${c.name} silinsin mi?`, { confirmLabel: 'Sil' }))) return
    try {
      await deleteCustomer(c.id)
      toast('Müşteri silindi')
      nav('/musteriler', { replace: true })
    } catch (e) {
      await tell((e as Error).message)
    }
  }

  return (
    <div>
      <PageHeader
        back="/musteriler"
        title={c.name}
        subtitle={c.source ? `Kaynak: ${c.source}` : undefined}
        actions={
          <>
            <Button size="sm" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
              Düzenle
            </Button>
            <LinkButton size="sm" variant="primary" to={`/siparisler/yeni?musteri=${c.id}`} icon={<Plus size={16} />}>
              Yeni sipariş
            </LinkButton>
            <IconButton label="Müşteriyi sil" onClick={remove}>
              <Trash2 size={18} className="text-red-600" />
            </IconButton>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={c.name} className="h-12 w-12 text-base" />
              <div className="min-w-0">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-muted">{c.phone}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={telLink(c.phone)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm">
                <Phone size={16} /> Ara
              </a>
              <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm">
                <MessageCircle size={16} /> WhatsApp
              </a>
              {c.instagram && (
                <a
                  href={`https://instagram.com/${c.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-sm"
                >
                  <AtSign size={16} /> {c.instagram}
                </a>
              )}
            </div>
            {c.address && (
              <div className="mt-3 flex gap-2 text-sm text-muted">
                <MapPin size={16} className="mt-0.5 shrink-0" /> {c.address}
              </div>
            )}
            {c.allergies && (
              <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-2.5 text-sm text-red-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {c.allergies}
              </div>
            )}
            {c.notes && <p className="mt-3 text-sm whitespace-pre-wrap">{c.notes}</p>}
          </Card>

          <Card>
            <CardHeader title="Özel günler" icon={<Gift size={18} />} />
            <div className="px-4 pb-4">
              {specials.length ? (
                <ul className="space-y-2">
                  {specials.map((u) => (
                    <li key={u.special.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{specialDayText(u)}</span>
                      <span className="shrink-0 text-muted">
                        {fmtDate(u.date, 'd MMMM')} · {u.inDays === 0 ? 'bugün' : `${u.inDays} gün`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">
                  Kayıtlı özel gün yok.{' '}
                  <button type="button" className="text-accent-ink underline" onClick={() => setEditing(true)}>
                    Ekle
                  </button>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sipariş" value={active.length} />
            <Stat label="Toplam" value={money(spent)} />
            <Stat label="Ortalama" value={money(active.length ? Math.round(spent / active.length) : 0)} />
            <Stat label="Açık bakiye" value={money(balance)} tone={balance > 0 ? 'text-red-600' : undefined} />
          </div>
        </div>

        <div>
          <h2 className="mb-2 px-1 font-display text-lg">Sipariş geçmişi</h2>
          {orders.length === 0 ? (
            <Card>
              <EmptyState
                title="Henüz sipariş yok"
                action={
                  <LinkButton variant="primary" to={`/siparisler/yeni?musteri=${c.id}`} icon={<Plus size={16} />}>
                    Sipariş oluştur
                  </LinkButton>
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => {
                const pt = productTypeOf(settings, o.productType)
                const ps = payments.filter((p) => p.orderId === o.id)
                const paid = paidTotal(ps)
                const imgs = images
                  .filter((i) => i.orderId === o.id)
                  .sort((a, b) => ['final', 'onay', 'taslak', 'referans'].indexOf(a.kind) - ['final', 'onay', 'taslak', 'referans'].indexOf(b.kind))
                const details = [
                  ['Kek', o.cakeType],
                  ['Krema', o.creamType],
                  ['İçerik', o.filling],
                  ['Tema', o.theme],
                  ['Yazı', o.cakeText],
                ].filter(([, v]) => v)
                return (
                  <Card key={o.id} className="overflow-hidden">
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-1 self-stretch rounded-full" style={{ background: pt.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/siparisler/${o.id}`} className="font-semibold hover:underline">
                            {fmtDate(o.deliveryDate)}
                          </Link>
                          <span className="text-xs text-muted">#{o.no}</span>
                          <StatusBadge status={o.status} />
                        </div>
                        <div className="text-sm text-muted">
                          {orderSummary(o, pt)}
                          {o.occasion ? ` · ${o.occasion}` : ''}
                        </div>
                        {details.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {details.map(([k, v]) => (
                              <span key={k}>
                                <span className="text-muted">{k}:</span> {v}
                              </span>
                            ))}
                          </div>
                        )}
                        {o.designNotes && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{o.designNotes}</p>}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                          <span>
                            <span className="text-muted">Tutar:</span> {money(o.agreedPrice)}
                          </span>
                          <span>
                            <span className="text-muted">Kapora:</span> {money(depositTotal(ps))}
                          </span>
                          {o.status !== 'iptal' && o.agreedPrice - paid > 0 && (
                            <span className="text-red-600">Kalan: {money(o.agreedPrice - paid)}</span>
                          )}
                        </div>
                        {imgs.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {imgs.slice(0, 6).map((img) => (
                              <Thumb key={img.id} image={img} className="h-16 w-16 shrink-0" onClick={() => setViewer(img)} />
                            ))}
                          </div>
                        )}
                      </div>
                      <LinkButton size="sm" to={`/siparisler/yeni?kaynak=${o.id}`} icon={<Copy size={14} />}>
                        Tekrarla
                      </LinkButton>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <CustomerFormModal open={editing} onClose={() => setEditing(false)} customer={c} />
      <ImageViewer image={viewer} onClose={() => setViewer(null)} />
    </div>
  )
}
