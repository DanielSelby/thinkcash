'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, Wallet, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Progress } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, EXPENSE_CATEGORIES, CATEGORY_COLORS, getBudgetStatus } from '@/lib/utils'
import type { Budget } from '@/types'

const schema = z.object({
  budget_name: z.string().min(1, 'Budget name is required'),
  category: z.string().min(1, 'Category is required'),
  monthly_limit: z.coerce.number().positive('Limit must be positive'),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialBudgets: Budget[]
  expenses: { amount: number; category: string }[]
  userId: string
}

export function BudgetsContent({ initialBudgets, expenses, userId }: Props) {
  const [budgets, setBudgets] = useState(initialBudgets)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const budgetsWithSpent = useMemo(() => budgets.map(b => {
    const spent = expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0)
    const percentage = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
    return { ...b, spent, remaining: b.monthly_limit - spent, percentage }
  }), [budgets, expenses])

  const summary = useMemo(() => ({
    totalBudgeted: budgets.reduce((s, b) => s + b.monthly_limit, 0),
    totalSpent: budgetsWithSpent.reduce((s, b) => s + (b.spent || 0), 0),
    exceeded: budgetsWithSpent.filter(b => (b.percentage || 0) >= 100).length,
    warning: budgetsWithSpent.filter(b => (b.percentage || 0) >= 80 && (b.percentage || 0) < 100).length,
    safe: budgetsWithSpent.filter(b => (b.percentage || 0) < 80).length,
  }), [budgets, budgetsWithSpent])

  const openCreate = () => { setEditing(null); reset(); setOpen(true) }
  const openEdit = (b: Budget) => {
    setEditing(b)
    reset({ budget_name: b.budget_name, category: b.category, monthly_limit: b.monthly_limit })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase.from('budgets').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else { setBudgets(prev => prev.map(b => b.id === editing.id ? updated : b)); toast({ title: 'Budget updated', variant: 'success' }); setOpen(false) }
    } else {
      const { data: created, error } = await supabase.from('budgets').insert({ ...data, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else { setBudgets(prev => [created, ...prev]); toast({ title: 'Budget created', variant: 'success' }); setOpen(false) }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    const supabase = createClient()
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setBudgets(prev => prev.filter(b => b.id !== id)); toast({ title: 'Budget deleted' }) }
  }

  const statusIcon = (pct: number) => {
    const status = getBudgetStatus(pct)
    if (status === 'exceeded') return <XCircle className="w-4 h-4 text-destructive" />
    if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-warning" />
    return <CheckCircle className="w-4 h-4 text-success" />
  }

  const progressClass = (pct: number) => {
    const status = getBudgetStatus(pct)
    if (status === 'exceeded') return '[&>div]:bg-destructive'
    if (status === 'warning') return '[&>div]:bg-warning'
    return ''
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Budgets</h1>
          <p className="text-muted-foreground text-sm">Set monthly spending limits by category</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Budget</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total Budgeted</p>
          <p className="font-display text-xl font-bold tabular-nums mt-1">{formatCurrency(summary.totalBudgeted)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="font-display text-xl font-bold tabular-nums mt-1">{formatCurrency(summary.totalSpent)}</p>
        </Card>
        <Card className="p-5 border-success/30">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <p className="text-sm text-muted-foreground">On Track</p>
          </div>
          <p className="font-display text-xl font-bold text-success mt-1">{summary.safe}</p>
        </Card>
        <Card className="p-5 border-destructive/30">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-muted-foreground">Exceeded</p>
          </div>
          <p className="font-display text-xl font-bold text-destructive mt-1">{summary.exceeded}</p>
        </Card>
      </div>

      {/* Budget cards grid */}
      {budgetsWithSpent.length === 0 ? (
        <Card className="p-12 text-center">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display font-semibold text-lg mb-1">No budgets yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Create budgets to track your spending limits</p>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create your first budget</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetsWithSpent.map(b => {
            const pct = b.percentage || 0
            const status = getBudgetStatus(pct)
            return (
              <Card key={b.id} className={`p-5 space-y-4 ${status === 'exceeded' ? 'border-destructive/40' : status === 'warning' ? 'border-warning/40' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${CATEGORY_COLORS[b.category]}20` }}>
                      <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{b.budget_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{EXPENSE_CATEGORIES.find(c => c.value === b.category)?.label || b.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {statusIcon(pct)}
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(b)}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(b.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-medium tabular-nums">{formatCurrency(b.spent || 0)} / {formatCurrency(b.monthly_limit)}</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className={`h-2 ${progressClass(pct)}`} />
                  <div className="flex justify-between text-xs">
                    <span className={status === 'exceeded' ? 'text-destructive font-medium' : status === 'warning' ? 'text-warning font-medium' : 'text-muted-foreground'}>
                      {pct.toFixed(0)}% used
                    </span>
                    <span className={`font-medium tabular-nums ${(b.remaining || 0) < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {(b.remaining || 0) < 0 ? `${formatCurrency(Math.abs(b.remaining || 0))} over` : `${formatCurrency(b.remaining || 0)} left`}
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

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Budget' : 'Create Budget'}</DialogTitle></DialogHeader>
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
                <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Limit (GHS)</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_limit')} />
              {errors.monthly_limit && <p className="text-xs text-destructive">{errors.monthly_limit.message}</p>}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Budget'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
