'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, TrendingDown, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate, PAYMENT_METHODS, CATEGORY_COLORS } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import type { Expense, UserAccount } from '@/types'

const schema = z.object({
  title:          z.string().min(1, 'Title is required'),
  amount:         z.coerce.number().positive('Amount must be positive'),
  category:       z.string().min(1, 'Category is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
  date:           z.string().min(1, 'Date is required'),
  notes:          z.string().optional(),
  account_id:     z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialExpenses: Expense[]
  accounts: UserAccount[]
  userId: string
  budgets?: any[]
}

const shortFmt = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}

// ── Theme-derived chart palette ──────────────────────────────────────
// Categories still need visually distinct colors (that's the whole point
// of a categorical chart), but the *set* of colors should feel like it
// belongs to the app's current theme rather than an arbitrary fixed
// rainbow. We take the theme's primary color, convert it to HSL, and
// rotate the hue evenly around the color wheel to generate N distinct
// but theme-anchored colors — same saturation/lightness family, so they
// read as "a palette," just like the original DONUT_COLORS did, but tied
// to whichever theme is currently active.
function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0
  const l = (max + min) / 2
  const d = max - min
  let s = 0
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d) % 6; break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function buildThemedPalette(baseHex: string, count: number): string[] {
  let h = 0, s = 65, l = 48
  try {
    const hsl = hexToHsl(baseHex)
    h = hsl[0]
    s = Math.min(Math.max(hsl[1], 55), 75)
    l = Math.min(Math.max(hsl[2], 38), 55)
  } catch { /* fall back to the defaults above if baseHex is unparsable */ }
  return Array.from({ length: count }, (_, i) => hslToHex((h + (360 / count) * i) % 360, s, l))
}

function groupByCurrency(items: any[], accounts: UserAccount[]) {
  const map: Record<string, number> = {}
  items.forEach(e => {
    const cur = accounts.find(a => a.id === e.account_id)?.currency || 'GHS'
    map[cur] = (map[cur] || 0) + Number(e.amount)
  })
  return map
}

function CurrencyTotal({ byCurrency, colorClass }: {
  byCurrency: Record<string, number>; colorClass?: string
}) {
  const entries = Object.entries(byCurrency)
  if (entries.length === 0) return (
    <p className={`kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate ${colorClass}`}>
      {formatCurrency(0)}
    </p>
  )
  if (entries.length === 1) return (
    <p className={`kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate ${colorClass}`}>
      {formatCurrency(entries[0][1], entries[0][0])}
    </p>
  )
  return (
    <div className="mt-1 space-y-0.5">
      {entries.map(([cur, amt]) => (
        <p key={cur} className={`kpi-value text-sm sm:text-lg font-bold tabular-nums truncate ${colorClass}`}>
          {formatCurrency(amt, cur)}
        </p>
      ))}
    </div>
  )
}

