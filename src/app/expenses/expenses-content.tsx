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
}

export function ExpensesContent({ initialExpenses, accounts, userId }: Props) {
  const { expenseCategories } = useCategories()

  const [expenses,       setExpenses]       = useState(initialExpenses)
  const [open,           setOpen]           = useState(false)
  const [editing,        setEditing]        = useState<Expense | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter,  setAccountFilter]  = useState('all')

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
      toast({ title: 'Expense deleted' })
    }
  }

  const filtered = useMemo(() =>
    expenses.filter(e => {
      const matchSearch  = e.title.toLowerCase().includes(search.toLowerCase())
      const matchCat     = categoryFilter === 'all' || e.category === categoryFilter
      const matchAccount = accountFilter  === 'all' || e.account_id === accountFilter
      return matchSearch && matchCat && matchAccount
    }), [expenses, search, categoryFilter, accountFilter])

  const getAccountName = (id?: string | null) =>
    accounts.find(a => a.id === id)?.name ?? '—'

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-white kpi-red p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Total Expenses</p>
          <p className="kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate">
            {formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}
          </p>
        </Card>
        <Card className="bg-white kpi-blue p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">This View</p>
          <p className="kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate">
            {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
          </p>
        </Card>
        <Card className="bg-white kpi-orange p-4 sm:p-5 overflow-hidden">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Entries</p>
          <p className="kpi-value text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate">{filtered.length}</p>
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
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{formatDate(expense.date)}</td>
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