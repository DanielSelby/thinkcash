'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, X, ArrowRight,
  Plus, ArrowLeftRight, Target, Landmark, Download,
  TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3,
  Settings, User, Bell, Shield, FileText, Tag,
  CreditCard, Building2, ChevronRight, Clock, Zap,
  Hash, DollarSign, Receipt,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────
interface CommandItem {
  id:       string
  label:    string
  sub?:     string
  icon:     any
  iconBg:   string
  iconColor:string
  action:   () => void
  kbd?:     string
}

interface ResultItem {
  id:       string
  label:    string
  sub:      string
  amount?:  string
  icon:     any
  iconBg:   string
  iconColor:string
  action:   () => void
}

// ── Quick Actions ─────────────────────────────────────────────────────
const buildQuickActions = (router: ReturnType<typeof useRouter>, close: () => void, primary: string): CommandItem[] => [
  {
    id: 'add-income',
    label: 'Add Income',
    sub: 'Record a new income entry',
    icon: TrendingUp,
    iconBg: '#dcfce7', iconColor: '#16a34a',
    action: () => { router.push('/income'); close() },
    kbd: 'I',
  },
  {
    id: 'add-expense',
    label: 'Add Expense',
    sub: 'Record a new expense',
    icon: TrendingDown,
    iconBg: '#fee2e2', iconColor: '#dc2626',
    action: () => { router.push('/expenses'); close() },
    kbd: 'E',
  },
  {
    id: 'transfer',
    label: 'Transfer Money',
    sub: 'Move money between accounts',
    icon: ArrowLeftRight,
    iconBg: '#dbeafe', iconColor: '#2563eb',
    action: () => { router.push('/user-accounts'); close() },
    kbd: 'T',
  },
  {
    id: 'create-budget',
    label: 'Create Budget',
    sub: 'Set a new spending budget',
    icon: Target,
    iconBg: '#fef3c7', iconColor: '#d97706',
    action: () => { router.push('/budgets'); close() },
  },
  {
    id: 'add-asset',
    label: 'Add Asset',
    sub: 'Track a physical or financial asset',
    icon: Landmark,
    iconBg: '#f3e8ff', iconColor: '#7c3aed',
    action: () => { router.push('/wealth'); close() },
  },
  {
    id: 'net-worth',
    label: 'View Net Worth',
    sub: 'See your full wealth overview',
    icon: BarChart3,
    iconBg: '#ecfdf5', iconColor: '#059669',
    action: () => { router.push('/wealth'); close() },
  },
  {
    id: 'export-report',
    label: 'Export Report',
    sub: 'Download your financial data',
    icon: Download,
    iconBg: '#f0fdf4', iconColor: '#16a34a',
    action: () => { router.push('/reports'); close() },
  },
]

// ── Pages ─────────────────────────────────────────────────────────────
const PAGES = [
  { id: 'dashboard',     label: 'Dashboard',       path: '/dashboard',     icon: BarChart3,    iconBg: '#dcfce7', iconColor: '#16a34a' },
  { id: 'income',        label: 'Income',          path: '/income',        icon: TrendingUp,   iconBg: '#dcfce7', iconColor: '#16a34a' },
  { id: 'expenses',      label: 'Expenses',        path: '/expenses',      icon: TrendingDown, iconBg: '#fee2e2', iconColor: '#dc2626' },
  { id: 'transactions',  label: 'Transactions',    path: '/transactions',  icon: Receipt,      iconBg: '#dbeafe', iconColor: '#2563eb' },
  { id: 'accounts',      label: 'My Wallets',      path: '/user-accounts', icon: Wallet,       iconBg: '#fef3c7', iconColor: '#d97706' },
  { id: 'budgets',       label: 'Budgets',         path: '/budgets',       icon: Target,       iconBg: '#fef3c7', iconColor: '#d97706' },
  { id: 'savings',       label: 'Savings Goals',   path: '/savings',       icon: PiggyBank,    iconBg: '#f3e8ff', iconColor: '#7c3aed' },
  { id: 'wealth',        label: 'Net Worth',       path: '/wealth',        icon: Landmark,     iconBg: '#ecfdf5', iconColor: '#059669' },
  { id: 'analytics',     label: 'Analytics',       path: '/analytics',     icon: BarChart3,    iconBg: '#dbeafe', iconColor: '#2563eb' },
  { id: 'reports',       label: 'Reports',         path: '/reports',       icon: FileText,     iconBg: '#fce7f3', iconColor: '#db2777' },
  { id: 'categories',    label: 'Categories',      path: '/categories',    icon: Tag,          iconBg: '#fef9c3', iconColor: '#ca8a04' },
  { id: 'settings',      label: 'Settings',        path: '/settings',      icon: Settings,     iconBg: '#f1f5f9', iconColor: '#64748b' },
  { id: 'profile',       label: 'Profile',         path: '/profile',       icon: User,         iconBg: '#f1f5f9', iconColor: '#64748b' },
  { id: 'notifications', label: 'Notifications',   path: '/notifications', icon: Bell,         iconBg: '#fee2e2', iconColor: '#dc2626' },
]

