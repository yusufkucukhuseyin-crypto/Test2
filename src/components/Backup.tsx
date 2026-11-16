import { useRef, useState } from 'react'
import { Download, HardDriveDownload, Share2, Upload } from 'lucide-react'
import { updateSettings } from '../db/actions'
import { exportBackup, importBackup, saveFile } from '../db/backup'
import type { Settings } from '../db/types'
import { today } from '../lib/format'
import { Button, Card, Modal, useToast } from './ui'
import { ask, tell } from './confirm'

const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches ?? false
const markBackup = () => updateSettings({ lastBackupAt: Date.now() })
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

/**
 * Yedek alır. Telefonda / tablette paylaşım menüsünü açar (iPhone: Dosyalar'a Kaydet, Android: Drive / İndirilenler,
 * ya da WhatsApp ile kendinize gönderin); bilgisayarda dosyayı indirir.
 */
export function BackupButton({ size, variant = 'primary', label = 'Yedek al' }: { size?: 'sm' | 'md'; variant?: 'primary' | 'secondary' | 'soft'; label?: string }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState<File | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const blob = await exportBackup()
      const name = `luma-yedek-${today()}.json`
      const file = new File([blob], name, { type: 'application/json' })
      // Paylaşım menüsü doğrudan bir dokunuşla açılmalı: dosya hazırlanınca ikinci düğmeyle açılır
      if (!import.meta.env.VITE_EMBED && isTouch() && navigator.canShare?.({ files: [file] })) {
        setReady(file)
        return
      }
      if (await saveFile(blob, name)) {
        await markBackup()
        toast('Yedek kaydedildi')
      }
    } catch (e) {
      await tell((e as Error).message || 'Yedek alınamadı')
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!ready) return
    try {
      await navigator.share({ files: [ready], title: 'Luma Cakes yedeği' })
      await markBackup()
      toast('Yedek kaydedildi')
      setReady(null)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      await download()
    }
  }

  const download = async () => {
    if (!ready) return
    if (await saveFile(ready, ready.name)) {
      await markBackup()
      toast('Yedek indirildi')
    }
    setReady(null)
  }

  return (
    <>
      <Button size={size} variant={variant} icon={<Download size={16} />} disabled={busy} onClick={run}>
        {busy ? 'Hazırlanıyor…' : label}
      </Button>
      <Modal
        open={Boolean(ready)}
        onClose={() => setReady(null)}
        title="Yedek hazır"
        footer={
          <>
            <Button icon={<HardDriveDownload size={16} />} onClick={download}>
              İndir
            </Button>
            <Button variant="primary" icon={<Share2 size={16} />} onClick={share}>
              Paylaş / Kaydet
            </Button>
          </>
        }
      >
        <p className="text-[15px]">
          Yedek dosyası hazır{ready ? ` (${mb(ready.size)})` : ''}. <b>Paylaş / Kaydet</b>’e dokunup:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            iPhone / iPad: <b className="text-ink">Dosyalar’a Kaydet</b> (iCloud Drive)
          </li>
          <li>
            Android: <b className="text-ink">Drive</b> ya da <b className="text-ink">Dosyalar</b>
          </li>
          <li>ya da WhatsApp’ta kendinize gönderin</li>
        </ul>
        <p className="mt-3 text-sm text-muted">Fotoğraflar dahil tüm kayıtlar bu dosyadadır. Başka bir cihazda “Yedeği geri yükle” ile açılır.</p>
      </Modal>
    </>
  )
}

/** Yedek dosyasını seçip geri yükler (tüm mevcut verilerin yerini alır) */
export function RestoreButton({ size, label = 'Yedeği geri yükle' }: { size?: 'sm' | 'md'; label?: string }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <Button size={size} icon={<Upload size={16} />} disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Yükleniyor…' : label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Yedek dosyası"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          if (!(await ask('Yedek geri yüklenirse bu cihazdaki TÜM mevcut verilerin yerini alır. Devam edilsin mi?', { confirmLabel: 'Geri yükle' }))) return
          setBusy(true)
          try {
            await importBackup(f)
            toast('Yedek geri yüklendi')
            setTimeout(() => location.reload(), 600)
          } catch (err) {
            await tell((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      />
    </>
  )
}

/** Veriler yalnızca cihazda: 7 günden uzun süredir yedek alınmadıysa hatırlatır */
export function BackupReminder({ settings, hasData }: { settings: Settings; hasData: boolean }) {
  if (!hasData) return null
  const last = settings.lastBackupAt
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null
  if (days !== null && days < 7) return null
  return (
    <Card className="border-amber-200 bg-amber-50/60 p-4" data-testid="backup-reminder">
      <div className="text-sm text-amber-900">
        <div className="font-semibold">Yedek almayı unutmayın</div>
        <p className="mt-0.5">
          Kayıtlar yalnızca bu cihazda saklanıyor. {days === null ? 'Henüz hiç yedek alınmadı.' : `Son yedek ${days} gün önce alındı.`}
        </p>
      </div>
      <div className="mt-3">
        <BackupButton size="sm" />
      </div>
    </Card>
  )
}
