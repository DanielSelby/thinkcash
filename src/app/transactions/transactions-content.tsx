'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Download, TrendingUp, TrendingDown, ArrowUpDown, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, CATEGORY_COLORS } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { toast } from '@/components/ui/toaster'

type Transaction = {
  id: string
  type: 'income' | 'expense'
  title: string
  amount: number
  category: string
  date: string
  payment_method?: string
  notes?: string | null
  account_id?: string | null
}

type AccountLite = { id: string; name: string; currency: string }

interface Props {
  transactions: Transaction[]
  accounts: AccountLite[]
}

export function TransactionsContent({ transactions, accounts }: Props) {
  const searchParams = useSearchParams()
  const { incomeCategories, expenseCategories } = useCategories()

  const [search,         setSearch]         = useState('')
  const [typeFilter,     setTypeFilter]     = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  const getAccountCurrency = (id?: string | null) =>
    accounts.find(a => a.id === id)?.currency

  const hasMixedCurrencies = useMemo(() => {
    const currencies = new Set(accounts.map(a => a.currency || 'GHS'))
    return currencies.size > 1
  }, [accounts])

  const allCategories = useMemo(() =>
    Array.from(new Set([...incomeCategories, ...expenseCategories])),
    [incomeCategories, expenseCategories])

  const filtered = useMemo(() => transactions.filter(t => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      (t.notes ?? '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || t.type === typeFilter
    const matchCat  = categoryFilter === 'all' || t.category === categoryFilter
    const matchFrom = !dateFrom || t.date >= dateFrom
    const matchTo   = !dateTo   || t.date <= dateTo
    return matchSearch && matchType && matchCat && matchFrom && matchTo
  }), [transactions, search, typeFilter, categoryFilter, dateFrom, dateTo])

  const totals = useMemo(() => ({
    income:   filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expenses: filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
  }), [filtered])

  const handleExportCSV = () => {
    const rows = [
      ['Date', 'Title', 'Category', 'Type', 'Amount', 'Currency', 'Payment Method', 'Notes'],
      ...filtered.map(t => [
        t.date, t.title, t.category, t.type,
        t.amount.toFixed(2), getAccountCurrency(t.account_id) || 'GHS',
        t.payment_method || '', t.notes || '',
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `think-shika-pa-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV exported', variant: 'success' })
  }

  const clearFilters = () => {
    setSearch(''); setTypeFilter('all'); setCategoryFilter('all')
    setDateFrom(''); setDateTo('')
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">All your income and expense transactions</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-white kpi-green p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-success flex-shrink-0" />
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Income</p>
          </div>
          <p className="kpi-value text-base sm:text-xl font-bold tabular-nums truncate">{formatCurrency(totals.income)}</p>
        </Card>
        <Card className="bg-white kpi-red p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Expenses</p>
          </div>
          <p className="kpi-value text-base sm:text-xl font-bold tabular-nums truncate">{formatCurrency(totals.expenses)}</p>
        </Card>
        <Card className="bg-white kpi-blue p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpDown className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Net</p>
          </div>
          <p className={`kpi-value text-base sm:text-xl font-bold tabular-nums truncate ${
            totals.income - totals.expenses >= 0 ? 'text-success' : 'text-destructive'
          }`}>
            {formatCurrency(totals.income - totals.expenses)}
          </p>
        </Card>
        <Card className="bg-white kpi-orange p-4 sm:p-5 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-[10px] sm:text-sm text-muted-foreground truncate">Total Transactions</p>
          </div>
          <p className="kpi-value text-base sm:text-xl font-bold tabular-nums truncate">{filtered.length}</p>
        </Card>
      </div>

      {hasMixedCurrencies && (
        <p className="text-xs text-muted-foreground -mt-2">
          Totals above are summed at face value across accounts with different currencies. Row amounts below show each transaction's actual account currency.
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36 bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40 bg-white" />
        <Input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="w-full sm:w-40 bg-white" />
        {(search || typeFilter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ArrowUpDown className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Description</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Category</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Type</th>
                    <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Payment</th>
                    <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={`${t.type}-${t.id}`}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(t.date, 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <p className="font-medium">{t.title}</p>
                        {t.notes && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{t.notes}</p>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <Badge style={{
                          background: `${CATEGORY_COLORS[t.category] || '#94a3b8'}20`,
                          color: CATEGORY_COLORS[t.category] || '#94a3b8',
                        }}>
                          {t.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <Badge variant={t.type === 'income' ? 'success' : 'destructive'}>
                          {t.type === 'income'
                            ? <TrendingUp   className="w-3 h-3 mr-1 inline" />
                            : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground capitalize text-xs whitespace-nowrap">
                        {t.payment_method?.replace('_', ' ') || '—'}
                      </td>
                      <td className={`px-6 py-3.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                        t.type === 'income' ? 'text-success' : 'text-destructive'
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, getAccountCurrency(t.account_id))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
                Showing {filtered.length} of {transactions.length} transactions
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}