// ── Main Component ─────────────────────────────────────────────────────
export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router   = useRouter()
  const { activeTheme, currency, profile } = useAppStore()
  const theme    = THEMES[activeTheme] ?? THEMES['green']
  const fmt      = (n: number) => formatCurrency(n, currency)

  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<ResultItem[]>([])
  const [searching,     setSearching]     = useState(false)
  const [activeIdx,     setActiveIdx]     = useState(0)
  const [recentItems,   setRecentItems]   = useState<ResultItem[]>([])

  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  const close = useCallback(() => {
    setQuery('')
    setResults([])
    setActiveIdx(0)
    onClose()
  }, [onClose])

  const quickActions = useMemo(
    () => buildQuickActions(router, close, theme.colors.primary),
    [router, close, theme.colors.primary]
  )

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setActiveIdx(0)
    }
  }, [open])

  // Load recent items (last 5 income + expenses)
  useEffect(() => {
    if (!open || !profile?.id) return
    const load = async () => {
      try {
        const supabase = createClient()
        const [{ data: inc }, { data: exp }] = await Promise.all([
          supabase.from('incomes').select('id, title, amount, category, date')
            .eq('user_id', profile.id).order('date', { ascending: false }).limit(3),
          supabase.from('expenses').select('id, title, amount, category, date')
            .eq('user_id', profile.id).order('date', { ascending: false }).limit(3),
        ])
        const items: ResultItem[] = [
          ...(inc ?? []).map((r: any) => ({
            id:        'recent-inc-' + r.id,
            label:     r.title || r.category || 'Income',
            sub:       `Income · ${r.date}`,
            amount:    '+' + fmt(Number(r.amount)),
            icon:      TrendingUp,
            iconBg:    '#dcfce7', iconColor: '#16a34a',
            action:    () => { router.push('/income'); close() },
          })),
          ...(exp ?? []).map((r: any) => ({
            id:        'recent-exp-' + r.id,
            label:     r.title || r.category || 'Expense',
            sub:       `Expense · ${r.date}`,
            amount:    '-' + fmt(Number(r.amount)),
            icon:      TrendingDown,
            iconBg:    '#fee2e2', iconColor: '#dc2626',
            action:    () => { router.push('/expenses'); close() },
          })),
        ].sort((a, b) => b.sub.localeCompare(a.sub)).slice(0, 5)
        setRecentItems(items)
      } catch { /* silent */ }
    }
    load()
  }, [open, profile?.id])

  // Search across all tables
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!profile?.id) return
      setSearching(true)
      try {
        const supabase = createClient()
        const q = query.trim().toLowerCase()

        const [
          { data: inc }, { data: exp }, { data: acc },
          { data: bud }, { data: goals }, { data: assets },
        ] = await Promise.all([
          supabase.from('incomes').select('id,title,amount,category,date')
            .eq('user_id', profile.id).ilike('title', `%${q}%`).limit(4),
          supabase.from('expenses').select('id,title,amount,category,date')
            .eq('user_id', profile.id).ilike('title', `%${q}%`).limit(4),
          supabase.from('user_accounts').select('id,name,type,currency')
            .eq('user_id', profile.id).ilike('name', `%${q}%`).limit(3),
          supabase.from('budgets').select('id,category,monthly_limit')
            .eq('user_id', profile.id).ilike('category', `%${q}%`).limit(3),
          supabase.from('savings_goals').select('id,name,target_amount,current_amount')
            .eq('user_id', profile.id).ilike('name', `%${q}%`).limit(3),
          supabase.from('assets').select('id,name,current_value,asset_type')
            .eq('user_id', profile.id).ilike('name', `%${q}%`).limit(3),
        ])

        const items: ResultItem[] = [
          ...(inc ?? []).map((r: any) => ({
            id: 'inc-' + r.id, label: r.title || 'Income',
            sub: `Income · ${r.category || ''} · ${r.date}`,
            amount: '+' + fmt(Number(r.amount)),
            icon: TrendingUp, iconBg: '#dcfce7', iconColor: '#16a34a',
            action: () => { router.push('/income'); close() },
          })),
          ...(exp ?? []).map((r: any) => ({
            id: 'exp-' + r.id, label: r.title || 'Expense',
            sub: `Expense · ${r.category || ''} · ${r.date}`,
            amount: '-' + fmt(Number(r.amount)),
            icon: TrendingDown, iconBg: '#fee2e2', iconColor: '#dc2626',
            action: () => { router.push('/expenses'); close() },
          })),
          ...(acc ?? []).map((r: any) => ({
            id: 'acc-' + r.id, label: r.name,
            sub: `Wallet · ${r.type?.replace('_', ' ')} · ${r.currency}`,
            icon: Wallet, iconBg: '#fef3c7', iconColor: '#d97706',
            action: () => { router.push('/user-accounts'); close() },
          })),
          ...(bud ?? []).map((r: any) => ({
            id: 'bud-' + r.id, label: r.category,
            sub: `Budget · ${fmt(Number(r.monthly_limit ?? 0))} / month`,
            icon: Target, iconBg: '#fef3c7', iconColor: '#d97706',
            action: () => { router.push('/budgets'); close() },
          })),
          ...(goals ?? []).map((r: any) => ({
            id: 'goal-' + r.id, label: r.name,
            sub: `Savings Goal · ${fmt(Number(r.current_amount))} / ${fmt(Number(r.target_amount))}`,
            icon: PiggyBank, iconBg: '#f3e8ff', iconColor: '#7c3aed',
            action: () => { router.push('/savings'); close() },
          })),
          ...(assets ?? []).map((r: any) => ({
            id: 'ast-' + r.id, label: r.name,
            sub: `Asset · ${r.asset_type} · ${fmt(Number(r.current_value))}`,
            icon: Landmark, iconBg: '#ecfdf5', iconColor: '#059669',
            action: () => { router.push('/wealth'); close() },
          })),
        ]
        setResults(items)
      } catch { /* silent */ }
      setSearching(false)
    }, 220)
    return () => clearTimeout(debounceRef.current)
  }, [query, profile?.id])

  // Build flat list for keyboard nav
  const flatItems = useMemo(() => {
    if (query.trim()) {
      const pageMatches = PAGES.filter(p =>
        p.label.toLowerCase().includes(query.toLowerCase())
      ).map(p => ({
        id: 'page-' + p.id, label: p.label, sub: 'Page',
        icon: p.icon, iconBg: p.iconBg, iconColor: p.iconColor,
        action: () => { router.push(p.path); close() },
      }))
      return [...results, ...pageMatches]
    }
    return [
      ...quickActions.map(a => ({ ...a, sub: a.sub ?? '' })),
      ...recentItems,
      ...PAGES.slice(0, 6).map(p => ({
        id: 'page-' + p.id, label: p.label, sub: 'Page',
        icon: p.icon, iconBg: p.iconBg, iconColor: p.iconColor,
        action: () => { router.push(p.path); close() },
      })),
    ]
  }, [query, results, quickActions, recentItems, router, close])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatItems.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') {
        e.preventDefault()
        flatItems[activeIdx]?.action()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flatItems, activeIdx, close])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Reset activeIdx when items change
  useEffect(() => { setActiveIdx(0) }, [query, results])

  if (!open) return null

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  // ── Render ─────────────────────────────────────────────────────────
  const showSearch  = query.trim().length > 0
  const showRecent  = !showSearch && recentItems.length > 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
      />

      {/* Panel */}
      <div className="fixed left-1/2 top-[15%] -translate-x-1/2 z-50 w-full max-w-xl px-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search transactions, accounts, budgets…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              {searching && (
                <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              )}
              {query && (
                <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-muted/40">
                Esc
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[420px] overflow-y-auto py-2">

            {/* ── Search Results ── */}
            {showSearch && (
              <>
                {results.length === 0 && !searching ? (
                  <>
                    {/* Page matches */}
                    {PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).length > 0 && (
                      <Section label="Pages">
                        {PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).map((p, i) => (
                          <Item key={p.id} item={{
                            id: 'page-' + p.id, label: p.label, sub: 'Navigate to page',
                            icon: p.icon, iconBg: p.iconBg, iconColor: p.iconColor,
                            action: () => { router.push(p.path); close() },
                          }} idx={i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
                        ))}
                      </Section>
                    )}
                    <div className="px-4 py-6 text-center">
                      <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">No results for "<span className="font-medium text-foreground">{query}</span>"</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try a transaction title, account name, or category</p>
                    </div>
                  </>
                ) : (
                  <Section label={`Search Results ${results.length > 0 ? `(${results.length})` : ''}`}>
                    {results.map((item, i) => (
                      <Item key={item.id} item={item} idx={i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
                    ))}
                    {/* Page matches below transaction results */}
                    {PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).map((p, i) => (
                      <Item key={'page-' + p.id} item={{
                        id: 'page-' + p.id, label: p.label, sub: 'Navigate to page',
                        icon: p.icon, iconBg: p.iconBg, iconColor: p.iconColor,
                        action: () => { router.push(p.path); close() },
                      }} idx={results.length + i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
                    ))}
                  </Section>
                )}
              </>
            )}

            {/* ── No query: Quick Actions + Recent + Pages ── */}
            {!showSearch && (
              <>
                <Section label="Quick Actions">
                  {quickActions.map((item, i) => (
                    <Item key={item.id} item={item} idx={i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} kbd={item.kbd} />
                  ))}
                </Section>

                {showRecent && (
                  <Section label="Recent Items">
                    {recentItems.map((item, i) => (
                      <Item key={item.id} item={item} idx={quickActions.length + i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
                    ))}
                  </Section>
                )}

                <Section label="Pages">
                  {PAGES.slice(0, 8).map((p, i) => (
                    <Item key={p.id} item={{
                      id: 'page-' + p.id, label: p.label, sub: 'Navigate',
                      icon: p.icon, iconBg: p.iconBg, iconColor: p.iconColor,
                      action: () => { router.push(p.path); close() },
                    }} idx={quickActions.length + recentItems.length + i} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />
                  ))}
                </Section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 bg-white">↑</kbd><kbd className="border border-border rounded px-1 bg-white">↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 bg-white">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="border border-border rounded px-1 bg-white">Esc</kbd> close</span>
            </div>
            <span className="flex items-center gap-1 font-medium" style={{ color: theme.colors.primary }}>
              <Zap className="w-3 h-3" /> Think-Shika
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Section label ─────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      {children}
    </div>
  )
}

// ── Single item row ───────────────────────────────────────────────────
function Item({
  item, idx, activeIdx, setActiveIdx, kbd,
}: {
  item: ResultItem | CommandItem
  idx: number
  activeIdx: number
  setActiveIdx: (i: number) => void
  kbd?: string
}) {
  const Icon     = item.icon
  const isActive = idx === activeIdx
  const amount   = (item as ResultItem).amount

  return (
    <button
      data-idx={idx}
      onClick={item.action}
      onMouseEnter={() => setActiveIdx(idx)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isActive ? 'bg-muted/70' : 'hover:bg-muted/40'
      }`}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: item.iconBg }}>
        <Icon className="w-4 h-4" style={{ color: item.iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate text-foreground">{item.label}</p>
        {item.sub && <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {amount && (
          <span className={`text-xs font-semibold tabular-nums ${
            amount.startsWith('+') ? 'text-green-600' : 'text-red-500'
          }`}>{amount}</span>
        )}
        {kbd && (
          <kbd className="hidden sm:block text-[10px] border border-border rounded px-1.5 py-0.5 bg-muted/60 text-muted-foreground font-mono">
            {kbd}
          </kbd>
        )}
        {isActive && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
    </button>
  )
}