export function ExpensesContent({ initialExpenses, accounts, userId, budgets = [] }: Props) {
  const { expenseCategories } = useCategories()
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [expenses,       setExpenses]       = useState(initialExpenses)
  const [open,           setOpen]           = useState(false)
  const [editing,        setEditing]        = useState<Expense | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter,  setAccountFilter]  = useState('all')
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null)
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [monthFilter, setMonthFilter] = useState('all')
  const [yearFilter,  setYearFilter]  = useState('all')

  // Regenerates whenever the active theme changes, so switching themes
  // re-colors these charts without needing a page reload.
  const chartColors = useMemo(() => buildThemedPalette(theme.colors.primary, 10), [theme.colors.primary])

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const getAccountCurrency = (id?: string | null) =>
    accounts.find(a => a.id === id)?.currency

  const openCreate = () => {
    setEditing(null)
    reset({ date: new Date().toISOString().split('T')[0] })
    setOpen(true)
  }

  const openEdit = (e: Expense) => {
    setEditing(e)
    reset({
      title:          e.title,
      amount:         e.amount,
      category:       e.category,
      payment_method: e.payment_method,
      date:           e.date,
      notes:          e.notes || '',
      account_id:     e.account_id || '',
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload  = { ...data, account_id: data.account_id || null }
    if (editing) {
      const { data: updated, error } = await supabase
        .from('expenses')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setExpenses(prev => prev.map(e => e.id === editing.id ? updated : e))
        toast({ title: 'Expense updated', variant: 'success' })
        setOpen(false)
      }
    } else {
      const { data: created, error } = await supabase
        .from('expenses')
        .insert({ ...payload, user_id: userId })
        .select().single()
      if (error) toast({ title: 'Failed to add', description: error.message, variant: 'destructive' })
      else {
        setExpenses(prev => [created, ...prev])
        toast({ title: 'Expense added', variant: 'success' })
        setOpen(false)
      }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast({ title: 'Deleted' })
    }
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const availableYears = useMemo(() =>
    Array.from(new Set(expenses.map(e => e.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [expenses])

  const clearDateFilters = () => {
    setDateFrom(''); setDateTo('')
    setMonthFilter('all'); setYearFilter('all')
  }
  const hasActiveDateFilters = !!dateFrom || !!dateTo || monthFilter !== 'all' || yearFilter !== 'all'

  const getAccountName = (id?: string | null) =>
    accounts.find(a => a.id === id)?.name ?? '—'

  const filtered = useMemo(() =>
    expenses.filter(e => {
      const matchSearch  = e.title.toLowerCase().includes(search.toLowerCase())
      const matchCat     = categoryFilter === 'all' || e.category === categoryFilter
      const matchAccount = accountFilter  === 'all' || e.account_id === accountFilter
      const matchFrom    = !dateFrom || e.date >= dateFrom
      const matchTo      = !dateTo   || e.date <= dateTo
      const matchMonth   = monthFilter === 'all' || e.date.slice(5, 7) === monthFilter
      const matchYear    = yearFilter  === 'all' || e.date.slice(0, 4) === yearFilter
      return matchSearch && matchCat && matchAccount && matchFrom && matchTo && matchMonth && matchYear
    }), [expenses, search, categoryFilter, accountFilter, dateFrom, dateTo, monthFilter, yearFilter])

  const totalByCurrency    = useMemo(() => groupByCurrency(expenses, accounts), [expenses, accounts])
  const filteredByCurrency = useMemo(() => groupByCurrency(filtered, accounts), [filtered, accounts])
  const hasMixedExpenseCurrency = Object.keys(filteredByCurrency).length > 1

  // Category breakdown for the charts — driven by whatever is currently filtered/searched,
  // so the charts and the table below always agree. Note: like the dashboard's category
  // breakdown, this blends raw amounts across currencies for the visual share only; exact
  // per-currency totals are in the KPI cards above and the table below.
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => {
      const cat = e.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(e.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const grandTotalFiltered = useMemo(() =>
    expenseByCategory.reduce((s, c) => s + c.value, 0), [expenseByCategory])

  // Budget vs Actual — pairs each budget with what's actually been spent in that
  // category, but ONLY for one month/year at a time: budgets are month-scoped
  // (budget_month / budget_year), so comparing "actual" against every budget
  // ever created would duplicate categories across months and show the same
  // total next to each of them. We use the active month/year slicer when set,
  // otherwise default to the current calendar month — same default the
  // Budgets page uses. If no budgets exist for that period, falls back to
  // showing actual spend per category (budget = 0) so the chart still renders
  // something useful instead of an empty state.
  const now = useMemo(() => new Date(), [])
  const budgetPeriod = useMemo(() => ({
    month: monthFilter !== 'all' ? monthFilter : String(now.getMonth() + 1).padStart(2, '0'),
    year:  yearFilter  !== 'all' ? yearFilter  : String(now.getFullYear()),
  }), [monthFilter, yearFilter, now])

  const periodBudgets = useMemo(() =>
    budgets.filter(b => {
      const bMonth = String(b.budget_month ?? now.getMonth() + 1).padStart(2, '0')
      const bYear  = String(b.budget_year  ?? now.getFullYear())
      return bMonth === budgetPeriod.month && bYear === budgetPeriod.year
    }), [budgets, budgetPeriod, now])

  const budgetVsActual = useMemo(() => {
    if (!periodBudgets.length) return expenseByCategory.map(c => ({
      name: c.name,
      budget: 0,
      actual: c.value,
      pct: 0,
    }))
    return periodBudgets.map(b => {
      const actual = filtered
        .filter(e => e.category === b.category)
        .reduce((s, e) => s + Number(e.amount), 0)
      const budget = Number(b.monthly_limit ?? b.amount ?? 0)
      return {
        name: b.budget_name || b.category,
        budget,
        actual,
        pct: budget > 0 ? Math.round((actual / budget) * 100) : 0,
      }
    }).sort((a, b) => b.actual - a.actual)
  }, [periodBudgets, filtered, expenseByCategory])

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Monitor and manage your spending</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </div>

      {/* KPI cards — currency-aware, never sum across currencies */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-white kpi-red p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
            Total Expenses
          </p>
          <CurrencyTotal byCurrency={totalByCurrency} />
          {Object.keys(totalByCurrency).length > 1 && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Shown per currency</p>
          )}
        </Card>
        <Card className="bg-white kpi-blue p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
            This View
          </p>
          <CurrencyTotal byCurrency={filteredByCurrency} />
        </Card>
        <Card className="bg-white kpi-orange p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
            Entries
          </p>
          <p className="kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1">{filtered.length}</p>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search expenses…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-white"><SelectValue placeholder="Account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date / Month / Year slicer */}
      <Card className="bg-white rounded-xl shadow-sm border border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter by Date</p>
            {hasActiveDateFilters && (
              <button onClick={clearDateFilters}
                className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Month</label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget vs Actual combo chart + Category Share donut */}
      {(expenseByCategory.length > 0 || budgets.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Budget vs Actual ── */}
          <Card className="rounded-xl shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Budget vs Actual</CardTitle>
              <p className="text-[10px] text-muted-foreground/70">
                {MONTH_NAMES[Number(budgetPeriod.month) - 1]} {budgetPeriod.year}
                {monthFilter === 'all' && yearFilter === 'all' ? ' · current month' : ''}
              </p>
              {activeCategoryIndex !== null && budgetVsActual[activeCategoryIndex] ? (
                <p className="text-xs font-semibold mt-0.5"
                  style={{ color: chartColors[activeCategoryIndex % chartColors.length] }}>
                  {budgetVsActual[activeCategoryIndex].name}:&nbsp;
                  Spent {formatCurrency(budgetVsActual[activeCategoryIndex].actual)} of&nbsp;
                  {formatCurrency(budgetVsActual[activeCategoryIndex].budget)} budget
                  {budgetVsActual[activeCategoryIndex].budget > 0 && (
                    ` · ${Math.round((budgetVsActual[activeCategoryIndex].actual / budgetVsActual[activeCategoryIndex].budget) * 100)}% used`
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {budgetVsActual.length} categor{budgetVsActual.length === 1 ? 'y' : 'ies'} · Click a bar to zoom
                </p>
              )}
            </CardHeader>
            <CardContent>
              {budgetVsActual.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <TrendingDown className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No budgets set — create budgets to compare</p>
                </div>
              ) : (
                <>
                  {/* Legend */}
                  <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: theme.colors.primaryLight || theme.colors.primary + 'aa' }} />
                      Budget limit
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm inline-block bg-destructive" />
                      Actual spent
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(200, budgetVsActual.length * 52)}>
                    <BarChart
                      data={budgetVsActual}
                      layout="vertical"
                      margin={{ top: 4, right: 60, left: 0, bottom: 0 }}
                      barGap={2}
                      barCategoryGap="30%"
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(v: any, name: string) => [formatCurrency(Number(v)), name === 'budget' ? 'Budget limit' : 'Actual spent']}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const budget = payload.find(p => p.dataKey === 'budget')?.value as number
                          const actual = payload.find(p => p.dataKey === 'actual')?.value as number
                          const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0
                          const over = actual > budget
                          return (
                            <div className="glass-card rounded-xl p-3 shadow-lg text-xs space-y-1 min-w-[180px]">
                              <p className="font-semibold text-sm">{label}</p>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Budget</span>
                                <span className="font-medium">{formatCurrency(budget)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Actual</span>
                                <span className={`font-medium ${over ? 'text-destructive' : 'text-success'}`}>{formatCurrency(actual)}</span>
                              </div>
                              <div className="h-px bg-border" />
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{over ? 'Over by' : 'Remaining'}</span>
                                <span className={`font-semibold ${over ? 'text-destructive' : 'text-success'}`}>
                                  {formatCurrency(Math.abs(budget - actual))}
                                </span>
                              </div>
                              <div className="mt-1">
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-muted-foreground">Used</span>
                                  <span className={over ? 'text-destructive font-semibold' : 'font-medium'}>{pct}%</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(pct, 100)}%`, background: over ? '#ef4444' : '#22c55e' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        }}
                      />
                      {/* Budget bar — background reference */}
                      <Bar
                        dataKey="budget"
                        name="Budget limit"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        animationDuration={500}
                        onClick={(_, i) => setActiveCategoryIndex(p => p === i ? null : i)}
                      >
                        {budgetVsActual.map((row, i) => (
                          <Cell
                            key={i}
                            fill={activeCategoryIndex !== null && activeCategoryIndex !== i
                              ? (theme.colors.primaryLight || theme.colors.primary + 'aa') + '55'
                              : (theme.colors.primaryLight || theme.colors.primary + 'aa')}
                          />
                        ))}
                        <LabelList
                          dataKey="budget"
                          position="right"
                          content={(props: any) => {
                            const { x, y, width, height, index, value } = props
                            if (index == null) return null
                            return (
                              <text x={x + width + 6} y={y + height / 2} dy={4}
                                fontSize={10} fill="var(--color-text-secondary, #888)">
                                {formatCurrency(value)}
                              </text>
                            )
                          }}
                        />
                      </Bar>
                      {/* Actual bar — overlaid */}
                      <Bar
                        dataKey="actual"
                        name="Actual spent"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        animationDuration={500}
                        onClick={(_, i) => setActiveCategoryIndex(p => p === i ? null : i)}
                      >
                        {budgetVsActual.map((row, i) => {
                          const over = row.actual > row.budget && row.budget > 0
                          const dimmed = activeCategoryIndex !== null && activeCategoryIndex !== i
                          return (
                            <Cell
                              key={i}
                              fill={dimmed
                                ? (over ? '#ef4444' : '#22c55e') + '55'
                                : (over ? '#ef4444' : '#22c55e')}
                            />
                          )
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Category Share donut ── */}
          <Card className="rounded-xl shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Category Share</CardTitle>
              <p className="text-xs text-muted-foreground">Click a slice to zoom in</p>
            </CardHeader>
            <CardContent>
              <div className="relative w-full mx-auto" style={{ maxWidth: 320 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={2}
                      labelLine={false}
                      label={({ percent }) => percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ''}
                      animationDuration={500}
                      onClick={(_, i) => setActiveCategoryIndex(p => p === i ? null : i)}
                    >
                      {expenseByCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={activeCategoryIndex !== null && activeCategoryIndex !== i
                            ? chartColors[i % chartColors.length] + '55'
                            : chartColors[i % chartColors.length]}
                          stroke="#fff" strokeWidth={2}
                          style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any, name: any) => [formatCurrency(Number(v)), name]} />
                    <Legend layout="horizontal" align="center" verticalAlign="bottom"
                      iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
                  style={{ top: 0, height: 'calc(100% - 40px)' }}>
                  <div className="text-center leading-tight">
                    <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                      {activeCategoryIndex !== null ? expenseByCategory[activeCategoryIndex]?.name : 'Total'}
                    </p>
                    <p className="text-lg sm:text-xl font-bold tabular-nums mt-0.5 text-destructive">
                      {activeCategoryIndex !== null
                        ? formatCurrency(expenseByCategory[activeCategoryIndex]?.value ?? 0)
                        : formatCurrency(grandTotalFiltered)}
                    </p>
                    {activeCategoryIndex !== null ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {grandTotalFiltered > 0
                          ? Math.round((expenseByCategory[activeCategoryIndex].value / grandTotalFiltered) * 100)
                          : 0}% of total
                      </p>
                    ) : hasMixedExpenseCurrency ? (
                      <p className="text-[9px] text-muted-foreground mt-0.5">Blended across currencies</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No expenses found</p>
              <p className="text-sm mt-1">Add your first expense to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Account</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Payment</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense, i) => (
                    <tr key={expense.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                        i % 2 === 1 ? 'bg-muted/10' : ''
                      }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-medium">{expense.title}</p>
                        {expense.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{expense.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge style={{
                          background: `${CATEGORY_COLORS[expense.category] || '#94a3b8'}20`,
                          color: CATEGORY_COLORS[expense.category] || '#94a3b8',
                        }}>
                          {expense.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {getAccountName(expense.account_id)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground capitalize whitespace-nowrap">
                        {expense.payment_method?.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-destructive tabular-nums whitespace-nowrap">
                        -{formatCurrency(expense.amount, getAccountCurrency(expense.account_id))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8"
                            onClick={() => openEdit(expense)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="w-8 h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(expense.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Groceries" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                <p className="text-xs text-muted-foreground">In selected account's currency</p>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register('date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select onValueChange={v => setValue('category', v)}
                  defaultValue={editing?.category}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select onValueChange={v => setValue('payment_method', v)}
                  defaultValue={editing?.payment_method}>
                  <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payment_method && <p className="text-xs text-destructive">{errors.payment_method.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select onValueChange={v => setValue('account_id', v === 'none' ? '' : v)}
                defaultValue={editing?.account_id || 'none'}>
                <SelectTrigger><SelectValue placeholder="Which account?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any additional notes…" {...register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Add Expense'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}