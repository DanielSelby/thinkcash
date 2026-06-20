'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { canAccessPage } from '@/lib/page-access'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Tag, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

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

export default function CategoriesPage() {
  const { activeTheme, profile } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const router = useRouter()

  useEffect(() => {
    if (profile && profile.role !== 'admin' && !canAccessPage(profile.allowed_pages, 'categories')) {
      router.replace('/dashboard')
    }
  }, [profile, router])

  const [incomeCategories,  setIncomeCategories]  = useState<string[]>([])
  const [expenseCategories, setExpenseCategories] = useState<string[]>([])
  const [newIncome,  setNewIncome]  = useState('')
  const [newExpense, setNewExpense] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const inc = localStorage.getItem(STORAGE_KEY_INCOME)
    const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
    setIncomeCategories(inc  ? JSON.parse(inc)  : DEFAULT_INCOME_CATEGORIES)
    setExpenseCategories(exp ? JSON.parse(exp)  : DEFAULT_EXPENSE_CATEGORIES)
    setLoaded(true)
  }, [])

  const saveIncome  = (cats: string[]) => {
    setIncomeCategories(cats)
    localStorage.setItem(STORAGE_KEY_INCOME, JSON.stringify(cats))
  }
  const saveExpense = (cats: string[]) => {
    setExpenseCategories(cats)
    localStorage.setItem(STORAGE_KEY_EXPENSE, JSON.stringify(cats))
  }

  const addIncome = () => {
    const v = newIncome.trim()
    if (!v) return
    if (incomeCategories.map(c => c.toLowerCase()).includes(v.toLowerCase())) {
      toast({ title: 'Category already exists', variant: 'destructive' }); return
    }
    saveIncome([...incomeCategories, v])
    setNewIncome('')
    toast({ title: `"${v}" added to Income`, variant: 'success' })
  }

  const addExpense = () => {
    const v = newExpense.trim()
    if (!v) return
    if (expenseCategories.map(c => c.toLowerCase()).includes(v.toLowerCase())) {
      toast({ title: 'Category already exists', variant: 'destructive' }); return
    }
    saveExpense([...expenseCategories, v])
    setNewExpense('')
    toast({ title: `"${v}" added to Expenses`, variant: 'success' })
  }

  const removeIncome  = (cat: string) => {
    saveIncome(incomeCategories.filter(c => c !== cat))
    toast({ title: `"${cat}" removed` })
  }
  const removeExpense = (cat: string) => {
    saveExpense(expenseCategories.filter(c => c !== cat))
    toast({ title: `"${cat}" removed` })
  }

  if (!loaded) return (
    <AppShell>
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Categories
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage income and expense categories. These appear in all forms across the app.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── Income ── */}
          <Card className="bg-white rounded-xl shadow-sm kpi-green">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Income Categories
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {incomeCategories.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new category…"
                  value={newIncome}
                  onChange={e => setNewIncome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addIncome()}
                  className="h-8 text-sm bg-white"
                />
                <Button size="sm" onClick={addIncome}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0 h-8 w-8 p-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {incomeCategories.map(cat => {
                  const isDefault = DEFAULT_INCOME_CATEGORIES.includes(cat)
                  return (
                    <div key={cat}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-green-50/70 border border-green-100 group">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-green-600 flex-shrink-0" />
                        <span className="text-sm">{cat}</span>
                        {isDefault && (
                          <span className="text-xs text-muted-foreground/60 hidden group-hover:inline">default</span>
                        )}
                      </div>
                      {!isDefault && (
                        <button onClick={() => removeIncome(cat)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all ml-2">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <button onClick={() => { saveIncome(DEFAULT_INCOME_CATEGORIES); toast({ title: 'Reset to defaults' }) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset to defaults
              </button>
            </CardContent>
          </Card>

          {/* ── Expense ── */}
          <Card className="bg-white rounded-xl shadow-sm kpi-red">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Expense Categories
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {expenseCategories.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new category…"
                  value={newExpense}
                  onChange={e => setNewExpense(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExpense()}
                  className="h-8 text-sm bg-white"
                />
                <Button size="sm" onClick={addExpense}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0 h-8 w-8 p-0">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {expenseCategories.map(cat => {
                  const isDefault = DEFAULT_EXPENSE_CATEGORIES.includes(cat)
                  return (
                    <div key={cat}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50/70 border border-red-100 group">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <span className="text-sm">{cat}</span>
                        {isDefault && (
                          <span className="text-xs text-muted-foreground/60 hidden group-hover:inline">default</span>
                        )}
                      </div>
                      {!isDefault && (
                        <button onClick={() => removeExpense(cat)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all ml-2">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <button onClick={() => { saveExpense(DEFAULT_EXPENSE_CATEGORIES); toast({ title: 'Reset to defaults' }) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset to defaults
              </button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Custom categories are saved in your browser. Default categories (marked on hover) cannot be deleted.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}