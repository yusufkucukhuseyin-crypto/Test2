import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ensureSettings } from './db/actions'

async function start() {
  try {
    await ensureSettings()
    // Tarayıcının verileri kendiliğinden silmemesi için kalıcı depolama iste
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {})
  } catch (e) {
    console.error(e)
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
