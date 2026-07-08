'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  BrainCircuit, TrendingUp, TrendingDown, AlertCircle, Lightbulb, BarChart3,
  Heart, Wallet, Target, PieChart as PieChartIcon, ShieldCheck, Trophy,
  Info, Calendar, ChevronDown, AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { TrendChart, SpendingPieChart } from '@/components/charts'
import { formatCurrency, CATEGORY_COLORS, calculateHealthScore, getHealthScoreLabel, getHealthScoreColor } from '@/lib/utils'
import type { Income, Expense } from '@/types'
import { KPICard } from '@/components/ui/kpi-card'

interface Props {
  incomes: Income[]
  expenses: Expense[]
  // Optional — only needed to power the Debt Ratio and Budget Adherence
  // metrics inside the Financial Health breakdown below. If the page
  // wrapper doesn't pass these yet, those two metrics gracefully fall back
  // to "Not set up" instead of the section breaking.
  accounts?: any[]
  budgets?: any[]
}

// ── Financial Health gauge (semi-circle with colored zones + needle) ──────
const GAUGE_ZONES = [
  { from: 0,  to: 20,  color: '#ef4444' },
  { from: 20, to: 40,  color: '#f97316' },
  { from: 40, to: 60,  color: '#eab308' },
  { from: 60, to: 80,  color: '#84cc16' },
  { from: 80, to: 100, color: '#22c55e' },
]

