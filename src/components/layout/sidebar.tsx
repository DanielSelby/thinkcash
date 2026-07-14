'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowUpDown, TrendingUp, TrendingDown,
  PiggyBank, Target, BarChart3, BrainCircuit, Bell,
  Settings, Shield, Users, ChevronLeft, ChevronRight,
  Wallet, RefreshCcw, Tag, BookMarked, CreditCard,
  Sparkles, HeartPulse, Landmark, CalendarClock, BadgeCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/config'
import { canAccessPage } from '@/lib/page-access'

// ── Nav item definitions ───────────────────────────────────────────────

const navItems = [
  { href: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard'          },
  { href: '/transactions',  icon: ArrowUpDown,     label: 'Transactions'       },
  { href: '/income',        icon: TrendingUp,      label: 'Income'             },
  { href: '/expenses',      icon: TrendingDown,    label: 'Expenses'           },
  { href: '/budgets',       icon: Wallet,          label: 'Budgets'            },
  { href: '/user-accounts', icon: CreditCard,      label: 'My Wallets'         },
  { href: '/savings',       icon: PiggyBank,       label: 'Savings Goals'      },
  { href: '/wealth',        icon: Landmark,        label: 'My Wealth'          },
  { href: '/custody',       icon: Users,           label: 'Custody Account'    },
  { href: '/recurring',     icon: RefreshCcw,      label: 'Recurring'          },
  { href: '/reports',       icon: BarChart3,       label: 'Reports'            },
  { href: '/analytics',     icon: BrainCircuit,    label: 'Analytics'          },
  { href: '/forecast',      icon: CalendarClock,   label: 'Cash Flow Forecast' },
  { href: '/accounts',      icon: BookMarked,      label: 'Chart of Accounts'  },
  { href: '/categories',    icon: Tag,             label: 'Set Categories'     },
  { href: '/health-score',  icon: HeartPulse,      label: 'Health Score'       },
  { href: '/ai-advisor',    icon: Sparkles,        label: 'AI Advisor'         },
]

const bottomItems = [
  { href: '/notifications', icon: Bell,     label: 'Notifications' },
  { href: '/settings',      icon: Settings, label: 'Settings'      },
]

const adminItems = [
  { href: '/admin/dashboard',     icon: LayoutDashboard, label: 'Overview'           },
  { href: '/admin/users',         icon: Users,           label: 'Users'              },
  { href: '/admin/subscriptions', icon: BadgeCheck,      label: 'Subscription Plans' },
  { href: '/admin/analytics',     icon: BarChart3,       label: 'Analytics'          },
  { href: '/admin/monitoring',    icon: Shield,          label: 'Monitoring'         },
]

// ── NavLink ────────────────────────────────────────────────────────────

function NavLink({
  href, icon: Icon, label, active, sidebar, sidebarOpen, highlight,
}: {
  href:        string
  icon:        any
  label:       string
  active:      boolean
  sidebar:     any
  sidebarOpen: boolean
  highlight?:  boolean
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
        background: active
          ? sidebar.activeBackground
          : highlight && !active
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        color:     active ? sidebar.activeText : sidebar.textMuted,
        boxShadow: active && sidebarOpen
          ? `inset 3px 0 0 ${sidebar.activeText}`
          : 'none',
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
          el.style.background = highlight ? 'rgba(255,255,255,0.06)' : 'transparent'
          el.style.color      = sidebar.textMuted
        }
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {sidebarOpen && <span className="flex-1">{label}</span>}
      {sidebarOpen && highlight && !active && (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-semibold"
          style={{ background: sidebar.activeText + '25', color: sidebar.activeText }}
        >
          AI
        </span>
      )}
    </Link>
  )
}

// ── Logo size maps ─────────────────────────────────────────────────────

const LOGO_IMG_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8',
  md: 'h-14',
  lg: 'h-24',
}

const LOGO_CIRCLE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
}

const LOGO_AREA_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-16',
  md: 'h-20',
  lg: 'h-24',
}

