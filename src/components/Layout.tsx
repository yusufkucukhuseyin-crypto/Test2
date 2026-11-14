import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChartColumn,
  ChartGantt,
  ClipboardList,
  House,
  Images,
  Menu,
  Package,
  Plus,
  Settings as SettingsIcon,
  Users,
  X,
} from 'lucide-react'
import { useSettings } from '../lib/hooks'
import { ACCENTS } from '../db/defaults'
import { cx } from './ui'
import { ErrorBoundary } from './ErrorBoundary'

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: 'Ana sayfa', icon: <House size={20} />, end: true },
  { to: '/siparisler', label: 'Siparişler', icon: <ClipboardList size={20} /> },
  { to: '/takvim', label: 'Takvim', icon: <CalendarDays size={20} /> },
  { to: '/planlama', label: 'Üretim planı', icon: <ChartGantt size={20} /> },
  { to: '/musteriler', label: 'Müşteriler', icon: <Users size={20} /> },
  { to: '/katalog', label: 'Katalog', icon: <Images size={20} /> },
  { to: '/stok', label: 'Stok', icon: <Package size={20} /> },
  { to: '/raporlar', label: 'Raporlar', icon: <ChartColumn size={20} /> },
  { to: '/ayarlar', label: 'Ayarlar', icon: <SettingsIcon size={20} /> },
]

function Logo({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-display text-lg text-white">
        {name.trim()[0]?.toLocaleUpperCase('tr-TR') ?? 'P'}
      </div>
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
  const loc = useLocation()
  const nav = useNavigate()

  useEffect(() => setMenuOpen(false), [loc.pathname])

  useEffect(() => {
    const a = ACCENTS.find((x) => x.key === settings?.accent) ?? ACCENTS[0]
    const r = document.documentElement.style
    r.setProperty('--accent', a.accent)
    r.setProperty('--accent-soft', a.soft)
    r.setProperty('--accent-ink', a.ink)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#faf6f2')
  }, [settings?.accent])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  const name = settings?.businessName || 'Pastane'

  return (
    <div className="min-h-dvh md:flex">
      {/* Tablet / masaüstü yan menü */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-white/70 px-3 py-5 md:flex">
        <div className="px-2 pb-5">
          <Logo name={name} />
        </div>
        <button
          type="button"
          onClick={() => nav('/siparisler/yeni')}
          className="mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-medium text-white shadow-sm hover:brightness-95"
        >
          <Plus size={18} /> Yeni sipariş
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                  isActive ? 'bg-accent-soft font-medium text-accent-ink' : 'text-ink/80 hover:bg-stone-100',
                )
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Telefon üst çubuk */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo name={name} />
          <button
            type="button"
            aria-label="Menü"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-stone-100"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-7 md:pb-10">
        <div className="mx-auto max-w-6xl">
          <ErrorBoundary resetKey={loc.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Telefon alt menü */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {[NAV[0], NAV[1]].map((n) => (
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
          {[NAV[2], NAV[4]].map((n) => (
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
              <Logo name={name} />
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
                  {n.icon}
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
