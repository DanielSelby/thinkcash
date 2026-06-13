'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, ArrowUpDown, TrendingUp, TrendingDown,
  PiggyBank, Target, BarChart3, BrainCircuit, Bell,
  Settings, Shield, Users, ChevronLeft, ChevronRight,
  Wallet, RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { APP_CONFIG } from '@/lib/config'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions', icon: ArrowUpDown, label: 'Transactions' },
  { href: '/income', icon: TrendingUp, label: 'Income' },
  { href: '/expenses', icon: TrendingDown, label: 'Expenses' },
  { href: '/budgets', icon: Wallet, label: 'Budgets' },
  { href: '/savings', icon: PiggyBank, label: 'Savings Goals' },
  { href: '/recurring', icon: RefreshCcw, label: 'Recurring' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/analytics', icon: BrainCircuit, label: 'Analytics' },
]

const bottomItems = [
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

const adminItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/admin/monitoring', icon: Shield, label: 'Monitoring' },
]

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, getTheme, appLogo } = useAppStore()
  const theme = getTheme()
  const { sidebar } = theme
  const items = isAdmin ? adminItems : navItems

  return (
    <aside
      style={{ background: sidebar.background, borderColor: sidebar.borderColor }}
      className={cn('relative flex flex-col h-full border-r transition-all duration-300 ease-in-out', sidebarOpen ? 'w-64' : 'w-16')}
    >
      {/* Logo */}
      <div style={{ borderColor: sidebar.borderColor }} className={cn('flex items-center h-16 px-4 border-b gap-3', !sidebarOpen && 'justify-center px-0')}>
        {appLogo ? (
          <img src={appLogo} alt="Logo" className={cn('object-contain', sidebarOpen ? 'h-9 w-auto' : 'h-8 w-8 rounded')} />
        ) : (
          <div style={{ background: theme.colors.accent }} className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-white" />
          </div>
        )}
        {sidebarOpen && (
          <div>
            <span style={{ color: sidebar.text }} className="font-display font-bold text-base leading-tight">{APP_CONFIG.name}</span>
            {!appLogo && <p style={{ color: sidebar.textMuted }} className="text-xs leading-tight">{APP_CONFIG.tagline}</p>}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {isAdmin && sidebarOpen && (
          <p style={{ color: sidebar.textMuted }} className="text-xs font-semibold uppercase tracking-wider px-3 pb-2 pt-1">Admin Panel</p>
        )}
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{ background: active ? sidebar.activeBackground : 'transparent', color: active ? sidebar.activeText : sidebar.textMuted }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = sidebar.hoverBackground; (e.currentTarget as HTMLElement).style.color = sidebar.text } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = sidebar.textMuted } }}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150', !sidebarOpen && 'justify-center px-0 w-10 mx-auto')}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div style={{ borderColor: sidebar.borderColor }} className="py-4 px-2 space-y-0.5 border-t">
        {bottomItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              style={{ background: active ? sidebar.activeBackground : 'transparent', color: active ? sidebar.activeText : sidebar.textMuted }}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all', !sidebarOpen && 'justify-center px-0 w-10 mx-auto')}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          )
        })}
      </div>

      {/* Toggle */}
      <Button
        variant="ghost" size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{ background: sidebar.background, borderColor: sidebar.borderColor, color: sidebar.text }}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border shadow-sm"
      >
        {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </Button>
    </aside>
  )
}