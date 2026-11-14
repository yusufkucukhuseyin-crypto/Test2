import { db, ALL_TABLES } from './db'
import { blobToDataURL, dataURLToBlob } from '../lib/image'
import { ensureSettings } from './actions'

const FORMAT = 'pastane-yonetim-yedek'

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {}
  for (const t of ALL_TABLES) {
    if (t === 'images') continue
    data[t] = await db.table(t).toArray()
  }
  const images = await db.images.toArray()
  data.images = await Promise.all(
    images.map(async (i) => ({ ...i, blob: await blobToDataURL(i.blob), thumb: await blobToDataURL(i.thumb) })),
  )
  const payload = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importBackup(file: File) {
  const text = await file.text()
  const payload = JSON.parse(text)
  if (payload?.format !== FORMAT || !payload.data) throw new Error('Bu dosya geçerli bir yedek değil.')
  const data = payload.data as Record<string, Record<string, unknown>[]>
  const images = await Promise.all(
    (data.images ?? []).map(async (i) => ({
      ...i,
      blob: await dataURLToBlob(i.blob as string),
      thumb: await dataURLToBlob(i.thumb as string),
    })),
  )
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) {
      await db.table(t).clear()
      const rows = t === 'images' ? images : (data[t] ?? [])
      if (rows.length) await db.table(t).bulkAdd(rows)
    }
  })
  await ensureSettings()
}

export async function wipeAll() {
  await db.transaction('rw', ALL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of ALL_TABLES) await db.table(t).clear()
  })
  await ensureSettings()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
