import { useSyncExternalStore } from 'react'
import { liveQuery } from 'dexie'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { db, outboxKey, SYNC_TABLES, type SyncTable } from '../db/db'
import { ask } from '../components/confirm'

/**
 * Bulut eşitleme (Supabase).
 *
 * - Kayıtlar önce cihazdaki veritabanına yazılır; her değişiklik aynı anda gönderim kuyruğuna (outbox) girer.
 * - Giriş yapılmışsa kuyruk birkaç saniye içinde "records" tablosuna gönderilir (kayıt başına bir satır).
 * - Diğer cihazlardaki değişiklikler "updated_at"e göre çekilir; bir cihaz gönderdiğinde ötekilere anlık
 *   haber verilir (Realtime Broadcast), ayrıca dakikada bir ve uygulama öne gelince kontrol edilir.
 * - Fotoğraflar "images" depolama alanına kullanıcı klasörüne yüklenir.
 * - Aynı kayıt iki cihazda değişirse son gönderilen geçerli olur; gönderilmeyi bekleyen yerel değişiklik
 *   buluttan gelenle ezilmez.
 */

export const CLOUD_URL = 'https://fzpgzixuxprunjorqifn.supabase.co'
/** Herkese açık (publishable) anahtar: uygulamaya gömülür, veriler satır düzeyi güvenlikle korunur */
export const CLOUD_KEY = 'sb_publishable_xy-EZqPv_HKswTFhfykx1w_umgwKdve'
/** claude.ai önizlemesinde bulut kapalı */
export const cloudEnabled = !import.meta.env.VITE_EMBED

export type SyncPhase = 'off' | 'starting' | 'syncing' | 'idle' | 'offline' | 'error'
export interface SyncState {
  phase: SyncPhase
  email?: string
  /** Gönderilmeyi bekleyen değişiklik sayısı */
  pending: number
  lastSync?: number
  error?: string
}

let state: SyncState = { phase: 'off', pending: 0 }
const listeners = new Set<() => void>()
function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
export const syncState = () => state

let sb: SupabaseClient | null = null
function client(): SupabaseClient {
  if (!sb) sb = createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'luma-auth' } })
  return sb
}

let uid: string | null = null
let channel: RealtimeChannel | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let poller: ReturnType<typeof setInterval> | undefined
let running = false
let rerun = false
let started = false
/** Bu hesapla bu cihazdaki ilk eşitleme kararı verildi mi (verilmeden hiçbir şey gönderilmez) */
let ready = false

const SYNCED = new Set<string>(SYNC_TABLES)

interface RemoteRow {
  tbl: string
  id: string
  data: Record<string, unknown> | null
  deleted: boolean
  updated_at: string
}

/* ---------------- Yardımcılar ---------------- */

async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.syncmeta.get(key))?.value as T | undefined
}
async function setMeta(key: string, value: unknown) {
  await db.syncmeta.put({ key, value })
}
const imgPath = (id: string, thumb = false) => `${uid}/${id}${thumb ? '_t' : ''}.jpg`

function trError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/invalid login credentials/i.test(m)) return 'E-posta ya da şifre hatalı.'
  if (/email not confirmed/i.test(m)) return 'E-posta adresi onaylanmamış.'
  if (/failed to fetch|network|load failed|fetch/i.test(m)) return 'Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edin.'
  if (/jwt|token/i.test(m)) return 'Oturum süresi doldu; yeniden giriş yapın.'
  return m
}

/* ---------------- Başlatma ve giriş ---------------- */

export async function initCloud() {
  if (!cloudEnabled || started) return
  started = true
  window.addEventListener('online', () => schedule(0))
  window.addEventListener('offline', () => uid && setState({ phase: 'offline' }))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(0))
  // Kuyruğa yeni değişiklik girince kısa bir beklemeyle gönder
  liveQuery(() => db.outbox.count()).subscribe({
    next: (n) => {
      setState({ pending: n })
      if (n > 0) schedule(1200)
    },
  })
  try {
    const { data } = await client().auth.getSession()
    if (data.session) await begin(data.session.user.id, data.session.user.email ?? undefined)
  } catch (e) {
    setState({ phase: 'error', error: trError(e) })
  }
  client().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') stop()
  })
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(trError(error))
  await begin(data.user.id, data.user.email ?? undefined)
}

export async function signOut() {
  stop()
  await client().auth.signOut().catch(() => {})
  setState({ phase: 'off', email: undefined, error: undefined })
}

export function syncNow() {
  schedule(0)
}

function stop() {
  uid = null
  ready = false
  clearTimeout(timer)
  clearInterval(poller)
  if (channel) client().removeChannel(channel)
  channel = null
}

