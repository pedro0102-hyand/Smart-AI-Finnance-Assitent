import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Wallet,
  ShoppingCart, MessageSquare, Sun, Moon, TrendingUp,
  LogOut, ChevronDown, User,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { usePageTitle } from '../../hooks/usePageTitle'
import { usePageTransition } from '../../hooks/usePageTransition'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',      labelShort: 'Início'  },
  { to: '/expenses',  icon: Receipt,         label: 'Gastos',         labelShort: 'Gastos'  },
  { to: '/salary',    icon: Wallet,          label: 'Salário',        labelShort: 'Salário' },
  { to: '/purchase',  icon: ShoppingCart,    label: 'Posso Comprar?', labelShort: 'Comprar' },
  { to: '/chat',      icon: MessageSquare,   label: 'Assistente IA',  labelShort: 'Chat'    },
]

const ROUTE_LABEL: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/expenses':  'Gastos',
  '/salary':    'Salário',
  '/purchase':  'Posso Comprar?',
  '/chat':      'Assistente IA',
}

// ── User menu dropdown ────────────────────────────────────────────────────────
function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  // Iniciais para o avatar
  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5
                   text-sm text-[var(--text-muted)] hover:bg-[var(--bg-card)]
                   hover:text-[var(--text-primary)] transition-all duration-150"
      >
        {/* Avatar */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                        bg-amber-500/20 text-amber-500 text-xs font-bold">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="truncate text-xs font-medium text-[var(--text-primary)]">{user.name}</p>
          <p className="truncate text-[10px] text-[var(--text-muted)]">{user.email}</p>
        </div>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border
                        border-[var(--border)] bg-[var(--bg-card)] shadow-xl overflow-hidden
                        animate-slide-up z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); logout() }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
                       text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={14} /> Sair da conta
          </button>
        </div>
      )}
    </div>
  )
}

// ── Mobile user avatar (top bar) ──────────────────────────────────────────────
function MobileUserAvatar() {
  const { user, logout } = useAuth()
  const [open, setOpen]  = useState(false)
  const ref              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null
  const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full
                   bg-amber-500/20 text-amber-500 text-xs font-bold"
        aria-label="Menu do usuário"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border
                        border-[var(--border)] bg-[var(--bg-card)] shadow-xl overflow-hidden
                        animate-slide-up z-50">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <User size={12} /> {user.name}
            </p>
            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{user.email}</p>
          </div>
          <button
            onClick={() => { setOpen(false); logout() }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm
                       text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut size={14} /> Sair da conta
          </button>
        </div>
      )}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout() {
  const { theme, toggle } = useTheme()
  const { pathname }      = useLocation()
  const { transitionKey, transitionClass } = usePageTransition()

  usePageTitle()

  const currentLabel = ROUTE_LABEL[pathname] ?? 'SmartFinance'

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">

      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex w-60 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[var(--border)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <TrendingUp size={16} className="text-graphite-950" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg leading-none">
            Smart<span className="text-amber-500">Finance</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ` +
                (isActive
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: theme + user */}
        <div className="px-3 py-4 border-t border-[var(--border)] space-y-1">
          <button
            onClick={toggle}
            className="btn-ghost w-full justify-start"
            aria-label="Alternar tema"
          >
            {theme === 'dark'
              ? <><Sun size={16} /> Modo claro</>
              : <><Moon size={16} /> Modo escuro</>
            }
          </button>
          <UserMenu />
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3
                           border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500">
              <TrendingUp size={12} className="text-graphite-950" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base leading-none">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="btn-ghost p-2" aria-label="Alternar tema">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <MobileUserAvatar />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8">
          <div key={transitionKey} className={transitionClass}>
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden flex border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0
                        safe-area-inset-bottom">
          {NAV.map(({ to, icon: Icon, labelShort }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ` +
                (isActive ? 'text-amber-500' : 'text-[var(--text-muted)]')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{labelShort}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}