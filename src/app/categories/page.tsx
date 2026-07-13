'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { canAccessPage } from '@/lib/page-access'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Tag, TrendingUp, TrendingDown, RotateCcw, Pencil, Check, X } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { createClient } from '@/lib/supabase/client'

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

// ── Inline edit state shape ──────────────────────────────────────────
interface EditState {
  type: 'income' | 'expense'
  original: string
  draft: string
}

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

  // ── Edit state — only one category editable at a time ───────────────
  const [editing, setEditing] = useState<EditState | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('income_categories, expense_categories')
            .eq('id', user.id)
            .single()

          if (prof?.income_categories?.length) {
            setIncomeCategories(prof.income_categories)
            localStorage.setItem(STORAGE_KEY_INCOME, JSON.stringify(prof.income_categories))
          } else {
            const inc = localStorage.getItem(STORAGE_KEY_INCOME)
            setIncomeCategories(inc ? JSON.parse(inc) : DEFAULT_INCOME_CATEGORIES)
          }

          if (prof?.expense_categories?.length) {
            setExpenseCategories(prof.expense_categories)
            localStorage.setItem(STORAGE_KEY_EXPENSE, JSON.stringify(prof.expense_categories))
          } else {
            const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
            setExpenseCategories(exp ? JSON.parse(exp) : DEFAULT_EXPENSE_CATEGORIES)
          }
        } else {
          const inc = localStorage.getItem(STORAGE_KEY_INCOME)
          const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
          setIncomeCategories(inc ? JSON.parse(inc) : DEFAULT_INCOME_CATEGORIES)
          setExpenseCategories(exp ? JSON.parse(exp) : DEFAULT_EXPENSE_CATEGORIES)
        }
      } catch {
        const inc = localStorage.getItem(STORAGE_KEY_INCOME)
        const exp = localStorage.getItem(STORAGE_KEY_EXPENSE)
        setIncomeCategories(inc ? JSON.parse(inc) : DEFAULT_INCOME_CATEGORIES)
        setExpenseCategories(exp ? JSON.parse(exp) : DEFAULT_EXPENSE_CATEGORIES)
      }
      setLoaded(true)
    }
    load()
  }, [])

  const saveIncome  = async (cats: string[]) => {
    setIncomeCategories(cats)
    localStorage.setItem(STORAGE_KEY_INCOME, JSON.stringify(cats))
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles')
          .update({ income_categories: cats })
          .eq('id', user.id)
      }
    } catch { /* silent — localStorage is the fallback */ }
  }
  const saveExpense = async (cats: string[]) => {
    setExpenseCategories(cats)
    localStorage.setItem(STORAGE_KEY_EXPENSE, JSON.stringify(cats))
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles')
          .update({ expense_categories: cats })
          .eq('id', user.id)
      }
    } catch { /* silent */ }
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

  // ── Start editing a category ─────────────────────────────────────────
  const startEdit = (type: 'income' | 'expense', cat: string) => {
    setEditing({ type, original: cat, draft: cat })
  }

  // ── Confirm the rename ───────────────────────────────────────────────
  const confirmEdit = async () => {
    if (!editing) return
    const draft = editing.draft.trim()
    if (!draft) {
      toast({ title: 'Category name cannot be empty', variant: 'destructive' }); return
    }
    if (draft === editing.original) { setEditing(null); return }

    if (editing.type === 'income') {
      if (incomeCategories.map(c => c.toLowerCase()).includes(draft.toLowerCase())) {
        toast({ title: 'That name already exists', variant: 'destructive' }); return
      }
      saveIncome(incomeCategories.map(c => c === editing.original ? draft : c))
    } else {
      if (expenseCategories.map(c => c.toLowerCase()).includes(draft.toLowerCase())) {
        toast({ title: 'That name already exists', variant: 'destructive' }); return
      }
      saveExpense(expenseCategories.map(c => c === editing.original ? draft : c))
    }

    // ── Propagate rename to all existing database rows ────────────
    try {
      const supabase = createClient()
      const table = editing.type === 'income' ? 'incomes' : 'expenses'

      // Update existing transactions
      await supabase
        .from(table)
        .update({ category: draft })
        .eq('category', editing.original)

      // Update budgets (expense categories only)
      if (editing.type === 'expense') {
        await supabase
          .from('budgets')
          .update({ category: draft })
          .eq('category', editing.original)
      }

      // Update recurring transactions
      await supabase
        .from('recurring_transactions')
        .update({ category: draft })
        .eq('category', editing.original)
        .eq('type', editing.type)

      toast({ title: `Renamed to "${draft}" — all existing records updated`, variant: 'success' })
    } catch (err) {
      // Category list is already updated locally; DB update failed silently
      toast({ title: `Renamed to "${draft}"`, description: 'Some existing records may still show the old name.', variant: 'success' })
    }

    setEditing(null)
  }
  const cancelEdit = () => setEditing(null)

  // ── Shared category row renderer ─────────────────────────────────────
  const CategoryRow = ({
    cat,
    type,
    isDefault,
    accentBg,
    accentBorder,
    accentTag,
  }: {
    cat: string
    type: 'income' | 'expense'
    isDefault: boolean
    accentBg: string
    accentBorder: string
    accentTag: string
  }) => {
    const isEditingThis = editing?.type === type && editing?.original === cat

    if (isEditingThis) {
      return (
        <div
          key={cat}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${accentBorder}`}
          style={{ background: type === 'income' ? '#f0fdf4' : '#fef2f2' }}
        >
          <Tag className={`w-3 h-3 flex-shrink-0 ${accentTag}`} />
          <Input
            autoFocus
            value={editing.draft}
            onChange={e => setEditing(prev => prev ? { ...prev, draft: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmEdit()
              if (e.key === 'Escape') cancelEdit()
            }}
            className="h-7 text-sm flex-1 px-2 py-0 border-0 bg-white shadow-sm rounded-md focus-visible:ring-1"
          />
          {/* Confirm */}
          <button
            onClick={confirmEdit}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex-shrink-0"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          {/* Cancel */}
          <button
            onClick={cancelEdit}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors flex-shrink-0"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }

    return (
      <div
        key={cat}
        className={`flex items-center justify-between px-3 py-2 rounded-lg border ${accentBorder} group`}
        style={{ background: type === 'income' ? 'rgba(240,253,244,0.7)' : 'rgba(254,242,242,0.7)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Tag className={`w-3 h-3 flex-shrink-0 ${accentTag}`} />
          <span className="text-sm truncate">{cat}</span>
          {isDefault && (
            <span className="text-xs text-muted-foreground/60 hidden group-hover:inline flex-shrink-0">
              default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2 flex-shrink-0">
          {/* Edit pencil — available for ALL categories including defaults */}
          <button
            onClick={() => startEdit(type, cat)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {/* Delete — only non-defaults */}
          {!isDefault && (
            <button
              onClick={() => type === 'income' ? removeIncome(cat) : removeExpense(cat)}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    )
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
            Manage income and expense categories. Hover any row to edit or delete it.
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
                <Button
                  size="sm" onClick={addIncome}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0 h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {incomeCategories.map(cat => (
                  <CategoryRow
                    key={cat}
                    cat={cat}
                    type="income"
                    isDefault={DEFAULT_INCOME_CATEGORIES.includes(cat)}
                    accentBg="bg-green-50/70"
                    accentBorder="border-green-100"
                    accentTag="text-green-600"
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  if (editing?.type === 'income') setEditing(null)
                  saveIncome(DEFAULT_INCOME_CATEGORIES)
                  toast({ title: 'Reset to defaults' })
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
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
                <Button
                  size="sm" onClick={addExpense}
                  style={{ background: theme.colors.primary, color: '#fff' }}
                  className="flex-shrink-0 h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {expenseCategories.map(cat => (
                  <CategoryRow
                    key={cat}
                    cat={cat}
                    type="expense"
                    isDefault={DEFAULT_EXPENSE_CATEGORIES.includes(cat)}
                    accentBg="bg-red-50/70"
                    accentBorder="border-red-100"
                    accentTag="text-red-500"
                  />
                ))}
              </div>

              <button
                onClick={() => {
                  if (editing?.type === 'expense') setEditing(null)
                  saveExpense(DEFAULT_EXPENSE_CATEGORIES)
                  toast({ title: 'Reset to defaults' })
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset to defaults
              </button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Custom categories are saved in your browser. Default categories (marked on hover) can be renamed but not deleted. Press <kbd className="px-1 py-0.5 rounded border border-amber-300 bg-amber-100 text-xs font-mono">Enter</kbd> to confirm or <kbd className="px-1 py-0.5 rounded border border-amber-300 bg-amber-100 text-xs font-mono">Esc</kbd> to cancel an edit.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}