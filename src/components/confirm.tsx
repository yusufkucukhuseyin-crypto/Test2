import { useEffect, useState } from 'react'
import { Button, Modal } from './ui'

/**
 * Tarayıcının confirm()/alert() pencereleri yerine uygulama içi onay penceresi.
 * (Ana ekrana eklenmiş uygulamalarda ve gömülü sayfalarda yerleşik pencereler çalışmayabilir.)
 */
interface Request {
  message: string
  confirmLabel: string
  danger: boolean
  alertOnly: boolean
  resolve: (v: boolean) => void
}

let push: ((r: Request) => void) | null = null

export function ask(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(message))
    push({ message, confirmLabel: opts.confirmLabel ?? 'Evet', danger: opts.danger ?? true, alertOnly: false, resolve })
  })
}

export function tell(message: string): Promise<void> {
  return new Promise((resolve) => {
    if (!push) {
      window.alert(message)
      return resolve()
    }
    push({ message, confirmLabel: 'Tamam', danger: false, alertOnly: true, resolve: () => resolve() })
  })
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null)
  useEffect(() => {
    push = setReq
    return () => {
      push = null
    }
  }, [])
  if (!req) return null
  const done = (v: boolean) => {
    req.resolve(v)
    setReq(null)
  }
  return (
    <Modal
      open
      onClose={() => done(false)}
      title={req.alertOnly ? 'Bilgi' : 'Emin misiniz?'}
      footer={
        <>
          {!req.alertOnly && <Button onClick={() => done(false)}>Vazgeç</Button>}
          <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>
            {req.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">{req.message}</p>
    </Modal>
  )
}
