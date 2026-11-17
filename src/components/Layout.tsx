import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  EyeOff,
  Gift,
  House,
  Images,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings as SettingsIcon,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useSettings } from '../lib/hooks'
import { upcomingSpecialDays } from '../lib/domain'
import { resolveAccent } from '../lib/color'
import { cx } from './ui'
import { ErrorBoundary } from './ErrorBoundary'
import { SyncIndicator } from './Cloud'

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: 'Ana sayfa', icon: <House size={20} />, end: true },
  { to: '/siparisler', label: 'Siparişler', icon: <ClipboardList size={20} /> },
  { to: '/takvim', label: 'Takvim', icon: <CalendarDays size={20} /> },
  { to: '/musteriler', label: 'Müşteriler', icon: <Users size={20} /> },
  { to: '/ozel-gunler', label: 'Özel günler', icon: <Gift size={20} /> },
  { to: '/fiyat-listesi', label: 'Fiyat listesi', icon: <Tags size={20} /> },
  { to: '/katalog', label: 'Katalog', icon: <Images size={20} /> },
  { to: '/stok', label: 'Stok', icon: <Package size={20} /> },
  { to: '/raporlar', label: 'Raporlar', icon: <ChartColumn size={20} /> },
  { to: '/ayarlar', label: 'Ayarlar', icon: <SettingsIcon size={20} /> },
]
const navItem = (to: string) => NAV.find((n) => n.to === to)!

/** Yan menü görünümü (tablet / masaüstü) */
type MenuMode = 'full' | 'mini' | 'hidden'
const MENU_KEY = 'luma-menu'

function readMenuMode(): MenuMode {
  try {
    const v = localStorage.getItem(MENU_KEY)
    return v === 'mini' || v === 'hidden' ? v : 'full'
  } catch {
    return 'full'
  }
}

function BrandMark({ name, logo, size = 36 }: { name: string; logo?: string; size?: number }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-white object-contain ring-1 ring-line"
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-display text-lg text-white"
    >
      {name.trim()[0]?.toLocaleUpperCase('tr-TR') ?? 'P'}
    </div>
  )
}

function Logo({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark name={name} logo={logo} />
      <div className="min-w-0">
        <div className="truncate font-display text-lg leading-tight text-ink">{name}</div>
        <div className="text-[11px] tracking-wide text-muted uppercase">Sipariş atölyesi</div>
      </div>
    </div>
  )
}

