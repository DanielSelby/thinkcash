'use client'

import { useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'
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
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GH', {
    style: 'currency', currency: 'GHS', maximumFractionDigits: 0,
  }).format(n)

function KPI({
  label, value, sub, colorClass, icon: Icon,
}: {
  label: string; value: string; sub?: string; colorClass: string; icon: any
}) {
  return (
    <Card className={`${colorClass} rounded-xl shadow-sm border border-border`}>
      <CardContent className="pt-4 pb-4 px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 truncate">
              {label}
            </p>
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

export function DashboardContent({ incomes, expenses, budgets, goals, profile }: Props) {
  const { setProfile, activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  useEffect(() => {
    if (profile) setProfile(profile)
  }, [profile])

  const totalIncome  = useMemo(() => incomes.reduce((s, r)  => s + Number(r.amount), 0), [incomes])
  const totalExpense = useMemo(() => expenses.reduce((s, r) => s + Number(r.amount), 0), [expenses])
  const net          = totalIncome - totalExpense
  const savingsRate  = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0

  // Chart: built purely from fetched data — no hardcoded/demo rows
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {}
    incomes.forEach(r => {
      const d = r.date?.slice(0, 10) ?? ''
      if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
      map[d].income += Number(r.amount)
    })
    expenses.forEach(r => {
      const d = r.date?.slice(0, 10) ?? ''
      if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
      map[d].expense += Number(r.amount)
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(r => ({
        ...r,
        label: new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }),
      }))
  }, [incomes, expenses])

  // Budget bars
  const budgetData = useMemo(() =>
    budgets.map(b => {
      const spent = expenses
        .filter(e => e.category === b.category)
        .reduce((s, e) => s + Number(e.amount), 0)
      return {
        name: b.category,
        budget: Number(b.amount),
        spent,
        pct: Number(b.amount) > 0 ? Math.round((spent / Number(b.amount)) * 100) : 0,
      }
    }), [budgets, expenses])

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold" style={{ color: theme.colors.primary }}>
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Financial snapshot for{' '}
          {new Date().toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards — UCT style, colored top border, colored value */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          label="Total Income" value={fmt(totalIncome)}
          sub="This month" colorClass="kpi-green" icon={TrendingUp}
        />
        <KPI
          label="Total Expenses" value={fmt(totalExpense)}
          sub="This month" colorClass="kpi-red" icon={TrendingDown}
        />
        <KPI
          label="Net Balance" value={fmt(net)}
          sub={net >= 0 ? 'Surplus ✓' : 'Deficit ✗'} colorClass="kpi-blue" icon={Wallet}
        />
        <KPI
          label="Savings Rate" value={`${savingsRate}%`}
          sub="Of income saved" colorClass="kpi-purple" icon={Target}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Income vs Expense area chart */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Income vs Expenses</CardTitle>
            <p className="text-xs text-muted-foreground">
              {chartData.length === 0
                ? 'No transactions recorded yet this month'
                : `${chartData.length} day(s) with activity`}
            </p>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-30" />
                <p className="text-sm">Add income or expenses to see your chart</p>
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
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₵${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Area
                    type="monotone" dataKey="income" stroke="#16a34a"
                    fill="url(#gInc)" strokeWidth={2} name="Income"
                  />
                  <Area
                    type="monotone" dataKey="expense" stroke="#dc2626"
                    fill="url(#gExp)" strokeWidth={2} name="Expense"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Budget usage bar chart */}
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Budget Usage</CardTitle>
            <p className="text-xs text-muted-foreground">
              {budgetData.length === 0 ? 'No budgets set yet' : `${budgetData.length} active budget(s)`}
            </p>
          </CardHeader>
          <CardContent>
            {budgetData.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Wallet className="w-8 h-8 opacity-30" />
                <p className="text-sm">Create a budget to track spending</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={budgetData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₵${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Bar dataKey="budget" fill={theme.colors.primaryLight} name="Budget" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="spent"  fill={theme.colors.accent}       name="Spent"  radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {incomes.length === 0 && expenses.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No transactions this month yet
            </p>
          ) : (
            [...incomes.map(r => ({ ...r, _type: 'income' })),
             ...expenses.map(r => ({ ...r, _type: 'expense' }))]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 8)
              .map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      r._type === 'income' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
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
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${
                    r._type === 'income' ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {r._type === 'income' ? '+' : '−'}{fmt(Number(r.amount))}
                  </span>
                </div>
              ))
          )}
        </CardContent>
      </Card>

      {/* Savings Goals */}
      {goals.length > 0 && (
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Savings Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((g, i) => {
              const pct = Math.min(100, Number(g.target_amount) > 0
                ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)
                : 0)
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {pct}% · {fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: theme.colors.primary }}
                    />
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