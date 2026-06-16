'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Edit2, Trash2, TrendingUp, Loader2 } from 'lucide-react'
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
import { formatCurrency, formatDate, CATEGORY_COLORS } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import type { Income, UserAccount } from '@/types'

const schema = z.object({
  title:      z.string().min(1, 'Title is required'),
  amount:     z.coerce.number().positive('Amount must be positive'),
  category:   z.string().min(1, 'Category is required'),
  date:       z.string().min(1, 'Date is required'),
  notes:      z.string().optional(),
  account_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialExpenses: Income[]
  accounts: UserAccount[]
  userId: string
}

export function ExpensesContent({ initialExpenses, accounts, userId }: Props) {
  const { incomeCategories } = useCategories()

  const [incomes,        setIncomes]        = useState(initialExpenses)
  const [open,           setOpen]           = useState(false)
  const [editing,        setEditing]        = useState<Income | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter,  setAccountFilter]  = useState('all')

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const openCreate = () => {
    setEditing(null)
    reset({ date: new Date().toISOString().split('T')[0] })
    setOpen(true)
  }

  const openEdit = (income: Income) => {
    setEditing(income)
    reset({
      title:      income.title,
      amount:     income.amount,
      category:   income.category,
      date:       income.date,
      notes:      income.notes || '',
      account_id: income.account_id || '',
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload  = { ...data, account_id: data.account_id || null }
    if (editing) {
      const { data: updated, error } = await supabase
        .from('incomes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setIncomes(prev => prev.map(i => i.id === editing.id ? updated : i))
        toast({ title: 'Income updated', variant: 'success' })
        setOpen(false)
      }
    } else {
      const { data: created, error } = await supabase
        .from('incomes')
        .insert({ ...payload, user_id: userId })
        .select().single()
      if (error) toast({ title: 'Failed to add', description: error.message, variant: 'destructive' })
      else {
        setIncomes(prev => [created, ...prev])
        toast({ title: 'Income added', variant: 'success' })
        setOpen(false)
      }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this income entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from('incomes').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setIncomes(prev => prev.filter(i => i.id !== id))
      toast({ title: 'Income deleted' })
    }
  }

  const filtered = useMemo(() =>
    incomes.filter(i => {
      const matchSearch  = i.title.toLowerCase().includes(search.toLowerCase())
      const matchCat     = categoryFilter === 'all' || i.category === categoryFilter
      const matchAccount = accountFilter  === 'all' || i.account_id === accountFilter
      return matchSearch && matchCat && matchAccount
    }), [incomes, search, categoryFilter, accountFilter])

  const totalFiltered = filtered.reduce((s, i) => s + i.amount, 0)

  const getAccountName = (id?: string | null) =>
    accounts.find(a => a.id === id)?.name ?? '—'

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Income</h1>
          <p className="text-muted-foreground text-sm">Track all your income sources</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Income
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white kpi-green p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Income</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">
            {formatCurrency(incomes.reduce((s, i) => s + i.amount, 0))}
          </p>
        </Card>
        <Card className="bg-white kpi-blue p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">This View</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">{formatCurrency(totalFiltered)}</p>
        </Card>
        <Card className="bg-white kpi-purple p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Entries</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">{filtered.length}</p>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search income…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {incomeCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Account" /></SelectTrigger>
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
              <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No income entries found</p>
              <p className="text-sm mt-1">Add your first income to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Account</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((income, idx) => (
                    <tr key={income.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                        idx % 2 === 1 ? 'bg-muted/10' : ''
                      }`}>
                      <td className="px-6 py-4">
                        <p className="font-medium">{income.title}</p>
                        {income.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{income.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge style={{
                          background: `${CATEGORY_COLORS[income.category] || '#94a3b8'}20`,
                          color: CATEGORY_COLORS[income.category] || '#94a3b8',
                        }}>
                          {income.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {getAccountName(income.account_id)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(income.date)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-success tabular-nums">
                        +{formatCurrency(income.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="w-8 h-8"
                            onClick={() => openEdit(income)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="w-8 h-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(income.id)}>
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
            <DialogTitle>{editing ? 'Edit Income' : 'Add Income'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. Monthly Salary" {...register('title')}
                className={errors.title ? 'border-destructive' : ''} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')}
                  className={errors.amount ? 'border-destructive' : ''} />
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
                  <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Select onValueChange={v => setValue('account_id', v === 'none' ? '' : v)}
                  defaultValue={editing?.account_id || 'none'}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No account</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any additional notes…" {...register('notes')} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Add Income'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

