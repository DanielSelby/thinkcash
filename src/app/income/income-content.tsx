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
import { KPICard } from '@/components/ui/kpi-card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import type { Income, UserAccount } from '@/types'

const schema = z.object({
  title:      z.string().min(1, 'Title is required'),
  amount:     z.coerce.number().positive('Amount must be positive'),
  category:   z.string().min(1, 'Category is required'),
  date:       z.string().min(1, 'Date is required'),
  notes:      z.string().optional(),
  account_id: z.string().min(1, 'Account is required — every income must be linked to a real account'),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialIncomes: Income[]
  accounts:       UserAccount[]
  userId:         string
}

function groupByCurrency(items: any[], accounts: UserAccount[]): Record<string, number> {
  const map: Record<string, number> = {}
  items.forEach(i => {
    const cur = accounts.find(a => a.id === i.account_id)?.currency || 'GHS'
    map[cur] = (map[cur] || 0) + Number(i.amount)
  })
  return map
}

export function IncomeContent({ initialIncomes, accounts, userId }: Props) {
  const { incomeCategories } = useCategories()
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  // ── State ────────────────────────────────────────────────────────────
  const [incomes,        setIncomes]        = useState(initialIncomes)
  const [open,           setOpen]           = useState(false)
  const [editing,        setEditing]        = useState<Income | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter,  setAccountFilter]  = useState('all')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [monthFilter,    setMonthFilter]    = useState('all')
  const [yearFilter,     setYearFilter]     = useState('all')

  // ── Form ─────────────────────────────────────────────────────────────
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const getAccountCurrency = (id?: string | null) =>
    accounts.find(a => a.id === id)?.currency

  const getAccountName = (id?: string | null) =>
    accounts.find(a => a.id === id)?.name ?? '—'

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

  // ── CRUD ─────────────────────────────────────────────────────────────
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
    else { setIncomes(prev => prev.filter(i => i.id !== id)); toast({ title: 'Income deleted' }) }
  }

  // ── Date helpers ──────────────────────────────────────────────────────
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]

  const availableYears = useMemo(() =>
    Array.from(new Set(incomes.map(i => i.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [incomes],
  )

  const clearDateFilters = () => {
    setDateFrom(''); setDateTo(''); setMonthFilter('all'); setYearFilter('all')
  }
  const hasActiveDateFilters = !!dateFrom || !!dateTo || monthFilter !== 'all' || yearFilter !== 'all'

  // ── Derived data (strict memo order — no forward references) ──────────

  const filtered = useMemo(() =>
    incomes.filter(i => {
      const matchSearch  = i.title.toLowerCase().includes(search.toLowerCase())
      const matchCat     = categoryFilter === 'all' || i.category === categoryFilter
      const matchAccount = accountFilter  === 'all' || i.account_id === accountFilter
      const matchFrom    = !dateFrom || i.date >= dateFrom
      const matchTo      = !dateTo   || i.date <= dateTo
      const matchMonth   = monthFilter === 'all' || i.date.slice(5, 7) === monthFilter
      const matchYear    = yearFilter  === 'all' || i.date.slice(0, 4) === yearFilter
      return matchSearch && matchCat && matchAccount && matchFrom && matchTo && matchMonth && matchYear
    }),
    [incomes, search, categoryFilter, accountFilter, dateFrom, dateTo, monthFilter, yearFilter],
  )

  // All incomes grouped by currency
  const totalByCurrency = useMemo(
    () => groupByCurrency(incomes, accounts),
    [incomes, accounts],
  )

  // Filtered incomes grouped by currency
  const filteredByCurrency = useMemo(
    () => groupByCurrency(filtered, accounts),
    [filtered, accounts],
  )

  // Category breakdown of filtered incomes — for topSource on KPI back face
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => {
      const cat = i.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(i.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const grandTotalFiltered = useMemo(
    () => incomeByCategory.reduce((s, c) => s + c.value, 0),
    [incomeByCategory],
  )

  // Average income per transaction
  const avgIncome = useMemo(
    () => (filtered.length > 0 ? grandTotalFiltered / filtered.length : 0),
    [grandTotalFiltered, filtered],
  )

  // Today's incomes
  const todayStr = new Date().toISOString().split('T')[0]

  const incomesToday = useMemo(
    () => filtered.filter(i => i.date === todayStr),
    [filtered, todayStr],
  )

  // Currency totals for today — MUST come after incomesToday
  const totalToday = useMemo(
    () => groupByCurrency(incomesToday, accounts),
    [incomesToday, accounts],
  )

  // Highest single income in current filter
  const highestIncome = useMemo(
    () => filtered.reduce<Income | null>(
      (max, i) => !max || Number(i.amount) > Number(max.amount) ? i : max,
      null,
    ),
    [filtered],
  )

  // ── KPICard formatted strings (all after their dependencies) ──────────

  const totalIncStr = useMemo(() => {
    const entries = Object.entries(totalByCurrency)
    return entries.length ? formatCurrency(entries[0][1], entries[0][0]) : formatCurrency(0)
  }, [totalByCurrency])

  const totalIncSub = useMemo(() => {
    const entries = Object.entries(totalByCurrency)
    if (entries.length <= 1) return `${incomes.length} entr${incomes.length === 1 ? 'y' : 'ies'}`
    return entries.slice(1).map(([c, a]) => formatCurrency(a, c)).join(' · ')
  }, [totalByCurrency, incomes])

  const filteredIncStr = useMemo(() => {
    const entries = Object.entries(filteredByCurrency)
    return entries.length ? formatCurrency(entries[0][1], entries[0][0]) : formatCurrency(0)
  }, [filteredByCurrency])

  const filteredIncSub = useMemo(() => {
    const entries = Object.entries(filteredByCurrency)
    if (entries.length <= 1) return `${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}`
    return entries.slice(1).map(([c, a]) => formatCurrency(a, c)).join(' · ')
  }, [filteredByCurrency, filtered])

  // Today card value — depends on totalToday
  const todayCardStr = useMemo(() => {
    const entries = Object.entries(totalToday)
    return entries.length ? formatCurrency(entries[0][1], entries[0][0]) : '—'
  }, [totalToday])

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">Income</h1>
          <p className="text-muted-foreground text-sm">Track all your income sources</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add Income
        </Button>
      </div>

      {/* ── KPI cards (3D flip) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

        <KPICard
          label="Total income"
          value={totalIncStr}
          sub={totalIncSub}
          colorClass=""
          icon={TrendingUp}
          accentColor="#16a34a"
          tooltip={
            Object.entries(totalByCurrency)
              .map(([c, a]) => `${c}: ${formatCurrency(a, c)}`)
              .join('\n') || 'No income yet'
          }
        />

        <KPICard
          label="This view"
          value={filteredIncStr}
          sub={filteredIncSub}
          colorClass=""
          icon={TrendingUp}
          accentColor="#2563eb"
          tooltip={
            Object.entries(filteredByCurrency)
              .map(([c, a]) => `${c}: ${formatCurrency(a, c)}`)
              .join('\n') || 'No income in current filter'
          }
        />

        <KPICard
          label="Entries"
          value={String(filtered.length)}
          sub="In current view"
          colorClass=""
          icon={TrendingUp}
          accentColor="#f97316"
          tooltip={`${filtered.length} of ${incomes.length} total income entries match the current filters`}
        />

        <KPICard
          label="Avg income"
          value={filtered.length > 0 ? formatCurrency(avgIncome) : '—'}
          sub="Per transaction"
          colorClass=""
          icon={TrendingUp}
          accentColor="#0891b2"
          topSource={incomeByCategory[0] ? `${incomeByCategory[0].name} (highest category)` : undefined}
          tooltip={`Average across ${filtered.length} transaction${filtered.length !== 1 ? 's' : ''} in current view`}
        />

        <KPICard
          label="Today"
          value={todayCardStr}
          sub={`${incomesToday.length} transaction${incomesToday.length !== 1 ? 's' : ''} today`}
          colorClass=""
          icon={TrendingUp}
          accentColor="#059669"
          tooltip={
            incomesToday.length > 0
              ? incomesToday
                  .map(i => `${i.title}: ${formatCurrency(Number(i.amount), getAccountCurrency(i.account_id))}`)
                  .join('\n')
              : 'No income recorded today'
          }
        />

        <KPICard
          label="Highest"
          value={
            highestIncome
              ? formatCurrency(Number(highestIncome.amount), getAccountCurrency(highestIncome.account_id))
              : '—'
          }
          sub={highestIncome ? highestIncome.title : 'No income yet'}
          colorClass=""
          icon={TrendingUp}
          accentColor="#9333ea"
          topSource={
            highestIncome
              ? `${highestIncome.category} · ${formatDate(highestIncome.date)}`
              : undefined
          }
          tooltip={
            highestIncome
              ? `${highestIncome.title}\n${highestIncome.category} · ${formatDate(highestIncome.date)}\n${getAccountName(highestIncome.account_id)}`
              : 'No income yet'
          }
        />

      </div>

      {/* ── Search & filters ── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search income…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {incomeCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-white">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Date slicer ── */}
      <Card className="bg-white rounded-xl shadow-sm border border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Filter by Date
            </p>
            {hasActiveDateFilters && (
              <button
                onClick={clearDateFilters}
                className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
              <input
                type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
              <input
                type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1"
              />
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

      {/* ── Income table ── */}
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
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Title</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Account</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((income, idx) => (
                    <tr key={income.id}
                      className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                        idx % 2 === 1 ? 'bg-muted/10' : ''
                      }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="font-medium">{income.title}</p>
                        {income.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{income.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge style={{
                          background: `${CATEGORY_COLORS[income.category] || '#94a3b8'}20`,
                          color: CATEGORY_COLORS[income.category] || '#94a3b8',
                        }}>
                          {income.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {getAccountName(income.account_id)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(income.date)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-success tabular-nums whitespace-nowrap">
                        +{formatCurrency(income.amount, getAccountCurrency(income.account_id))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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

      {/* ── Add / Edit dialog ── */}
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
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')}
                  className={errors.amount ? 'border-destructive' : ''} />
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
                <Select onValueChange={v => setValue('category', v)} defaultValue={editing?.category}>
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
                <Label>Account</Label>
                <Select
                  onValueChange={v => setValue('account_id', v, { shouldValidate: true })}
                  defaultValue={editing?.account_id || undefined}
                >
                  <SelectTrigger className={errors.account_id ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Which account received this?" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.account_id && <p className="text-xs text-destructive">{errors.account_id.message}</p>}
                {accounts.length === 0 && (
                  <p className="text-xs text-amber-600">
                    You need at least one account — add one in My Accounts first.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any additional notes…" {...register('notes')} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Add Income'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}