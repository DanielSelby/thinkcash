'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Dot,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  CalendarClock, Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { buildForecast, aggregateByCurrency } from '@/lib/forecast'
import type { ForecastPoint } from '@/lib/forecast'

// ── helpers ────────────────────────────────────────────────────────────
function toDateKey(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function friendlyDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function daysFromNow(dateStr: string): number {
  return Math.round(
    (new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)
  )
}

const HORIZON_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

const THRESHOLD_OPTIONS = [
  { label: 'Zero (negative balance)', value: 0       },
  { label: 'GH₵500 low balance',      value: 500     },
  { label: 'GH₵1,000 low balance',    value: 1000    },
  { label: 'GH₵2,000 low balance',    value: 2000    },
  { label: 'GH₵5,000 low balance',    value: 5000    },
]

const CURRENCY_PALETTE: Record<string, string> = {
  GHS: '#16a34a',
  USD: '#2563eb',
  EUR: '#7c3aed',
  GBP: '#0891b2',
  AED: '#f59e0b',
  NGN: '#dc2626',
}
function getCurrencyColor(cur: string, i: number): string {
  const fallbacks = ['#16a34a','#2563eb','#7c3aed','#0891b2','#f59e0b','#dc2626','#db2777']
  return CURRENCY_PALETTE[cur] ?? fallbacks[i % fallbacks.length]
}

// ── custom tooltip ──────────────────────────────────────────────────────
function ForecastTooltip({ active, payload, label, currency, fmt }: any) {
  if (!active || !payload?.length) return null
  const point: ForecastPoint = payload[0]?.payload
  if (!point) return null
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-semibold text-sm mb-1">{friendlyDate(point.date)}</p>
      <p className="text-muted-foreground mb-1.5">{daysFromNow(point.date) === 0 ? 'Today' : `In ${daysFromNow(point.date)} day${daysFromNow(point.date) === 1 ? '' : 's'}`}</p>
      <p className="font-bold" style={{ color: payload[0]?.stroke }}>
        Projected: {fmt(payload[0]?.value, currency)}
      </p>
      {point.events?.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[9px]">Scheduled events</p>
          {point.events.map((e: any, i: number) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate">{e.title}</span>
              <span className={e.type === 'income' ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── custom dot — only renders on recurring-event days ──────────────────
function EventDot(props: any) {
  const { cx, cy, payload } = props
  if (!payload?.isRecurringEvent) return null
  return <circle cx={cx} cy={cy} r={4} fill={props.stroke} stroke="#fff" strokeWidth={2} />
}

// ── main component ──────────────────────────────────────────────────────
interface Props {
  rawAccounts: any[]
  incomes:     any[]
  expenses:    any[]
  transfers:   any[]
  recurring:   any[]
}

export function ForecastContent({ rawAccounts, incomes, expenses, transfers, recurring }: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [horizon,       setHorizon]       = useState(30)
  const [threshold,     setThreshold]     = useState(0)
  const [expandedCur,   setExpandedCur]   = useState<string | null>(null)
  const [showAccDetail, setShowAccDetail] = useState(false)

  const fmt = (n: number, cur = primaryCurrency) => formatCurrency(n, cur)

  // ── Compute live balances (same formula used everywhere else) ──────────
  const accountsWithBalance = useMemo(() =>
    rawAccounts.map(acc => {
      const totalIncome  = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn  = transfers.filter(t => t.to_account_id === acc.id).reduce((s, t) => s + Number(t.to_amount ?? t.amount), 0)
      return {
        ...acc,
        balance: Number(acc.opening_balance ?? 0) + totalIncome - totalExpense - transfersOut + transfersIn,
      }
    }), [rawAccounts, incomes, expenses, transfers])

  // ── Run the forecast engine ────────────────────────────────────────────
  const perAccountSeries = useMemo(() =>
    buildForecast({
      accounts:   accountsWithBalance,
      recurring,
      incomes,
      expenses,
      horizonDays: horizon,
      lookbackDays: 90,
      lowBalanceThreshold: threshold,
    }), [accountsWithBalance, recurring, incomes, expenses, horizon, threshold])

  const byCurrency = useMemo(() =>
    aggregateByCurrency(perAccountSeries), [perAccountSeries])

  const currencies = Object.keys(byCurrency)

  // ── Recurring items with account link status ────────────────────────
  const unlinkedRecurring = recurring.filter(r => !r.account_id)
  const linkedRecurring   = recurring.filter(r => r.account_id)

  // ── Currency summary cards ─────────────────────────────────────────
  const currencySummaries = useMemo(() => currencies.map((cur, i) => {
    const points   = byCurrency[cur]
    const lowest   = points.reduce((min, p) => p.balance < min.balance ? p : min, points[0])
    const highest  = points.reduce((max, p) => p.balance > max.balance ? p : max, points[0])
    const lastPt   = points[points.length - 1]
    const startBal = points[0]?.balance ?? 0
    const crossesThreshold = points.some(p => p.balance < threshold)
    const firstBelow = points.find(p => p.balance < threshold)
    return { cur, points, lowest, highest, lastPt, startBal, crossesThreshold, firstBelow, color: getCurrencyColor(cur, i) }
  }), [byCurrency, threshold])

  // ── Upcoming events (next 14 days, from recurring only) ───────────
  const upcomingEvents = useMemo(() => {
    const today = new Date()
    const events: { date: string; title: string; amount: number; type: string; accountName: string; currency: string }[] = []
    recurring.forEach(r => {
      let cursor = new Date(r.next_date)
      const horizon14 = addDays(today, 14)
      let safety = 0
      while (cursor <= horizon14 && safety < 60) {
        safety++
        if (cursor >= today) {
          const acc = accountsWithBalance.find(a => a.id === r.account_id)
          events.push({
            date: toDateKey(cursor),
            title: r.title,
            amount: Number(r.amount),
            type: r.type,
            accountName: acc?.name ?? 'Unassigned',
            currency: acc?.currency ?? primaryCurrency,
          })
        }
        const next = new Date(cursor)
        if (r.frequency === 'daily')   next.setDate(next.getDate() + 1)
        else if (r.frequency === 'weekly') next.setDate(next.getDate() + 7)
        else if (r.frequency === 'monthly') next.setMonth(next.getMonth() + 1)
        else if (r.frequency === 'yearly') next.setFullYear(next.getFullYear() + 1)
        else break
        cursor = next
      }
    })
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)
  }, [recurring, accountsWithBalance, primaryCurrency])

  // ── Chart tick formatter ────────────────────────────────────────────
  const tickFmt = (v: number, cur: string) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`
    return String(Math.round(v))
  }

  // ── Discretionary rate card ─────────────────────────────────────────
  const now = new Date()
  const cutoff = toDateKey(addDays(now, -90))
  const recentIncome  = incomes.filter(i  => i.date >= cutoff).reduce((s, i) => s + Number(i.amount), 0)
  const recentExpense = expenses.filter(e => e.date >= cutoff).reduce((s, e) => s + Number(e.amount), 0)
  const dailyRate     = (recentIncome - recentExpense) / 90

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            <CalendarClock className="w-5 h-5" /> Cash Flow Forecast
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Projected balance based on recurring transactions + average daily spending over the last 90 days.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon selector */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {HORIZON_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setHorizon(o.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={horizon === o.value ? { background: theme.colors.primary, color: '#fff' } : { color: '#64748b' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Unlinked recurring warning ── */}
      {unlinkedRecurring.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {unlinkedRecurring.length} recurring transaction{unlinkedRecurring.length > 1 ? 's' : ''} not linked to an account
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These won't appear in the forecast: <span className="font-medium">{unlinkedRecurring.map(r => r.title).join(', ')}</span>.
              Go to <a href="/recurring" className="underline font-semibold">Recurring Transactions</a> and assign each one an account.
            </p>
          </div>
        </div>
      )}

      {/* ── Low balance threshold picker ── */}
      <Card className="bg-white rounded-xl shadow-sm border border-border">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground">Warn me if projected balance drops below:</p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {THRESHOLD_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setThreshold(o.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border"
                  style={threshold === o.value
                    ? { background: theme.colors.primary, color: '#fff', borderColor: theme.colors.primary }
                    : { borderColor: '#e2e8f0', color: '#64748b' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary cards row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="h-1" style={{ background: theme.colors.primary }} />
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Linked Recurring</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 tabular-nums">{linkedRecurring.length}</p>
            <p className="text-[9px] sm:text-xs text-muted-foreground">{unlinkedRecurring.length} unlinked</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <CardContent className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Avg Daily Net</p>
            <p className={`text-lg sm:text-2xl font-bold mt-1 tabular-nums ${dailyRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {dailyRate >= 0 ? '+' : ''}{fmt(Math.abs(dailyRate))}
            </p>
            <p className="text-[9px] sm:text-xs text-muted-foreground">per day (90d avg)</p>
          </CardContent>
        </Card>
        {currencySummaries.slice(0, 2).map(s => (
          <Card key={s.cur} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="h-1" style={{ background: s.color }} />
            <CardContent className="p-3 sm:p-4">
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">
                {s.cur} in {horizon}d
              </p>
              <p className={`text-lg sm:text-2xl font-bold mt-1 tabular-nums ${s.lastPt.balance >= 0 ? '' : 'text-red-500'}`}>
                {formatCurrency(s.lastPt.balance, s.cur)}
              </p>
              <p className="text-[9px] sm:text-xs mt-0.5"
                style={{ color: s.lastPt.balance >= s.startBal ? '#16a34a' : '#dc2626' }}>
                {s.lastPt.balance >= s.startBal ? '▲' : '▼'} {formatCurrency(Math.abs(s.lastPt.balance - s.startBal), s.cur)} vs today
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Per-currency forecast charts ── */}
      {currencies.length === 0 ? (
        <Card className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
          <CalendarClock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
          <h3 className="font-semibold text-lg mb-1">No accounts to forecast</h3>
          <p className="text-muted-foreground text-sm">Add accounts in My Accounts, then link your recurring transactions to them.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {currencySummaries.map(s => {
            const isExpanded = expandedCur === s.cur || currencies.length === 1
            return (
              <Card key={s.cur} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="h-1.5" style={{ background: s.color }} />
                <CardHeader className="pb-0 pt-4 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          {s.cur} Balance Forecast
                          {s.crossesThreshold && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3" /> Warning
                            </span>
                          )}
                          {!s.crossesThreshold && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> On track
                            </span>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Today: <span className="font-semibold">{formatCurrency(s.startBal, s.cur)}</span>
                          {' · '}In {horizon} days: <span className="font-semibold" style={{ color: s.lastPt.balance >= 0 ? s.color : '#dc2626' }}>{formatCurrency(s.lastPt.balance, s.cur)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lowest projected</p>
                        <p className="text-sm font-bold tabular-nums" style={{ color: s.lowest.balance < threshold ? '#dc2626' : s.color }}>
                          {formatCurrency(s.lowest.balance, s.cur)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{friendlyDate(s.lowest.date)} ({daysFromNow(s.lowest.date)}d)</p>
                      </div>
                      {currencies.length > 1 && (
                        <button onClick={() => setExpandedCur(expandedCur === s.cur ? null : s.cur)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Warning banner */}
                  {s.crossesThreshold && s.firstBelow && (
                    <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                      <p className="text-xs text-red-700">
                        Projected to drop below {formatCurrency(threshold, s.cur)} in{' '}
                        <strong>{daysFromNow(s.firstBelow.date)} days</strong> ({friendlyDate(s.firstBelow.date)})
                        — balance: <strong>{formatCurrency(s.firstBelow.balance, s.cur)}</strong>
                      </p>
                    </div>
                  )}
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-4 pb-4 px-3 sm:px-5">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={s.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${s.cur}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={s.color} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={v => {
                            const d = new Date(v)
                            return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
                          }}
                          interval={horizon === 30 ? 4 : horizon === 60 ? 9 : 14}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          width={52}
                          tickFormatter={v => tickFmt(v, s.cur)}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<ForecastTooltip currency={s.cur} fmt={formatCurrency} />} />
                        {threshold > 0 && (
                          <ReferenceLine y={threshold} stroke="#f59e0b" strokeDasharray="4 2"
                            label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                        )}
                        <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 2" strokeOpacity={0.4} />
                        {/* Today line */}
                        <ReferenceLine x={toDateKey(new Date())} stroke={s.color} strokeDasharray="3 3" strokeOpacity={0.5}
                          label={{ value: 'Today', position: 'insideTopLeft', fontSize: 9, fill: s.color }} />
                        <Area
                          type="monotone"
                          dataKey="balance"
                          stroke={s.color}
                          strokeWidth={2}
                          fill={`url(#grad-${s.cur})`}
                          dot={<EventDot stroke={s.color} />}
                          activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                          name={`${s.cur} Balance`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                    <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-full border-2" style={{ borderColor: s.color, background: '#fff' }} />
                        Recurring event on this day
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-t-2 border-dashed border-amber-500" />
                        Warning threshold
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-6 border-t-2 border-dashed border-red-400 opacity-50" />
                        Zero line
                      </span>
                      <span className="ml-auto italic">
                        Dots mark days with a scheduled recurring transaction
                      </span>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Upcoming recurring events ── */}
      {upcomingEvents.length > 0 && (
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Upcoming Events — Next 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {upcomingEvents.map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${e.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {e.type === 'income'
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {friendlyDate(e.date)} · {daysFromNow(e.date) === 0 ? 'Today' : `In ${daysFromNow(e.date)} day${daysFromNow(e.date) === 1 ? '' : 's'}`} · {e.accountName}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${e.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {e.type === 'income' ? '+' : '-'}{formatCurrency(e.amount, e.currency)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── How this works ── */}
      <Card className="bg-muted/30 rounded-xl border border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">How this forecast is calculated</p>
              <p><strong>Recurring transactions</strong> — each active recurring item linked to an account contributes its exact amount on each scheduled future date (daily/weekly/monthly/yearly).</p>
              <p><strong>Discretionary spending</strong> — your last 90 days of income and expenses (excluding recurring-matched items) are averaged into a daily net rate ({dailyRate >= 0 ? '+' : ''}{fmt(Math.abs(dailyRate))}/day) and applied to every day in the forecast. This is an estimate, not a guarantee.</p>
              <p><strong>Dots on the chart</strong> mark days where a recurring transaction is scheduled.</p>
              <p><strong>To improve accuracy:</strong> link every recurring transaction to an account in the Recurring Transactions page, and make sure your income/expense history is up to date.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}