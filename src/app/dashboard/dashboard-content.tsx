'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, Wallet, Target,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes: any[]
  expenses: any[]
  budgets: any[]
  goals: any[]
  profile: any
  from: string
  to: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(n)

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const INCOME_CATS  = ['All','Salary','Freelance','Business','Investment','Rental','Gift','Bonus','Other']
const EXPENSE_CATS = ['All','Food & Dining','Transport','Housing','Utilities','Healthcare','Education','Entertainment','Shopping','Clothing','Personal Care','Savings','Debt Payment','Insurance','Travel','Other']

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

function KPI({ label, value, sub, colorClass, icon: Icon }: {
  label: string; value: string; sub?: string; colorClass: string; icon: any
}) {
  return (
    <Card className={`${colorClass} rounded-xl shadow-sm border border-border bg-white`}>
      <CardContent className="pt-4 pb-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="kpi-value text-2xl font-bold tabular-nums leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardContent({ incomes, expenses, budgets, goals, profile, from, to }: Props) {
  const { setProfile, activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const router = useRouter()

  const now = new Date()
  const [localFrom,    setLocalFrom]    = useState(from)
  const [localTo,      setLocalTo]      = useState(to)
  const [selMonth,     setSelMonth]     = useState('')
  const [selYear,      setSelYear]      = useState(String(now.getFullYear()))
  const [incomeCat,    setIncomeCat]    = useState('All')
  const [expenseCat,   setExpenseCat]   = useState('All')

  useEffect(() => { if (profile) setProfile(profile) }, [profile])

  const apply = (f: string, t: string) => router.push(`/dashboard?from=${f}&to=${t}`)

  const handleMonthChange = (m: string) => {
    setSelMonth(m)
    if (!m) return
    const yr  = Number(selYear)
    const mo  = MONTHS.indexOf(m)
    const f   = new Date(yr, mo, 1).toISOString().split('T')[0]
    const t   = new Date(yr, mo + 1, 0).toISOString().split('T')[0]
    setLocalFrom(f); setLocalTo(t); apply(f, t)
  }

  const handleYearChange = (y: string) => {
    setSelYear(y)
    const yr = Number(y)
    if (selMonth) {
      const mo = MONTHS.indexOf(selMonth)
      const f  = new Date(yr, mo, 1).toISOString().split('T')[0]
      const t  = new Date(yr, mo + 1, 0).toISOString().split('T')[0]
      setLocalFrom(f); setLocalTo(t); apply(f, t)
    } else {
      const f = `${yr}-01-01`; const t = `${yr}-12-31`
      setLocalFrom(f); setLocalTo(t); apply(f, t)
    }
  }

  const handleFromTo = () => apply(localFrom, localTo)

  const reset = () => {
    const f = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const t = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setLocalFrom(f); setLocalTo(t); setSelMonth(''); setSelYear(String(now.getFullYear()))
    setIncomeCat('All'); setExpenseCat('All')
    apply(f, t)
  }

  // Filter by category client-side
  const filteredIncomes  = useMemo(() =>
    incomeCat  === 'All' ? incomes  : incomes.filter(r  => r.category === incomeCat),  [incomes,  incomeCat])
  const filteredExpenses = useMemo(() =>
    expenseCat === 'All' ? expenses : expenses.filter(r => r.category === expenseCat), [expenses, expenseCat])

  const totalIncome  = useMemo(() => filteredIncomes.reduce((s, r)  => s + Number(r.amount), 0), [filteredIncomes])
  const totalExpense = useMemo(() => filteredExpenses.reduce((s, r) => s + Number(r.amount), 0), [filteredExpenses])
  const net         = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {}
    filteredIncomes.forEach(r  => { const d = r.date?.slice(0,10) ?? ''; if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }; map[d].income  += Number(r.amount) })
    filteredExpenses.forEach(r => { const d = r.date?.slice(0,10) ?? ''; if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }; map[d].expense += Number(r.amount) })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({ ...r, label: new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) }))
  }, [filteredIncomes, filteredExpenses])

  const budgetData = useMemo(() =>
    budgets.map(b => {
      const spent = filteredExpenses.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
      return { name: b.category, budget: Number(b.amount), spent }
    }), [budgets, filteredExpenses])

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const selectCls = `h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2 cursor-pointer`
  const dateCls   = `h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2`

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
          Overview Dashboard
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {greeting}, {firstName} · {fmt(totalIncome)} income · {fmt(totalExpense)} expenses
        </p>
      </div>

      {/* ── UCT-style Filter Bar ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white rounded-xl border border-border shadow-sm">

        {/* FROM */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
          <input type="date" value={localFrom} onChange={e => setLocalFrom(e.target.value)}
            className={dateCls} />
        </div>

        {/* TO */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
          <input type="date" value={localTo} onChange={e => setLocalTo(e.target.value)}
            className={dateCls} />
        </div>

        {/* MONTH */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Month</label>
          <select value={selMonth} onChange={e => handleMonthChange(e.target.value)} className={selectCls}>
            <option value="">All Months</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* YEAR */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</label>
          <select value={selYear} onChange={e => handleYearChange(e.target.value)} className={selectCls}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* INCOME CATEGORY */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Income Cat.</label>
          <select value={incomeCat} onChange={e => setIncomeCat(e.target.value)} className={selectCls}>
            {INCOME_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* EXPENSE CATEGORY */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Expense Cat.</label>
          <select value={expenseCat} onChange={e => setExpenseCat(e.target.value)} className={selectCls}>
            {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Apply + Reset */}
        <div className="flex gap-2 pb-0.5">
          <button
            onClick={handleFromTo}
            style={{ background: theme.colors.primary }}
            className="h-8 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Apply
          </button>
          <button
            onClick={reset}
            className="h-8 px-3 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Income"   value={fmt(totalIncome)}  sub="Selected period"              colorClass="kpi-green"  icon={TrendingUp}   />
        <KPI label="Total Expenses" value={fmt(totalExpense)} sub="Selected period"              colorClass="kpi-red"    icon={TrendingDown}  />
        <KPI label="Net Balance"    value={fmt(net)}          sub={net >= 0 ? 'Surplus ✓' : 'Deficit ✗'} colorClass="kpi-blue" icon={Wallet} />
        <KPI label="Savings Rate"   value={`${savingsRate}%`} sub="Of income saved"              colorClass="kpi-purple" icon={Target}        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Income vs Expenses</CardTitle>
            <p className="text-xs text-muted-foreground">
              {chartData.length === 0 ? 'No transactions in this period' : `${chartData.length} day(s) with activity`}
            </p>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <p className="text-sm">No data for selected range</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Area type="monotone" dataKey="income"  stroke="#16a34a" fill="url(#gInc)" strokeWidth={2} name="Income"  />
                  <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExp)" strokeWidth={2} name="Expense" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Budget Usage</CardTitle>
            <p className="text-xs text-muted-foreground">
              {budgetData.length === 0 ? 'No budgets set yet' : `${budgetData.length} active budget(s)`}
            </p>
          </CardHeader>
          <CardContent>
            {budgetData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Wallet className="w-8 h-8 opacity-20" />
                <p className="text-sm">Create a budget to track spending</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={budgetData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="budget" fill={theme.colors.primaryLight} name="Budget" radius={[0,4,4,0]} />
                  <Bar dataKey="spent"  fill={theme.colors.accent}       name="Spent"  radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredIncomes.length === 0 && filteredExpenses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions in this period</p>
          ) : (
            [...filteredIncomes.map(r => ({ ...r, _type: 'income' })),
             ...filteredExpenses.map(r => ({ ...r, _type: 'expense' }))]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 8)
              .map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${r._type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                      {r._type === 'income'
                        ? <ArrowUpRight   className="w-4 h-4 text-green-600" />
                        : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.description || r.category || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                        {r.category ? ` · ${r.category}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${r._type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {r._type === 'income' ? '+' : '−'}{fmt(Number(r.amount))}
                  </span>
                </div>
              ))
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
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-muted-foreground tabular-nums">
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