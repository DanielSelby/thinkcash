'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, PiggyBank, Wallet, Activity, Heart,
  Plus, ArrowUpDown, Target, BarChart3, FileDown,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { TrendChart, SpendingPieChart, SavingsChart } from '@/components/charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/misc'
import { Progress } from '@/components/ui/misc'
import {
  formatCurrency, CATEGORY_COLORS, calculateHealthScore,
  getHealthScoreColor, getHealthScoreLabel, getBudgetStatus,
} from '@/lib/utils'
import { useAppStore } from '@/store'
import type { Income, Expense, Budget, SavingsGoal, Profile } from '@/types'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'

interface Props {
  incomes: Income[]
  expenses: Expense[]
  budgets: Budget[]
  goals: SavingsGoal[]
  profile: Profile | null
}

export function DashboardContent({ incomes, expenses, budgets, goals, profile }: Props) {
  const { setProfile } = useAppStore()

  useEffect(() => {
    if (profile) setProfile(profile)
  }, [profile, setProfile])

  const totalIncome = useMemo(() => incomes.reduce((s, i) => s + i.amount, 0), [incomes])
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses])
  const savings = totalIncome - totalExpenses
  const healthScore = calculateHealthScore(totalIncome, totalExpenses, savings, 75)

  // Category breakdown for pie
  const categorySpending = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        color: CATEGORY_COLORS[category] || '#94a3b8',
      }))
  }, [expenses, totalExpenses])

  // Mock 6-month trend (replace with real DB query)
  const trendData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const isCurrentMonth = i === 5
      return {
        month: format(d, 'MMM'),
        income: isCurrentMonth ? totalIncome : Math.random() * 3000 + 2000,
        expenses: isCurrentMonth ? totalExpenses : Math.random() * 2000 + 1500,
        savings: isCurrentMonth ? savings : Math.random() * 1000 + 200,
      }
    }), [totalIncome, totalExpenses, savings])

  // Budget status
  const budgetWithSpent = useMemo(() => budgets.map(b => {
    const spent = expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0)
    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
    return { ...b, spent, remaining: b.monthly_limit - spent, percentage: pct }
  }), [budgets, expenses])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="gradient-text">{profile?.full_name?.split(' ')[0] || 'there'}</span> 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here's your financial overview for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/reports"><FileDown className="w-4 h-4" />Export</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/expenses"><Plus className="w-4 h-4" />Add Expense</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Total Income" value={totalIncome} icon={TrendingUp} color="success" change={5.2} changeLabel="vs last month" />
        <StatCard title="Total Expenses" value={totalExpenses} icon={TrendingDown} color="destructive" change={-2.1} changeLabel="vs last month" />
        <StatCard title="Net Savings" value={savings} icon={PiggyBank} color="default" />
        <StatCard title="Net Cash Flow" value={savings} icon={Activity} color={savings >= 0 ? 'success' : 'destructive'} />
        <StatCard title="Budgets Active" value={budgets.length} icon={Wallet} color="warning" isCurrency={false} />
        <div className="glass-card rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Health Score</p>
            <p className={`font-display text-2xl font-bold tabular-nums ${getHealthScoreColor(healthScore)}`}>
              {healthScore}<span className="text-base font-normal">/100</span>
            </p>
            <Badge variant={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'destructive'} className="mt-1 text-xs">
              {getHealthScoreLabel(healthScore)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingPieChart data={categorySpending} />
            <div className="mt-2 space-y-1">
              {categorySpending.slice(0, 4).map(c => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="capitalize text-muted-foreground">{c.category}</span>
                  </div>
                  <span className="font-medium tabular-nums">{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Status */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Budget Status</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/budgets">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgetWithSpent.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No budgets set. <Link href="/budgets" className="text-primary hover:underline">Create one</Link>
              </div>
            ) : budgetWithSpent.slice(0, 5).map(b => {
              const status = getBudgetStatus(b.percentage!)
              return (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">{b.budget_name || b.category}</span>
                    <span className={
                      status === 'exceeded' ? 'text-destructive' :
                      status === 'warning' ? 'text-warning' : 'text-muted-foreground'
                    }>
                      {formatCurrency(b.spent!)} / {formatCurrency(b.monthly_limit)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(b.percentage!, 100)}
                    className={`h-1.5 ${
                      status === 'exceeded' ? '[&>div]:bg-destructive' :
                      status === 'warning' ? '[&>div]:bg-warning' : ''
                    }`}
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Savings Goals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Savings Goals</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/savings">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No goals yet. <Link href="/savings" className="text-primary hover:underline">Set a goal</Link>
              </div>
            ) : goals.slice(0, 4).map(g => {
              const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
              return (
                <div key={g.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{g.goal_name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                    </span>
                  </div>
                  <Progress value={Math.min(pct, 100)} />
                  <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% complete</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {[
              { href: '/income', icon: TrendingUp, label: 'Add Income', color: 'text-success' },
              { href: '/expenses', icon: TrendingDown, label: 'Add Expense', color: 'text-destructive' },
              { href: '/budgets', icon: Wallet, label: 'Create Budget', color: 'text-warning' },
              { href: '/savings', icon: PiggyBank, label: 'Add Goal', color: 'text-primary' },
              { href: '/reports', icon: BarChart3, label: 'View Report', color: 'text-accent' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-accent/5 hover:border-accent/30 transition-all group text-center">
                <Icon className={`w-5 h-5 ${color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">{label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
