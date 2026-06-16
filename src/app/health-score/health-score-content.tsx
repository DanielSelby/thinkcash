'use client'

import { useMemo } from 'react'
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Target, Wallet, PiggyBank, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes: any[]
  expenses: any[]
  budgets: any[]
  goals: any[]
  recurring: any[]
  monthStart: string
  monthEnd: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 })
    .format(n).replace('GHS', 'GH₵')

interface ScoreComponent {
  name: string
  score: number
  maxScore: number
  status: 'good' | 'warning' | 'bad'
  message: string
  tip: string
  icon: any
}

export function HealthScoreContent({ incomes, expenses, budgets, goals, recurring, monthStart, monthEnd }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const analysis = useMemo(() => {
    const mInc = incomes.filter(i  => i.date >= monthStart && i.date <= monthEnd)
    const mExp = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd)

    const totalIncome   = mInc.reduce((s, i) => s + Number(i.amount), 0)
    const totalExpenses = mExp.reduce((s, e) => s + Number(e.amount), 0)
    const netSavings    = totalIncome - totalExpenses
    const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
    const expenseRatio  = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 100

    // Budget adherence
    const budgetScores = budgets.map(b => {
      const spent = mExp.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
      return b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
    })
    const avgBudgetUsage  = budgetScores.length > 0 ? budgetScores.reduce((s, v) => s + v, 0) / budgetScores.length : null
    const exceededBudgets = budgetScores.filter(v => v > 100).length

    // Goals progress
    const avgGoalProgress = goals.length > 0
      ? goals.reduce((s, g) => s + (g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0), 0) / goals.length
      : null

    // Emergency fund proxy (savings goals named "emergency")
    const emergencyFund = goals.find(g =>
      g.goal_name?.toLowerCase().includes('emergency') ||
      g.goal_name?.toLowerCase().includes('fund')
    )

    // ── Score Components ──────────────────────────────────────────────

    const components: ScoreComponent[] = []

    // 1. Savings Rate (25 pts)
    let savingsScore = 0
    let savingsStatus: 'good' | 'warning' | 'bad' = 'bad'
    let savingsMsg = ''
    let savingsTip = ''
    if (savingsRate >= 20) { savingsScore = 25; savingsStatus = 'good';    savingsMsg = `Excellent! You're saving ${savingsRate.toFixed(0)}% of income.`;       savingsTip = 'Keep it up! Try to invest some of your savings.' }
    else if (savingsRate >= 10) { savingsScore = 17; savingsStatus = 'warning'; savingsMsg = `You're saving ${savingsRate.toFixed(0)}% — good, but aim for 20%.`; savingsTip = 'Cut one non-essential expense to boost your savings rate.' }
    else if (savingsRate > 0)   { savingsScore = 8;  savingsStatus = 'warning'; savingsMsg = `Low savings rate of ${savingsRate.toFixed(0)}%.`;                    savingsTip = 'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.' }
    else                         { savingsScore = 0;  savingsStatus = 'bad';     savingsMsg = 'You are spending more than you earn this month.';                    savingsTip = 'Review your top 3 expense categories and find cuts.' }
    components.push({ name: 'Savings Rate', score: savingsScore, maxScore: 25, status: savingsStatus, message: savingsMsg, tip: savingsTip, icon: PiggyBank })

    // 2. Budget Adherence (20 pts)
    if (budgets.length === 0) {
      components.push({ name: 'Budget Adherence', score: 0, maxScore: 20, status: 'bad', message: 'No budgets set — you have no spending limits.', tip: 'Create budgets for your top 3 expense categories.', icon: Wallet })
    } else {
      let budgetScore = 0
      let budgetStatus: 'good' | 'warning' | 'bad' = 'bad'
      let budgetMsg = ''
      let budgetTip = ''
      if (exceededBudgets === 0 && avgBudgetUsage! < 80) { budgetScore = 20; budgetStatus = 'good';    budgetMsg = 'All budgets are on track.';                              budgetTip = 'Great discipline! Consider increasing your savings budget.' }
      else if (exceededBudgets === 0)                     { budgetScore = 14; budgetStatus = 'warning'; budgetMsg = 'Budgets intact but some are close to limit.';            budgetTip = 'Watch your spending for the rest of the month.' }
      else if (exceededBudgets <= 1)                      { budgetScore = 8;  budgetStatus = 'warning'; budgetMsg = `${exceededBudgets} budget exceeded this month.`;         budgetTip = 'Review what caused the overspend and adjust next month.' }
      else                                                { budgetScore = 0;  budgetStatus = 'bad';     budgetMsg = `${exceededBudgets} budgets exceeded — overspending detected.`; budgetTip = 'Reduce discretionary spending immediately.' }
      components.push({ name: 'Budget Adherence', score: budgetScore, maxScore: 20, status: budgetStatus, message: budgetMsg, tip: budgetTip, icon: Wallet })
    }

    // 3. Expense Ratio (20 pts)
    let expScore = 0
    let expStatus: 'good' | 'warning' | 'bad' = 'bad'
    let expMsg = ''
    let expTip = ''
    if (expenseRatio <= 60)       { expScore = 20; expStatus = 'good';    expMsg = `Low expense ratio of ${expenseRatio.toFixed(0)}% — excellent control.`; expTip = 'You have great spending discipline. Consider investing the surplus.' }
    else if (expenseRatio <= 80)  { expScore = 13; expStatus = 'warning'; expMsg = `Expense ratio at ${expenseRatio.toFixed(0)}% — moderate.`;               expTip = 'Try to bring expenses below 75% of income.' }
    else if (expenseRatio <= 100) { expScore = 6;  expStatus = 'warning'; expMsg = `High expense ratio of ${expenseRatio.toFixed(0)}%.`;                     expTip = 'You are living close to your income limit — risky.' }
    else                           { expScore = 0;  expStatus = 'bad';     expMsg = 'Spending exceeds income — you are in deficit.';                          expTip = 'Urgent: identify and cut non-essential expenses.' }
    components.push({ name: 'Expense Control', score: expScore, maxScore: 20, status: expStatus, message: expMsg, tip: expTip, icon: TrendingDown })

    // 4. Savings Goals (20 pts)
    if (goals.length === 0) {
      components.push({ name: 'Savings Goals', score: 5, maxScore: 20, status: 'bad', message: 'No savings goals set.', tip: 'Set at least one savings goal — emergency fund, house, or education.', icon: Target })
    } else {
      let goalScore = 0
      let goalStatus: 'good' | 'warning' | 'bad' = 'bad'
      let goalMsg = ''
      let goalTip = ''
      const progress = avgGoalProgress ?? 0
      if (progress >= 75)      { goalScore = 20; goalStatus = 'good';    goalMsg = `Excellent! You're ${progress.toFixed(0)}% toward your goals.`;       goalTip = 'You are close — stay consistent!' }
      else if (progress >= 40) { goalScore = 13; goalStatus = 'warning'; goalMsg = `Halfway there — ${progress.toFixed(0)}% average goal progress.`;     goalTip = 'Increase your monthly goal contributions to stay on track.' }
      else if (progress >= 10) { goalScore = 7;  goalStatus = 'warning'; goalMsg = `Early stages — ${progress.toFixed(0)}% average goal progress.`;      goalTip = 'Set up automatic savings contributions if possible.' }
      else                      { goalScore = 3;  goalStatus = 'bad';     goalMsg = `Very low goal progress at ${progress.toFixed(0)}%.`;                  goalTip = 'Start small — even GH₵50/month toward a goal matters.' }
      components.push({ name: 'Savings Goals', score: goalScore, maxScore: 20, status: goalStatus, message: goalMsg, tip: goalTip, icon: Target })
    }

    // 5. Emergency Fund (15 pts)
    if (!emergencyFund) {
      components.push({ name: 'Emergency Fund', score: 0, maxScore: 15, status: 'bad', message: 'No emergency fund detected.', tip: 'Create a savings goal named "Emergency Fund" — target 3–6 months of expenses.', icon: Shield })
    } else {
      const efProgress = emergencyFund.target_amount > 0
        ? (emergencyFund.current_amount / emergencyFund.target_amount) * 100 : 0
      let efScore = 0; let efStatus: 'good' | 'warning' | 'bad' = 'bad'; let efMsg = ''; let efTip = ''
      if (efProgress >= 100)     { efScore = 15; efStatus = 'good';    efMsg = 'Emergency fund fully funded!';                      efTip = 'Excellent! Now focus on investment goals.' }
      else if (efProgress >= 50) { efScore = 10; efStatus = 'warning'; efMsg = `Emergency fund ${efProgress.toFixed(0)}% funded.`;  efTip = 'Keep contributing — aim for 3–6 months of expenses.' }
      else                        { efScore = 4;  efStatus = 'warning'; efMsg = `Emergency fund only ${efProgress.toFixed(0)}% funded.`; efTip = 'Prioritize emergency fund before other goals.' }
      components.push({ name: 'Emergency Fund', score: efScore, maxScore: 15, status: efStatus, message: efMsg, tip: efTip, icon: Shield })
    }

    const totalScore = components.reduce((s, c) => s + c.score, 0)
    const maxScore   = components.reduce((s, c) => s + c.maxScore, 0)

    return {
      components,
      totalScore,
      maxScore,
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
    }
  }, [incomes, expenses, budgets, goals, monthStart, monthEnd])

  const { totalScore, maxScore, components } = analysis
  const percentage = Math.round((totalScore / maxScore) * 100)

  const scoreGrade = percentage >= 80 ? { label: 'Excellent', color: '#16a34a', bg: '#dcfce7' }
    : percentage >= 65 ? { label: 'Good',      color: '#2563eb', bg: '#dbeafe' }
    : percentage >= 50 ? { label: 'Fair',      color: '#ca8a04', bg: '#fef9c3' }
    :                    { label: 'Needs Work', color: '#dc2626', bg: '#fee2e2' }

  const statusIcon = (s: 'good' | 'warning' | 'bad') => {
    if (s === 'good')    return <CheckCircle    className="w-4 h-4 text-green-600 flex-shrink-0" />
    if (s === 'warning') return <AlertTriangle  className="w-4 h-4 text-yellow-500 flex-shrink-0" />
    return                      <XCircle        className="w-4 h-4 text-red-500 flex-shrink-0"  />
  }

  // Stroke dasharray for circular progress
  const radius      = 70
  const circumference = 2 * Math.PI * radius
  const strokeDash  = circumference - (percentage / 100) * circumference

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
          Financial Health Score
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Based on your savings rate, budget adherence, expense control, goals, and emergency fund
        </p>
      </div>

      {/* Score Hero */}
      <Card className="bg-white rounded-xl shadow-sm overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">

            {/* Circular score */}
            <div className="relative flex-shrink-0">
              <svg width="180" height="180" className="transform -rotate-90">
                {/* Background circle */}
                <circle cx="90" cy="90" r={radius}
                  fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                {/* Score arc */}
                <circle cx="90" cy="90" r={radius}
                  fill="none"
                  stroke={scoreGrade.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDash}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tabular-nums" style={{ color: scoreGrade.color }}>
                  {percentage}
                </span>
                <span className="text-xs text-muted-foreground">out of 100</span>
              </div>
            </div>

            {/* Grade + summary */}
            <div className="flex-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3"
                style={{ background: scoreGrade.bg, color: scoreGrade.color }}>
                {scoreGrade.label}
              </div>
              <p className="text-2xl font-bold tabular-nums mb-1">
                {totalScore} / {maxScore} points
              </p>
              <p className="text-sm text-muted-foreground">
                {percentage >= 80 ? 'Your finances are in great shape. Keep up the excellent work!'
                  : percentage >= 65 ? 'Good financial habits. A few improvements will boost your score.'
                  : percentage >= 50 ? 'You\'re on the right track but there\'s room for improvement.'
                  : 'Your finances need attention. Focus on the tips below to improve.'}
              </p>

              {/* Mini breakdown */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="text-xs bg-green-50 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground">Income</p>
                  <p className="font-semibold text-green-600">{fmt(analysis.totalIncome)}</p>
                </div>
                <div className="text-xs bg-red-50 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground">Expenses</p>
                  <p className="font-semibold text-red-500">{fmt(analysis.totalExpenses)}</p>
                </div>
                <div className="text-xs bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground">Net Savings</p>
                  <p className="font-semibold text-blue-600">{fmt(analysis.netSavings)}</p>
                </div>
                <div className="text-xs bg-purple-50 rounded-lg px-3 py-2">
                  <p className="text-muted-foreground">Savings Rate</p>
                  <p className="font-semibold text-purple-600">{analysis.savingsRate.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Components */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: theme.colors.primary }}>
          Score Breakdown
        </h2>
        {components.map((comp, i) => {
          const compPct = Math.round((comp.score / comp.maxScore) * 100)
          const Icon    = comp.icon
          return (
            <Card key={i} className="bg-white rounded-xl shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {statusIcon(comp.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{comp.name}</p>
                      </div>
                      <span className="text-sm font-bold tabular-nums"
                        style={{ color: comp.status === 'good' ? '#16a34a' : comp.status === 'warning' ? '#ca8a04' : '#dc2626' }}>
                        {comp.score}/{comp.maxScore}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${compPct}%`,
                          background: comp.status === 'good' ? '#16a34a' : comp.status === 'warning' ? '#ca8a04' : '#dc2626',
                        }} />
                    </div>

                    <p className="text-xs text-foreground mb-1">{comp.message}</p>
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <span className="flex-shrink-0">💡</span>
                      {comp.tip}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Action Plan */}
      <Card className="rounded-xl overflow-hidden border-0"
        style={{ background: theme.colors.primary }}>
        <CardContent className="pt-5 pb-5">
          <h3 className="text-white font-semibold mb-3">Your Top 3 Actions to Improve</h3>
          <div className="space-y-2">
            {components
              .filter(c => c.status !== 'good')
              .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
              .slice(0, 3)
              .map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                    {i + 1}
                  </span>
                  <p className="text-white/90 text-sm">{c.tip}</p>
                </div>
              ))}
            {components.every(c => c.status === 'good') && (
              <p className="text-white/90 text-sm">🎉 All areas are in great shape! Keep maintaining your excellent financial habits.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}