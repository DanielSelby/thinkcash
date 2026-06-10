export type UserRole = 'user' | 'admin'

export interface Profile {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export type IncomeCategory =
  | 'salary'
  | 'freelance'
  | 'business'
  | 'investment'
  | 'rental'
  | 'other'

export interface Income {
  id: string
  user_id: string
  title: string
  amount: number
  category: IncomeCategory
  notes: string | null
  date: string
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | 'food'
  | 'transportation'
  | 'housing'
  | 'utilities'
  | 'entertainment'
  | 'healthcare'
  | 'shopping'
  | 'education'
  | 'travel'
  | 'insurance'
  | 'investments'
  | 'other'

export type PaymentMethod =
  | 'cash'
  | 'mobile_money'
  | 'debit_card'
  | 'credit_card'
  | 'bank_transfer'

export interface Expense {
  id: string
  user_id: string
  title: string
  amount: number
  category: ExpenseCategory
  payment_method: PaymentMethod
  notes: string | null
  date: string
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: ExpenseCategory
  monthly_limit: number
  budget_name: string
  created_at: string
  updated_at: string
  // computed
  spent?: number
  remaining?: number
  percentage?: number
}

export interface SavingsGoal {
  id: string
  user_id: string
  goal_name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // computed
  percentage?: number
  days_remaining?: number
}

export type TransactionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type TransactionType = 'income' | 'expense'

export interface RecurringTransaction {
  id: string
  user_id: string
  type: TransactionType
  title: string
  amount: number
  category: string
  frequency: TransactionFrequency
  next_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'budget' | 'goal' | 'bill' | 'recurring' | 'report' | 'system'
  is_read: boolean
  created_at: string
}

export interface Transaction {
  id: string
  type: TransactionType
  title: string
  amount: number
  category: string
  date: string
  payment_method?: PaymentMethod
  notes?: string | null
}

export interface DashboardStats {
  totalBalance: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlySavings: number
  netCashFlow: number
  healthScore: number
  savingsRate: number
  expenseRatio: number
}

export interface MonthlyTrend {
  month: string
  income: number
  expenses: number
  savings: number
}

export interface CategorySpending {
  category: string
  amount: number
  percentage: number
  color: string
}
