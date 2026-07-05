'use client'

import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
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

// ── helpers ──────────────────────────────────────────────────────────
function toDateKey(d: Date): string { return d.toISOString().split('T')[0] }
function addDays(date: Date, n: number): Date { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function friendlyDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysFromNow(dateStr: string): number {
  return Math.round((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
}

const HORIZON_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
]

const THRESHOLD_OPTIONS = [
  { label: 'Zero (negative balance)', value: 0    },
  { label: 'GH₵500 low balance',      value: 500  },
  { label: 'GH₵1,000 low balance',    value: 1000 },
  { label: 'GH₵2,000 low balance',    value: 2000 },
  { label: 'GH₵5,000 low balance',    value: 5000 },
]

const CURRENCY_PALETTE: Record<string, string> = {
  GHS: '#16a34a', USD: '#2563eb', EUR: '#7c3aed',
  GBP: '#0891b2', AED: '#f59e0b', NGN: '#dc2626',
}
function getCurrencyColor(cur: string, i: number): string {
  const fallbacks = ['#16a34a','#2563eb','#7c3aed','#0891b2','#f59e0b','#dc2626','#db2777']
  return CURRENCY_PALETTE[cur] ?? fallbacks[i % fallbacks.length]
}

// ── ForecastTooltip ───────────────────────────────────────────────────
function ForecastTooltip({ active, payload, label, currency, exchangeRate }: any) {
  if (!active || !payload?.length) return null
  const point: ForecastPoint = payload[0]?.payload
  if (!point) return null
  const balance = Number(payload[0]?.value ?? 0)
  const isGHS   = currency === 'GHS'
  const ghsVal  = isGHS ? balance : balance * (exchangeRate ?? 1)
  return (
    <div className="bg-white border border-border rounded-xl shadow-lg p-3 text-xs max-w-[240px] space-y-2">
      <p className="font-semibold text-sm border-b border-border pb-1.5">{friendlyDate(point.date)}</p>
      <p className="text-muted-foreground text-[10px]">
        {daysFromNow(point.date) === 0 ? 'Today' : `In ${daysFromNow(point.date)} day${daysFromNow(point.date) === 1 ? '' : 's'}`}
      </p>
      <div>
        <p className="font-bold" style={{ color: payload[0]?.stroke }}>
          {formatCurrency(balance, currency)}
        </p>
        {!isGHS && exchangeRate && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            ≈ {formatCurrency(ghsVal, 'GHS')} converted
          </p>
        )}
      </div>
      {point.events?.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
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

// ── EventDot ──────────────────────────────────────────────────────────
function EventDot(props: any) {
  const { cx, cy, payload, stroke } = props
  if (!payload?.isRecurringEvent) return null
  return <circle cx={cx} cy={cy} r={4} fill="#fff" stroke={stroke} strokeWidth={2} />
}

// ── FlipKPICard ───────────────────────────────────────────────────────
function FlipKPICard({ label, front, back, color, sub }: {
  label: string
  front: React.ReactNode
  back:  React.ReactNode
  color: string
  sub?:  React.ReactNode
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      className="relative cursor-pointer select-none"
      style={{ perspective: '900px', minHeight: 100 }}
      onClick={() => setFlipped(v => !v)}
      title="Click to flip"
    >
      <div className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', minHeight: 'inherit' }}>
        {/* Front */}
        <div className="absolute inset-0 rounded-xl border border-border bg-white shadow-sm overflow-hidden"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
          <div className="h-1" style={{ background: color }} />
          <div className="p-3 sm:p-4">
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">{label}</p>
            <div className="mt-1">{front}</div>
            {sub && <div className="mt-0.5">{sub}</div>}
            <p className="text-[8px] text-muted-foreground/40 mt-1 text-right">Click to flip</p>
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 rounded-xl overflow-hidden shadow-sm"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: color }}>
          <div className="p-3 sm:p-4 h-full flex flex-col justify-between">
            <p className="text-[9px] font-bold text-white/70 uppercase tracking-wide">{label}</p>
            <div className="text-white">{back}</div>
            <p className="text-[8px] text-white/40 text-right">Click to flip back</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────
interface Props {
  rawAccounts:    any[]
  incomes:        any[]
  expenses:       any[]
  transfers:      any[]
  recurring:      any[]
  exchangeRates?: Record<string, number> // e.g. { USD: 15.2, EUR: 16.5 } — GHS per 1 unit
}

export function ForecastContent({ rawAccounts, incomes, expenses, transfers, recurring, exchangeRates = {} }: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [horizon,       setHorizon]       = useState(30)
  const [threshold,     setThreshold]     = useState(0)     // always in GHS
  const [expandedCur,   setExpandedCur]   = useState<string | null>(null)

  const fmt = (n: number, cur = primaryCurrency) => formatCurrency(n, cur)

  // ── Compute live balances ─────────────────────────────────────────
  const accountsWithBalance = useMemo(() =>
    rawAccounts.map(acc => {
      const totalIncome  = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn  = transfers.filter(t => t.to_account_id   === acc.id).reduce((s, t) => s + Number(t.to_amount ?? t.amount), 0)
      return { ...acc, balance: Number(acc.opening_balance ?? 0) + totalIncome - totalExpense - transfersOut + transfersIn }
    }), [rawAccounts, incomes, expenses, transfers])

  // ── Forecast engine ───────────────────────────────────────────────
  const perAccountSeries = useMemo(() =>
    buildForecast({
      accounts: accountsWithBalance, recurring, incomes, expenses,
      horizonDays: horizon, lookbackDays: 90, lowBalanceThreshold: threshold,
    }), [accountsWithBalance, recurring, incomes, expenses, horizon, threshold])

  const byCurrency = useMemo(() => aggregateByCurrency(perAccountSeries), [perAccountSeries])
  const currencies = Object.keys(byCurrency)

  // ── Recurring items ───────────────────────────────────────────────
  const unlinkedRecurring = recurring.filter(r => !r.account_id)
  const linkedRecurring   = recurring.filter(r =>  r.account_id)

  // ── Currency summaries — threshold converted per currency ─────────
  const currencySummaries = useMemo(() => currencies.map((cur, i) => {
    const points   = byCurrency[cur]
    const rate     = cur === 'GHS' ? 1 : (exchangeRates[cur] ?? 1)
    // Convert GHS threshold to this currency (divide since rate = GHS per 1 foreign unit)
    const thresholdInCur = cur === 'GHS' ? threshold : threshold / rate

    const lowest   = points.reduce((min, p) => p.balance < min.balance ? p : min, points[0])
    const highest  = points.reduce((max, p) => p.balance > max.balance ? p : max, points[0])
    const lastPt   = points[points.length - 1]
    const startBal = points[0]?.balance ?? 0

    const crossesThreshold = points.some(p => p.balance < thresholdInCur)
    const firstBelow       = points.find(p => p.balance < thresholdInCur)

    const ghsEquivNow  = startBal * rate
    const ghsEquivEnd  = lastPt.balance * rate

    return {
      cur, points, lowest, highest, lastPt, startBal,
      crossesThreshold, firstBelow,
      color: getCurrencyColor(cur, i),
      thresholdInCur,
      rate,
      ghsEquivNow,
      ghsEquivEnd,
      isGHS: cur === 'GHS',
    }
  }), [byCurrency, threshold, exchangeRates])

  // ── Upcoming events ───────────────────────────────────────────────
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
          events.push({ date: toDateKey(cursor), title: r.title, amount: Number(r.amount), type: r.type, accountName: acc?.name ?? 'Unassigned', currency: acc?.currency ?? primaryCurrency })
        }
        const next = new Date(cursor)
        if      (r.frequency === 'daily')   next.setDate(next.getDate() + 1)
        else if (r.frequency === 'weekly')  next.setDate(next.getDate() + 7)
        else if (r.frequency === 'monthly') next.setMonth(next.getMonth() + 1)
        else if (r.frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1)
        else break
        cursor = next
      }
    })
    return events.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)
  }, [recurring, accountsWithBalance, primaryCurrency])

  // ── Discretionary rate ────────────────────────────────────────────
  const now          = new Date()
  const cutoff       = toDateKey(addDays(now, -90))
  const recentIncome  = incomes.filter(i  => i.date >= cutoff).reduce((s, i) => s + Number(i.amount), 0)
  const recentExpense = expenses.filter(e => e.date >= cutoff).reduce((s, e) => s + Number(e.amount), 0)
  const dailyRate     = (recentIncome - recentExpense) / 90

  const tickFmt = (v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            <CalendarClock className="w-5 h-5" /> Cash Flow Forecast
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Projected balance based on recurring transactions + average daily spending over the last 90 days.
          </p>
        </div>
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

      {/* Unlinked recurring warning */}
      {unlinkedRecurring.length > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {unlinkedRecurring.length} recurring transaction{unlinkedRecurring.length > 1 ? 's' : ''} not linked to an account
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              These won't appear in the forecast: <span className="font-medium">{unlinkedRecurring.map(r => r.title).join(', ')}</span>.{' '}
              Go to <a href="/recurring" className="underline font-semibold">Recurring Transactions</a> and assign each one an account.
            </p>
          </div>
        </div>
      )}

      {/* Threshold picker */}
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
            {threshold > 0 && currencies.filter(c => c !== 'GHS').length > 0 && (
              <p className="text-[10px] text-muted-foreground italic ml-auto">
                Foreign currencies use converted GHS equivalent
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI flip cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Linked Recurring */}
        <FlipKPICard
          label="Linked Recurring"
          color={theme.colors.primary}
          front={<p className="text-lg sm:text-2xl font-bold tabular-nums">{linkedRecurring.length}</p>}
          sub={<p className="text-[9px] sm:text-xs text-muted-foreground">{unlinkedRecurring.length} unlinked</p>}
          back={
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-white/80"><span>Linked</span><span className="font-bold">{linkedRecurring.length}</span></div>
              <div className="flex justify-between text-white/70"><span>Unlinked</span><span>{unlinkedRecurring.length}</span></div>
              <div className="flex justify-between text-white/70 border-t border-white/20 pt-1"><span>Total</span><span>{recurring.length}</span></div>
            </div>
          }
        />

        {/* Avg Daily Net */}
        <FlipKPICard
          label="Avg Daily Net"
          color="#2563eb"
          front={
            <p className={`text-lg sm:text-2xl font-bold tabular-nums ${dailyRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {dailyRate >= 0 ? '+' : ''}{fmt(Math.abs(dailyRate))}
            </p>
          }
          sub={<p className="text-[9px] sm:text-xs text-muted-foreground">per day (90d avg)</p>}
          back={
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-white/80"><span>90d Income</span><span className="font-bold">{fmt(recentIncome)}</span></div>
              <div className="flex justify-between text-white/70"><span>90d Expenses</span><span>{fmt(recentExpense)}</span></div>
              <div className="flex justify-between text-white/70 border-t border-white/20 pt-1">
                <span>Daily rate</span>
                <span className={dailyRate >= 0 ? 'text-green-300' : 'text-red-300'}>{dailyRate >= 0 ? '+' : ''}{fmt(Math.abs(dailyRate))}</span>
              </div>
            </div>
          }
        />

        {/* Currency forecast KPI cards — first 2 currencies */}
        {currencySummaries.slice(0, 2).map(s => (
          <FlipKPICard
            key={s.cur}
            label={`${s.cur} in ${horizon}d`}
            color={s.color}
            front={
              <div>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums ${s.lastPt.balance >= 0 ? '' : 'text-red-500'}`}>
                  {formatCurrency(s.lastPt.balance, s.cur)}
                </p>
                {!s.isGHS && (
                  <p className="text-[9px] text-muted-foreground tabular-nums">
                    ≈ {formatCurrency(s.ghsEquivEnd, 'GHS')} GHS
                  </p>
                )}
              </div>
            }
            sub={
              <p className="text-[9px] sm:text-xs tabular-nums"
                style={{ color: s.lastPt.balance >= s.startBal ? '#16a34a' : '#dc2626' }}>
                {s.lastPt.balance >= s.startBal ? '▲' : '▼'}{formatCurrency(Math.abs(s.lastPt.balance - s.startBal), s.cur)} vs today
              </p>
            }
            back={
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-white/80">
                  <span>Today</span><span className="font-bold">{formatCurrency(s.startBal, s.cur)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>In {horizon}d</span><span>{formatCurrency(s.lastPt.balance, s.cur)}</span>
                </div>
                {!s.isGHS && (
                  <div className="flex justify-between text-white/60 text-[10px] border-t border-white/20 pt-1">
                    <span>GHS equiv (end)</span><span>≈ {formatCurrency(s.ghsEquivEnd, 'GHS')}</span>
                  </div>
                )}
                <div className="flex justify-between text-white/70 border-t border-white/20 pt-1">
                  <span>Lowest</span><span>{formatCurrency(s.lowest.balance, s.cur)}</span>
                </div>
              </div>
            }
          />
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
                          {s.crossesThreshold ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3" /> Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3" /> On track
                            </span>
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Today: <span className="font-semibold">{formatCurrency(s.startBal, s.cur)}</span>
                          {!s.isGHS && <span className="text-[10px]"> (≈ {formatCurrency(s.ghsEquivNow, 'GHS')})</span>}
                          {' · '}In {horizon} days:{' '}
                          <span className="font-semibold" style={{ color: s.lastPt.balance >= 0 ? s.color : '#dc2626' }}>
                            {formatCurrency(s.lastPt.balance, s.cur)}
                          </span>
                          {!s.isGHS && <span className="text-[10px] text-muted-foreground"> (≈ {formatCurrency(s.ghsEquivEnd, 'GHS')})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lowest projected</p>
                        <p className="text-sm font-bold tabular-nums"
                          style={{ color: s.lowest.balance < s.thresholdInCur ? '#dc2626' : s.color }}>
                          {formatCurrency(s.lowest.balance, s.cur)}
                        </p>
                        {!s.isGHS && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            ≈ {formatCurrency(s.lowest.balance * s.rate, 'GHS')}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          {friendlyDate(s.lowest.date)} ({daysFromNow(s.lowest.date)}d)
                        </p>
                      </div>
                      {currencies.length > 1 && (
                        <button onClick={() => setExpandedCur(expandedCur === s.cur ? null : s.cur)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Warning banner — shows foreign amount + GHS equivalent */}
                  {s.crossesThreshold && s.firstBelow && (
                    <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 text-xs text-red-700 space-y-0.5">
                        <p>
                          Projected to drop below{' '}
                          <strong>{formatCurrency(s.thresholdInCur, s.cur)}</strong>
                          {!s.isGHS && <span className="text-[10px]"> (≈ {formatCurrency(threshold, 'GHS')})</span>}
                          {' '}in <strong>{daysFromNow(s.firstBelow.date)} days</strong> ({friendlyDate(s.firstBelow.date)})
                        </p>
                        <p>
                          Balance at that point:{' '}
                          <strong>{formatCurrency(s.firstBelow.balance, s.cur)}</strong>
                          {!s.isGHS && (
                            <span className="text-[10px] text-red-600"> ≈ {formatCurrency(s.firstBelow.balance * s.rate, 'GHS')} GHS</span>
                          )}
                        </p>
                      </div>
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
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                          tickFormatter={v => new Date(v).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}
                          interval={horizon === 30 ? 4 : horizon === 60 ? 9 : 14} />
                        <YAxis tick={{ fontSize: 10 }} width={52} tickFormatter={tickFmt} axisLine={false} tickLine={false} />
                        <Tooltip content={<ForecastTooltip currency={s.cur} exchangeRate={s.rate} />} />
                        {threshold > 0 && (
                          <ReferenceLine y={s.thresholdInCur} stroke="#f59e0b" strokeDasharray="4 2"
                            label={{ value: 'Threshold', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                        )}
                        <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 2" strokeOpacity={0.4} />
                        <ReferenceLine x={toDateKey(new Date())} stroke={s.color} strokeDasharray="3 3" strokeOpacity={0.5}
                          label={{ value: 'Today', position: 'insideTopLeft', fontSize: 9, fill: s.color }} />
                        <Area type="monotone" dataKey="balance" stroke={s.color} strokeWidth={2}
                          fill={`url(#grad-${s.cur})`}
                          dot={<EventDot stroke={s.color} />}
                          activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                          name={`${s.cur} Balance`} />
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
                      <span className="ml-auto italic">Dots mark days with a scheduled recurring transaction</span>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Upcoming events */}
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

      {/* How this works */}
      <Card className="bg-muted/30 rounded-xl border border-border">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">How this forecast is calculated</p>
              <p><strong>Recurring transactions</strong> — each active recurring item linked to an account contributes its exact amount on each scheduled future date.</p>
              <p><strong>Discretionary spending</strong> — your last 90 days of income and expenses are averaged into a daily net rate ({dailyRate >= 0 ? '+' : ''}{fmt(Math.abs(dailyRate))}/day) and applied to every day in the forecast.</p>
              <p><strong>Foreign currency thresholds</strong> — the GHS threshold is converted to each foreign currency using your configured exchange rates for accurate warnings.</p>
              <p><strong>To improve accuracy:</strong> link every recurring transaction to an account and keep your income/expense history up to date.</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}