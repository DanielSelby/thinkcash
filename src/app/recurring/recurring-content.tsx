'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, RefreshCcw, Loader2, Power, PowerOff } from 'lucide-react'
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
import { useCategories } from '@/hooks/useCategories'
import type { RecurringTransaction } from '@/types'

const schema = z.object({
  title:     z.string().min(1, 'Title required'),
  type:      z.enum(['income', 'expense']),
  amount:    z.coerce.number().positive('Amount must be positive'),
  category:  z.string().min(1, 'Category required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  next_date: z.string().min(1, 'Next date required'),
})
type FormData = z.infer<typeof schema>

interface Props { initialRecurring: RecurringTransaction[]; userId: string }

export function RecurringContent({ initialRecurring, userId }: Props) {
  const { incomeCategories, expenseCategories } = useCategories()

  const [items,   setItems]   = useState(initialRecurring)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<RecurringTransaction | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'expense', next_date: new Date().toISOString().split('T')[0] },
  })

  const watchType  = watch('type', 'expense')
  const categories = watchType === 'income' ? incomeCategories : expenseCategories

  const openCreate = () => {
    setEditing(null)
    reset({ type: 'expense', next_date: new Date().toISOString().split('T')[0] })
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
      }
    }
    setLoading(false)
  }

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: !current }).eq('id', id)
    if (error) toast({ title: 'Failed', variant: 'destructive' })
    else setItems(prev => prev.map(i => i.id === id ? { ...i, is_active: !current } : i))
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
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white p-5">
          <p className="text-sm text-muted-foreground">Total Active</p>
          <p className="font-display text-2xl font-bold mt-1">
            {items.filter(i => i.is_active).length}
          </p>
        </Card>
        <Card className="bg-white p-5 kpi-green">
          <p className="text-sm text-muted-foreground">Monthly Income</p>
          <p className="kpi-value text-xl font-bold tabular-nums mt-1">
            {formatCurrency(items
              .filter(i => i.is_active && i.type === 'income' && i.frequency === 'monthly')
              .reduce((s, i) => s + i.amount, 0))}
          </p>
        </Card>
        <Card className="bg-white p-5 kpi-red">
          <p className="text-sm text-muted-foreground">Monthly Expenses</p>
          <p className="kpi-value text-xl font-bold tabular-nums mt-1">
            {formatCurrency(items
              .filter(i => i.is_active && i.type === 'expense' && i.frequency === 'monthly')
              .reduce((s, i) => s + i.amount, 0))}
          </p>
        </Card>
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
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Frequency</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Next Date</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
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
                      <td className="px-6 py-4">
                        <Badge variant={item.type === 'income' ? 'success' : 'destructive'}>
                          {item.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 capitalize text-muted-foreground">
                        {freqLabel(item.frequency)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(item.next_date)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={item.is_active ? 'success' : 'secondary'}>
                          {item.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold tabular-nums ${
                        item.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-6 py-4">
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Monthly Salary, Netflix, Rent…" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  onValueChange={v => setValue('type', v as 'income' | 'expense')}
                  defaultValue={editing?.type || 'expense'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select
                  onValueChange={v => setValue('frequency', v as any)}
                  defaultValue={editing?.frequency || 'monthly'}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Next Date</Label>
                <Input type="date" {...register('next_date')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                onValueChange={v => setValue('category', v)}
                defaultValue={editing?.category}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
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