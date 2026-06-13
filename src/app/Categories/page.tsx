'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Tag, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

const DEFAULT_INCOME_CATEGORIES = [
  'Salary', 'Freelance', 'Business', 'Investment', 'Rental', 'Gift', 'Bonus', 'Other',
]
const DEFAULT_EXPENSE_CATEGORIES = [
  'Food & Dining', 'Transport', 'Housing', 'Utilities', 'Healthcare',
  'Education', 'Entertainment', 'Shopping', 'Clothing', 'Personal Care',
  'Savings', 'Debt Payment', 'Insurance', 'Travel', 'Other',
]

const STORAGE_KEY_INCOME  = 'ts_income_categories'
const STORAGE_KEY_EXPENSE = 'ts_expense_categories'

export default function CategoriesPage() {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [incomeCategories,  setIncomeCategories]  = useState<string[]>([])
  const [expenseCategories, setExpenseCategories] = useState<string[]>([])
  const [newIncome,  setNewIncome]  = useState('')
  const [newExpense, setNewExpense] = useState('')

  // Load from localStorage (persists across sessions)
  useEffect(() => {
    const inc = localStorage.getItem(STORAGE_KEY_INCOME)
    const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
    setIncomeCategories(inc  ? JSON.parse(inc)  : DEFAULT_INCOME_CATEGORIES)
    setExpenseCategories(exp ? JSON.parse(exp)  : DEFAULT_EXPENSE_CATEGORIES)
  }, [])

  const saveIncome  = (cats: string[]) => { setIncomeCategories(cats);  localStorage.setItem(STORAGE_KEY_INCOME,  JSON.stringify(cats)) }
  const saveExpense = (cats: string[]) => { setExpenseCategories(cats); localStorage.setItem(STORAGE_KEY_EXPENSE, JSON.stringify(cats)) }

  const addIncome = () => {
    const v = newIncome.trim()
    if (!v) return
    if (incomeCategories.includes(v)) { toast({ title: 'Category already exists', variant: 'destructive' }); return }
    saveIncome([...incomeCategories, v])
    setNewIncome('')
    toast({ title: `"${v}" added to Income categories`, variant: 'success' })
  }

  const addExpense = () => {
    const v = newExpense.trim()
    if (!v) return
    if (expenseCategories.includes(v)) { toast({ title: 'Category already exists', variant: 'destructive' }); return }
    saveExpense([...expenseCategories, v])
    setNewExpense('')
    toast({ title: `"${v}" added to Expense categories`, variant: 'success' })
  }

  const removeIncome  = (cat: string) => { saveIncome(incomeCategories.filter(c => c !== cat));   toast({ title: `"${cat}" removed` }) }
  const removeExpense = (cat: string) => { saveExpense(expenseCategories.filter(c => c !== cat)); toast({ title: `"${cat}" removed` }) }

  const resetIncome  = () => { saveIncome(DEFAULT_INCOME_CATEGORIES);   toast({ title: 'Income categories reset to defaults' }) }
  const resetExpense = () => { saveExpense(DEFAULT_EXPENSE_CATEGORIES); toast({ title: 'Expense categories reset to defaults' }) }

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: theme.colors.primary }}>
            Categories
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your income and expense categories. These appear in all dropdown menus across the app.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Income Categories */}
          <Card className="bg-white rounded-xl shadow-sm kpi-green">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Income Categories
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {incomeCategories.length} categories
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add new */}
              <div className="flex gap-2">
                <Input
                  placeholder="New category name…"
                  value={newIncome}
                  onChange={e => setNewIncome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addIncome()}
                  className="h-8 text-sm bg-white"
                />
                <Button size="sm" onClick={addIncome}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* List */}
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {incomeCategories.map(cat => (
                  <div key={cat}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50/60 border border-green-100 group">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-green-600" />
                      <span className="text-sm">{cat}</span>
                    </div>
                    {!DEFAULT_INCOME_CATEGORIES.includes(cat) && (
                      <button
                        onClick={() => removeIncome(cat)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {DEFAULT_INCOME_CATEGORIES.includes(cat) && (
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">default</span>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={resetIncome}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Reset to defaults
              </button>
            </CardContent>
          </Card>

          {/* Expense Categories */}
          <Card className="bg-white rounded-xl shadow-sm kpi-red">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Expense Categories
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {expenseCategories.length} categories
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Add new */}
              <div className="flex gap-2">
                <Input
                  placeholder="New category name…"
                  value={newExpense}
                  onChange={e => setNewExpense(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExpense()}
                  className="h-8 text-sm bg-white"
                />
                <Button size="sm" onClick={addExpense}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* List */}
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {expenseCategories.map(cat => (
                  <div key={cat}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50/60 border border-red-100 group">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-red-500" />
                      <span className="text-sm">{cat}</span>
                    </div>
                    {!DEFAULT_EXPENSE_CATEGORIES.includes(cat) && (
                      <button
                        onClick={() => removeExpense(cat)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {DEFAULT_EXPENSE_CATEGORIES.includes(cat) && (
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">default</span>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={resetExpense}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                Reset to defaults
              </button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white rounded-xl shadow-sm border border-amber-200">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-700">
              <strong>Tip:</strong> Custom categories you add here will appear in the Income and Expense forms automatically.
              Default categories (shown as "default" on hover) cannot be deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}