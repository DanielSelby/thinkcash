'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowUpDown, TrendingUp, TrendingDown,
  PiggyBank, Target, BarChart3, BrainCircuit, Bell,
  Settings, Shield, Users, ChevronLeft, ChevronRight,
  Wallet, RefreshCcw, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/config'

const navItems = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions', icon: ArrowUpDown,     label: 'Transactions' },
  { href: '/income',       icon: TrendingUp,      label: 'Income' },
  { href: '/expenses',     icon: TrendingDown,    label: 'Expenses' },
  { href: '/categories',   icon: Tag,             label: 'Categories' },
  { href: '/budgets',      icon: Wallet,          label: 'Budgets' },
  { href: '/savings',      icon: PiggyBank,       label: 'Savings Goals' },
  { href: '/recurring',    icon: RefreshCcw,      label: 'Recurring' },
  { href: '/reports',      icon: BarChart3,       label: 'Reports' },
  { href: '/analytics',    icon: BrainCircuit,    label: 'Analytics' },
]

const bottomItems = [
  { href: '/notifications', icon: Bell,     label: 'Notifications' },
  { href: '/settings',      icon: Settings, label: 'Settings' },
]

const adminItems = [
  { href: '/admin/dashboard',  icon: LayoutDashboard, label: 'Overview' },
  { href: '/admin/users',      icon: Users,           label: 'Users' },
  { href: '/admin/analytics',  icon: BarChart3,       label: 'Analytics' },
  { href: '/admin/monitoring', icon: Shield,          label: 'Monitoring' },
]

function NavLink({
  href, icon: Icon, label, active, sidebar, sidebarOpen,
}: {
  href: string
  icon: any
  label: string
  active: boolean
  sidebar: any
  sidebarOpen: boolean
}) {
  return (
    <Link
      href={href}
      title={!sidebarOpen ? label : undefined}
      className={cn(
        'flex items-center gap-3 text-sm font-medium transition-all duration-150 rounded-lg',
        sidebarOpen ? 'px-3 py-2' : 'justify-center w-10 h-10 mx-auto',
      )}
      style={{
        background: active ? sidebar.activeBackground : 'transparent',
        color:      active ? sidebar.activeText       : sidebar.textMuted,
        boxShadow:  active && sidebarOpen ? `inset 3px 0 0 ${sidebar.activeText}` : 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.background = sidebar.hoverBackground
          el.style.color      = sidebar.text
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'transparent'
          el.style.color      = sidebar.textMuted
        }
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {sidebarOpen && <span>{label}</span>}
    </Link>
  )
}

// Logo height classes per size setting
const LOGO_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7',
  md: 'h-10',
  lg: 'h-14',
}

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, getTheme, appLogo, logoSize } = useAppStore()
  const theme       = getTheme()
  const { sidebar } = theme
  const items       = isAdmin ? adminItems : navItems

  // Logo area height expands when logo is large
  const logoAreaHeight = appLogo && sidebarOpen && logoSize === 'lg' ? 'h-20' : 'h-16'

  return (
    <aside
      style={{ background: sidebar.background, borderColor: sidebar.borderColor }}
      className={cn(
        'relative flex flex-col h-full border-r transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* ── Logo area ── */}
      <div
        style={{ borderColor: sidebar.borderColor }}
        className={cn(
          'flex items-center border-b gap-3 px-4 transition-all duration-300',
          logoAreaHeight,
          !sidebarOpen && 'justify-center px-0'
        )}
      >
        {appLogo ? (
          <img
            src={appLogo}
            alt="Logo"
            className={cn(
              'object-contain flex-shrink-0 transition-all duration-300',
              !sidebarOpen
                ? 'h-8 w-8 rounded'
                : LOGO_HEIGHT[logoSize ?? 'md'] + ' w-auto'
            )}
          />
        ) : (
          <div
            style={{ background: theme.colors.accent }}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <Target className="w-4 h-4 text-white" />
          </div>
        )}

        {sidebarOpen && (
          <div className="min-w-0">
            <span
              style={{ color: sidebar.text }}
              className="font-display font-bold text-base leading-tight block truncate"
            >
              {APP_CONFIG.name}
            </span>
            {!appLogo && (
              <p
                style={{ color: sidebar.textMuted }}
                className="text-xs leading-tight truncate"
              >
                {APP_CONFIG.tagline}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Main nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {isAdmin && sidebarOpen && (
          <p
            style={{ color: sidebar.textMuted }}
            className="text-xs font-semibold uppercase tracking-wider px-3 pb-2 pt-1"
          >
            Admin Panel
          </p>
        )}
        {items.map(({ href, icon, label }) => (
          <NavLink
            key={href}
            href={href}
            icon={icon}
            label={label}
            active={pathname === href || pathname.startsWith(href + '/')}
            sidebar={sidebar}
            sidebarOpen={sidebarOpen}
          />
        ))}
      </nav>

      {/* ── Bottom nav ── */}
      <div
        style={{ borderColor: sidebar.borderColor }}
        className="py-3 px-2 space-y-0.5 border-t"
      >
        {bottomItems.map(({ href, icon, label }) => (
          <NavLink
            key={href}
            href={href}
            icon={icon}
            label={label}
            active={pathname === href}
            sidebar={sidebar}
            sidebarOpen={sidebarOpen}
          />
        ))}
      </div>

      {/* ── Collapse toggle ── */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          background:   sidebar.background,
          borderColor:  sidebar.borderColor,
          color:        sidebar.text,
        }}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-sm"
      >
        {sidebarOpen
          ? <ChevronLeft  className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />}
      </Button>
    </aside>
  )
}