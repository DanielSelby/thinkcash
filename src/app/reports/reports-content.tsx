'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ReportsOverview } from './reports-overview'
import { PLContent } from './pl-content'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes:      any[]
  expenses:     any[]
  accounts:     any[]
  assets:       any[]
  investments:  any[]
  debts:        any[]
  loans:        any[]
  goals:        any[]
}

const REPORT_VIEWS = [
  { value: 'overview', label: 'Overview'      },
  { value: 'pl',       label: 'P&L Statement' },
]

export function ReportsContent({
  incomes, expenses, accounts,
  assets, investments, debts, loans, goals,
}: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [view,     setView]     = useState<'overview' | 'pl'>('overview')
  const [dropOpen, setDropOpen] = useState(false)

  const current = REPORT_VIEWS.find(v => v.value === view)!

  function handleSelect(next: 'overview' | 'pl') {
    setView(next)
    setDropOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <button
            onClick={() => setDropOpen(o => !o)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl border border-border bg-white text-sm font-semibold shadow-sm hover:border-primary/50 transition-colors"
          >
            {current.label}
            <ChevronDown
              className="w-4 h-4 transition-transform"
              style={{ transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {dropOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
              <div className="absolute top-11 left-0 z-50 w-48 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                {REPORT_VIEWS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => handleSelect(v.value as 'overview' | 'pl')}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted"
                    style={
                      view === v.value
                        ? { background: theme.colors.primaryPale, color: theme.colors.primary, fontWeight: 600 }
                        : { color: '#6b7280' }
                    }
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
          {current.label}
        </h1>
      </div>

      {view === 'overview' ? (
        <ReportsOverview
          incomes={incomes}
          expenses={expenses}
          accounts={accounts}
          assets={assets}
          investments={investments}
          debts={debts}
          loans={loans}
          goals={goals}
        />
      ) : (
        <PLContent
          incomes={incomes}
          expenses={expenses}
          accounts={accounts}
          assets={assets}
          investments={investments}
          debts={debts}
          loans={loans}
        />
      )}
    </div>
  )
}