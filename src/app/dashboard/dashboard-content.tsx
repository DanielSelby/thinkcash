'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Target,
  ArrowUpRight, ArrowDownRight, RefreshCw, SlidersHorizontal, X,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'

interface Props {
  accounts:  any[]
  transfers: any[]
  incomes:   any[]
  expenses:  any[]
  budgets:   any[]
  goals:     any[]
  profile:   any
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const INCOME_CATS  = ['All','Salary','Freelance','Business','Investment','Rental','Gift','Bonus','Other']
const EXPENSE_CATS = ['All','Food & Dining','Transport','Housing','Utilities','Healthcare',
                      'Education','Entertainment','Shopping','Clothing','Personal Care',
                      'Savings','Debt Payment','Insurance','Travel','Other']
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: '#2563eb', mobile_money: '#f59e0b', cash: '#16a34a', investment: '#7c3aed',
}
const DONUT_COLORS = ['#16a34a','#2563eb','#7c3aed','#f59e0b','#dc2626','#0d9488','#db2777','#65a30d']

export function KPICard({ label, value, sub, colorClass, icon: Icon, tooltip }: {
  label: string; value: string; sub?: string
  colorClass: string; icon: any; tooltip?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Card
      className={`${colorClass} rounded-xl shadow-sm border border-border bg-white overflow-visible relative`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <CardContent className="p-3 sm:p-5 overflow-hidden">
        <div className="flex items-start justify-between gap-1 sm:gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5 sm:mb-1 leading-tight">
              {label}
            </p>
            <p className="kpi-value text-sm sm:text-2xl font-bold tabular-nums leading-tight break-all">
              {value}
            </p>
            {sub && (
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{sub}</p>
            )}
          </div>
          <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
      {tooltip && hovered && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full z-50 w-60 pointer-events-none hidden sm:block">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-pre-line">
            {tooltip}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </Card>
  )
}

const DonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null
  const R = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * R)
  const y = cy + r * Math.sin(-midAngle * R)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function DashboardContent({ accounts, transfers, incomes, expenses, budgets, goals, profile }: Props) {
  const { setProfile, activeTheme, currency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const fmt      = useMemo(() => (n: number) => formatCurrency(n, currency), [currency])
  const shortFmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
    return String(Math.round(v))
  }

  useEffect(() => { if (profile) setProfile(profile) }, [profile])

  const [showFilter,        setShowFilter]        = useState(false)
  const [localFrom,         setLocalFrom]         = useState('')
  const [localTo,           setLocalTo]           = useState('')
  const [selMonth,          setSelMonth]          = useState('')
  const [selYear,           setSelYear]           = useState('')
  const [incomeCat,         setIncomeCat]         = useState('All')
  const [expenseCat,        setExpenseCat]        = useState('All')
  const [isFiltered,        setIsFiltered]        = useState(false)
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [activeDonutIndex,  setActiveDonutIndex]  = useState<number | null>(null)

  // Account balances including transfers
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome  = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn  = transfers.filter(t => t.to_account_id   === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const balance      = acc.opening_balance + totalIncome - totalExpense - transfersOut + transfersIn
      return { ...acc, total_income: totalIncome, total_expenses: totalExpense, transfers_in: transfersIn, transfers_out: transfersOut, balance }
    }), [accounts, incomes, expenses, transfers])

  const setFrom   = (v: string) => { setLocalFrom(v);  setIsFiltered(true) }
  const setTo     = (v: string) => { setLocalTo(v);    setIsFiltered(true) }
  const setIncCat = (v: string) => { setIncomeCat(v);  setIsFiltered(true) }
  const setExpCat = (v: string) => { setExpenseCat(v); setIsFiltered(true) }

  const handleMonthChange = (m: string) => {
    setSelMonth(m)
    if (m) {
      const yr = Number(selYear || new Date().getFullYear())
      const mo = MONTHS.indexOf(m)
      setLocalFrom(new Date(yr, mo, 1).toISOString().split('T')[0])
      setLocalTo(new Date(yr, mo + 1, 0).toISOString().split('T')[0])
    }
    setIsFiltered(true)
  }

  const handleYearChange = (y: string) => {
    setSelYear(y)
    const yr = Number(y)
    if (selMonth) {
      const mo = MONTHS.indexOf(selMonth)
      setLocalFrom(new Date(yr, mo, 1).toISOString().split('T')[0])
      setLocalTo(new Date(yr, mo + 1, 0).toISOString().split('T')[0])
    } else {
      setLocalFrom(`${yr}-01-01`)
      setLocalTo(`${yr}-12-31`)
    }
    setIsFiltered(true)
  }

  const clearFilter = () => {
    setLocalFrom(''); setLocalTo('')
    setSelMonth('');  setSelYear('')
    setIncomeCat('All'); setExpenseCat('All')
    setIsFiltered(false); setShowFilter(false)
  }

  const filteredIncomes = useMemo(() => {
    let data = incomes
    if (isFiltered) {
      if (localFrom)           data = data.filter(r => r.date >= localFrom)
      if (localTo)             data = data.filter(r => r.date <= localTo)
      if (incomeCat !== 'All') data = data.filter(r => r.category === incomeCat)
    }
    return data
  }, [incomes, isFiltered, localFrom, localTo, incomeCat])

  const filteredExpenses = useMemo(() => {
    let data = expenses
    if (isFiltered) {
      if (localFrom)            data = data.filter(r => r.date >= localFrom)
      if (localTo)              data = data.filter(r => r.date <= localTo)
      if (expenseCat !== 'All') data = data.filter(r => r.category === expenseCat)
    }
    return data
  }, [expenses, isFiltered, localFrom, localTo, expenseCat])

  // ── Currency-aware totals ─────────────────────────────────────────
  // Only sum transactions in the app's selected currency
  // Show mixed-currency note when accounts differ
  const getTransactionCurrency = (r: any) =>
    accounts.find(a => a.id === r.account_id)?.currency || currency

  const incomeByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, currency])

  const expenseByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(r => {
      const cur = getTransactionCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredExpenses, accounts, currency])

  const hasMixedIncome   = Object.keys(incomeByCurrency).length  > 1
  const hasMixedExpense  = Object.keys(expenseByCurrency).length > 1

  // For KPI display — primary currency total only
  const totalIncome  = incomeByCurrency[currency]  ?? Object.values(incomeByCurrency)[0]  ?? 0
  const totalExpense = expenseByCurrency[currency] ?? Object.values(expenseByCurrency)[0] ?? 0
  const net          = totalIncome - totalExpense
  const savingsRate  = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => {
      const cat = r.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(r.amount)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredIncomes])

  // Chart groups by month — primary currency only for clean chart
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {}
    filteredIncomes
      .filter(r => getTransactionCurrency(r) === currency)
      .forEach(r => {
        const d = (r.date ?? '').slice(0, 7); if (!d) return
        if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
        map[d].income += Number(r.amount)
      })
    filteredExpenses
      .filter(r => getTransactionCurrency(r) === currency)
      .forEach(r => {
        const d = (r.date ?? '').slice(0, 7); if (!d) return
        if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
        map[d].expense += Number(r.amount)
      })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        ...r,
        label: new Date(r.date + '-01').toLocaleDateString('en-GH', { month: 'short', year: '2-digit' }),
      }))
  }, [filteredIncomes, filteredExpenses, accounts, currency])

  const budgetData = useMemo(() =>
    budgets.map(b => {
      const spent = filteredExpenses.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
      return { name: b.category, budget: Number(b.amount), spent }
    }), [budgets, filteredExpenses])

  // Account total balance — grouped by currency, never summed across
  const visibleAccounts = accountsWithBalance.filter(a => accountTypeFilter === 'all' || a.type === accountTypeFilter)
  const balanceByCurrency: Record<string, number> = {}
  visibleAccounts.forEach(a => {
    const cur = a.currency || 'GHS'
    balanceByCurrency[cur] = (balanceByCurrency[cur] || 0) + Number(a.balance ?? 0)
  })
  const balanceCurrencies = Object.keys(balanceByCurrency)

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const selectCls = 'h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1 cursor-pointer'
  const dateCls   = 'h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1'

  const filterLabel = isFiltered
    ? `${localFrom || 'Start'} → ${localTo || 'End'}${incomeCat !== 'All' ? ` · Inc: ${incomeCat}` : ''}${expenseCat !== 'All' ? ` · Exp: ${expenseCat}` : ''}`
    : 'All time'

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {greeting}, {firstName} ·{' '}
            <span className={isFiltered ? 'text-orange-500 font-medium' : ''}>{filterLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button onClick={clearFilter}
              className="flex items-center gap-1 text-xs text-orange-500 border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
              <X className="w-3 h-3" /> Clear Filter
            </button>
          )}
          <button onClick={() => setShowFilter(v => !v)}
            style={{ background: isFiltered ? theme.colors.accent : theme.colors.primary }}
            className="flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity">
            <SlidersHorizontal className="w-3 h-3" />
            {isFiltered ? 'Edit Filter' : 'Filter'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Filter Transactions</p>
              <button onClick={() => setShowFilter(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
                <input type="date" value={localFrom} onChange={e => setFrom(e.target.value)} className={dateCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
                <input type="date" value={localTo} onChange={e => setTo(e.target.value)} className={dateCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Month</label>
                <select value={selMonth} onChange={e => handleMonthChange(e.target.value)} className={selectCls}>
                  <option value="">All Months</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</label>
                <select value={selYear} onChange={e => handleYearChange(e.target.value)} className={selectCls}>
                  <option value="">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Income Cat.</label>
                <select value={incomeCat} onChange={e => setIncCat(e.target.value)} className={selectCls}>
                  {INCOME_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Expense Cat.</label>
                <select value={expenseCat} onChange={e => setExpCat(e.target.value)} className={selectCls}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={clearFilter}
                className="h-8 px-3 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:text-foreground flex items-center gap-1 mb-0.5">
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <KPICard label="Total Income" colorClass="kpi-green" icon={TrendingUp}
          value={hasMixedIncome
            ? Object.entries(incomeByCurrency).map(([c, v]) => formatCurrency(v, c)).join(' + ')
            : fmt(totalIncome)}
          sub={`${filteredIncomes.length} txns`}
          tooltip={`${filteredIncomes.length} transaction(s)\n${hasMixedIncome ? Object.entries(incomeByCurrency).map(([c,v]) => `${c}: ${formatCurrency(v,c)}`).join('\n') : fmt(totalIncome)}`}
        />
        <KPICard label="Total Expenses" colorClass="kpi-red" icon={TrendingDown}
          value={hasMixedExpense
            ? Object.entries(expenseByCurrency).map(([c, v]) => formatCurrency(v, c)).join(' + ')
            : fmt(totalExpense)}
          sub={`${filteredExpenses.length} txns`}
          tooltip={`${filteredExpenses.length} transaction(s)\n${hasMixedExpense ? Object.entries(expenseByCurrency).map(([c,v]) => `${c}: ${formatCurrency(v,c)}`).join('\n') : fmt(totalExpense)}`}
        />
        <KPICard label="Net Balance" colorClass="kpi-blue" icon={Wallet}
          value={fmt(net)}
          sub={net >= 0 ? 'Surplus ✓' : 'Deficit ✗'}
          tooltip={hasMixedIncome || hasMixedExpense
            ? `Primary currency (${currency}) only`
            : `${fmt(totalIncome)} − ${fmt(totalExpense)} = ${fmt(net)}`}
        />
        <KPICard label="Savings Rate" colorClass="kpi-purple" icon={Target}
          value={`${savingsRate}%`}
          sub="Of income saved"
          tooltip={`${savingsRate}% saved · Net ${fmt(net)} ÷ Income ${fmt(totalIncome)}`}
        />
      </div>

      {/* Account Balances */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">Account Balances</p>
            <div className="flex gap-1.5 flex-wrap">
              {['all', 'bank', 'mobile_money', 'cash', 'investment'].map(type => (
                <button key={type} onClick={() => setAccountTypeFilter(type)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors border whitespace-nowrap ${
                    accountTypeFilter === type ? 'text-white border-transparent' : 'border-border bg-white text-muted-foreground hover:border-primary/50'
                  }`}
                  style={accountTypeFilter === type ? { background: theme.colors.primary } : {}}>
                  {type === 'mobile_money' ? 'MoMo' : type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {accountsWithBalance
              .filter(a => accountTypeFilter === 'all' || a.type === accountTypeFilter)
              .map(acc => {
                const color = ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
                return (
                  <Card key={acc.id} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                    <div className="h-1" style={{ background: color }} />
                    <CardContent className="p-2.5 sm:p-4">
                      <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{acc.name}</p>
                      <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5 sm:mt-1 truncate" style={{ color }}>
                        {formatCurrency(acc.balance ?? 0, acc.currency)}
                      </p>
                      <div className="flex justify-between text-[10px] sm:text-xs mt-1 sm:mt-2 gap-1">
                        <span className="text-green-600 truncate">+{formatCurrency(acc.total_income ?? 0, acc.currency)}</span>
                        <span className="text-red-500 truncate">-{formatCurrency(acc.total_expenses ?? 0, acc.currency)}</span>
                      </div>
                      {((acc.transfers_in ?? 0) > 0 || (acc.transfers_out ?? 0) > 0) && (
                        <div className="flex justify-between text-[10px] sm:text-xs mt-0.5 sm:mt-1 gap-1">
                          {(acc.transfers_in  ?? 0) > 0 && <span className="text-blue-500 truncate">↙{formatCurrency(acc.transfers_in  ?? 0, acc.currency)}</span>}
                          {(acc.transfers_out ?? 0) > 0 && <span className="text-orange-500 truncate">↗{formatCurrency(acc.transfers_out ?? 0, acc.currency)}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
          </div>

          {/* Total balance — never mix currencies */}
          <div className="px-3 sm:px-4 py-3 bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs sm:text-sm font-semibold">
                Total Balance
                {accountTypeFilter !== 'all' && (
                  <span className="text-muted-foreground font-normal ml-1 capitalize">
                    ({accountTypeFilter === 'mobile_money' ? 'MoMo' : accountTypeFilter})
                  </span>
                )}
              </p>
              {balanceCurrencies.length === 1 ? (
                <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: theme.colors.primary }}>
                  {formatCurrency(balanceByCurrency[balanceCurrencies[0]], balanceCurrencies[0])}
                </p>
              ) : (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end">
                  {balanceCurrencies.map(cur => (
                    <span key={cur} className="text-sm sm:text-base font-bold tabular-nums" style={{ color: theme.colors.primary }}>
                      {formatCurrency(balanceByCurrency[cur], cur)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {balanceCurrencies.length > 1 && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                Shown separately per currency — amounts are not combined
              </p>
            )}
          </div>
        </div>
      )}

      {/* Area Chart */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Income vs Expenses by Month</CardTitle>
          <p className="text-xs text-muted-foreground">
            {chartData.length === 0
              ? hasMixedIncome
                ? `No ${currency} transactions yet (chart shows ${currency} only)`
                : 'No transactions yet'
              : `${chartData.length} month(s) · ${currency} only`}
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <TrendingUp className="w-8 h-8 opacity-20" />
              <p className="text-sm">Add income or expenses to see your chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Area type="monotone" dataKey="income"  stroke="#16a34a" fill="url(#gInc)" strokeWidth={2} name="Income"  dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExp)" strokeWidth={2} name="Expense" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Budget + Donut side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Budget Usage</CardTitle>
            <p className="text-xs text-muted-foreground">
              {budgetData.length === 0 ? 'No budgets set yet' : `${budgetData.length} active budget(s)`}
            </p>
          </CardHeader>
          <CardContent>
            {budgetData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Wallet className="w-8 h-8 opacity-20" />
                <p className="text-sm">Create a budget to track spending</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={budgetData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="budget" fill={theme.colors.primaryLight} name="Budget" radius={[0,4,4,0]} />
                  <Bar dataKey="spent"  fill={theme.colors.accent}       name="Spent"  radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Income by Category</CardTitle>
            <p className="text-xs text-muted-foreground">
              {incomeByCategory.length === 0 ? 'No income yet'
                : `${incomeByCategory.length} categor${incomeByCategory.length === 1 ? 'y' : 'ies'}`}
            </p>
          </CardHeader>
          <CardContent>
            {incomeByCategory.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <p className="text-sm">Add income to see the breakdown</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    labelLine={false}
                    label={DonutLabel}
                    animationDuration={500}
                    onClick={(_, i) => setActiveDonutIndex(p => p === i ? null : i)}
                  >
                    {incomeByCategory.map((_, i) => (
                      <Cell key={i}
                        fill={activeDonutIndex !== null && activeDonutIndex !== i
                          ? DONUT_COLORS[i % DONUT_COLORS.length] + '66'
                          : DONUT_COLORS[i % DONUT_COLORS.length]}
                        stroke="#fff" strokeWidth={2} style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [fmt(Number(v)), name]} />
                  <Legend layout="horizontal" align="center" verticalAlign="bottom" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
            <span className="text-xs text-muted-foreground">
              {filteredIncomes.length + filteredExpenses.length} total
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredIncomes.length === 0 && filteredExpenses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
          ) : (
            [...filteredIncomes.map(r  => ({ ...r, _type: 'income'  })),
             ...filteredExpenses.map(r => ({ ...r, _type: 'expense' }))]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 10)
              .map((r, i) => {
                const txCurrency = getTransactionCurrency(r)
                return (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        r._type === 'income' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {r._type === 'income'
                          ? <ArrowUpRight   className="w-3.5 h-3.5 text-green-600" />
                          : <ArrowDownRight className="w-3.5 h-3.5 text-red-500"  />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">
                          {r.description || r.title || r.category || '—'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {r.category ? ` · ${r.category}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs sm:text-sm font-semibold tabular-nums flex-shrink-0 ${
                      r._type === 'income' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {r._type === 'income' ? '+' : '−'}{formatCurrency(Number(r.amount), txCurrency)}
                    </span>
                  </div>
                )
              })
          )}
        </CardContent>
      </Card>

      {/* Savings Goals */}
      {goals.length > 0 && (
        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Savings Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((g, i) => {
              const pct = Math.min(100, Number(g.target_amount) > 0
                ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0)
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs sm:text-sm mb-1.5 gap-2">
                    <span className="font-medium truncate">{g.name}</span>
                    <span className="text-muted-foreground tabular-nums flex-shrink-0">
                      {pct}% · {fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: theme.colors.primary }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}