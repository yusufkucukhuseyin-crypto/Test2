import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Cloud, CloudCheck, CloudOff, LoaderCircle, LogOut, RefreshCw } from 'lucide-react'
import { cloudEnabled, signIn, signOut, syncNow, useSync, type SyncState } from '../lib/cloud'
import { Button, Card, Field, Input, cx, useToast } from './ui'
import { ask } from './confirm'

function describe(s: SyncState): { icon: React.ReactNode; text: string; tone: string } {
  switch (s.phase) {
    case 'off':
      return { icon: <CloudOff size={16} />, text: 'Bulut kapalı', tone: 'text-muted' }
    case 'starting':
    case 'syncing':
      return { icon: <LoaderCircle size={16} className="animate-spin" />, text: 'Eşitleniyor…', tone: 'text-accent-ink' }
    case 'offline':
      return {
        icon: <CloudOff size={16} />,
        text: s.pending ? `Çevrimdışı · ${s.pending} bekliyor` : 'Çevrimdışı',
        tone: 'text-amber-700',
      }
    case 'error':
      return { icon: <AlertTriangle size={16} />, text: 'Eşitleme hatası', tone: 'text-red-600' }
    default:
      return s.pending
        ? { icon: <Cloud size={16} />, text: `${s.pending} değişiklik bekliyor`, tone: 'text-accent-ink' }
        : { icon: <CloudCheck size={16} />, text: 'Buluta kaydedildi', tone: 'text-emerald-700' }
  }
}

/** Menüdeki küçük eşitleme durumu (dokununca Ayarlar → Bulut) */
export function SyncIndicator({ compact }: { compact?: boolean }) {
  const s = useSync()
  if (!cloudEnabled) return null
  const d = describe(s)
  return (
    <Link
      to="/ayarlar"
      title={d.text + (s.error ? ` — ${s.error}` : '')}
      aria-label={`Bulut: ${d.text}`}
      data-testid="sync-indicator"
      data-phase={s.phase}
      className={cx('inline-flex items-center gap-1.5 rounded-lg text-xs font-medium hover:bg-stone-100', compact ? 'h-9 w-9 justify-center' : 'px-2 py-1', d.tone)}
    >
      {d.icon}
      {!compact && <span className="truncate">{d.text}</span>}
    </Link>
  )
}

/** E-posta + şifre ile giriş */
export function CloudLoginForm() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await signIn(email, password)
          setPassword('')
          toast('Giriş yapıldı; veriler eşitleniyor')
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <Field label="E-posta">
        <Input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Şifre">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" variant="primary" disabled={busy || !email || !password}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </Button>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
    </form>
  )
}

/** Ayarlar → Bulut eşitleme */
export function CloudCard({ className }: { className?: string }) {
  const s = useSync()
  if (!cloudEnabled) return null
  const d = describe(s)
  return (
    <Card className={cx('p-4', className)} data-testid="cloud-card">
      <h2 className="font-display text-lg">Bulut eşitleme (tüm cihazlar)</h2>
      {s.phase === 'off' ? (
        <>
          <p className="mt-1 text-sm text-muted">
            Giriş yapınca girdiğiniz her kayıt otomatik olarak buluta kaydedilir; telefon, tablet ve bilgisayarda aynı hesapla giriş
            yaparak aynı verilere ulaşırsınız. İnternet yokken çalışmaya devam eder, bağlanınca eşitler.
          </p>
          <CloudLoginForm />
        </>
      ) : (
        <>
          <div className="mt-2 text-[15px]">
            <b>{s.email}</b> ile giriş yapıldı
          </div>
          <div className={cx('mt-1 flex items-center gap-1.5 text-sm', d.tone)}>
            {d.icon}
            {d.text}
            {s.phase === 'idle' && s.lastSync && !s.pending && (
              <span className="text-muted">
                · son eşitleme {new Date(s.lastSync).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {s.error && <p className="mt-1 text-sm text-red-600">{s.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={<RefreshCw size={16} />} onClick={syncNow} disabled={s.phase === 'syncing' || s.phase === 'starting'}>
              Şimdi eşitle
            </Button>
            <Button
              variant="ghost"
              icon={<LogOut size={16} />}
              onClick={async () => {
                if (
                  s.pending &&
                  !(await ask(`${s.pending} değişiklik henüz buluta gönderilmedi. Çıkış yaparsanız bir dahaki girişte gönderilir.`, {
                    confirmLabel: 'Çıkış yap',
                    danger: false,
                  }))
                )
                  return
                await signOut()
              }}
            >
              Çıkış yap
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Çıkış yapınca bu cihazdaki kayıtlar silinmez; yalnızca eşitleme durur.</p>
        </>
      )}
    </Card>
  )
}

/** Ana sayfada, giriş yapılmamışsa gösterilen kart */
export function CloudPrompt({ className }: { className?: string }) {
  const s = useSync()
  if (!cloudEnabled || s.phase !== 'off') return null
  return (
    <Card className={cx('border-accent/30 p-4', className)} data-testid="cloud-prompt">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Cloud size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">Tüm cihazlarınızda aynı veriler</div>
          <p className="mt-0.5 text-sm text-muted">Giriş yapın; kayıtlarınız otomatik olarak buluta kaydedilsin ve telefon, tablet, bilgisayarda görünsün.</p>
        </div>
      </div>
      <CloudLoginForm />
    </Card>
  )
}