function angleForScore(v: number) {
  return 180 - (v / 100) * 180
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function zoneArcPath(cx: number, cy: number, r: number, aFrom: number, aTo: number) {
  const p1 = polarPoint(cx, cy, r, aFrom)
  const p2 = polarPoint(cx, cy, r, aTo)
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`
}

function HealthGauge({ score, needleColor }: { score: number; needleColor: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const cx = 140, cy = 140, rTrack = 118, trackWidth = 22
  const needleAngle = angleForScore(score)
  const needleLength = rTrack - trackWidth - 8

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 320 }}>
      <svg viewBox="0 0 280 165" className="w-full h-auto overflow-visible">
        {GAUGE_ZONES.map(z => (
          <path
            key={z.from}
            d={zoneArcPath(cx, cy, rTrack, angleForScore(z.from), angleForScore(z.to))}
            stroke={z.color}
            strokeWidth={trackWidth}
            fill="none"
          />
        ))}
        {[0, 25, 50, 75, 100].map(v => {
          const p = polarPoint(cx, cy, rTrack + 18, angleForScore(v))
          return (
            <text key={v} x={p.x} y={p.y} fontSize={11} fill="#6b7280" textAnchor="middle" dominantBaseline="middle">
              {v}
            </text>
          )
        })}
        <g
          style={{
            transform: `rotate(${mounted ? -needleAngle : -180}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <line x1={cx} y1={cy} x2={cx + needleLength} y2={cy} stroke={needleColor} strokeWidth={5} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={8} fill={needleColor} />
      </svg>
      <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none" style={{ top: '48%' }}>
        <p className="text-5xl font-bold tabular-nums leading-none text-foreground">{score}</p>
        <p className="text-sm text-muted-foreground mt-1">out of 100</p>
      </div>
    </div>
  )
}

function healthStatus(score: number) {
  if (score >= 85) return { label: 'Excellent',       color: '#22c55e', bg: 'bg-green-50',  ring: 'border-green-200'  }
  if (score >= 70) return { label: 'Good',             color: '#3b82f6', bg: 'bg-blue-50',   ring: 'border-blue-200'   }
  if (score >= 50) return { label: 'Fair',             color: '#f59e0b', bg: 'bg-amber-50',  ring: 'border-amber-200'  }
  return               { label: 'Needs Attention', color: '#ef4444', bg: 'bg-red-50',    ring: 'border-red-200'    }
}

// One-line, score-tier-driven encouragement/advice per metric — dynamic,
// not hardcoded to any single example, so it tracks the person's real numbers.
function metricMessage(key: string, score: number | null) {
  if (score === null) return "Set this up to include it in your score."
  const tiers = {
    savings:   ['Consider increasing your savings rate.', 'Try to save a bit more each month.', 'Good savings habits.', 'Great job saving consistently!'],
    budget:    ['Spending is running high — review your budgets.', 'A few categories are over budget.', "You're mostly staying within budget.", "You're staying within budget."],
    debt:      ['Debt ratio is high — prioritize paying it down.', 'Consider reducing your debt.', 'Debt is manageable.', 'Low debt — nicely managed.'],
    emergency: ['Build up your emergency fund — aim for 6 months.', 'Your emergency fund could use some padding.', 'Solid emergency fund.', 'Excellent emergency fund!'],
    growth:    ['Net worth is declining — review income vs expenses.', 'Net worth is roughly flat.', 'Net worth is trending up.', 'Your net worth is growing.'],
  } as Record<string, string[]>
  const bucket = score >= 85 ? 3 : score >= 70 ? 2 : score >= 50 ? 1 : 0
  return tiers[key]?.[bucket] ?? ''
}

function focusText(key: string, label: string) {
  const texts: Record<string, string> = {
    savings:   'Increase your savings rate toward the 20-30% benchmark',
    budget:    'Review categories that are running over budget',
    debt:      'Reduce debt ratio below 30% to improve your score',
    emergency: 'Grow your emergency fund toward 6 months of expenses',
    growth:    'Focus on growing net cash flow month over month',
  }
  return texts[key] ?? `Improve your ${label.toLowerCase()}`
}

export function AnalyticsContent({ incomes, expenses, accounts = [], budgets = [] }: Props) {
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

  // ── Financial Health breakdown (Savings Rate, Budget Adherence, Debt
  // Ratio, Emergency Fund, Net Worth Growth) — same five-metric model used
  // on the Dashboard's compact gauge, computed here in full with a
  // per-metric breakdown. Debt Ratio and Emergency Fund need account
  // balances; Budget Adherence needs budgets — both degrade gracefully to
  // "Not set up" if those aren't passed in yet. ─────────────────────────
  const { overallScore, healthMetrics, focusAreas, statusMeta } = useMemo(() => {
    const savingsScore = Math.max(0, Math.min(100, Math.round((savingsRate / 30) * 100)))

    const mStart = format(startOfMonth(now), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(now), 'yyyy-MM-dd')
    const activeBudgets = budgets
      .map((b: any) => {
        const limit = Number(b.monthly_limit ?? b.amount ?? 0)
        const spent = expenses.filter(e => e.category === b.category && e.date >= mStart && e.date <= mEnd).reduce((s, e) => s + e.amount, 0)
        return { limit, spent }
      })
      .filter(b => b.limit > 0)
    const budgetScore = activeBudgets.length === 0 ? null : Math.round(
      activeBudgets.reduce((sum, b) => {
        const used = b.spent / b.limit
        const s = used <= 1 ? 100 : Math.max(0, 100 - (used - 1) * 100)
        return sum + s
      }, 0) / activeBudgets.length
    )

    // Account balances — income & expenses only (no transfer data available
    // here), same simplification used by the Dashboard's Cash Flow Waterfall.
    const accountBalances = accounts.map((acc: any) => {
      const inc = incomes.filter(i => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const exp = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      return Number(acc.opening_balance ?? 0) + inc - exp
    })
    const hasAccounts = accounts.length > 0
    const totalAssets = accountBalances.reduce((s, b) => s + Math.max(0, b), 0)
    const totalDebt   = accountBalances.reduce((s, b) => s + Math.max(0, -b), 0)
    const debtRatio   = (totalAssets + totalDebt) > 0 ? totalDebt / (totalAssets + totalDebt) : 0
    const debtScore   = hasAccounts ? Math.max(0, Math.min(100, Math.round(100 - debtRatio * 200))) : null

    const avgMonthlyExpense = monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.expenses, 0) / monthlyData.length : 0
    const emergencyMonths = avgMonthlyExpense > 0 ? totalAssets / avgMonthlyExpense : (totalAssets > 0 ? 6 : 0)
    const emergencyScore = hasAccounts ? Math.max(0, Math.min(100, Math.round((emergencyMonths / 6) * 100))) : null

    const curM  = monthlyData[monthlyData.length - 1]
    const prevM = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null
    const curNet  = curM ? curM.income - curM.expenses : 0
    const prevNet = prevM ? prevM.income - prevM.expenses : null
    let growthScore: number
    if (prevNet === null) growthScore = curNet > 0 ? 70 : curNet < 0 ? 30 : 50
    else if (prevNet === 0) growthScore = curNet > 0 ? 100 : curNet < 0 ? 0 : 50
    else growthScore = Math.max(0, Math.min(100, Math.round(50 + ((curNet - prevNet) / Math.abs(prevNet)) * 50)))

    const healthMetrics = [
      { key: 'savings',   label: 'Savings Rate',     icon: Wallet,        iconBg: '#ede9fe', iconColor: '#7c3aed', score: savingsScore   },
      { key: 'budget',    label: 'Budget Adherence', icon: Target,        iconBg: '#dcfce7', iconColor: '#16a34a', score: budgetScore    },
      { key: 'debt',      label: 'Debt Ratio',       icon: PieChartIcon,  iconBg: '#ffedd5', iconColor: '#f97316', score: debtScore      },
      { key: 'emergency', label: 'Emergency Fund',   icon: ShieldCheck,   iconBg: '#dbeafe', iconColor: '#2563eb', score: emergencyScore },
      { key: 'growth',    label: 'Net Worth Growth', icon: TrendingUp,    iconBg: '#ede9fe', iconColor: '#7c3aed', score: growthScore    },
    ]

    const scored = healthMetrics.map(m => m.score).filter((s): s is number => s !== null)
    const overallScore = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0
    const statusMeta = healthStatus(overallScore)

    const ranked = healthMetrics.filter(m => m.score !== null).sort((a, b) => (a.score as number) - (b.score as number))
    const weakest = ranked.slice(0, 2)
    const strongest = ranked[ranked.length - 1]
    const focusAreas = [
      ...weakest.map(m => ({ color: m.iconColor, text: focusText(m.key, m.label) })),
      strongest ? { color: strongest.iconColor, text: `Maintain your ${strongest.label.toLowerCase()}` } : null,
    ].filter((x): x is { color: string; text: string } => x !== null)

    return { overallScore, healthMetrics, focusAreas, statusMeta }
  }, [savingsRate, budgets, expenses, accounts, incomes, monthlyData])

  const overallBlurb = overallScore >= 85
    ? { title: "You're Doing Great!", message: "Your financial habits are strong and you're building a secure future. Keep it up!" }
    : overallScore >= 70
    ? { title: "You're Doing Well", message: "Your finances are in good shape overall, with a little room to tighten things up." }
    : overallScore >= 50
    ? { title: "Room to Improve", message: "You're on the right track — a few changes could meaningfully strengthen your finances." }
    : { title: "Needs Attention", message: "Your finances could use some focus this month — start with the areas below." }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">Deep insights into your financial behaviour</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map(m => (
          <KPICard
            key={m.label}
            label={m.label}
            value={m.value}
            sub={m.description}
            colorClass=""
            icon={m.status === 'success' ? TrendingUp : m.status === 'warning' ? AlertTriangle : TrendingDown}
            accentColor={m.status === 'success' ? '#16a34a' : m.status === 'warning' ? '#f59e0b' : '#dc2626'}
            tooltip={m.description}
          />
        ))}
      </div>

      {/* ── Financial Health — detailed gauge + breakdown ── */}
      <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardContent className="p-5 sm:p-6 space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#ede9fe' }}>
                <Heart className="w-5 h-5" style={{ color: '#7c3aed' }} />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">Financial Health</h2>
                <p className="text-sm text-muted-foreground">Your overall financial wellness at a glance</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" /> This Month <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Gauge */}
            <div className="flex flex-col items-center">
              <HealthGauge score={overallScore} needleColor={statusMeta.color} />
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-bold mt-1 ${statusMeta.bg}`}
                style={{ color: statusMeta.color }}
              >
                <TrendingUp className="w-4 h-4" /> {statusMeta.label}
              </span>
              <p className="text-sm text-muted-foreground text-center mt-3 max-w-xs">{overallBlurb.message}</p>
            </div>

            {/* Score breakdown */}
            <div>
              <div className="flex items-center gap-1.5 mb-4">
                <h3 className="font-bold text-base">Score Breakdown</h3>
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {healthMetrics.map(m => {
                  const Icon = m.icon
                  const display = m.score ?? 0
                  const color = m.score === null ? '#cbd5e1' : m.iconColor
                  return (
                    <div key={m.key} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: m.iconBg }}>
                        <Icon className="w-4 h-4" style={{ color: m.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{m.label}</p>
                          <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color }}>
                            {m.score === null ? 'Not set up' : <>{m.score} <span className="text-muted-foreground font-normal">/100</span></>}
                          </p>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mt-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${display}%`, background: color }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{metricMessage(m.key, m.score)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Summary + focus areas */}
          <div className={`rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6 ${statusMeta.bg} border ${statusMeta.ring}`}>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: statusMeta.color + '22' }}>
                <Trophy className="w-6 h-6" style={{ color: statusMeta.color }} />
              </div>
              <div>
                <p className="font-bold text-sm">{overallBlurb.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{overallBlurb.message}</p>
              </div>
            </div>
            <div>
              <p className="font-bold text-sm mb-2">Focus Areas to Improve</p>
              <div className="space-y-1.5">
                {focusAreas.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }} />
                    {f.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Scores are calculated based on your financial data and best practice benchmarks.</span>
          </div>
        </CardContent>
      </Card>

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