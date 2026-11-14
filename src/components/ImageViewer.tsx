import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import type { ImageKind, OrderImage } from '../db/types'
import { orderSummary, productTypeOf } from '../lib/domain'
import { fmtDate } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { FullImage, IMAGE_KINDS } from './shared'
import { Button, Field, Input, LinkButton, Modal, Select, Toggle, useToast } from './ui'

export function ImageViewer({
  image,
  onClose,
  showOrder,
}: {
  image: OrderImage | null
  onClose: () => void
  /** Katalogdan açıldığında sipariş bilgisi ve "bu modelden sipariş" butonu */
  showOrder?: boolean
}) {
  const toast = useToast()
  const settings = useSettings()
  const [caption, setCaption] = useState('')
  const [lastId, setLastId] = useState<string>()
  const info = useLiveQuery(async () => {
    if (!image?.orderId || !showOrder) return null
    const order = await db.orders.get(image.orderId)
    const customer = order ? await db.customers.get(order.customerId) : undefined
    return order ? { order, customer } : null
  }, [image?.orderId, showOrder])
  if (image && image.id !== lastId) {
    setLastId(image.id)
    setCaption(image.caption ?? '')
  }
  if (!image) return null

  const newOrderUrl = `/siparisler/yeni?gorsel=${image.id}${image.orderId ? `&kaynak=${image.orderId}` : ''}`

  return (
    <Modal
      open
      onClose={onClose}
      title={showOrder ? 'Model' : 'Görsel'}
      wide
      footer={
        <>
          <Button
            variant="danger"
            icon={<Trash2 size={16} />}
            onClick={async () => {
              if (!confirm('Görsel silinsin mi?')) return
              await db.images.delete(image.id)
              toast('Görsel silindi')
              onClose()
            }}
          >
            Sil
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              await db.images.update(image.id, { caption })
              onClose()
            }}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <FullImage image={image} />
      {showOrder && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3">
          <div className="min-w-0 text-sm">
            {info && settings ? (
              <>
                <div className="font-medium">
                  {orderSummary(info.order, productTypeOf(settings, info.order.productType))}
                  {info.order.occasion ? ` · ${info.order.occasion}` : ''}
                </div>
                <div className="text-muted">
                  {info.customer?.name} · {fmtDate(info.order.deliveryDate)}
                  {info.order.cakeType ? ` · ${info.order.cakeType}` : ''}
                  {info.order.creamType ? ` / ${info.order.creamType}` : ''}
                </div>
                <Link to={`/siparisler/${info.order.id}`} className="inline-flex items-center gap-1 text-accent-ink underline">
                  <ExternalLink size={13} /> Siparişe git
                </Link>
              </>
            ) : (
              <span className="text-muted">Siparişe bağlı olmayan katalog görseli</span>
            )}
          </div>
          <LinkButton to={newOrderUrl} variant="primary" size="sm" icon={<Plus size={16} />}>
            Bu modelden sipariş
          </LinkButton>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Açıklama">
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Örn. Pastel kelebekli 2 kat" />
        </Field>
        <Field label="Tür">
          <Select value={image.kind} onChange={(e) => db.images.update(image.id, { kind: e.target.value as ImageKind })}>
            {IMAGE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <Toggle
          checked={image.inCatalog === 1}
          onChange={(v) => db.images.update(image.id, { inCatalog: v ? 1 : 0 })}
          label="Katalogda göster"
        />
      </div>
    </Modal>
  )
}
