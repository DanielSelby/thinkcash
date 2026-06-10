import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatShortDate(date: string | Date): string {
  return formatDate(date, 'MMM d')
}

export function getCurrentMonth(): { start: string; end: string } {
  const now = new Date()
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
  }
}

export function getPreviousMonth(): { start: string; end: string } {
  const prev = subMonths(new Date(), 1)
  return {
    start: format(startOfMonth(prev), 'yyyy-MM-dd'),
    end: format(endOfMonth(prev), 'yyyy-MM-dd'),
  }
}

export function getMonthLabel(monthsAgo = 0): string {
  return format(subMonths(new Date(), monthsAgo), 'MMM yyyy')
}

export function calculateHealthScore(
  income: number,
  expenses: number,
  savings: number,
  budgetAdherence: number
): number {
  if (income === 0) return 0
  const savingsRate = (savings / income) * 100
  const expenseRatio = (expenses / income) * 100

  let score = 50
  if (savingsRate >= 20) score += 20
  else if (savingsRate >= 10) score += 10
  if (expenseRatio <= 70) score += 20
  else if (expenseRatio <= 85) score += 10
  score += budgetAdherence * 0.1

  return Math.min(100, Math.max(0, Math.round(score)))
}

export function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-destructive'
}

export function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

export function getBudgetStatus(percentage: number): 'safe' | 'warning' | 'exceeded' {
  if (percentage >= 100) return 'exceeded'
  if (percentage >= 80) return 'warning'
  return 'safe'
}

export const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316',
  transportation: '#3b82f6',
  housing: '#8b5cf6',
  utilities: '#06b6d4',
  entertainment: '#ec4899',
  healthcare: '#10b981',
  shopping: '#f59e0b',
  education: '#6366f1',
  travel: '#14b8a6',
  insurance: '#64748b',
  investments: '#22c55e',
  other: '#94a3b8',
  salary: '#22c55e',
  freelance: '#3b82f6',
  business: '#8b5cf6',
  investment: '#f59e0b',
  rental: '#14b8a6',
}

export const INCOME_CATEGORIES = [
  { value: 'salary', label: 'Salary' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'business', label: 'Business' },
  { value: 'investment', label: 'Investment' },
  { value: 'rental', label: 'Rental' },
  { value: 'other', label: 'Other' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food & Dining' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'housing', label: 'Housing' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'travel', label: 'Travel' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'investments', label: 'Investments' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

export const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]
