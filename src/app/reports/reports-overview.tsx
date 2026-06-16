'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns'
import { FileText, FileSpreadsheet, Download, BarChart3, TrendingUp, TrendingDown, PiggyBank, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_COLORS } from '@/lib/utils'
import { PLContent } from './pl-content'
import type { Income, Expense } from '@/types'

interface Props { incomes: Income[]; expenses: Expense[] }

type ReportPeriod = 'monthly' | 'quarterly' | 'annual'

const REPORT_VIEWS = [
  { value: 'overview', label: 'Overview' },
  { value: 'pl',       label: 'P&L Statement' },
]

// jsPDF cannot render ₵ unicode — use ASCII-safe prefix for all PDF/Excel exports
const pdfFmt = (n: number) =>
  'GHS ' + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

const APP_NAME = 'Think-Shika PA'

// ── Main Wrapper Component ──────────────────────────────────────────
export function ReportsOverview({ incomes, expenses }: Props) {
  const [view, setView] = useState('overview')
  const [dropOpen, setDropOpen] = useState(false)
  const current = REPORT_VIEWS.find(v => v.value === view)!

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Dropdown navigation view controller */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setDropOpen(o => !o)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-white text-sm font-semibold shadow-sm hover:border-primary/50 transition-colors"
          >
            {current.label}
            <ChevronDown className={`w-4 h-4 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropOpen && (
            <div className="absolute top-11 left-0 z-50 bg-white border border-border rounded-xl shadow-lg overflow-hidden w-48">
              {REPORT_VIEWS.map(v => (
                <button
                  key={v.value}
                  onClick={() => { setView(v.value); setDropOpen(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    view === v.value
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <h1 className="font-display text-xl font-bold">{current.label}</h1>
      </div>

      {/* Content Rendering Switchboard */}
      {view === 'overview' && <ReportsOverview incomes={incomes} expenses={expenses} />}
      {view === 'pl'       && <PLContent       incomes={incomes} expenses={expenses} />}
    </div>
  )
}

