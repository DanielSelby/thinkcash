'use client'

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { calculateFinancialHealth, healthGrade } from '@/lib/financialHealth'

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

export function HealthScoreContent({ incomes, expenses, budgets, goals, monthStart, monthEnd }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  // ── Single source of truth — same function used by the Analytics page ──
  const analysis = calculateFinancialHealth({ incomes, expenses, budgets, goals, monthStart, monthEnd })
  const { totalScore, maxScore, percentage, components } = analysis
  const scoreGrade = healthGrade(percentage)

  const statusIcon = (s: 'good' | 'warning' | 'bad') => {
    if (s === 'good')    return <CheckCircle    className="w-4 h-4 text-green-600 flex-shrink-0" />
    if (s === 'warning') return <AlertTriangle  className="w-4 h-4 text-yellow-500 flex-shrink-0" />
    return                      <XCircle        className="w-4 h-4 text-red-500 flex-shrink-0"  />
  }

  // Stroke dasharray for circular progress
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference - (percentage / 100) * circumference

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
                <circle cx="90" cy="90" r={radius}
                  fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
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
        {components.map((comp) => {
          const compPct = Math.round((comp.score / comp.maxScore) * 100)
          const Icon = comp.icon
          return (
            <Card key={comp.key} className="bg-white rounded-xl shadow-sm">
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
              .map((c) => (
                <div key={c.key} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                    •
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