// ── Sidebar ────────────────────────────────────────────────────────────

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const {
    sidebarOpen, setSidebarOpen, getTheme,
    appLogo, logoSize, viewMode, profile,
  } = useAppStore()

  const theme        = getTheme()
  const { sidebar }  = theme
  const isAdminUser  = profile?.role === 'admin'
  const allowedPages = profile?.allowed_pages ?? null

  const items = (isAdmin ? adminItems : navItems).filter(item => {
    if (isAdmin) return true
    const key = item.href.replace(/^\//, '')
    if (key === 'dashboard') return true
    return isAdminUser || canAccessPage(allowedPages, key)
  })

  const size           = logoSize ?? 'md'
  const logoAreaHeight = appLogo && sidebarOpen ? LOGO_AREA_HEIGHT[size] : 'h-16'

  return (
    <aside
      style={{ background: sidebar.background, borderColor: sidebar.borderColor }}
      className={cn(
        'relative flex flex-col h-full border-r transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarOpen ? 'w-64' : 'w-16',
      )}
    >
      {/* ── Logo area ─────────────────────────────────────────────── */}
      <div
        style={{ borderColor: sidebar.borderColor }}
        className={cn(
          'flex items-center border-b gap-3 px-4 transition-all duration-300',
          logoAreaHeight,
          !sidebarOpen && 'justify-center px-0',
        )}
      >
        {/* Logo image or placeholder */}
        {appLogo ? (
          <div
            className={cn(
              'flex-shrink-0 rounded-full bg-white flex items-center justify-center shadow-sm transition-all duration-300',
              size === 'lg' && sidebarOpen ? 'p-0.5' : 'p-1.5',
              !sidebarOpen ? 'w-10 h-10' : LOGO_CIRCLE[size],
            )}
          >
            <img
              src={appLogo}
              alt="Logo"
              className={cn(
                'object-contain transition-all duration-300 w-auto',
                !sidebarOpen ? 'h-6' : LOGO_IMG_HEIGHT[size],
              )}
            />
          </div>
        ) : (
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border:     '2px dashed rgba(255,255,255,0.35)',
            }}
          >
            <Target className="w-5 h-5 text-white/80" />
          </div>
        )}

        {/* App name + tagline — only when sidebar is expanded */}
        {sidebarOpen && (
          <div className="min-w-0">
            <span
              style={{ color: sidebar.text }}
              className="font-display font-bold text-base leading-tight block truncate"
            >
              {APP_CONFIG.name}
            </span>
            <p
              style={{ color: sidebar.textMuted }}
              className="text-xs leading-tight truncate mt-1.5"
            >
              Your Finance Manager
            </p>
          </div>
        )}
      </div>

      {/* ── Main nav ──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">

        {/* Admin label */}
        {isAdmin && sidebarOpen && (
          <p
            style={{ color: sidebar.textMuted }}
            className="text-xs font-semibold uppercase tracking-wider px-3 pb-2 pt-1"
          >
            Admin Panel
          </p>
        )}

        {/* Regular nav items (excludes AI-specific routes handled below) */}
        {items
          .filter(i => i.href !== '/health-score' && i.href !== '/ai-advisor')
          .map(({ href, icon, label }) => (
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

        {/* ── AI section divider ── */}
        {!isAdmin && sidebarOpen && (
          <div className="pt-2 pb-1 px-3">
            <div className="border-t" style={{ borderColor: sidebar.borderColor }} />
            <p
              className="text-xs font-semibold uppercase tracking-wider mt-2"
              style={{ color: sidebar.activeText }}
            >
              ✦ AI Features
            </p>
          </div>
        )}
        {!isAdmin && !sidebarOpen && (
          <div
            className="my-1 mx-auto w-6 border-t"
            style={{ borderColor: sidebar.borderColor }}
          />
        )}

        {/* AI nav items */}
        {!isAdmin && [
          { href: '/health-score', icon: HeartPulse, label: 'Health Score' },
          { href: '/ai-advisor',   icon: Sparkles,   label: 'AI Advisor'   },
        ]
          .filter(({ href }) =>
            isAdminUser || canAccessPage(allowedPages, href.replace(/^\//, '')),
          )
          .map(({ href, icon, label }) => (
            <NavLink
              key={href}
              href={href}
              icon={icon}
              label={label}
              active={pathname === href || pathname.startsWith(href + '/')}
              sidebar={sidebar}
              sidebarOpen={sidebarOpen}
              highlight
            />
          ))}
      </nav>

      {/* ── Bottom nav (Notifications + Settings) ─────────────────── */}
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

      {/* ── Collapse toggle (hidden on mobile — sidebar auto-collapses) ── */}
      {viewMode !== 'mobile' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            background:  sidebar.background,
            borderColor: sidebar.borderColor,
            color:       sidebar.text,
          }}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-sm"
        >
          {sidebarOpen
            ? <ChevronLeft  className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />}
        </Button>
      )}
    </aside>
  )
}