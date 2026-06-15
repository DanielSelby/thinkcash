import { useState, useEffect } from 'react'

export const DEFAULT_INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Investment',
  'Rental', 'Gift', 'Bonus', 'Other',
]

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transport', 'Housing', 'Utilities',
  'Healthcare', 'Education', 'Entertainment', 'Shopping',
  'Clothing', 'Personal Care', 'Savings', 'Debt Payment',
  'Insurance', 'Travel', 'Other',
]

export const STORAGE_KEY_INCOME  = 'ts_income_categories'
export const STORAGE_KEY_EXPENSE = 'ts_expense_categories'

export function useCategories() {
  const [incomeCategories,  setIncomeCategories]  = useState<string[]>(DEFAULT_INCOME_CATEGORIES)
  const [expenseCategories, setExpenseCategories] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const inc = localStorage.getItem(STORAGE_KEY_INCOME)
    const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
    setIncomeCategories(inc  ? JSON.parse(inc)  : DEFAULT_INCOME_CATEGORIES)
    setExpenseCategories(exp ? JSON.parse(exp)  : DEFAULT_EXPENSE_CATEGORIES)
    setLoaded(true)
  }, [])

  return { incomeCategories, expenseCategories, loaded }
}