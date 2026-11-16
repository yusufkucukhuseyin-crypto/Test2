import { useSyncExternalStore } from 'react'

/**
 * Uygulama olarak yükleme (PWA) yardımcıları:
 * - yeni sürüm hazır olunca kullanıcıya sorar (form doldururken sayfa kendiliğinden yenilenmez)
 * - Android / masaüstü Chrome'un "yükle" istemini saklar
 * - iOS'ta "Ana Ekrana Ekle" adımlarını göstermek için platformu bilir
 */

type Listener = () => void
const listeners = new Set<Listener>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: Listener) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let needRefresh = false
let updateSW: ((reload?: boolean) => Promise<void>) | null = null
let installEvent: InstallPromptEvent | null = null
let installed = false

export function initPwa() {
  if (import.meta.env.VITE_EMBED) return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    installed = true
    emit()
  })
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh() {
          needRefresh = true
          emit()
        },
        onRegisteredSW(_url, reg) {
          // Uygulama açık kalırsa saatte bir yeni sürüm kontrolü
          if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
        },
      })
    })
    .catch(() => {})
}

export function useNeedRefresh(): boolean {
  return useSyncExternalStore(subscribe, () => needRefresh)
}

export function applyUpdate() {
  if (updateSW) updateSW(true)
  else location.reload()
}

export type Platform = 'ios' | 'android' | 'desktop'

export function platform(): Platform {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** Ana ekrandan (uygulama olarak) mı açıldı */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function useInstall() {
  const canPrompt = useSyncExternalStore(subscribe, () => Boolean(installEvent))
  const justInstalled = useSyncExternalStore(subscribe, () => installed)
  return {
    canPrompt,
    installed: justInstalled || isStandalone(),
    async prompt() {
      if (!installEvent) return false
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      installEvent = null
      emit()
      return choice.outcome === 'accepted'
    },
  }
}
