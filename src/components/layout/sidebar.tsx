'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowUpDown, TrendingUp, TrendingDown,
  PiggyBank, Target, BarChart3, BrainCircuit, Bell,
  Settings, Shield, Users, ChevronLeft, ChevronRight,
  Wallet, RefreshCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'

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

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  const adminItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/admin/monitoring', icon: Shield, label: 'Monitoring' },
  ]

  const items = isAdmin ? adminItems : navItems

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-border gap-3',
        !sidebarOpen && 'justify-center px-0'
      )}>
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Target className="w-4 h-4 text-primary-foreground" />
        </div>
        {sidebarOpen && (
          <span className="font-display font-bold text-lg gradient-text">Think-Shika PA</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {isAdmin && sidebarOpen && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-2 pt-1">
            Admin
          </p>
        )}
        {items.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                'hover:bg-accent/10 hover:text-accent',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground',
                !sidebarOpen && 'justify-center px-0 w-10 mx-auto'
              )}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom items */}
      <div className="py-4 px-2 space-y-0.5 border-t border-border">
        {bottomItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                'hover:bg-accent/10 hover:text-accent',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                !sidebarOpen && 'justify-center px-0 w-10 mx-auto'
              )}
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
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-card shadow-sm hover:bg-accent/10"
      >
        {sidebarOpen
          ? <ChevronLeft className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />
        }
      </Button>
    </aside>
  )
}