export default function Layout() {
  const settings = useSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setModeState] = useState<MenuMode>(readMenuMode)
  const loc = useLocation()
  const nav = useNavigate()

  const setMode = (m: MenuMode) => {
    setModeState(m)
    try {
      localStorage.setItem(MENU_KEY, m)
    } catch {
      /* tarayıcı depolaması yoksa yalnızca bu oturumda */
    }
  }

  useEffect(() => setMenuOpen(false), [loc.pathname])

  useEffect(() => {
    const a = resolveAccent(settings)
    const r = document.documentElement.style
    r.setProperty('--accent', a.accent)
    r.setProperty('--accent-soft', a.soft)
    r.setProperty('--accent-ink', a.ink)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#faf6f2')
  }, [settings?.accent, settings?.accentColor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  // Önümüzdeki 7 gündeki özel günler: menüde sayı olarak gösterilir
  const soonSpecials = useLiveQuery(async () => upcomingSpecialDays(await db.customers.toArray(), 7).length, []) ?? 0
  // Minimum seviyenin altına inen stok kalemleri (ör. kutular): menüde sayı olarak gösterilir
  const lowStock =
    useLiveQuery(async () => (await db.stockItems.toArray()).filter((s) => s.minQuantity && s.quantity <= s.minQuantity).length, []) ?? 0
  const badge = (to: string) => (to === '/ozel-gunler' ? soonSpecials : to === '/stok' ? lowStock : 0)

  const name = settings?.businessName || 'Pastane'
  const logo = settings?.logo
  const mini = mode === 'mini'

  return (
    <div className="min-h-dvh md:flex">
      {/* Tablet / masaüstü yan menü: tam, küçük (yalnızca simgeler) ya da gizli */}
      {mode !== 'hidden' && (
        <aside
          className={cx(
            'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-white/70 py-5 transition-[width] md:flex',
            mini ? 'w-[76px] items-center px-2' : 'w-60 px-3',
          )}
        >
          <div className={cx('pb-4', mini ? 'flex flex-col items-center gap-1' : 'px-2')}>
            {mini ? <BrandMark name={name} logo={logo} size={40} /> : <Logo name={name} logo={logo} />}
            <div className={mini ? '' : '-ml-2 mt-2'}>
              <SyncIndicator compact={mini} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => nav('/siparisler/yeni')}
            aria-label="Yeni sipariş"
            title={mini ? 'Yeni sipariş' : undefined}
            className={cx(
              'mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-medium text-white shadow-sm hover:brightness-95',
              mini && 'w-11',
            )}
          >
            <Plus size={18} /> {!mini && 'Yeni sipariş'}
          </button>
          <nav className={cx('flex flex-col gap-0.5', mini && 'items-center')}>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                aria-label={n.label}
                title={mini ? n.label : undefined}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-xl text-[15px] transition',
                    mini ? 'h-11 w-11 justify-center' : 'px-3 py-2.5',
                    isActive ? 'bg-accent-soft font-medium text-accent-ink' : 'text-ink/80 hover:bg-stone-100',
                  )
                }
              >
                <span className="relative">
                  {n.icon}
                  {mini && badge(n.to) > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white" />}
                </span>
                {!mini && n.label}
                {!mini && badge(n.to) > 0 && (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-xs leading-5 font-semibold text-white" title="7 gün içinde">
                    {badge(n.to)}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className={cx('mt-auto flex gap-1 pt-4', mini ? 'flex-col items-center' : 'px-1')}>
            <button
              type="button"
              onClick={() => setMode(mini ? 'full' : 'mini')}
              title={mini ? 'Menüyü genişlet' : 'Menüyü küçült'}
              className={cx(
                'flex h-10 items-center gap-2 rounded-xl text-sm text-muted hover:bg-stone-100 hover:text-ink',
                mini ? 'w-10 justify-center' : 'flex-1 px-3',
              )}
            >
              {mini ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!mini && 'Küçült'}
            </button>
            <button
              type="button"
              onClick={() => setMode('hidden')}
              title="Menüyü gizle"
              className={cx(
                'flex h-10 items-center gap-2 rounded-xl text-sm text-muted hover:bg-stone-100 hover:text-ink',
                mini ? 'w-10 justify-center' : 'flex-1 px-3',
              )}
            >
              <EyeOff size={18} />
              {!mini && 'Gizle'}
            </button>
          </div>
        </aside>
      )}
      {mode === 'hidden' && (
        <button
          type="button"
          onClick={() => setMode('full')}
          title="Menüyü göster"
          aria-label="Menüyü göster"
          className="fixed top-4 left-4 z-40 hidden h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-sm hover:bg-stone-50 md:flex"
        >
          <PanelLeftOpen size={20} />
        </button>
      )}

      {/* Telefon üst çubuk */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo name={name} logo={logo} />
          <div className="flex items-center gap-1">
            <SyncIndicator compact />
            <button
              type="button"
              aria-label="Menü"
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className={cx('min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-7 md:pb-10', mode === 'hidden' && 'md:pl-20')}>
        <div className="mx-auto max-w-6xl">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Telefon alt menü */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {[navItem('/'), navItem('/siparisler')].map((n) => (
            <BottomLink key={n.to} {...n} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              aria-label="Yeni sipariş"
              onClick={() => nav('/siparisler/yeni')}
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg ring-4 ring-cream"
            >
              <Plus size={26} />
            </button>
          </div>
          {[navItem('/takvim'), navItem('/musteriler')].map((n) => (
            <BottomLink key={n.to} {...n} />
          ))}
        </div>
      </nav>

      {/* Telefon tam menü */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMenuOpen(false)} />
          <div className="animate-sheet pb-safe absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <Logo name={name} logo={logo} />
              <button
                type="button"
                aria-label="Kapat"
                onClick={() => setMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100"
              >
                <X size={22} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cx(
                      'flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-[13px]',
                      isActive ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-ink',
                    )
                  }
                >
                  <span className="relative">
                    {n.icon}
                    {badge(n.to) > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-white">{badge(n.to)}</span>
                    )}
                  </span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BottomLink({ to, label, icon, end }: { to: string; label: string; icon: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cx('flex flex-col items-center gap-0.5 text-[11px]', isActive ? 'text-accent-ink' : 'text-muted')
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
