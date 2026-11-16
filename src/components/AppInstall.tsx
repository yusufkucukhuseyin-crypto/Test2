import { useState } from 'react'
import { Download, EllipsisVertical, RefreshCw, Share, SquarePlus, Smartphone, X } from 'lucide-react'
import { applyUpdate, platform, useInstall, useNeedRefresh } from '../lib/pwa'
import { Button, Card, cx } from './ui'

/** Yeni sürüm yüklendiğinde altta çıkan "Yenile" çubuğu */
export function UpdateBanner() {
  const need = useNeedRefresh()
  if (!need) return null
  return (
    <div className="pb-safe fixed inset-x-0 bottom-20 z-[70] flex justify-center px-4 md:bottom-6 print:hidden">
      <div className="flex items-center gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm text-white shadow-lg">
        Uygulamanın yeni sürümü hazır
        <Button size="sm" variant="primary" icon={<RefreshCw size={15} />} onClick={applyUpdate}>
          Yenile
        </Button>
      </div>
    </div>
  )
}

const DISMISS_KEY = 'luma-install-dismissed'

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Uygulamayı ana ekrana yükleme kartı.
 * Android / Chrome: tek dokunuşla yükle. iPhone / iPad: Safari'de Paylaş → Ana Ekrana Ekle adımları.
 * Uygulama olarak açıldıysa (ya da önizlemedeyse) görünmez.
 */
export function InstallCard({ dismissible = false, className }: { dismissible?: boolean; className?: string }) {
  const { canPrompt, installed, prompt } = useInstall()
  const [dismissed, setDismissed] = useState(() => dismissible && readDismissed())
  if (import.meta.env.VITE_EMBED || installed || dismissed) return null
  const p = platform()

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* yalnızca bu oturumda gizle */
    }
  }

  return (
    <Card className={cx('relative p-4', className)} data-testid="install-card">
      {dismissible && (
        <button
          type="button"
          aria-label="Kapat"
          onClick={dismiss}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-stone-100"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Smartphone size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">Uygulama olarak yükleyin</div>
          <p className="mt-0.5 text-sm text-muted">
            Ana ekranınızda simgesiyle açılır, tam ekran çalışır, internet olmadan da kullanılır.
          </p>

          {canPrompt ? (
            <Button className="mt-3" variant="primary" icon={<Download size={16} />} onClick={() => prompt()}>
              Uygulamayı yükle
            </Button>
          ) : p === 'ios' ? (
            <ol className="mt-3 space-y-2 text-sm">
              <Step n={1}>
                Safari’de alttaki <b>Paylaş</b> düğmesine dokunun <Share size={15} className="inline align-[-2px]" />
              </Step>
              <Step n={2}>
                Listeden <b>Ana Ekrana Ekle</b>’yi seçin <SquarePlus size={15} className="inline align-[-2px]" />
              </Step>
              <Step n={3}>
                Sağ üstte <b>Ekle</b>’ye dokunun. Uygulamayı artık ana ekrandaki <b>Luma Cakes</b> simgesinden açın.
              </Step>
            </ol>
          ) : p === 'android' ? (
            <ol className="mt-3 space-y-2 text-sm">
              <Step n={1}>
                Chrome’da sağ üstteki menüye dokunun <EllipsisVertical size={15} className="inline align-[-2px]" />
              </Step>
              <Step n={2}>
                <b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>’yi seçin.
              </Step>
            </ol>
          ) : (
            <p className="mt-2 text-sm">
              Chrome ya da Edge’de adres çubuğunun sağındaki <b>yükle</b> simgesine tıklayın. Telefonda ve tablette bu sayfayı açınca
              adımlar burada görünür.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">{n}</span>
      <span>{children}</span>
    </li>
  )
}
