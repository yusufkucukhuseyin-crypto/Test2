import { db, ALL_TABLES, normalizeOrder } from './db'
import type { Order } from './types'
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
      let rows = t === 'images' ? images : (data[t] ?? [])
      // Eski yedeklerdeki sipariş durumlarını yeni üç duruma çevir
      if (t === 'orders') rows = rows.map((o) => normalizeOrder(o as unknown as Order) as unknown as Record<string, unknown>)
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

interface DownloadsCap {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: string }>
}
type ClaudeHost = { use?: (name: string) => Promise<unknown> }

/** Önizleme (claude.ai) içinde çalışıyorsa dosya kaydetme yeteneği; değilse null */
async function hostDownloads(): Promise<DownloadsCap | null> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (!host?.use) return null
  try {
    return ((await host.use('downloads')) as DownloadsCap | null) ?? null
  } catch {
    return null
  }
}

/**
 * Dosyayı kullanıcıya verir. Normal kullanımda tarayıcı indirmesi; claude.ai önizlemesinde
 * önizlemenin kaydetme penceresi. Kullanıcı vazgeçerse false döner.
 */
export async function saveFile(blob: Blob, filename: string): Promise<boolean> {
  const dl = await hostDownloads()
  if (dl) {
    try {
      await dl.save({ filename, data: blob })
      return true
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'declined' || code === 'rate_limited') return false
      // Kaydetme kullanılamıyorsa normal indirmeyi dene
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return true
}
