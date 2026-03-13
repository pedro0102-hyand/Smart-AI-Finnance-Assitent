import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Wallet,
  ShoppingCart, MessageSquare, Sun, Moon, TrendingUp,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',  labelShort: 'Início'    },
  { to: '/expenses',  icon: Receipt,         label: 'Gastos',     labelShort: 'Gastos'    },
  { to: '/salary',    icon: Wallet,          label: 'Salário',    labelShort: 'Salário'   },
  { to: '/purchase',  icon: ShoppingCart,    label: 'Posso Comprar?', labelShort: 'Comprar' },
  { to: '/chat',      icon: MessageSquare,   label: 'Assistente IA',  labelShort: 'Chat'   },
]

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--bg-primary)]">

      {/* ── Sidebar (desktop) ────────────────────────────────────────── */}
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

        {/* Theme toggle */}
        <div className="px-3 py-4 border-t border-[var(--border)]">
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
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3
                           border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
          <span className="font-display text-lg">
            Smart<span className="text-amber-500">Finance</span>
          </span>
          <button onClick={toggle} className="btn-ghost p-2" aria-label="Alternar tema">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Page content — padding menor no mobile */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 animate-fade-in">
          <Outlet />
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