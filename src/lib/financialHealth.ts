import type { LucideIcon } from 'lucide-react'
import { PiggyBank, Wallet, TrendingDown, Target, Shield } from 'lucide-react'

// ────────────────────────────────────────────────────────────────────────
// Single source of truth for the "Financial Health" score.
// Used by BOTH:
//   - components/health-score/HealthScoreContent.tsx (circular score card)
//   - components/analytics/AnalyticsContent.tsx (gauge breakdown)
// If you need to change how the score is calculated, change it HERE ONLY.
// ────────────────────────────────────────────────────────────────────────

export type ComponentStatus = 'good' | 'warning' | 'bad'

export interface HealthComponent {
  key: string
  name: string
  score: number
  maxScore: number
  status: ComponentStatus
  message: string
  tip: string
  icon: LucideIcon
}

export interface HealthInputs {
  incomes: any[]
  expenses: any[]
  budgets: any[]
  goals: any[]
  monthStart: string
  monthEnd: string
}

export interface HealthResult {
  components: HealthComponent[]
  totalScore: number
  maxScore: number
  percentage: number
  totalIncome: number
  totalExpenses: number
  netSavings: number
  savingsRate: number
  expenseRatio: number
}

export function calculateFinancialHealth({
  incomes,
  expenses,
  budgets,
  goals,
  monthStart,
  monthEnd,
}: HealthInputs): HealthResult {
  const mInc = incomes.filter(i => i.date >= monthStart && i.date <= monthEnd)
  const mExp = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd)

  const totalIncome = mInc.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = mExp.reduce((s, e) => s + Number(e.amount), 0)
  const netSavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
  const expenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 100

  // Budget adherence
  const budgetScores = budgets.map(b => {
    const spent = mExp.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
    const limit = Number(b.monthly_limit ?? b.amount ?? 0)
    return limit > 0 ? (spent / limit) * 100 : 0
  })
  const avgBudgetUsage = budgetScores.length > 0 ? budgetScores.reduce((s, v) => s + v, 0) / budgetScores.length : null
  const exceededBudgets = budgetScores.filter(v => v > 100).length

  // Goals progress
  const avgGoalProgress = goals.length > 0
    ? goals.reduce((s, g) => s + (g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0), 0) / goals.length
    : null

  // Emergency fund proxy (savings goal named "emergency" or "fund")
  const emergencyFund = goals.find(g =>
    g.goal_name?.toLowerCase().includes('emergency') ||
    g.goal_name?.toLowerCase().includes('fund')
  )

  const components: HealthComponent[] = []

  // 1. Savings Rate (25 pts)
  {
    let score = 0, status: ComponentStatus = 'bad', message = '', tip = ''
    if (savingsRate >= 20) { score = 25; status = 'good';    message = `Excellent! You're saving ${savingsRate.toFixed(0)}% of income.`;       tip = 'Keep it up! Try to invest some of your savings.' }
    else if (savingsRate >= 10) { score = 17; status = 'warning'; message = `You're saving ${savingsRate.toFixed(0)}% — good, but aim for 20%.`; tip = 'Cut one non-essential expense to boost your savings rate.' }
    else if (savingsRate > 0)   { score = 8;  status = 'warning'; message = `Low savings rate of ${savingsRate.toFixed(0)}%.`;                    tip = 'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.' }
    else                         { score = 0;  status = 'bad';     message = 'You are spending more than you earn this month.';                    tip = 'Review your top 3 expense categories and find cuts.' }
    components.push({ key: 'savings', name: 'Savings Rate', score, maxScore: 25, status, message, tip, icon: PiggyBank })
  }

  // 2. Budget Adherence (20 pts)
  if (budgets.length === 0) {
    components.push({ key: 'budget', name: 'Budget Adherence', score: 0, maxScore: 20, status: 'bad', message: 'No budgets set — you have no spending limits.', tip: 'Create budgets for your top 3 expense categories.', icon: Wallet })
  } else {
    let score = 0, status: ComponentStatus = 'bad', message = '', tip = ''
    if (exceededBudgets === 0 && avgBudgetUsage! < 80) { score = 20; status = 'good';    message = 'All budgets are on track.';                              tip = 'Great discipline! Consider increasing your savings budget.' }
    else if (exceededBudgets === 0)                     { score = 14; status = 'warning'; message = 'Budgets intact but some are close to limit.';            tip = 'Watch your spending for the rest of the month.' }
    else if (exceededBudgets <= 1)                      { score = 8;  status = 'warning'; message = `${exceededBudgets} budget exceeded this month.`;         tip = 'Review what caused the overspend and adjust next month.' }
    else                                                 { score = 0;  status = 'bad';     message = `${exceededBudgets} budgets exceeded — overspending detected.`; tip = 'Reduce discretionary spending immediately.' }
    components.push({ key: 'budget', name: 'Budget Adherence', score, maxScore: 20, status, message, tip, icon: Wallet })
  }

  // 3. Expense Control (20 pts)
  {
    let score = 0, status: ComponentStatus = 'bad', message = '', tip = ''
    if (expenseRatio <= 60)       { score = 20; status = 'good';    message = `Low expense ratio of ${expenseRatio.toFixed(0)}% — excellent control.`; tip = 'You have great spending discipline. Consider investing the surplus.' }
    else if (expenseRatio <= 80)  { score = 13; status = 'warning'; message = `Expense ratio at ${expenseRatio.toFixed(0)}% — moderate.`;               tip = 'Try to bring expenses below 75% of income.' }
    else if (expenseRatio <= 100) { score = 6;  status = 'warning'; message = `High expense ratio of ${expenseRatio.toFixed(0)}%.`;                     tip = 'You are living close to your income limit — risky.' }
    else                           { score = 0;  status = 'bad';     message = 'Spending exceeds income — you are in deficit.';                          tip = 'Urgent: identify and cut non-essential expenses.' }
    components.push({ key: 'expense', name: 'Expense Control', score, maxScore: 20, status, message, tip, icon: TrendingDown })
  }

  // 4. Savings Goals (20 pts)
  if (goals.length === 0) {
    components.push({ key: 'goals', name: 'Savings Goals', score: 5, maxScore: 20, status: 'bad', message: 'No savings goals set.', tip: 'Set at least one savings goal — emergency fund, house, or education.', icon: Target })
  } else {
    let score = 0, status: ComponentStatus = 'bad', message = '', tip = ''
    const progress = avgGoalProgress ?? 0
    if (progress >= 75)      { score = 20; status = 'good';    message = `Excellent! You're ${progress.toFixed(0)}% toward your goals.`;       tip = 'You are close — stay consistent!' }
    else if (progress >= 40) { score = 13; status = 'warning'; message = `Halfway there — ${progress.toFixed(0)}% average goal progress.`;     tip = 'Increase your monthly goal contributions to stay on track.' }
    else if (progress >= 10) { score = 7;  status = 'warning'; message = `Early stages — ${progress.toFixed(0)}% average goal progress.`;      tip = 'Set up automatic savings contributions if possible.' }
    else                      { score = 3;  status = 'bad';     message = `Very low goal progress at ${progress.toFixed(0)}%.`;                  tip = 'Start small — even GH₵50/month toward a goal matters.' }
    components.push({ key: 'goals', name: 'Savings Goals', score, maxScore: 20, status, message, tip, icon: Target })
  }

  // 5. Emergency Fund (15 pts)
  if (!emergencyFund) {
    components.push({ key: 'emergency', name: 'Emergency Fund', score: 0, maxScore: 15, status: 'bad', message: 'No emergency fund detected.', tip: 'Create a savings goal named "Emergency Fund" — target 3–6 months of expenses.', icon: Shield })
  } else {
    const efProgress = emergencyFund.target_amount > 0
      ? (emergencyFund.current_amount / emergencyFund.target_amount) * 100 : 0
    let score = 0, status: ComponentStatus = 'bad', message = '', tip = ''
    if (efProgress >= 100)     { score = 15; status = 'good';    message = 'Emergency fund fully funded!';                      tip = 'Excellent! Now focus on investment goals.' }
    else if (efProgress >= 50) { score = 10; status = 'warning'; message = `Emergency fund ${efProgress.toFixed(0)}% funded.`;  tip = 'Keep contributing — aim for 3–6 months of expenses.' }
    else                        { score = 4;  status = 'warning'; message = `Emergency fund only ${efProgress.toFixed(0)}% funded.`; tip = 'Prioritize emergency fund before other goals.' }
    components.push({ key: 'emergency', name: 'Emergency Fund', score, maxScore: 15, status, message, tip, icon: Shield })
  }

  const totalScore = components.reduce((s, c) => s + c.score, 0)
  const maxScore = components.reduce((s, c) => s + c.maxScore, 0)
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  return {
    components,
    totalScore,
    maxScore,
    percentage,
    totalIncome,
    totalExpenses,
    netSavings,
    savingsRate,
    expenseRatio,
  }
}

export function healthGrade(percentage: number) {
  if (percentage >= 80) return { label: 'Excellent',    color: '#16a34a', bg: '#dcfce7', ring: 'border-green-200' }
  if (percentage >= 65) return { label: 'Good',         color: '#2563eb', bg: '#dbeafe', ring: 'border-blue-200' }
  if (percentage >= 50) return { label: 'Fair',         color: '#ca8a04', bg: '#fef9c3', ring: 'border-amber-200' }
  return                       { label: 'Needs Work',   color: '#dc2626', bg: '#fee2e2', ring: 'border-red-200' }
}