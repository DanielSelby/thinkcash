'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, TrendingDown, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate, PAYMENT_METHODS, CATEGORY_COLORS } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import type { Expense } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  initialExpenses: Expense[]
  userId: string
}

export function ExpensesContent({ initialExpenses, userId }: Props) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const { expenseCategories } = useCategories()
const [categoryFilter, setCategoryFilter] = useState('all')

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const openEdit = (e: Expense) => {
    setEditing(e)
    reset({ title: e.title, amount: e.amount, category: e.category, payment_method: e.payment_method, date: e.date, notes: e.notes || '' })
    setOpen(true)
  }
  const openCreate = () => { setEditing(null); reset({ date: new Date().toISOString().split('T')[0] }); setOpen(true) }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase.from('expenses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else { setExpenses(prev => prev.map(e => e.id === editing.id ? updated : e)); toast({ title: 'Expense updated', variant: 'success' }); setOpen(false) }
    } else {
      const { data: created, error } = await supabase.from('expenses').insert({ ...data, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed to add', description: error.message, variant: 'destructive' })
      else { setExpenses(prev => [created, ...prev]); toast({ title: 'Expense added', variant: 'success' }); setOpen(false) }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setExpenses(prev => prev.filter(e => e.id !== id)); toast({ title: 'Expense deleted' }) }
  }

  const filtered = useMemo(() => expenses.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || e.category === categoryFilter
    return matchSearch && matchCat
  }), [expenses, search, categoryFilter])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground text-sm">Monitor and manage your spending</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Expense</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Expenses</p><p className="font-display text-2xl font-bold text-destructive tabular-nums mt-1">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">This View</p><p className="font-display text-2xl font-bold tabular-nums mt-1">{formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Entries</p><p className="font-display text-2xl font-bold tabular-nums mt-1">{filtered.length}</p></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Payment</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense, i) => (
                    <tr key={expense.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-6 py-4"><p className="font-medium">{expense.title}</p>{expense.notes && <p className="text-xs text-muted-foreground truncate max-w-xs">{expense.notes}</p>}</td>
                      <td className="px-6 py-4"><Badge style={{ background: `${CATEGORY_COLORS[expense.category]}20`, color: CATEGORY_COLORS[expense.category] }}>{expense.category}</Badge></td>
                      <td className="px-6 py-4 text-muted-foreground capitalize">{expense.payment_method?.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(expense.date)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-destructive tabular-nums">-{formatCurrency(expense.amount)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(expense)}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDelete(expense.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Groceries" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register('date')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select onValueChange={v => setValue('category', v)} defaultValue={editing?.category}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{expenseCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select onValueChange={v => setValue('payment_method', v)} defaultValue={editing?.payment_method}>
                  <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any additional notes..." {...register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Add Expense'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}


