'use client'
import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Wallet, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, Copy,
  Calendar, LayoutGrid, RefreshCw, ArrowLeft, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, CATEGORY_COLORS, getBudgetStatus } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { useAppStore } from '@/store'
import { KPICard } from '@/components/ui/kpi-card'
import { BarChart3, TrendingDown } from 'lucide-react'
import { THEMES } from '@/lib/config'
import type { Budget } from '@/types'
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1)
const schema = z.object({
  budget_name:   z.string().min(1, 'Budget name is required'),
  category:      z.string().min(1, 'Category is required'),
  monthly_limit: z.coerce.number().positive('Limit must be positive'),
  budget_month:  z.coerce.number().min(1).max(12),
  budget_year:   z.coerce.number().min(2020).max(2100),
})
type FormData = z.infer<typeof schema>
interface Props {
  initialBudgets: Budget[]
  expenses: { amount: number; category: string; date: string }[]
  userId: string
}
// Given a month/year, returns the next calendar month — used to default the
// Rollover dialog's target to "next month" rather than making the person
// pick it from scratch every time.
const nextMonthOf = (month: number, year: number) =>
  month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }
export function BudgetsContent({ initialBudgets, expenses, userId }: Props) {
  const { activeTheme, currency } = useAppStore()
  const { expenseCategories } = useCategories()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const fmt = (n: number) => formatCurrency(n, currency)
  const now = new Date()
  const [budgets,   setBudgets]   = useState(initialBudgets)
  const [open,      setOpen]      = useState(false)
  const [editing,   setEditing]   = useState<Budget | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  // Controlled form values for Selects
  const [selCategory, setSelCategory] = useState('')
  const [selMonth,    setSelMonth]    = useState(String(now.getMonth() + 1))
  const [selYear,     setSelYear]     = useState(String(now.getFullYear()))
  // ── Budget Rollover ────────────────────────────────────────────────
  // Copies selected budgets from the month currently being viewed into
  // another month. Only budget_name/category/monthly_limit are copied —
  // spent/remaining/percentage are always derived live from that month's
  // real expenses, so a rolled-over budget always starts at 0% used,
  // never carrying over "completed" spending from the source month.
  const [rolloverOpen,     setRolloverOpen]     = useState(false)
  const [rolloverLoading,  setRolloverLoading]  = useState(false)
  const [rolloverSelected, setRolloverSelected] = useState<Set<string>>(new Set())
  const [rolloverMonth,    setRolloverMonth]    = useState(String(now.getMonth() + 1))
  const [rolloverYear,     setRolloverYear]     = useState(String(now.getFullYear()))
  const [view, setView] = useState<'overview' | 'breakdown'>('overview')
  const [showGuidanceDetails, setShowGuidanceDetails] = useState(true)
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      budget_month: now.getMonth() + 1,
      budget_year:  now.getFullYear(),
    },
  })
  const monthBudgets = useMemo(() =>
    budgets.filter(b =>
      (b.budget_month ?? now.getMonth() + 1) === viewMonth &&
      (b.budget_year  ?? now.getFullYear())  === viewYear
    ), [budgets, viewMonth, viewYear])
  const monthExpenses = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const prefix = `${viewYear}-${pad(viewMonth)}`
    return expenses.filter(e => e.date?.startsWith(prefix))
  }, [expenses, viewMonth, viewYear])
  const budgetsWithSpent = useMemo(() =>
    monthBudgets.map(b => {
      const spent      = monthExpenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0)
      const percentage = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
      return { ...b, spent, remaining: b.monthly_limit - spent, percentage }
    }), [monthBudgets, monthExpenses])
  const summary = useMemo(() => ({
    totalBudgeted: monthBudgets.reduce((s, b) => s + b.monthly_limit, 0),
    totalSpent:    budgetsWithSpent.reduce((s, b) => s + (b.spent || 0), 0),
    exceeded:      budgetsWithSpent.filter(b => (b.percentage || 0) >= 100).length,
    safe:          budgetsWithSpent.filter(b => (b.percentage || 0) < 80).length,
  }), [monthBudgets, budgetsWithSpent])
  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  const openCreate = () => {
    setEditing(null)
    const mo = String(viewMonth)
    const yr = String(viewYear)
    setSelCategory('')
    setSelMonth(mo)
    setSelYear(yr)
    reset({ budget_month: viewMonth, budget_year: viewYear, budget_name: '', monthly_limit: 0 as any, category: '' })
    setOpen(true)
  }
  const openEdit = (b: Budget) => {
    setEditing(b)
    const mo = String(b.budget_month ?? viewMonth)
    const yr = String(b.budget_year  ?? viewYear)
    setSelCategory(b.category)
    setSelMonth(mo)
    setSelYear(yr)
    reset({
      budget_name:   b.budget_name,
      category:      b.category,
      monthly_limit: b.monthly_limit,
      budget_month:  b.budget_month ?? viewMonth,
      budget_year:   b.budget_year  ?? viewYear,
    })
    setOpen(true)
  }
  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase
        .from('budgets')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setBudgets(prev => prev.map(b => b.id === editing.id ? updated : b))
        toast({ title: 'Budget updated', variant: 'success' })
        setOpen(false)
      }
    } else {
      const { data: created, error } = await supabase
        .from('budgets')
        .insert({ ...data, user_id: userId })
        .select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else {
        setBudgets(prev => [created, ...prev])
        toast({ title: 'Budget created', variant: 'success' })
        setOpen(false)
      }
    }
    setLoading(false)
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    const supabase = createClient()
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setBudgets(prev => prev.filter(b => b.id !== id))
      toast({ title: 'Budget deleted' })
    }
  }
  // ── Rollover helpers ─────────────────────────────────────────────────
  const openRollover = () => {
    setRolloverSelected(new Set(monthBudgets.map(b => b.id)))
    const next = nextMonthOf(viewMonth, viewYear)
    setRolloverMonth(String(next.month))
    setRolloverYear(String(next.year))
    setRolloverOpen(true)
  }
  const toggleRolloverBudget = (id: string) => {
    setRolloverSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllRollover = () => setRolloverSelected(new Set(monthBudgets.map(b => b.id)))
  const clearAllRollover  = () => setRolloverSelected(new Set())
  const rolloverIsSameMonth = Number(rolloverMonth) === viewMonth && Number(rolloverYear) === viewYear
  const handleRollover = async () => {
    if (rolloverSelected.size === 0 || rolloverIsSameMonth) return
    setRolloverLoading(true)
    const supabase = createClient()
    const targetMonth = Number(rolloverMonth)
    const targetYear  = Number(rolloverYear)
    const sourceBudgets = monthBudgets.filter(b => rolloverSelected.has(b.id))
    // Never create a duplicate budget for a category that's already
    // budgeted in the target month — skip those instead of overwriting
    // or duplicating whatever spending/limit already exists there.
    const existingCategoriesInTarget = new Set(
      budgets
        .filter(b =>
          (b.budget_month ?? now.getMonth() + 1) === targetMonth &&
          (b.budget_year  ?? now.getFullYear())  === targetYear
        )
        .map(b => b.category)
    )
    const toCreate = sourceBudgets.filter(b => !existingCategoriesInTarget.has(b.category))
    const skipped  = sourceBudgets.length - toCreate.length
    if (toCreate.length === 0) {
      toast({
        title: 'Nothing to roll over',
        description: `All selected categories already have a budget in ${MONTH_NAMES[targetMonth - 1]} ${targetYear}.`,
        variant: 'destructive',
      })
      setRolloverLoading(false)
      return
    }
    // Only the definition carries over — no spent/remaining/percentage
    // fields exist on the row at all, so there is nothing "completed"
    // from the source month for the new budget to inherit.
    const payload = toCreate.map(b => ({
      budget_name:   b.budget_name,
      category:      b.category,
      monthly_limit: b.monthly_limit,
      budget_month:  targetMonth,
      budget_year:   targetYear,
      user_id:       userId,
    }))
    const { data: created, error } = await supabase
      .from('budgets')
      .insert(payload)
      .select()
    if (error) {
      toast({ title: 'Rollover failed', description: error.message, variant: 'destructive' })
    } else {
      const createdRows = created || []
      setBudgets(prev => [...createdRows, ...prev])
      toast({
        title: `Rolled over ${createdRows.length} budget${createdRows.length === 1 ? '' : 's'} to ${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
        description: skipped > 0
          ? `${skipped} skipped — already budgeted for that month`
          : undefined,
        variant: 'success',
      })
      setRolloverOpen(false)
    }
    setRolloverLoading(false)
  }
  const statusIcon = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return <XCircle       className="w-4 h-4 text-destructive" />
    if (s === 'warning')  return <AlertTriangle  className="w-4 h-4 text-warning"    />
    return                       <CheckCircle    className="w-4 h-4 text-success"     />
  }
  const progressClass = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return '[&>div]:bg-destructive'
    if (s === 'warning')  return '[&>div]:bg-warning'
    return ''
  }
  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()
  const dialogKey = editing ? `edit-${editing.id}` : 'create'

  // ── Spending Guidance (aggregate) ─────────────────────────────────────
  const daysInPeriod = new Date(viewYear, viewMonth, 0).getDate()
  const periodStart  = new Date(viewYear, viewMonth - 1, 1)
  const periodEnd    = new Date(viewYear, viewMonth - 1, daysInPeriod)
  const daysElapsed = (() => {
    const beforePeriod = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth() + 1)
    const afterPeriod  = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth > now.getMonth() + 1)
    if (beforePeriod) return daysInPeriod
    if (afterPeriod)  return 0
    return now.getDate()
  })()
  const daysLeftInPeriod = daysInPeriod - daysElapsed

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

  const weekDay       = now.getDay()
  const diffToMonday  = (weekDay === 0 ? -6 : 1) - weekDay
  const weekMonday    = new Date(now); weekMonday.setDate(now.getDate() + diffToMonday)
  const weekSunday    = new Date(weekMonday); weekSunday.setDate(weekMonday.getDate() + 6)
  const weekStartClip = weekMonday < periodStart ? periodStart : weekMonday
  const weekEndClip   = weekSunday > periodEnd ? periodEnd : weekSunday
  const weekRangeLabel = `${weekStartClip.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEndClip.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const todayStr      = toISO(now)
  const weekStartStr  = toISO(weekStartClip)
  const weekEndStr    = toISO(weekEndClip)
  const spentToday    = monthExpenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.amount, 0)
  const spentThisWeek = monthExpenses.filter(e => e.date >= weekStartStr && e.date <= weekEndStr).reduce((s, e) => s + e.amount, 0)

  const dailyTarget   = daysInPeriod > 0 ? summary.totalBudgeted / daysInPeriod : 0
  const weeklyTarget  = dailyTarget * 7
  const monthlyTarget = summary.totalBudgeted
  const remainingToday      = dailyTarget - spentToday
  const remainingThisWeek   = weeklyTarget - spentThisWeek
  const remainingThisMonth  = summary.totalBudgeted - summary.totalSpent
  const pctDailyUsed   = dailyTarget   > 0 ? (spentToday       / dailyTarget)   * 100 : 0
  const pctWeeklyUsed  = weeklyTarget  > 0 ? (spentThisWeek     / weeklyTarget)  * 100 : 0
  const pctMonthlyUsed = monthlyTarget > 0 ? (summary.totalSpent / monthlyTarget) * 100 : 0

  const aggregatePct = summary.totalBudgeted > 0 ? (summary.totalSpent / summary.totalBudgeted) * 100 : 0
  const aggregateStatusKey = getBudgetStatus(aggregatePct)
  const aggregateStatusMeta = aggregateStatusKey === 'exceeded'
    ? { label: 'Over Budget',       color: '#dc2626', bg: '#fee2e2' }
    : aggregateStatusKey === 'warning'
    ? { label: 'Approaching Limit', color: '#d97706', bg: '#fef3c7' }
    : { label: 'On Track',          color: '#16a34a', bg: '#dcfce7' }

  // ── Spending Guidance Breakdown (per category) ────────────────────────
  const breakdownRows = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    return budgetsWithSpent.map(b => {
      const daily   = daysInPeriod > 0 ? b.monthly_limit / daysInPeriod : 0
      const weekly  = daily * 7
      // Projected spend = (spent so far / days elapsed) × total days in month
      const projected = dayOfMonth > 0
        ? Math.round(((b.spent || 0) / dayOfMonth) * daysInPeriod)
        : 0
      const projectedStatus = projected > b.monthly_limit
        ? 'over'
        : projected > b.monthly_limit * 0.8
        ? 'warning'
        : 'ok'
      return { ...b, dailyTarget: daily, weeklyTarget: weekly, projectedSpend: projected, projectedStatus }
    })
  }, [budgetsWithSpent, daysInPeriod])

  return (
    <div className="space-y-5">
    {view === 'overview' && (
    <div key="overview" className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Budgets
          </h1>
          <p className="text-muted-foreground text-sm">Monthly spending limits by category</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={openRollover} disabled={monthBudgets.length === 0}>
            <Copy className="w-4 h-4 mr-1" /> Rollover Budgets
          </Button>
          <Button variant="outline" onClick={() => setView('breakdown')} disabled={monthBudgets.length === 0}>
            <LayoutGrid className="w-4 h-4 mr-1" /> Spending Guide
          </Button>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Create Budget
          </Button>
        </div>
      </div>
      {/* ── KPI Flip Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Budgeted"
          value={fmt(summary.totalBudgeted)}
          sub={`${monthBudgets.length} budget(s)`}
          colorClass=""
          icon={Wallet}
          accentColor="#2563eb"
          tooltip={`Total budget allocated for ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
        />
        <KPICard
          label="Spent"
          value={fmt(summary.totalSpent)}
          sub={summary.totalBudgeted > 0 ? `${Math.round((summary.totalSpent / summary.totalBudgeted) * 100)}% of budget` : 'No budget set'}
          colorClass=""
          icon={TrendingDown}
          accentColor="#dc2626"
          tooltip={`Total spent across all budgets in ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
        />
        <KPICard
          label="On Track"
          value={String(summary.safe)}
          sub={`${summary.safe} of ${monthBudgets.length} budgets`}
          colorClass=""
          icon={CheckCircle}
          accentColor="#16a34a"
          tooltip="Budgets where spending is within the limit"
        />
        <KPICard
          label="Exceeded"
          value={String(summary.exceeded)}
          sub={summary.exceeded > 0 ? `${summary.exceeded} over budget` : 'All on track 🎉'}
          colorClass=""
          icon={XCircle}
          accentColor={summary.exceeded > 0 ? "#dc2626" : "#16a34a"}
          tooltip="Budgets where spending has gone over the limit"
        />
      </div>
      {/* Month Navigator — compact inline bar */}
      <div className="flex items-center justify-between bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm">
        <button onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm" style={{ color: theme.colors.primary }}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-white px-2 py-0.5 rounded-full font-semibold"
              style={{ background: theme.colors.accent }}>
              Current Month
            </span>
          )}
        </div>
        <button onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Monthly Budget summary */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div className="md:pr-8 md:border-r border-border">
              <p className="text-sm text-muted-foreground">Monthly Budget</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1" style={{ color: theme.colors.primary }}>
                {fmt(summary.totalBudgeted)}
              </p>
              <span
                className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: aggregateStatusMeta.bg, color: aggregateStatusMeta.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: aggregateStatusMeta.color }} />
                {aggregateStatusMeta.label}
              </span>
              <p className="text-xs text-muted-foreground mt-2">
                {summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}% of budget used` : 'No budget set'}
              </p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
                  <Wallet className="w-4 h-4" style={{ color: '#2563eb' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Spent So Far</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{fmt(summary.totalSpent)}</p>
                  <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}%` : '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: '#16a34a' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{fmt(remainingThisMonth)}</p>
                  <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}%` : '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#d97706' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{daysLeftInPeriod} days</p>
                  <p className="text-[11px] text-muted-foreground">{Math.round((daysLeftInPeriod / Math.max(1, daysInPeriod)) * 100)}% of period left</p>
                </div>
              </div>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mt-4">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, aggregatePct)}%`, background: aggregateStatusMeta.color }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Spending Guidance */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
            <div>
              <p className="text-sm font-bold">Spending Guidance</p>
              <p className="text-xs text-muted-foreground">Here's how much you can spend based on your monthly budget.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setView('breakdown')}
                disabled={monthBudgets.length === 0}
              >
                <LayoutGrid className="w-4 h-4 mr-1" /> Spending Guidance Breakdown
              </Button>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                Show details
                <button
                  type="button"
                  onClick={() => setShowGuidanceDetails(v => !v)}
                  className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                  style={{ background: showGuidanceDetails ? theme.colors.primary : '#cbd5e1' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                    style={{ left: showGuidanceDetails ? '18px' : '2px' }}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Daily */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#eff6ff' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Daily</p>
                  <p className="text-[11px] text-muted-foreground">Target per day</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(dailyTarget)}</p>
              <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctDailyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent Today</span><span className="font-medium">{fmt(spentToday)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining Today</span><span className={`font-medium ${remainingToday < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingToday)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Left</span><span className="font-medium">{daysElapsed} of {daysInPeriod}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                {Math.round(Math.min(999, pctDailyUsed))}% of daily target used
              </div>
            </div>

            {/* Weekly */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#faf5ff' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f3e8ff' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#9333ea' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Weekly</p>
                  <p className="text-[11px] text-muted-foreground">Target per week</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(weeklyTarget)}</p>
              <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-purple-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctWeeklyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent This Week</span><span className="font-medium">{fmt(spentThisWeek)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining This Week</span><span className={`font-medium ${remainingThisWeek < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingThisWeek)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Week</span><span className="font-medium">{weekRangeLabel}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                {Math.round(Math.min(999, pctWeeklyUsed))}% of weekly target used
              </div>
            </div>

            {/* Monthly */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#f0fdf4' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Monthly</p>
                  <p className="text-[11px] text-muted-foreground">Total for month</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(monthlyTarget)}</p>
              <div className="h-1.5 bg-green-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-green-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctMonthlyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent This Month</span><span className="font-medium">{fmt(summary.totalSpent)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining This Month</span><span className={`font-medium ${remainingThisMonth < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingThisMonth)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Left</span><span className="font-medium">{daysElapsed} of {daysInPeriod}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#dcfce7', color: '#15803d' }}>
                {Math.round(Math.min(999, pctMonthlyUsed))}% of monthly budget used
              </div>
            </div>
          </div>

          {/* Budget Pace Guide */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 mt-5 pt-4 border-t border-border">
            <div className="flex-shrink-0">
              <p className="text-sm font-semibold">Budget Pace Guide</p>
              <p className="text-xs text-muted-foreground">Based on your spending so far this month</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-semibold">On Track</span>
                <span className="text-muted-foreground">You're spending within your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-semibold">Approaching Limit</span>
                <span className="text-muted-foreground">You've used more than 80% of your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-semibold">Over Budget</span>
                <span className="text-muted-foreground">You've spent more than 100% of your budget.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Cards */}
      {budgetsWithSpent.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No budgets for {MONTH_NAMES[viewMonth - 1]} {viewYear}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create a budget for this month or navigate to another month
          </p>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Create Budget for {MONTH_NAMES[viewMonth - 1]}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetsWithSpent.map(b => {
            const pct    = b.percentage || 0
            const status = getBudgetStatus(pct)
            return (
              <Card key={b.id} className={`bg-white p-4 sm:p-5 space-y-4 rounded-xl shadow-sm overflow-hidden ${
                status === 'exceeded' ? 'border-destructive/40 kpi-red'
                : status === 'warning' ? 'border-warning/40 kpi-orange'
                : 'kpi-green'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${CATEGORY_COLORS[b.category] || '#94a3b8'}20` }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{b.budget_name}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {b.category} · {MONTH_NAMES[(b.budget_month ?? 1) - 1]} {b.budget_year ?? viewYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusIcon(pct)}
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(b)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive"
                      onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Spent</span>
                    <span className="font-medium tabular-nums truncate text-right">
                      {fmt(b.spent || 0)} / {fmt(b.monthly_limit)}
                    </span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className={`h-2 ${progressClass(pct)}`} />
                  <div className="flex justify-between text-xs gap-2">
                    <span className={
                      status === 'exceeded' ? 'text-destructive font-medium'
                      : status === 'warning' ? 'text-warning font-medium'
                      : 'text-muted-foreground'
                    }>
                      {pct.toFixed(0)}% used
                    </span>
                    <span className={`font-medium tabular-nums truncate ${
                      (b.remaining || 0) < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {(b.remaining || 0) < 0
                        ? `${fmt(Math.abs(b.remaining || 0))} over`
                        : `${fmt(b.remaining || 0)} left`}
                    </span>
                  </div>
                </div>
                {status === 'exceeded' && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Budget exceeded — review your {b.category} spending
                  </div>
                )}
                {status === 'warning' && (
                  <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Over 80% used — spend carefully this month
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {/* ── Dialog — key forces full remount on open/edit ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={dialogKey}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Budget' : 'Create Budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Budget Name</Label>
              <Input placeholder="e.g. Food Budget" {...register('budget_name')} />
              {errors.budget_name && <p className="text-xs text-destructive">{errors.budget_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={selCategory}
                onValueChange={v => { setSelCategory(v); setValue('category', v) }}
              >
                <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Limit</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_limit')} />
              {errors.monthly_limit && <p className="text-xs text-destructive">{errors.monthly_limit.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={selMonth}
                  onValueChange={v => { setSelMonth(v); setValue('budget_month', Number(v)) }}
                >
                  <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.budget_month && <p className="text-xs text-destructive">{errors.budget_month.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select
                  value={selYear}
                  onValueChange={v => { setSelYear(v); setValue('budget_year', Number(v)) }}
                >
                  <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.budget_year && <p className="text-xs text-destructive">{errors.budget_year.message}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}
                style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Create Budget'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* ── Rollover Dialog ── */}
      <Dialog open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" style={{ color: theme.colors.primary }} />
              Rollover Budgets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy selected budgets from {MONTH_NAMES[viewMonth - 1]} {viewYear} into another month.
              Only the name, category, and limit carry over — spending always starts fresh for the new month.
            </p>
            {monthBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No budgets in {MONTH_NAMES[viewMonth - 1]} {viewYear} to roll over.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {rolloverSelected.size} of {monthBudgets.length} selected
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={selectAllRollover} className="text-xs font-semibold text-primary hover:underline">Select all</button>
                    <button type="button" onClick={clearAllRollover} className="text-xs font-semibold text-muted-foreground hover:underline">Clear all</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {monthBudgets.map(b => {
                    const checked = rolloverSelected.has(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleRolloverBudget(b.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{b.budget_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.category}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums flex-shrink-0">{fmt(b.monthly_limit)}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Target Month</Label>
                    <Select value={rolloverMonth} onValueChange={setRolloverMonth}>
                      <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target Year</Label>
                    <Select value={rolloverYear} onValueChange={setRolloverYear}>
                      <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {rolloverIsSameMonth && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Target month is the same as the month you're viewing — pick a different month.
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setRolloverOpen(false)}>Cancel</Button>
              <Button
                onClick={handleRollover}
                disabled={rolloverLoading || rolloverSelected.size === 0 || rolloverIsSameMonth || monthBudgets.length === 0}
                style={{ background: theme.colors.primary, color: '#fff' }}
              >
                {rolloverLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : `Rollover ${rolloverSelected.size > 0 ? rolloverSelected.size : ''} Budget${rolloverSelected.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    )}

    {/* ── Spending Guidance Breakdown — reached from the button above.
        Shares this component's state entirely (viewMonth/viewYear, budgets,
        expenses), so the selected month, filters, and everything else are
        already "preserved" simply because nothing was unmounted — this is
        a view swap within the same component tree, not a navigation. ──── */}
    {view === 'breakdown' && (
    <div key="breakdown" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('overview')}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0 border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
              Monthly Budgets Guidance
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {MONTH_NAMES[viewMonth - 1]} 1 – {MONTH_NAMES[viewMonth - 1]} {daysInPeriod}, {viewYear} ({daysInPeriod} days)
            </p>
          </div>
        </div>
        <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
          <Plus className="w-4 h-4 mr-1" /> Create Budget
        </Button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Monthly Budget */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
            <Wallet className="w-6 h-6" style={{ color: '#16a34a' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Monthly Budget</p>
            <p className="text-lg font-bold tabular-nums truncate" style={{ color: theme.colors.primary }}>{fmt(summary.totalBudgeted)}</p>
            <p className="text-[11px] text-muted-foreground">100% of plan</p>
          </div>
        </div>

        {/* Spent So Far */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
            <TrendingDown className="w-6 h-6" style={{ color: '#2563eb' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Spent So Far</p>
            <p className="text-lg font-bold tabular-nums truncate text-blue-600">{fmt(summary.totalSpent)}</p>
            <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}% of budget` : '—'}</p>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f3e8ff' }}>
            <RefreshCw className="w-6 h-6" style={{ color: '#7c3aed' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Remaining Budget</p>
            <p className="text-lg font-bold tabular-nums truncate text-violet-600">{fmt(Math.max(0, remainingThisMonth))}</p>
            <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}% left` : '—'}</p>
          </div>
        </div>

        {/* Days Left */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
            <Calendar className="w-6 h-6" style={{ color: '#d97706' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Days Left in Month</p>
            <p className="text-lg font-bold tabular-nums truncate text-amber-600">{daysLeftInPeriod} Days</p>
            <p className="text-[11px] text-muted-foreground">
              Ends on {new Date(viewYear, viewMonth - 1, daysInPeriod).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Budget Health */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
            <CheckCircle className="w-6 h-6" style={{ color: '#16a34a' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Budget Health</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: aggregateStatusMeta.color }}>
              {summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}%` : '—'}
            </p>
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1,2,3,4,5].map(s => (
                <span key={s} className="text-[10px]" style={{
                  color: (100 - aggregatePct) >= s * 20 ? '#f59e0b' : '#d1d5db'
                }}>★</span>
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">
                {aggregateStatusMeta.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overall Progress + Budget Insight ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">

        {/* Overall Progress */}
        <Card className="bg-white rounded-2xl shadow-sm border border-border">
          <CardContent className="p-5">
            <p className="text-sm font-bold mb-1">Overall Progress</p>
            <div className="flex items-end justify-between gap-2 mb-2">
              <p className="text-2xl font-bold tabular-nums" style={{ color: aggregateStatusMeta.color }}>
                {Math.round(aggregatePct)}% <span className="text-base font-semibold text-muted-foreground">Used</span>
              </p>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mb-1"
                style={{ background: aggregateStatusMeta.bg, color: aggregateStatusMeta.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: aggregateStatusMeta.color }} />
                {aggregateStatusMeta.label}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, aggregatePct)}%`,
                  background: aggregatePct >= 100 ? '#dc2626' : aggregatePct >= 80 ? '#f59e0b' : '#16a34a',
                }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground flex-wrap gap-2">
              <span className="tabular-nums">{fmt(summary.totalSpent)} of {fmt(summary.totalBudgeted)} used</span>
              <span className="tabular-nums">{fmt(Math.max(0, remainingThisMonth))} remaining</span>
              <span>{daysLeftInPeriod} days left</span>
            </div>

            {/* Per-budget mini bars */}
            <div className="mt-4 space-y-2.5">
              {budgetsWithSpent.slice(0, 4).map(b => {
                const pct = Math.min(100, b.percentage || 0)
                const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a'
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate max-w-[160px]">{b.budget_name}</span>
                      <span className="tabular-nums font-semibold" style={{ color: barColor }}>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })}
              {budgetsWithSpent.length > 4 && (
                <p className="text-[11px] text-muted-foreground text-center pt-1">
                  +{budgetsWithSpent.length - 4} more budgets below
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budget Insight */}
        <Card className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <CardContent className="p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <p className="text-sm font-bold">Budget Insight</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {aggregatePct >= 100
                  ? `You've exceeded your total budget of ${fmt(summary.totalBudgeted)}. Review your spending and adjust your budget categories.`
                  : aggregatePct >= 80
                  ? `You've used ${Math.round(aggregatePct)}% of your total budget. With ${daysLeftInPeriod} days left, spend carefully — you have ${fmt(Math.max(0, remainingThisMonth))} remaining.`
                  : `You have spent ${Math.round(aggregatePct)}% of your total budget. You're on track! Try to keep your daily spending around ${fmt(dailyTarget)} to finish the month strong.`}
              </p>
              {daysLeftInPeriod > 0 && summary.totalBudgeted > 0 && (
                <div className="mt-4 p-3 rounded-xl" style={{ background: theme.colors.primary + '0f' }}>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.primary }}>Suggested daily spend</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: theme.colors.primary }}>
                    {fmt(Math.max(0, remainingThisMonth) / Math.max(1, daysLeftInPeriod))}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ day</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">to stay within budget for the rest of {MONTH_NAMES[viewMonth - 1]}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
              <span>{summary.safe} of {monthBudgets.length} budgets on track</span>
              {summary.exceeded > 0 && (
                <span className="text-red-500 font-semibold">{summary.exceeded} exceeded</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Breakdown table */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <p className="text-sm font-bold">Budget Breakdown</p>
              <p className="text-xs text-muted-foreground">See how much you can spend each day and week for every budget category.</p>
            </div>
          </div>

          {breakdownRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No budgets for {MONTH_NAMES[viewMonth - 1]} {viewYear}</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Category</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Monthly Budget</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Daily Target<br /><span className="font-normal">(Average)</span></th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Weekly Target<br /><span className="font-normal">(Average)</span></th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs w-36">Spent So Far / % Used</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Remaining</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Projected Spend<br /><span className="font-normal">(End of Month)</span></th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map(b => {
                    const pct = b.percentage || 0
                    const status = getBudgetStatus(pct)
                    const spentPct  = b.monthly_limit > 0 ? Math.round(((b.spent || 0) / b.monthly_limit) * 100) : 0
                    const remainPct = 100 - spentPct
                    const statusMeta = status === 'exceeded'
                      ? { label: 'Over Budget',       color: '#dc2626', bg: '#fee2e2' }
                      : status === 'warning'
                      ? { label: 'Approaching',       color: '#d97706', bg: '#fef3c7' }
                      : { label: 'On Track',           color: '#16a34a', bg: '#dcfce7' }
                    return (
                      <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: `${CATEGORY_COLORS[b.category] || '#94a3b8'}20` }}>
                              {({
                                'Food & Dining': '🍽️', 'Transport': '🚗', 'Housing': '🏠',
                                'Utilities': '💡', 'Utilities Bills': '💡', 'Healthcare': '🏥',
                                'Education': '📚', 'Entertainment': '🎬', 'Shopping': '🛍️',
                                'Clothing': '👗', 'Personal Care': '💆', 'Savings': '🏦',
                                'Debt Payment': '💳', 'Insurance': '🛡️', 'Travel': '✈️',
                                'Communication': '📱', 'Family Support': '👨‍👩‍👧', 'Emergency': '🚨',
                                'Charity & Donations': '❤️', 'Charity & Donation': '❤️',
                                'Tithe & Offerings': '🙏', 'Tithe & Offerings - Church Donations': '🙏',
                                'Church Donations': '⛪', 'Investment': '📈', 'Other': '📦',
                              } as Record<string, string>)[b.category] || '📦'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{b.budget_name}</p>
                              <p className="text-xs text-muted-foreground truncate capitalize">{b.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(b.monthly_limit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(b.dailyTarget)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(b.weeklyTarget)}</td>
                        
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1 min-w-[110px]">
                            <div className="flex items-center justify-between w-full text-xs">
                              <span className="font-semibold tabular-nums" style={{
                                color: pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a'
                              }}>
                                {Math.round(pct)}%
                              </span>
                              <span className="text-muted-foreground text-[10px]">{fmt(b.spent || 0)}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">

                          {fmt(Math.max(0, b.remaining || 0))}

                          <span className="text-muted-foreground text-xs ml-1">{Math.max(0, remainPct)}%</span>

                        </td>

                        <td className="px-3 py-3 text-right tabular-nums">
                          <span
                            className="font-semibold"
                            style={{
                              color: b.projectedStatus === 'over'
                                ? '#dc2626'
                                : b.projectedStatus === 'warning'
                                ? '#d97706'
                                : '#16a34a',
                            }}
                          >
                            {fmt(b.projectedSpend ?? 0)}
                          </span>
                          {b.projectedSpend > b.monthly_limit && (
                            <p className="text-[10px] text-red-500 mt-0.5">
                              +{fmt(b.projectedSpend - b.monthly_limit)} over
                            </p>
                          )}
                          {b.projectedSpend <= b.monthly_limit && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {fmt(b.monthly_limit - b.projectedSpend)} under
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background: statusMeta.bg, color: statusMeta.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.color }} />
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to use + Budget Pace Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white rounded-xl shadow-sm">
          <CardContent className="py-4 px-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.colors.primary + '18' }}>
              <Info className="w-4 h-4" style={{ color: theme.colors.primary }} />
            </div>
            <div>
              <p className="text-sm font-semibold">How to use</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use your daily and weekly targets as a guide to help you stay on track. Try not to exceed your daily target for better monthly control.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl shadow-sm">
          <CardContent className="py-4 px-5">
            <p className="text-sm font-semibold mb-2">Budget Pace Guide</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-semibold">On Track</span>
                <span className="text-muted-foreground">You're within your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-semibold">Approaching Limit</span>
                <span className="text-muted-foreground">You've used more than 80% of your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-semibold">Over Budget</span>
                <span className="text-muted-foreground">You've spent more than 100% of your budget.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    )}
    </div>
  )
}