async function begin(userId: string, email?: string) {
  uid = userId
  ready = false
  setState({ phase: 'starting', email, error: undefined })
  // Diğer cihazlardan "değişti" haberi gelince hemen çek
  channel = client().channel(`luma-${userId}`, { config: { broadcast: { self: false } } })
  channel.on('broadcast', { event: 'changed' }, () => schedule(300)).subscribe()
  clearInterval(poller)
  poller = setInterval(() => schedule(0), 60_000)
  schedule(0)
}

/**
 * Bu hesapla bu cihazda ilk kez eşitleme:
 * bulut boşsa cihazdakiler gönderilir; cihazda kayıt yoksa buluttakiler gelir;
 * ikisinde de kayıt varsa kullanıcıya sorulur.
 */
async function firstSync(userId: string) {
  const { count, error } = await client().from('records').select('id', { count: 'exact', head: true }).eq('deleted', false)
  if (error) throw error
  const localData = (await db.customers.count()) + (await db.orders.count()) + (await db.payments.count())
  if (!count) {
    await enqueueAll()
  } else if (localData === 0) {
    await replaceLocalWithCloud()
  } else {
    const orders = await db.orders.count()
    const customers = await db.customers.count()
    const useCloud = await ask(
      `Bu cihazda ${orders} sipariş ve ${customers} müşteri kayıtlı; bulutta da kayıtlarınız var.\n\n` +
        `• “Birleştir”: bu cihazdakiler de buluta eklenir, tüm cihazlarda görünür.\n` +
        `• “Buluttakileri kullan”: bu cihazdaki kayıtlar silinir, buluttakiler gelir.`,
      { confirmLabel: 'Buluttakileri kullan', cancelLabel: 'Birleştir', danger: true },
    )
    if (useCloud) await replaceLocalWithCloud()
    else await enqueueAll()
  }
  const prev = await getMeta<{ lastPulled?: string | null }>('state')
  await setMeta('state', { userId, lastPulled: prev && (prev as { userId?: string }).userId === userId ? prev.lastPulled : null })
}

/** Cihazdaki tüm kayıtları gönderim kuyruğuna alır */
async function enqueueAll() {
  const at = Date.now()
  for (const t of SYNC_TABLES) {
    const ids = (await db.table(t).toCollection().primaryKeys()) as string[]
    await db.outbox.bulkPut(ids.map((id) => ({ key: outboxKey(t, id), tbl: t, id, op: 'put' as const, at })))
  }
}

/** Cihazdaki kayıtları buluttakilerle değiştirir (önce hepsi indirilir, sonra tek işlemde yazılır) */
async function replaceLocalWithCloud() {
  const rows = await fetchSince(null)
  await applyRows(rows, true)
  const last = rows.length ? rows[rows.length - 1].updated_at : null
  await setMeta('state', { userId: uid, lastPulled: last })
}

/* ---------------- Eşitleme döngüsü ---------------- */

function schedule(ms: number) {
  if (!uid) return
  clearTimeout(timer)
  timer = setTimeout(run, ms)
}

async function run() {
  if (!uid) return
  if (running) {
    rerun = true
    return
  }
  if (!navigator.onLine) {
    setState({ phase: 'offline' })
    return
  }
  running = true
  setState({ phase: 'syncing' })
  try {
    if (!ready) {
      const meta = await getMeta<{ userId: string }>('state')
      if (!meta || meta.userId !== uid) await firstSync(uid)
      ready = true
    }
    const pushed = await push()
    await pull()
    if (pushed && channel) channel.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => {})
    setState({ phase: 'idle', lastSync: Date.now(), error: undefined })
  } catch (e) {
    setState({ phase: navigator.onLine ? 'error' : 'offline', error: trError(e) })
    // Hata olursa yarım dakika sonra yeniden dene
    clearTimeout(timer)
    timer = setTimeout(run, 30_000)
  } finally {
    running = false
    if (rerun) {
      rerun = false
      schedule(300)
    }
  }
}

/** Kuyruktaki değişiklikleri gönderir. Gönderildikten sonra değişmemiş kuyruk girişleri silinir. */
async function push(): Promise<boolean> {
  let any = false
  for (;;) {
    const batch = await db.outbox.orderBy('at').limit(100).toArray()
    if (!batch.length) break
    const rows: Record<string, unknown>[] = []
    for (const e of batch) {
      const rec = e.op === 'put' ? await db.table(e.tbl).get(e.id) : undefined
      if (!rec) {
        rows.push({ user_id: uid, tbl: e.tbl, id: e.id, data: null, deleted: true, updated_at: 'now' })
        if (e.tbl === 'images') await removeImage(e.id)
        continue
      }
      const data = e.tbl === 'images' ? await prepareImage(rec) : rec
      // updated_at: 'now' → sunucu saati (cihaz saatleri farklı olabilir)
      rows.push({ user_id: uid, tbl: e.tbl, id: e.id, data, deleted: false, updated_at: 'now' })
    }
    const { error } = await client().from('records').upsert(rows, { onConflict: 'user_id,tbl,id' })
    if (error) throw error
    await db.transaction('rw', db.outbox, async () => {
      for (const e of batch) {
        const cur = await db.outbox.get(e.key)
        if (cur && cur.at === e.at) await db.outbox.delete(e.key)
      }
    })
    any = true
  }
  return any
}

