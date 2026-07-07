'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, RefreshCcw, Loader2, Power, PowerOff } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate, FREQUENCIES, CATEGORY_COLORS } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { useCategories } from '@/hooks/useCategories'
import type { RecurringTransaction } from '@/types'
import { KPICard } from '@/components/ui/kpi-card'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'


const schema = z.object({
  title:      z.string().min(1, 'Title required'),
  type:       z.enum(['income', 'expense']),
  amount:     z.coerce.number().positive('Amount must be positive'),
  category:   z.string().min(1, 'Category required'),
  frequency:  z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  next_date:  z.string().min(1, 'Next date required'),
  account_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface AccountLite { id: string; name: string; currency: string }
interface Props { initialRecurring: RecurringTransaction[]; accounts?: AccountLite[]; userId: string }

export function RecurringContent({ initialRecurring, accounts = [], userId }: Props) {
  const { incomeCategories, expenseCategories } = useCategories()

  const [items,   setItems]   = useState(initialRecurring)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type:      'expense',
      frequency: 'monthly',
      next_date: new Date().toISOString().split('T')[0],
    },
  })

  const watchType  = watch('type', 'expense')
  const categories = watchType === 'income' ? incomeCategories : expenseCategories

  // Checks a single recurring transaction and fires a "due soon" notification
  // if its next_date falls within the next 0–3 days. Deduped for 24h so it
  // won't re-fire on every page load within the same day.
  const checkDueSoon = async (item: RecurringTransaction) => {
    if (!item.is_active) return
    const daysUntil = differenceInDays(parseISO(item.next_date), new Date())
    if (daysUntil >= 0 && daysUntil <= 3) {
      await notify({
        userId,
        type: 'recurring',
        title: `Upcoming: ${item.title}`,
        message: `${item.title} (${formatCurrency(item.amount)}) is due ${
          daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`
        }.`,
        dedupeWindowHours: 24,
      })
    }
  }

  // Date-based check, not action-based — runs once when the page loads
  // against the server-fetched list, so "due soon" alerts show up even if
  // the user never touches the form that day.
  useEffect(() => {
    initialRecurring.forEach(item => { checkDueSoon(item) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setEditing(null)
    reset({
      type:      'expense',
      frequency: 'monthly',
      next_date: new Date().toISOString().split('T')[0],
      title:     '',
      amount:    undefined as any,
      category:  '',
    })
    setOpen(true)
  }

  const openEdit = (item: RecurringTransaction) => {
    setEditing(item)
    reset({
      title:     item.title,
      type:      item.type,
      amount:    item.amount,
      category:  item.category,
      frequency: item.frequency,
      next_date: item.next_date,
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    try {
      if (editing) {
        const { data: updated, error } = await supabase
          .from('recurring_transactions')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editing.id).select().single()
        if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
        else {
          setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
          toast({ title: 'Updated', variant: 'success' })
          setOpen(false)
          checkDueSoon(updated)
        }
      } else {
        const { data: created, error } = await supabase
          .from('recurring_transactions')
          .insert({ ...data, user_id: userId, is_active: true })
          .select().single()
        if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
        else {
          setItems(prev => [...prev, created])
          toast({ title: 'Recurring transaction created', variant: 'success' })
          setOpen(false)
          checkDueSoon(created)
        }
      }
    } catch (e: any) {
      toast({ title: 'Unexpected error', description: e?.message, variant: 'destructive' })
    }
    setLoading(false)
  }

  // Surface silent validation errors so user knows what's wrong
  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast({
      title: 'Please fix form errors',
      description: first?.message || 'Some fields are invalid',
      variant: 'destructive',
    })
  }

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: !current }).eq('id', id)
    if (error) toast({ title: 'Failed', variant: 'destructive' })
    else {
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
      if (!current) {
        // Just reactivated — check if it's already due soon
        const reactivated = items.find(i => i.id === id)
        if (reactivated) checkDueSoon({ ...reactivated, is_active: true })
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring transaction?')) return
    const supabase = createClient()
    await supabase.from('recurring_transactions').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    toast({ title: 'Deleted' })
  }

  const freqLabel = (f: string) => FREQUENCIES.find(x => x.value === f)?.label || f

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Recurring Transactions</h1>
          <p className="text-muted-foreground text-sm">Automate regular income and expenses</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add Recurring</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label="Total Active"
          value={String(items.filter(i => i.is_active).length)}
          sub={`${items.filter(i => !i.is_active).length} paused`}
          colorClass=""
          icon={RefreshCw}
          accentColor="#2563eb"
          tooltip="Number of active recurring transactions"
        />
        <KPICard
          label="Monthly Income"
          value={formatCurrency(items.filter(i => i.is_active && i.type === 'income' && i.frequency === 'monthly').reduce((s, i) => s + i.amount, 0))}
          sub="Recurring monthly"
          colorClass=""
          icon={TrendingUp}
          accentColor="#16a34a"
          tooltip="Total monthly recurring income"
        />
        <KPICard
          label="Monthly Expenses"
          value={formatCurrency(items.filter(i => i.is_active && i.type === 'expense' && i.frequency === 'monthly').reduce((s, i) => s + i.amount, 0))}
          sub="Recurring monthly"
          colorClass=""
          icon={TrendingDown}
          accentColor="#dc2626"
          tooltip="Total monthly recurring expenses"
        />
      </div>

      {items.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <RefreshCcw className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No recurring transactions</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Set up salary, rent, subscriptions or any regular transactions
          </p>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Add your first recurring</Button>
        </Card>
      ) : (
        <Card className="bg-white rounded-xl shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Frequency</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Next Date</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${CATEGORY_COLORS[item.category] || '#94a3b8'}20` }}>
                            <RefreshCcw className="w-3.5 h-3.5"
                              style={{ color: CATEGORY_COLORS[item.category] || '#94a3b8' }} />
                          </div>
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={item.type === 'income' ? 'success' : 'destructive'}>
                          {item.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 capitalize text-muted-foreground whitespace-nowrap">
                        {freqLabel(item.frequency)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(item.next_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={item.is_active ? 'success' : 'secondary'}>
                          {item.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                        item.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8"
                            onClick={() => toggleActive(item.id, item.is_active)}
                            title={item.is_active ? 'Pause' : 'Activate'}>
                            {item.is_active
                              ? <PowerOff className="w-3.5 h-3.5 text-warning" />
                              : <Power    className="w-3.5 h-3.5 text-success" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8"
                            onClick={() => openEdit(item)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive"
                            onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recurring' : 'Add Recurring Transaction'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Monthly Salary, Netflix, Rent…" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  onValueChange={v => setValue('type', v as 'income' | 'expense', { shouldValidate: true })}
                  defaultValue={editing?.type || 'expense'}
                  value={watchType}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  onValueChange={v => setValue('frequency', v as any, { shouldValidate: true })}
                  defaultValue={editing?.frequency || 'monthly'}
                  value={watch('frequency') || 'monthly'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.frequency && <p className="text-xs text-destructive">{errors.frequency.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Next Date</Label>
                <Input type="date" {...register('next_date')} />
                {errors.next_date && <p className="text-xs text-destructive">{errors.next_date.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                onValueChange={v => setValue('category', v, { shouldValidate: true })}
                defaultValue={editing?.category}
                value={watch('category') || ''}
              >
                <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Account <span className="text-muted-foreground text-xs">(optional — needed for Cash Flow Forecast)</span></Label>
              <Select
                onValueChange={v => setValue('account_id', v === 'none' ? '' : v)}
                defaultValue={editing?.account_id || 'none'}
              >
                <SelectTrigger><SelectValue placeholder="Which account?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}