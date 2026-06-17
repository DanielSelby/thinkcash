'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Wallet, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight,
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

export function BudgetsContent({ initialBudgets, expenses, userId }: Props) {
  const { activeTheme } = useAppStore()
  const { expenseCategories } = useCategories()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const now = new Date()
  const [budgets,   setBudgets]   = useState(initialBudgets)
  const [open,      setOpen]      = useState(false)
  const [editing,   setEditing]   = useState<Budget | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear,  setViewYear]  = useState(now.getFullYear())

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
    reset({ budget_month: viewMonth, budget_year: viewYear })
    setOpen(true)
  }
  const openEdit = (b: Budget) => {
    setEditing(b)
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

  const statusIcon = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return <XCircle      className="w-4 h-4 text-destructive" />
    if (s === 'warning')  return <AlertTriangle className="w-4 h-4 text-warning"     />
    return                       <CheckCircle   className="w-4 h-4 text-success"      />
  }

  const progressClass = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return '[&>div]:bg-destructive'
    if (s === 'warning')  return '[&>div]:bg-warning'
    return ''
  }

  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Budgets
          </h1>
          <p className="text-muted-foreground text-sm">Monthly spending limits by category</p>
        </div>
        <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
          <Plus className="w-4 h-4 mr-1" /> Create Budget
        </Button>
      </div>

      {/* Month Navigator */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center min-w-0">
              <p className="font-bold text-sm sm:text-base truncate" style={{ color: theme.colors.primary }}>
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </p>
              {isCurrentMonth && (
                <span className="text-xs text-white px-2 py-0.5 rounded-full"
                  style={{ background: theme.colors.accent }}>
                  Current Month
                </span>
              )}
            </div>

            <button onClick={nextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-white kpi-blue p-3 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Budgeted</p>
          <p className="kpi-value text-base sm:text-xl font-bold tabular-nums mt-1 truncate">{formatCurrency(summary.totalBudgeted)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{monthBudgets.length} budget(s)</p>
        </Card>
        <Card className="bg-white kpi-red p-3 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Spent</p>
          <p className="kpi-value text-base sm:text-xl font-bold tabular-nums mt-1 truncate">{formatCurrency(summary.totalSpent)}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {summary.totalBudgeted > 0
              ? `${Math.round((summary.totalSpent / summary.totalBudgeted) * 100)}% of budget`
              : 'No budget set'}
          </p>
        </Card>
        <Card className="bg-white kpi-green p-3 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">On Track</p>
          </div>
          <p className="kpi-value text-base sm:text-xl font-bold mt-1" style={{ color: '#16a34a' }}>{summary.safe}</p>
        </Card>
        <Card className="bg-white kpi-red p-3 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Exceeded</p>
          </div>
          <p className="kpi-value text-base sm:text-xl font-bold mt-1" style={{ color: '#dc2626' }}>{summary.exceeded}</p>
        </Card>
      </div>

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
                : status === 'warning'  ? 'border-warning/40 kpi-orange'
                : 'kpi-green'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${CATEGORY_COLORS[b.category] || '#94a3b8'}20` }}>
                      <span className="w-3 h-3 rounded-full"
                        style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{b.budget_name}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {b.category}
                        {' · '}{MONTH_NAMES[(b.budget_month ?? 1) - 1]} {b.budget_year ?? viewYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusIcon(pct)}
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(b)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Spent</span>
                    <span className="font-medium tabular-nums truncate text-right">
                      {formatCurrency(b.spent || 0)} / {formatCurrency(b.monthly_limit)}
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
                    <span className={`font-medium tabular-nums truncate ${(b.remaining || 0) < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {(b.remaining || 0) < 0
                        ? `${formatCurrency(Math.abs(b.remaining || 0))} over`
                        : `${formatCurrency(b.remaining || 0)} left`}
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

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
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
              <Select onValueChange={v => setValue('category', v)} defaultValue={editing?.category}>
                <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Monthly Limit (GHS)</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_limit')} />
              {errors.monthly_limit && <p className="text-xs text-destructive">{errors.monthly_limit.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  onValueChange={v => setValue('budget_month', Number(v))}
                  defaultValue={String(editing?.budget_month ?? viewMonth)}
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
                  onValueChange={v => setValue('budget_year', Number(v))}
                  defaultValue={String(editing?.budget_year ?? viewYear)}
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
    </div>
  )
}