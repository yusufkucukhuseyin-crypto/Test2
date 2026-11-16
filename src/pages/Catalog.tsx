import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ImagePlus, Images, Search } from 'lucide-react'
import { db } from '../db/db'
import type { OrderImage } from '../db/types'
import { useSettings } from '../lib/hooks'
import { matches, uid } from '../lib/format'
import { processImage } from '../lib/image'
import { productTypeOf } from '../lib/domain'
import { Thumb } from '../components/shared'
import { ImageViewer } from '../components/ImageViewer'
import { Button, Card, EmptyState, PageHeader, Select, cx, useToast } from '../components/ui'

export default function Catalog() {
  const settings = useSettings()
  const toast = useToast()
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const [viewer, setViewer] = useState<OrderImage | null>(null)
  const [uploadType, setUploadType] = useState('pasta')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const data = useLiveQuery(async () => {
    const images = await db.images.where('inCatalog').equals(1).reverse().sortBy('createdAt')
    const orderIds = [...new Set(images.map((i) => i.orderId).filter(Boolean))]
    const orders = await db.orders.bulkGet(orderIds)
    const orderById = new Map(orders.filter(Boolean).map((o) => [o!.id, o!]))
    return { images, orderById }
  }, [])

  const list = useMemo(() => {
    if (!data) return []
    return data.images.filter((i) => {
      if (type && i.productType !== type) return false
      const o = data.orderById.get(i.orderId)
      return matches([i.caption, o?.theme, o?.occasion, o?.cakeType, o?.creamType, o?.designNotes], q)
    })
  }, [data, type, q])

  if (!settings || !data) return null

  const upload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    setBusy(true)
    try {
      const now = Date.now()
      const processed = await Promise.all(files.map((f) => processImage(f)))
      await db.images.bulkAdd(
        processed.map((p, i) => ({
          id: uid(),
          orderId: '',
          kind: 'final' as const,
          ...p,
          inCatalog: 1 as const,
          productType: uploadType,
          createdAt: now + i,
        })),
      )
      toast(`${files.length} görsel kataloğa eklendi`)
    } finally {
      setBusy(false)
    }
  }

  const counts = new Map<string, number>()
  for (const i of data.images) counts.set(i.productType ?? '', (counts.get(i.productType ?? '') ?? 0) + 1)

  return (
    <div>
      <PageHeader
        title="Katalog"
        subtitle="Bitmiş ürün fotoğraflarınız — müşteriye “bu modelden” diye göstermek için"
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <Select className="h-11 w-auto min-w-0 flex-1 sm:flex-none" value={uploadType} onChange={(e) => setUploadType(e.target.value)} aria-label="Eklenecek ürün türü">
              {settings.productTypes.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Button variant="primary" icon={<ImagePlus size={18} />} disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Yükleniyor…' : 'Fotoğraf ekle'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                upload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search size={18} className="text-muted" />
          <input
            className="h-11 flex-1 bg-transparent outline-none placeholder:text-stone-400"
            placeholder="Açıklama, tema, kutlama türü…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip active={!type} onClick={() => setType('')}>
            Tümü ({data.images.length})
          </Chip>
          {settings.productTypes
            .filter((p) => counts.get(p.key))
            .map((p) => (
              <Chip key={p.key} active={type === p.key} onClick={() => setType(p.key)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                {p.label} ({counts.get(p.key)})
              </Chip>
            ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Images size={22} />}
            title="Katalog boş"
            text="Sipariş detayında “Bitmiş ürün” olarak yüklenen fotoğraflar otomatik olarak buraya eklenir. Buradan doğrudan da fotoğraf ekleyebilirsiniz."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((img) => {
            const o = data.orderById.get(img.orderId)
            const pt = productTypeOf(settings, img.productType ?? o?.productType ?? 'diger')
            return (
              <div key={img.id}>
                <Thumb image={img} onClick={() => setViewer(img)} className="w-full" />
                <div className="mt-1.5 px-0.5">
                  <div className="truncate text-sm font-medium">{img.caption || o?.occasion || pt.label}</div>
                  <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <span className="h-2 w-2 rounded-full" style={{ background: pt.color }} />
                    {pt.label}
                    {o?.amount ? ` · ${o.amount} ${pt.unit === 'kişi' ? 'kişilik' : 'adet'}` : ''}
                    {o?.tiers && o.tiers > 1 ? ` · ${o.tiers} kat` : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ImageViewer image={viewer} onClose={() => setViewer(null)} showOrder />
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap',
        active ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-white',
      )}
    >
      {children}
    </button>
  )
}