async function prepareImage(rec: Record<string, unknown>) {
  const { blob, thumb, ...meta } = rec as { blob: Blob; thumb: Blob; id: string }
  if (!(await getMeta(`up:${meta.id}`))) {
    for (const [path, b] of [
      [imgPath(meta.id), blob],
      [imgPath(meta.id, true), thumb],
    ] as const) {
      const { error } = await client().storage.from('images').upload(path, b, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
    }
    await setMeta(`up:${meta.id}`, true)
  }
  return { ...meta, media: true }
}

async function removeImage(id: string) {
  await client()
    .storage.from('images')
    .remove([imgPath(id), imgPath(id, true)])
    .catch(() => {})
  await db.syncmeta.delete(`up:${id}`)
}

async function fetchSince(since: string | null): Promise<RemoteRow[]> {
  const out: RemoteRow[] = []
  let from = since
  for (;;) {
    let q = client().from('records').select('tbl,id,data,deleted,updated_at').order('updated_at').limit(1000)
    if (from) q = q.gte('updated_at', from)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as RemoteRow[]
    out.push(...rows)
    const last = rows.length ? rows[rows.length - 1].updated_at : null
    if (rows.length < 1000 || !last || last === from) break
    from = last
  }
  return out
}

/** Diğer cihazlardaki değişiklikleri çeker */
async function pull() {
  const meta = await getMeta<{ userId: string; lastPulled: string | null }>('state')
  const rows = await fetchSince(meta?.lastPulled ?? null)
  if (!rows.length) return
  await applyRows(rows, false)
  await setMeta('state', { userId: uid, lastPulled: rows[rows.length - 1].updated_at })
}

/**
 * Buluttan gelen satırları cihaza yazar. Fotoğraflar önce indirilir (veritabanı işlemi içinde ağ beklenemez).
 * Bu işlem "syncmeta"yı da içerdiği için gönderim kuyruğuna alınmaz.
 */
async function applyRows(rows: RemoteRow[], replace: boolean) {
  const pendingKeys = replace ? new Set<string>() : new Set((await db.outbox.toArray()).map((e) => e.key))
  // Son hâl: aynı kayıt birden çok kez geldiyse sonuncusu
  const latest = new Map<string, RemoteRow>()
  for (const r of rows) if (SYNCED.has(r.tbl)) latest.set(outboxKey(r.tbl, r.id), r)
  const blobs = new Map<string, { blob: Blob; thumb: Blob }>()
  for (const [key, r] of latest) {
    if (r.tbl !== 'images' || r.deleted || pendingKeys.has(key)) continue
    if (!replace && (await db.images.get(r.id))) continue
    const [a, b] = await Promise.all([
      client().storage.from('images').download(`${uid}/${r.id}.jpg`),
      client().storage.from('images').download(`${uid}/${r.id}_t.jpg`),
    ])
    if (a.error || b.error) throw a.error ?? b.error
    blobs.set(r.id, { blob: a.data, thumb: b.data })
  }
  const keep = new Map<string, { blob: Blob; thumb: Blob }>()
  if (replace) {
    // Silmeden önce, buluttaki fotoğrafların cihazda zaten olan dosyalarını koru
    for (const img of await db.images.toArray()) keep.set(img.id, { blob: img.blob, thumb: img.thumb })
  }
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.syncmeta, db.outbox], async () => {
    if (replace) {
      for (const t of SYNC_TABLES) await db.table(t).clear()
      await db.outbox.clear()
    }
    for (const [key, r] of latest) {
      if (pendingKeys.has(key)) continue
      const table = db.table(r.tbl as SyncTable)
      if (r.deleted || !r.data) {
        if (!replace) await table.delete(r.id)
        continue
      }
      let rec: Record<string, unknown> = r.data
      if (r.tbl === 'images') {
        const { media: _m, ...meta } = rec
        const local = replace ? keep.get(r.id) : await db.images.get(r.id)
        const files = blobs.get(r.id) ?? (local ? { blob: local.blob, thumb: local.thumb } : undefined)
        if (!files) continue
        rec = { ...meta, blob: files.blob, thumb: files.thumb }
        await db.syncmeta.put({ key: `up:${r.id}`, value: true })
      } else if (!replace) {
        const local = await table.get(r.id)
        if (local && JSON.stringify(local) === JSON.stringify(rec)) continue
      }
      await table.put(rec)
    }
  })
}
