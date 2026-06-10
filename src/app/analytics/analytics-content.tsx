'use client'

import { useMemo } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { BrainCircuit, TrendingUp, TrendingDown, AlertCircle, Lightbulb, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { TrendChart, SpendingPieChart } from '@/components/charts'
import { formatCurrency, CATEGORY_COLORS, calculateHealthScore, getHealthScoreLabel, getHealthScoreColor } from '@/lib/utils'
import type { Income, Expense } from '@/types'

interface Props { incomes: Income[]; expenses: Expense[] }

export function AnalyticsContent({ incomes, expenses }: Props) {
  const now = new Date()

  // Monthly breakdown for last 6 months
  const monthlyData = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    const mStart = format(startOfMonth(d), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(d), 'yyyy-MM-dd')
    const inc = incomes.filter(x => x.date >= mStart && x.date <= mEnd).reduce((s, x) => s + x.amount, 0)
    const exp = expenses.filter(x => x.date >= mStart && x.date <= mEnd).reduce((s, x) => s + x.amount, 0)
    return { month: format(d, 'MMM'), income: inc, expenses: exp, savings: inc - exp }
  }), [incomes, expenses])

  const currentMonth = monthlyData[5]
  const prevMonth = monthlyData[4]

  // Category spending for pie chart
  const categorySpending = useMemo(() => {
    const mStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    const monthExpenses = expenses.filter(e => e.date >= mStart && e.date <= mEnd)
    const total = monthExpenses.reduce((s, e) => s + e.amount, 0)
    const map: Record<string, number> = {}
    monthExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([category, amount]) => ({
      category, amount, percentage: total > 0 ? (amount / total) * 100 : 0,
      color: CATEGORY_COLORS[category] || '#94a3b8',
    }))
  }, [expenses])

  const totalIncome = currentMonth.income
  const totalExpenses = currentMonth.expenses
  const savings = currentMonth.savings
  const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0
  const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0
  const healthScore = calculateHealthScore(totalIncome, totalExpenses, savings, 75)

  const expenseChange = prevMonth.expenses > 0 ? ((totalExpenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0
  const incomeChange = prevMonth.income > 0 ? ((totalIncome - prevMonth.income) / prevMonth.income) * 100 : 0

  // Top spending category
  const topCategory = categorySpending[0]

  // AI-style insights
  const insights = useMemo(() => {
    const list: { type: 'positive' | 'warning' | 'info'; message: string }[] = []

    if (expenseChange > 10) list.push({ type: 'warning', message: `Your spending increased by ${expenseChange.toFixed(0)}% this month compared to last month.` })
    if (expenseChange < -5) list.push({ type: 'positive', message: `Great job! Your spending decreased by ${Math.abs(expenseChange).toFixed(0)}% compared to last month.` })
    if (topCategory) list.push({ type: 'info', message: `${topCategory.category.charAt(0).toUpperCase() + topCategory.category.slice(1)} accounts for ${topCategory.percentage.toFixed(0)}% of your monthly spending at ${formatCurrency(topCategory.amount)}.` })
    if (savingsRate < 10) list.push({ type: 'warning', message: `Your savings rate is ${savingsRate.toFixed(0)}%. Financial experts recommend saving at least 20% of your income.` })
    if (savingsRate >= 20) list.push({ type: 'positive', message: `Excellent! You're saving ${savingsRate.toFixed(0)}% of your income — well above the recommended 20%.` })
    if (incomeChange > 5) list.push({ type: 'positive', message: `Your income grew by ${incomeChange.toFixed(0)}% this month. Consider putting the extra toward savings goals.` })

    const entertainmentSpend = expenses.filter(e => e.category === 'entertainment' && e.date >= format(startOfMonth(now), 'yyyy-MM-dd')).reduce((s, e) => s + e.amount, 0)
    if (entertainmentSpend > totalIncome * 0.1) {
      list.push({ type: 'info', message: `Entertainment spending (${formatCurrency(entertainmentSpend)}) is ${((entertainmentSpend / totalIncome) * 100).toFixed(0)}% of your income. Reducing it by half could save ${formatCurrency(entertainmentSpend / 2)} monthly.` })
    }

    return list
  }, [expenseChange, incomeChange, savingsRate, topCategory, totalIncome, expenses])

  const metrics = [
    { label: 'Savings Rate', value: `${savingsRate.toFixed(1)}%`, status: savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'warning' : 'destructive', description: 'Of income saved' },
    { label: 'Expense Ratio', value: `${expenseRatio.toFixed(1)}%`, status: expenseRatio <= 70 ? 'success' : expenseRatio <= 85 ? 'warning' : 'destructive', description: 'Of income spent' },
    { label: 'Health Score', value: `${healthScore}/100`, status: healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'destructive', description: getHealthScoreLabel(healthScore) },
    { label: 'Income Growth', value: `${incomeChange > 0 ? '+' : ''}${incomeChange.toFixed(1)}%`, status: incomeChange >= 0 ? 'success' : 'destructive', description: 'vs last month' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep insights into your financial behaviour</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map(m => (
          <Card key={m.label} className="p-5">
            <p className="text-sm text-muted-foreground">{m.label}</p>
            <p className={`font-display text-2xl font-bold tabular-nums mt-1 ${
              m.status === 'success' ? 'text-success' : m.status === 'warning' ? 'text-warning' : 'text-destructive'
            }`}>{m.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">6-Month Income vs Expenses Trend</CardTitle></CardHeader>
          <CardContent><TrendChart data={monthlyData} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Current Month Breakdown</CardTitle></CardHeader>
          <CardContent>
            <SpendingPieChart data={categorySpending} />
            <div className="mt-3 space-y-1.5">
              {categorySpending.slice(0, 5).map(c => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="capitalize text-muted-foreground">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">{formatCurrency(c.amount)}</span>
                    <span className="text-muted-foreground">({c.percentage.toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Financial Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Add more transactions to unlock personalized insights</p>
            </div>
          ) : insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl p-4 ${
              insight.type === 'positive' ? 'bg-success/10 border border-success/20' :
              insight.type === 'warning' ? 'bg-warning/10 border border-warning/20' :
              'bg-primary/10 border border-primary/20'
            }`}>
              {insight.type === 'positive' ? <TrendingUp className="w-4 h-4 text-success flex-shrink-0 mt-0.5" /> :
               insight.type === 'warning' ? <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" /> :
               <Lightbulb className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
              <p className="text-sm leading-relaxed">{insight.message}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Monthly comparison table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Month</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Income</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Expenses</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Savings</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Rate</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.slice().reverse().map((m, i) => {
                  const rate = m.income > 0 ? (m.savings / m.income) * 100 : 0
                  return (
                    <tr key={m.month} className={`border-b border-border last:border-0 hover:bg-muted/30 ${i === 0 ? 'bg-primary/5 font-medium' : ''}`}>
                      <td className="px-6 py-3.5">{m.month}{i === 0 && <Badge className="ml-2 text-xs" variant="default">Current</Badge>}</td>
                      <td className="px-6 py-3.5 text-right text-success tabular-nums">{formatCurrency(m.income)}</td>
                      <td className="px-6 py-3.5 text-right text-destructive tabular-nums">{formatCurrency(m.expenses)}</td>
                      <td className={`px-6 py-3.5 text-right tabular-nums ${m.savings >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(m.savings)}</td>
                      <td className={`px-6 py-3.5 text-right tabular-nums ${rate >= 20 ? 'text-success' : rate >= 10 ? 'text-warning' : 'text-destructive'}`}>{rate.toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
