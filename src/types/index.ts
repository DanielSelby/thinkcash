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
  | 'salary' | 'freelance' | 'business'
  | 'investment' | 'rental' | 'other'

export interface Income {
  id: string
  user_id: string
  title: string
  amount: number
  category: IncomeCategory
  notes: string | null
  date: string
  account_id?: string | null
  created_at: string
  updated_at: string
}

export type ExpenseCategory =
  | 'food' | 'transportation' | 'housing' | 'utilities'
  | 'entertainment' | 'healthcare' | 'shopping' | 'education'
  | 'travel' | 'insurance' | 'investments' | 'other'

export type PaymentMethod =
  | 'cash' | 'mobile_money' | 'debit_card'
  | 'credit_card' | 'bank_transfer'

export interface Expense {
  id: string
  user_id: string
  title: string
  amount: number
  category: ExpenseCategory
  payment_method: PaymentMethod
  notes: string | null
  date: string
  account_id?: string | null
  created_at: string
  updated_at: string
}

export type AccountType = 'bank' | 'mobile_money' | 'cash' | 'investment'

export interface UserAccount {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution?: string | null
  opening_balance: number
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
  // computed
  total_income?: number
  total_expenses?: number
  balance?: number
}

export interface Budget {
  id: string
  user_id: string
  category: ExpenseCategory
  monthly_limit: number
  budget_name: string
  budget_month?: number
  budget_year?: number
  created_at: string
  updated_at: string
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

export interface Asset {
  id: string
  user_id: string
  name: string
  asset_type: 'property' | 'vehicle' | 'electronics' | 'jewelry' | 'other'
  current_value: number
  purchase_value: number
  purchase_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Investment {
  id: string
  user_id: string
  name: string
  investment_type: 'stocks' | 'crypto' | 'mutual_funds' | 'bonds' | 'fixed_deposit' | 'real_estate' | 'other'
  invested_amount: number
  current_value: number
  institution: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Debt {
  id: string
  user_id: string
  name: string
  debt_type: 'credit_card' | 'overdraft' | 'buy_now_pay_later' | 'other'
  total_amount: number
  remaining: number
  interest_rate: number
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Loan {
  id: string
  user_id: string
  name: string
  loan_type: 'mortgage' | 'personal' | 'car' | 'student' | 'business' | 'other'
  principal: number
  remaining: number
  interest_rate: number
  monthly_payment: number
  start_date: string | null
  end_date: string | null
  institution: string | null
  notes: string | null
  created_at: string
  updated_at: string
}