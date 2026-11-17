import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ensureSettings } from './db/actions'
import { initPwa } from './lib/pwa'
import { initCloud } from './lib/cloud'

function StorageError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-line bg-white p-6 text-center">
        <div className="font-display text-xl">Veriler bu tarayıcıda saklanamıyor</div>
        <p className="mt-2 text-sm text-muted">
          Uygulama kayıtları cihazın tarayıcısında tutar. Gizli / özel pencerede ya da site verileri engellenmişken bu mümkün
          olmayabilir. Normal bir pencerede açmayı deneyin.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-50 p-2 text-left text-xs text-muted">{message}</pre>
      </div>
    </div>
  )
}

async function start() {
  // Yükleme istemi erken gelebilir; uygulama çizilmeden dinlemeye başla
  initPwa()
  const root = createRoot(document.getElementById('root')!)
  try {
    await ensureSettings()
  } catch (e) {
    console.error(e)
    root.render(<StorageError message={(e as Error)?.message ?? String(e)} />)
    return
  }
  // Tarayıcının verileri kendiliğinden silmemesi için kalıcı depolama iste
  try {
    navigator.storage?.persist?.().catch(() => {})
  } catch {
    /* desteklenmiyor */
  }
  // Bulut eşitleme (giriş yapılmışsa arka planda başlar)
  initCloud()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
