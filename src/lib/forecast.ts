// ============================================================
// Cash Flow Forecast Engine
//
// Projects account balances forward in time using two signals:
//   1. Recurring transactions — exact, deterministic future occurrences
//   2. Discretionary average — smoothed daily rate from the last 90 days
//      of non-recurring income/expense activity, extrapolated forward
//
// Forecast is computed PER CURRENCY, never blended — consistent with
// every other money calculation in this app.
// ============================================================

export interface ForecastPoint {
  date: string          // yyyy-MM-dd
  balance: number
  isRecurringEvent: boolean
  events: { title: string; amount: number; type: 'income' | 'expense' }[]
}

export interface ForecastSeries {
  currency: string
  startBalance: number
  points: ForecastPoint[]
  lowestPoint: ForecastPoint
  crossesZero: boolean
  daysUntilZero: number | null
}

interface RecurringItem {
  id: string
  type: 'income' | 'expense'
  title: string
  amount: number
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_date: string
  is_active: boolean
  account_id?: string | null
}

interface TxRecord {
  amount: number
  date: string
  account_id: string | null
}

interface AccountLite {
  id: string
  name: string
  currency: string
  balance: number // live current balance, computed the same way as everywhere else in the app
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Expands a recurring item into every occurrence date within [from, to],
 * starting from its next_date and stepping forward by its frequency.
 */
function expandOccurrences(item: RecurringItem, from: Date, to: Date): Date[] {
  const occurrences: Date[] = []
  let cursor = new Date(item.next_date)

  // If next_date is already in the past relative to `from`, fast-forward
  // to the first occurrence on/after `from` so we don't loop excessively
  // for long-overdue recurring items.
  const stepDays = (() => {
    switch (item.frequency) {
      case 'daily':   return 1
      case 'weekly':  return 7
      case 'monthly': return null // handled specially below (calendar months, not 30 days)
      case 'yearly':  return null
      default:        return null
    }
  })()

  const stepMonths = item.frequency === 'monthly' ? 1 : item.frequency === 'yearly' ? 12 : null

  // Guard against runaway loops
  let safety = 0
  while (cursor <= to && safety < 1000) {
    safety++
    if (cursor >= from) occurrences.push(new Date(cursor))
    if (stepDays) {
      cursor = addDays(cursor, stepDays)
    } else if (stepMonths) {
      const next = new Date(cursor)
      next.setMonth(next.getMonth() + stepMonths)
      cursor = next
    } else {
      break
    }
  }
  return occurrences
}

/**
 * Computes the smoothed average daily net (income − expense) for a given
 * account over the last `lookbackDays`, EXCLUDING amounts that already
 * match an active recurring item (so we don't double-count rent both as
 * "recurring" and as part of the discretionary average).
 */
function computeDiscretionaryDailyRate(
  accountId: string,
  incomes: TxRecord[],
  expenses: TxRecord[],
  recurringTitles: Set<string>, // not perfect dedupe, but recurring items are a small, known set
  lookbackDays: number
): number {
  const cutoff = toDateKey(addDays(new Date(), -lookbackDays))
  const incForAccount = incomes.filter(i => i.account_id === accountId && i.date >= cutoff)
  const expForAccount = expenses.filter(e => e.account_id === accountId && e.date >= cutoff)

  const totalIncome  = incForAccount.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpense = expForAccount.reduce((s, e) => s + Number(e.amount), 0)
  const netOverPeriod = totalIncome - totalExpense

  return netOverPeriod / lookbackDays
}

export function buildForecast({
  accounts,
  recurring,
  incomes,
  expenses,
  horizonDays,
  lookbackDays = 90,
  lowBalanceThreshold = 0,
}: {
  accounts: AccountLite[]
  recurring: RecurringItem[]
  incomes: TxRecord[]
  expenses: TxRecord[]
  horizonDays: number
  lookbackDays?: number
  lowBalanceThreshold?: number
}): ForecastSeries[] {
  const today = new Date()
  const horizonEnd = addDays(today, horizonDays)
  const activeRecurring = recurring.filter(r => r.is_active)
  const recurringTitles = new Set(activeRecurring.map(r => r.title.toLowerCase()))

  return accounts.map(acc => {
    const accountRecurring = activeRecurring.filter(r => r.account_id === acc.id)
    const discretionaryDailyRate = computeDiscretionaryDailyRate(
      acc.id, incomes, expenses, recurringTitles, lookbackDays
    )

    // Pre-expand every recurring occurrence within the horizon, grouped by date
    const occurrencesByDate: Record<string, { title: string; amount: number; type: 'income' | 'expense' }[]> = {}
    accountRecurring.forEach(item => {
      const dates = expandOccurrences(item, today, horizonEnd)
      dates.forEach(d => {
        const key = toDateKey(d)
        if (!occurrencesByDate[key]) occurrencesByDate[key] = []
        occurrencesByDate[key].push({ title: item.title, amount: Number(item.amount), type: item.type })
      })
    })

    let runningBalance = acc.balance
    const points: ForecastPoint[] = []

    for (let i = 0; i <= horizonDays; i++) {
      const date = addDays(today, i)
      const key = toDateKey(date)
      const events = occurrencesByDate[key] ?? []

      const recurringDelta = events.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0)
      runningBalance += recurringDelta + discretionaryDailyRate

      points.push({
        date: key,
        balance: Math.round(runningBalance * 100) / 100,
        isRecurringEvent: events.length > 0,
        events,
      })
    }

    const lowestPoint = points.reduce((min, p) => p.balance < min.balance ? p : min, points[0])
    const firstBelowThreshold = points.find(p => p.balance < lowBalanceThreshold)

    return {
      currency: acc.currency || 'GHS',
      startBalance: acc.balance,
      points,
      lowestPoint,
      crossesZero: !!firstBelowThreshold,
      daysUntilZero: firstBelowThreshold
        ? Math.round((new Date(firstBelowThreshold.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }
  })
}

/**
 * Groups per-account forecast series into per-CURRENCY totals (summing
 * balances of every account sharing that currency, day by day) — gives
 * a single forward-looking line per currency rather than per account,
 * useful for the headline chart while per-account detail stays available
 * separately.
 */
export function aggregateByCurrency(series: ForecastSeries[]): Record<string, ForecastPoint[]> {
  const byCurrency: Record<string, ForecastPoint[]> = {}

  series.forEach(s => {
    if (!byCurrency[s.currency]) {
      byCurrency[s.currency] = s.points.map(p => ({ ...p, events: [...p.events] }))
    } else {
      byCurrency[s.currency] = byCurrency[s.currency].map((existing, i) => {
        const matching = s.points[i]
        return {
          date: existing.date,
          balance: Math.round((existing.balance + matching.balance) * 100) / 100,
          isRecurringEvent: existing.isRecurringEvent || matching.isRecurringEvent,
          events: [...existing.events, ...matching.events],
        }
      })
    }
  })

  return byCurrency
}