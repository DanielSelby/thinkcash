'use client'
import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Wallet, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronLeft, ChevronRight, Copy,
  Calendar, LayoutGrid, RefreshCw, ArrowLeft, Info,UtensilsCrossed, Car, Home, Zap, HeartPulse, GraduationCap,
  Tv2, ShoppingBag, Shirt, Sparkles, PiggyBank, CreditCard,
  ShieldCheck, Plane, Smartphone, Users, Siren, Heart,
  Church, TrendingUp, Package,SlidersHorizontal, Search, X,ChevronDown
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, CATEGORY_COLORS, getBudgetStatus } from '@/lib/utils'
import { useCategories } from '@/hooks/useCategories'
import { useAppStore } from '@/store'
import { KPICard } from '@/components/ui/kpi-card'
import { BarChart3, TrendingDown } from 'lucide-react'
import { THEMES } from '@/lib/config'
import type { Budget } from '@/types'
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1)
const schema = z.object({
  budget_name:   z.string().min(1, 'Budget name is required'),
  category:      z.string().min(1, 'Category is required'),
  monthly_limit: z.coerce.number().positive('Limit must be positive'),
  budget_month:  z.coerce.number().min(1).max(12),
  budget_year:   z.coerce.number().min(2020).max(2100),
})
type FormData = z.infer<typeof schema>
interface Props {
  initialBudgets: Budget[]
  expenses: { amount: number; category: string; date: string }[]
  userId: string
}
// Given a month/year, returns the next calendar month — used to default the
// Rollover dialog's target to "next month" rather than making the person
// pick it from scratch every time.
const nextMonthOf = (month: number, year: number) =>
  month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year }

// Converts a series of (x, y) points into a smooth cubic path using
// monotone cubic Hermite interpolation (the same technique as d3's
// curveMonotoneX). Unlike a plain Catmull-Rom spline, this guarantees the
// curve never overshoots above/below the surrounding data points — so a
// single spike stays a spike and flat/near-zero stretches stay flat,
// even when points are sparse (e.g. a day-of-week filter leaving big
// gaps between plotted points).
function smoothLinePath(points: { x: number; y: number }[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`

  const dx: number[] = []
  const secant: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x
    secant[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]
  }

  const tangent: number[] = new Array(n)
  tangent[0] = secant[0]
  tangent[n - 1] = secant[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (secant[i - 1] === 0 || secant[i] === 0 || (secant[i - 1] > 0) !== (secant[i] > 0)) {
      tangent[i] = 0
    } else {
      tangent[i] = (secant[i - 1] + secant[i]) / 2
    }
  }

  // Fritsch-Carlson: clamp tangents so the curve can't overshoot between
  // any two consecutive points.
  for (let i = 0; i < n - 1; i++) {
    if (secant[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / secant[i]
    const b = tangent[i + 1] / secant[i]
    const s = a * a + b * b
    if (s > 9) {
      const scale = 3 / Math.sqrt(s)
      tangent[i] = a * scale * secant[i]
      tangent[i + 1] = b * scale * secant[i]
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    const cp1x = points[i].x + h / 3
    const cp1y = points[i].y + (tangent[i] * h) / 3
    const cp2x = points[i + 1].x - h / 3
    const cp2y = points[i + 1].y - (tangent[i + 1] * h) / 3
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`
  }
  return d
}

function DailySpendChart({ allDays, monthExpenses, budgetsWithSpent, dailyTarget, fmt, theme, viewMonth, viewYear, MONTH_NAMES }: {
  allDays: { day: number; label: string; dayName: string; date: string }[]
  monthExpenses: any[]
  budgetsWithSpent: any[]
  dailyTarget: number
  fmt: (n: number) => string
  theme: any
  viewMonth: number
  viewYear: number
  MONTH_NAMES: string[]
}) {
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const toggleDay = (d: string) => {
    setSelectedDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  const chartData = useMemo(() => {
    return allDays
      .filter(d => selectedDays.size === 0 || selectedDays.has(d.dayName))
      .map(d => {
        const dayExp = monthExpenses
          .filter(e => e.date === d.date)
          .filter(e => selectedCategory === 'all' || e.category === selectedCategory)
          .reduce((s, e) => s + Number(e.amount), 0)
        return { label: d.label, dayName: d.dayName, spent: dayExp, target: dailyTarget }
      })
  }, [allDays, monthExpenses, selectedDays, selectedCategory, dailyTarget])

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(budgetsWithSpent.map(b => b.category)))],
    [budgetsWithSpent]
  )

  const maxVal = Math.max(...chartData.map(d => Math.max(d.spent, d.target)), 1)
  const H = 160
  // Fixed internal width regardless of how many points are plotted — this
  // keeps the SVG's viewBox aspect ratio constant, so text/dots/strokes
  // (all sized in SVG user-units) never look stretched or "zoomed" when a
  // filter narrows the data down to just a few points. Only the spacing
  // between points changes, not the coordinate scale itself.
  const VIEW_W = 700
  const W_STEP = VIEW_W / Math.max(chartData.length, 1)

  const toY = (v: number) => H - (v / maxVal) * H

  const spendPoints  = chartData.map((d, i) => ({ x: i * W_STEP + W_STEP / 2, y: toY(d.spent) }))
  const targetPoints = chartData.map((d, i) => ({ x: i * W_STEP + W_STEP / 2, y: toY(d.target) }))
  const spendPath  = smoothLinePath(spendPoints)
  const targetPath = smoothLinePath(targetPoints)
  const areaPath = chartData.length > 0
    ? `${spendPath} L ${(chartData.length - 1) * W_STEP + W_STEP / 2} ${H} L ${W_STEP / 2} ${H} Z`
    : ''

  const totalW = VIEW_W

  return (
    <>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-sm font-bold">Daily Spend</p>
            <p className="text-xs text-muted-foreground">{MONTH_NAMES[viewMonth - 1]} {viewYear} — actual vs daily target</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category slicer */}
            <div className="relative">
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                className="appearance-none border border-border rounded-lg pl-3 pr-7 py-1.5 bg-white text-xs font-semibold outline-none cursor-pointer">
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>
            {/* Clear day filter */}
            {selectedDays.size > 0 && (
              <button onClick={() => setSelectedDays(new Set())}
                className="text-xs font-semibold flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border hover:bg-muted/40"
                style={{ color: theme.colors.primary }}>
                <X className="w-3 h-3" /> Clear days
              </button>
            )}
          </div>
        </div>

        {/* Day-of-week slicer pills */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {DAY_NAMES.map(d => {
            const isSelected = selectedDays.has(d)
            return (
              <button key={d} onClick={() => toggleDay(d)}
                className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
                style={isSelected
                  ? { background: theme.colors.primary, color: '#fff', borderColor: theme.colors.primary }
                  : { background: '#f1f5f9', color: '#64748b', borderColor: 'transparent' }}>
                {d}
              </button>
            )
          })}
          <span className="text-[11px] text-muted-foreground self-center ml-1">
            {selectedDays.size === 0 ? 'All days' : `${selectedDays.size} day${selectedDays.size > 1 ? 's' : ''} selected`}
          </span>
        </div>

        {/* SVG Area Chart */}
        {chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data for selected filters</div>
        ) : (
          <div>
            <svg
              width="100%" height={H + 40}
              viewBox={`0 0 ${totalW + 40} ${H + 40}`}
              preserveAspectRatio="none"
              className="block"
            >
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <g transform="translate(20, 8)">
                {/* Y-axis value labels only — no gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                  <text key={pct} x={-4} y={H * pct + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
                    {fmt(maxVal * (1 - pct)).replace(/GH[₵C]?\s?/, '').replace(/GHS\s?/, '')}
                  </text>
                ))}
                {/* Area fill */}
                {areaPath && <path d={areaPath} fill="url(#spendGrad)" />}
                {/* Target line */}
                <path d={targetPath} stroke="#94a3b8" strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
                {/* Spend line */}
                <path d={spendPath} stroke={theme.colors.primary} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {/* Dots + X labels */}
                {chartData.map((d, i) => {
                  const cx = i * W_STEP + W_STEP / 2
                  const cy = toY(d.spent)
                  const isHov = hoveredIdx === i
                  return (
                    <g key={i}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{ cursor: 'pointer' }}>
                      {/* Hit area */}
                      <rect x={cx - W_STEP / 2} y={0} width={W_STEP} height={H} fill="transparent" />
                      {/* Hover highlight */}
                      {isHov && <rect x={cx - W_STEP / 2} y={0} width={W_STEP} height={H}
                        fill={theme.colors.primary} fillOpacity={0.06} rx={3} />}
                      <circle cx={cx} cy={cy} r={isHov ? 5 : 3}
                        fill={d.spent > dailyTarget ? '#dc2626' : theme.colors.primary}
                        stroke="#fff" strokeWidth={1.5} />
                      <text x={cx} y={H + 14} fontSize={9}
                        fill={isHov ? theme.colors.primary : '#94a3b8'}
                        textAnchor="middle" fontWeight={isHov ? 700 : 400}>{d.label}</text>
                      <text x={cx} y={H + 24} fontSize={8}
                        fill="#cbd5e1" textAnchor="middle">{d.dayName}</text>
                      {/* Tooltip */}
                      {isHov && (() => {
                        const ttW = 130; const ttH = 58
                        const ttX = Math.min(cx - ttW / 2, totalW - ttW - 4)
                        const ttY = Math.max(4, cy - ttH - 10)
                        return (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={7}
                              fill="white" stroke="#e2e8f0" strokeWidth={1}
                              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
                            <text x={ttX + 10} y={ttY + 15} fontSize={10} fontWeight={700} fill="#374151">
                              {d.dayName} {d.label}
                            </text>
                            <circle cx={ttX + 14} cy={ttY + 28} r={4}
                              fill={d.spent > dailyTarget ? '#dc2626' : theme.colors.primary} />
                            <text x={ttX + 24} y={ttY + 32} fontSize={9} fill="#374151">
                              Spent: <tspan fontWeight={700}
                                fill={d.spent > dailyTarget ? '#dc2626' : theme.colors.primary}>
                                {fmt(d.spent)}
                              </tspan>
                            </text>
                            <circle cx={ttX + 14} cy={ttY + 44} r={4} fill="#94a3b8" />
                            <text x={ttX + 24} y={ttY + 48} fontSize={9} fill="#374151">
                              Target: <tspan fontWeight={700} fill="#64748b">{fmt(dailyTarget)}</tspan>
                            </text>
                          </g>
                        )
                      })()}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded inline-block" style={{ background: theme.colors.primary }} />
            Actual Spend
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded inline-block bg-gray-300" style={{ borderTop: '1.5px dashed #94a3b8', background: 'transparent' }} />
            Daily Target ({fmt(dailyTarget)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Over target
          </span>
        </div>
    </>
  )
}

function BudgetVsActualAreaChart({ expenses, budgets, fmt, theme, MONTH_NAMES, defaultMonth, defaultYear }: {
  expenses: { amount: number; category: string; date: string }[]
  budgets: any[]
  fmt: (n: number) => string
  theme: any
  MONTH_NAMES: string[]
  defaultMonth: number
  defaultYear: number
}) {
  // Follows the app's active theme so this chart re-colors whenever the
  // user switches theme — primary for the Actual line. The Budget pace
  // line uses theme.colors.warning rather than accent: every theme
  // defines warning as an amber/orange, which stays visually distinct
  // from primary in all six themes (accent doesn't — e.g. plum's accent
  // is a near-white blush with poor contrast, and eclipse's accent is
  // another shade of green too close to its own primary). "Over pace"
  // stays a fixed red since that's a universal warning signal, not a
  // brand color.
  const ACTUAL_COLOR = theme.colors.primary
  const BUDGET_COLOR = theme.colors.warning || '#f59e0b'
  const OVER_COLOR   = '#dc2626' // red, over-pace dot only — intentionally not theme-driven

  const now = new Date()
  const [month, setMonth]               = useState(defaultMonth)
  const [year, setYear]                 = useState(defaultYear)
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [hoveredIdx, setHoveredIdx]     = useState<number | null>(null)

  const daysInPeriod = new Date(year, month, 0).getDate()

  const monthBudgets = useMemo(() =>
    budgets.filter(b =>
      (b.budget_month ?? now.getMonth() + 1) === month &&
      (b.budget_year  ?? now.getFullYear())  === year
    ), [budgets, month, year])

  const monthExpenses = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const prefix = `${year}-${pad(month)}`
    return expenses.filter(e => e.date?.startsWith(prefix))
  }, [expenses, month, year])

  const totalBudgeted = useMemo(() => monthBudgets.reduce((s, b) => s + b.monthly_limit, 0), [monthBudgets])
  const dailyTarget   = daysInPeriod > 0 ? totalBudgeted / daysInPeriod : 0

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(monthBudgets.map(b => b.category)))],
    [monthBudgets]
  )

  const allDays = useMemo(() => {
    const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    return Array.from({ length: daysInPeriod }, (_, i) => {
      const d = new Date(year, month - 1, i + 1)
      return {
        day:     i + 1,
        label:   String(i + 1),
        dayName: DAY_NAMES[d.getDay()],
        date:    `${year}-${String(month).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`,
      }
    })
  }, [daysInPeriod, month, year])

  // Cumulative actual vs cumulative budget pace, computed across the whole
  // month first, then narrowed to the dateFrom/dateTo window for display —
  // so the date filter zooms into a window of the curve without resetting
  // the running totals that got you there.
  const fullChartData = useMemo(() => {
    let cumActual = 0
    return allDays.map((d, i) => {
      const dayExp = monthExpenses
        .filter(e => e.date === d.date)
        .filter(e => selectedCategory === 'all' || e.category === selectedCategory)
        .reduce((s, e) => s + Number(e.amount), 0)
      cumActual += dayExp
      const cumBudget = dailyTarget * (i + 1)
      return { label: d.label, dayName: d.dayName, date: d.date, actual: cumActual, budget: cumBudget }
    })
  }, [allDays, monthExpenses, selectedCategory, dailyTarget])

  const chartData = useMemo(() =>
    fullChartData.filter(d => {
      if (dateFrom && d.date < dateFrom) return false
      if (dateTo   && d.date > dateTo)   return false
      return true
    }), [fullChartData, dateFrom, dateTo])

  const clearDateFilter = () => { setDateFrom(''); setDateTo('') }
  const hasDateFilter = !!dateFrom || !!dateTo

  const maxVal = Math.max(...chartData.map(d => Math.max(d.actual, d.budget)), 1)
  const H = 160
  // Fixed internal width regardless of point count — see DailySpendChart
  // for why: keeps text/dots/strokes visually consistent size whether the
  // date filter shows the full month or just a handful of days.
  const VIEW_W = 700
  const W_STEP = VIEW_W / Math.max(chartData.length, 1)
  const toY = (v: number) => H - (v / maxVal) * H

  const actualPoints = chartData.map((d, i) => ({ x: i * W_STEP + W_STEP / 2, y: toY(d.actual) }))
  const budgetPoints = chartData.map((d, i) => ({ x: i * W_STEP + W_STEP / 2, y: toY(d.budget) }))
  const actualPath = smoothLinePath(actualPoints)
  const budgetPath = smoothLinePath(budgetPoints)
  const areaPath = chartData.length > 0
    ? `${actualPath} L ${(chartData.length - 1) * W_STEP + W_STEP / 2} ${H} L ${W_STEP / 2} ${H} Z`
    : ''

  const totalW = VIEW_W

  return (
    <>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-sm font-bold">Budget vs Actual</p>
          <p className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year} — cumulative spend vs budget pace</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month/Year slicer — independent from the page-level month */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 bg-white text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <select
              value={`${year}-${String(month).padStart(2,'0')}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                setYear(Number(y)); setMonth(Number(m))
                setDateFrom(''); setDateTo('')
              }}
              className="appearance-none bg-transparent outline-none cursor-pointer font-semibold text-xs pr-4"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const y = d.getFullYear(); const m = d.getMonth() + 1
                return (
                  <option key={`${y}-${m}`} value={`${y}-${String(m).padStart(2,'0')}`}>
                    {MONTH_NAMES[m - 1]} {y}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>

          {/* Category slicer */}
          <div className="relative">
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
              className="appearance-none border border-border rounded-lg pl-3 pr-7 py-1.5 bg-white text-xs font-semibold outline-none cursor-pointer">
              {categories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">From</label>
          <input
            type="date" value={dateFrom}
            min={`${year}-${String(month).padStart(2,'0')}-01`}
            max={`${year}-${String(month).padStart(2,'0')}-${String(daysInPeriod).padStart(2,'0')}`}
            onChange={e => setDateFrom(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">To</label>
          <input
            type="date" value={dateTo}
            min={`${year}-${String(month).padStart(2,'0')}-01`}
            max={`${year}-${String(month).padStart(2,'0')}-${String(daysInPeriod).padStart(2,'0')}`}
            onChange={e => setDateTo(e.target.value)}
            className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1"
          />
        </div>
        {hasDateFilter && (
          <button onClick={clearDateFilter}
            className="text-xs font-semibold flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border hover:bg-muted/40"
            style={{ color: ACTUAL_COLOR }}>
            <X className="w-3 h-3" /> Clear dates
          </button>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data for selected filters</div>
      ) : (
        <div>
          <svg
            width="100%" height={H + 40}
            viewBox={`0 0 ${Math.max(totalW + 40, 300)} ${H + 40}`}
            preserveAspectRatio="none"
            className="block"
          >
            <defs>
              <linearGradient id="budgetActualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACTUAL_COLOR} stopOpacity="0.3" />
                <stop offset="100%" stopColor={ACTUAL_COLOR} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <g transform="translate(20, 8)">
              {/* Y-axis value labels only — no gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map(pct => (
                <text key={pct} x={-4} y={H * pct + 3} fontSize={8} fill="#94a3b8" textAnchor="end">
                  {fmt(maxVal * (1 - pct)).replace(/GH[₵C]?\s?/, '').replace(/GHS\s?/, '')}
                </text>
              ))}
              {areaPath && <path d={areaPath} fill="url(#budgetActualGrad)" />}
              <path d={budgetPath} stroke={BUDGET_COLOR} strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
              <path d={actualPath} stroke={ACTUAL_COLOR} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {chartData.map((d, i) => {
                const cx = i * W_STEP + W_STEP / 2
                const cy = toY(d.actual)
                const isHov = hoveredIdx === i
                const over = d.actual > d.budget
                return (
                  <g key={i}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{ cursor: 'pointer' }}>
                    <rect x={cx - W_STEP / 2} y={0} width={W_STEP} height={H} fill="transparent" />
                    {isHov && <rect x={cx - W_STEP / 2} y={0} width={W_STEP} height={H}
                      fill={ACTUAL_COLOR} fillOpacity={0.06} rx={3} />}
                    <circle cx={cx} cy={cy} r={isHov ? 5 : 3}
                      fill={over ? OVER_COLOR : ACTUAL_COLOR}
                      stroke="#fff" strokeWidth={1.5} />
                    <text x={cx} y={H + 14} fontSize={9}
                      fill={isHov ? ACTUAL_COLOR : '#94a3b8'}
                      textAnchor="middle" fontWeight={isHov ? 700 : 400}>{d.label}</text>
                    <text x={cx} y={H + 24} fontSize={8}
                      fill="#cbd5e1" textAnchor="middle">{d.dayName}</text>
                    {isHov && (() => {
                      const ttW = 140; const ttH = 58
                      const ttX = Math.min(cx - ttW / 2, totalW - ttW - 4)
                      const ttY = Math.max(4, cy - ttH - 10)
                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          <rect x={ttX} y={ttY} width={ttW} height={ttH} rx={7}
                            fill="white" stroke="#e2e8f0" strokeWidth={1}
                            filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
                          <text x={ttX + 10} y={ttY + 15} fontSize={10} fontWeight={700} fill="#374151">
                            {d.dayName} {d.label}
                          </text>
                          <circle cx={ttX + 14} cy={ttY + 28} r={4}
                            fill={over ? OVER_COLOR : ACTUAL_COLOR} />
                          <text x={ttX + 24} y={ttY + 32} fontSize={9} fill="#374151">
                            Actual: <tspan fontWeight={700}
                              fill={over ? OVER_COLOR : ACTUAL_COLOR}>
                              {fmt(d.actual)}
                            </tspan>
                          </text>
                          <circle cx={ttX + 14} cy={ttY + 44} r={4} fill={BUDGET_COLOR} />
                          <text x={ttX + 24} y={ttY + 48} fontSize={9} fill="#374151">
                            Budget: <tspan fontWeight={700} fill={BUDGET_COLOR}>{fmt(d.budget)}</tspan>
                          </text>
                        </g>
                      )
                    })()}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      )}

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded inline-block" style={{ background: ACTUAL_COLOR }} />
          Cumulative Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded inline-block" style={{ borderTop: `1.5px dashed ${BUDGET_COLOR}`, background: 'transparent' }} />
          Cumulative Budget Pace
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: OVER_COLOR }} />
          Over pace
        </span>
      </div>
    </>
  )
}


function BudgetDetailRow({ b, monthExpenses, fmt, theme }: { b: any; monthExpenses: any[]; fmt: (n: number) => string; theme: any }) {
  const txns = monthExpenses
    .filter((e: any) => e.category === b.category)
    .sort((a: any, c: any) => (c.date ?? '').localeCompare(a.date ?? ''))
  const topDays: Record<string, number> = {}
  txns.forEach((t: any) => { topDays[t.date ?? ''] = (topDays[t.date ?? ''] || 0) + Number(t.amount) })
  const peakDay = Object.entries(topDays).sort((a, b) => b[1] - a[1])[0]
  const avgTxn = txns.length > 0 ? txns.reduce((s: number, t: any) => s + Number(t.amount), 0) / txns.length : 0

  return (
    <tr className="bg-muted/20 border-b border-border">
      <td colSpan={9} className="px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
            {[
              { label: 'Budget Limit',  value: fmt(b.monthly_limit) },
              { label: 'Spent',         value: fmt(b.spent || 0),                      color: '#dc2626' },
              { label: 'Remaining',     value: fmt(Math.max(0, b.remaining || 0)),      color: '#16a34a' },
              { label: 'Transactions',  value: String(txns.length) },
              { label: 'Avg per Txn',   value: fmt(avgTxn) },
              { label: 'Daily Budget',  value: fmt(b.dailyTarget) },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums" style={color ? { color } : {}}>{value}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Usage</p>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, b.percentage || 0)}%`, background: (b.percentage || 0) >= 100 ? '#dc2626' : (b.percentage || 0) >= 80 ? '#f59e0b' : '#16a34a' }} />
            </div>
            <p className="text-xs text-muted-foreground">{Math.round(b.percentage || 0)}% used · {Math.round(100 - Math.min(100, b.percentage || 0))}% left</p>
            {peakDay && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Peak Spend Day</p>
                <p className="text-sm font-bold mt-1">{new Date(peakDay[0]).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p className="text-xs text-muted-foreground">{fmt(peakDay[1])} spent</p>
              </div>
            )}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Transactions</p>
            {txns.length === 0 ? (
              <p className="text-xs text-muted-foreground">No transactions this month</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {txns.slice(0, 8).map((t: any, ti: number) => (
                  <div key={ti} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{t.title || t.category || 'Expense'}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date}</p>
                    </div>
                    <span className="font-semibold tabular-nums text-red-500 flex-shrink-0 ml-2">-{fmt(Number(t.amount))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

export function BudgetsContent({ initialBudgets, expenses, userId }: Props) {
  const { activeTheme, currency } = useAppStore()
  const { expenseCategories } = useCategories()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const fmt = (n: number) => formatCurrency(n, currency)
  const now = new Date()
  const [budgets,   setBudgets]   = useState(initialBudgets)
  const [open,      setOpen]      = useState(false)
  const [editing,   setEditing]   = useState<Budget | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1)
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [statusFilter,      setStatusFilter]      = useState<'all' | 'on_track' | 'warning' | 'exceeded'>('all')
  const [showAllProgress,   setShowAllProgress]   = useState(false)
  const [selectedBudgetId,  setSelectedBudgetId]  = useState<string | null>(null)
  const [searchFilter,   setSearchFilter]   = useState('')
  const [showFilters,    setShowFilters]    = useState(false)
  // Controlled form values for Selects
  const [selCategory, setSelCategory] = useState('')
  const [selMonth,    setSelMonth]    = useState(String(now.getMonth() + 1))
  const [selYear,     setSelYear]     = useState(String(now.getFullYear()))
  // ── Budget Rollover ────────────────────────────────────────────────
  // Copies selected budgets from the month currently being viewed into
  // another month. Only budget_name/category/monthly_limit are copied —
  // spent/remaining/percentage are always derived live from that month's
  // real expenses, so a rolled-over budget always starts at 0% used,
  // never carrying over "completed" spending from the source month.
  const [rolloverOpen,     setRolloverOpen]     = useState(false)
  const [rolloverLoading,  setRolloverLoading]  = useState(false)
  const [rolloverSelected, setRolloverSelected] = useState<Set<string>>(new Set())
  const [rolloverMonth,    setRolloverMonth]    = useState(String(now.getMonth() + 1))
  const [rolloverYear,     setRolloverYear]     = useState(String(now.getFullYear()))
  const [view, setView] = useState<'overview' | 'breakdown'>('overview')
  const [showGuidanceDetails, setShowGuidanceDetails] = useState(true)
  const [guideChartView, setGuideChartView] = useState<'daily' | 'budget'>('daily')
  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      budget_month: now.getMonth() + 1,
      budget_year:  now.getFullYear(),
    },
  })
  const monthBudgets = useMemo(() =>
    budgets.filter(b =>
      (b.budget_month ?? now.getMonth() + 1) === viewMonth &&
      (b.budget_year  ?? now.getFullYear())  === viewYear
    ), [budgets, viewMonth, viewYear])
  const monthExpenses = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const prefix = `${viewYear}-${pad(viewMonth)}`
    return expenses.filter(e => e.date?.startsWith(prefix))
  }, [expenses, viewMonth, viewYear])
  const budgetsWithSpent = useMemo(() =>
    monthBudgets.map(b => {
      const spent      = monthExpenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0)
      const percentage = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0
      return { ...b, spent, remaining: b.monthly_limit - spent, percentage }
    }), [monthBudgets, monthExpenses])
  const summary = useMemo(() => ({
    totalBudgeted: monthBudgets.reduce((s, b) => s + b.monthly_limit, 0),
    totalSpent:    budgetsWithSpent.reduce((s, b) => s + (b.spent || 0), 0),
    exceeded:      budgetsWithSpent.filter(b => (b.percentage || 0) >= 100).length,
    safe:          budgetsWithSpent.filter(b => (b.percentage || 0) < 80).length,
  }), [monthBudgets, budgetsWithSpent])
  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }
  const openCreate = () => {
    setEditing(null)
    const mo = String(viewMonth)
    const yr = String(viewYear)
    setSelCategory('')
    setSelMonth(mo)
    setSelYear(yr)
    reset({ budget_month: viewMonth, budget_year: viewYear, budget_name: '', monthly_limit: 0 as any, category: '' })
    setOpen(true)
  }
  const openEdit = (b: Budget) => {
    setEditing(b)
    const mo = String(b.budget_month ?? viewMonth)
    const yr = String(b.budget_year  ?? viewYear)
    setSelCategory(b.category)
    setSelMonth(mo)
    setSelYear(yr)
    reset({
      budget_name:   b.budget_name,
      category:      b.category,
      monthly_limit: b.monthly_limit,
      budget_month:  b.budget_month ?? viewMonth,
      budget_year:   b.budget_year  ?? viewYear,
    })
    setOpen(true)
  }
  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase
        .from('budgets')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setBudgets(prev => prev.map(b => b.id === editing.id ? updated : b))
        toast({ title: 'Budget updated', variant: 'success' })
        setOpen(false)
      }
    } else {
      const { data: created, error } = await supabase
        .from('budgets')
        .insert({ ...data, user_id: userId })
        .select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else {
        setBudgets(prev => [created, ...prev])
        toast({ title: 'Budget created', variant: 'success' })
        setOpen(false)
      }
    }
    setLoading(false)
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    const supabase = createClient()
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setBudgets(prev => prev.filter(b => b.id !== id))
      toast({ title: 'Budget deleted' })
    }
  }
  // ── Rollover helpers ─────────────────────────────────────────────────
  const openRollover = () => {
    setRolloverSelected(new Set(monthBudgets.map(b => b.id)))
    const next = nextMonthOf(viewMonth, viewYear)
    setRolloverMonth(String(next.month))
    setRolloverYear(String(next.year))
    setRolloverOpen(true)
  }
  const toggleRolloverBudget = (id: string) => {
    setRolloverSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllRollover = () => setRolloverSelected(new Set(monthBudgets.map(b => b.id)))
  const clearAllRollover  = () => setRolloverSelected(new Set())
  const rolloverIsSameMonth = Number(rolloverMonth) === viewMonth && Number(rolloverYear) === viewYear
  const handleRollover = async () => {
    if (rolloverSelected.size === 0 || rolloverIsSameMonth) return
    setRolloverLoading(true)
    const supabase = createClient()
    const targetMonth = Number(rolloverMonth)
    const targetYear  = Number(rolloverYear)
    const sourceBudgets = monthBudgets.filter(b => rolloverSelected.has(b.id))
    // Never create a duplicate budget for a category that's already
    // budgeted in the target month — skip those instead of overwriting
    // or duplicating whatever spending/limit already exists there.
    const existingCategoriesInTarget = new Set(
      budgets
        .filter(b =>
          (b.budget_month ?? now.getMonth() + 1) === targetMonth &&
          (b.budget_year  ?? now.getFullYear())  === targetYear
        )
        .map(b => b.category)
    )
    const toCreate = sourceBudgets.filter(b => !existingCategoriesInTarget.has(b.category))
    const skipped  = sourceBudgets.length - toCreate.length
    if (toCreate.length === 0) {
      toast({
        title: 'Nothing to roll over',
        description: `All selected categories already have a budget in ${MONTH_NAMES[targetMonth - 1]} ${targetYear}.`,
        variant: 'destructive',
      })
      setRolloverLoading(false)
      return
    }
    // Only the definition carries over — no spent/remaining/percentage
    // fields exist on the row at all, so there is nothing "completed"
    // from the source month for the new budget to inherit.
    const payload = toCreate.map(b => ({
      budget_name:   b.budget_name,
      category:      b.category,
      monthly_limit: b.monthly_limit,
      budget_month:  targetMonth,
      budget_year:   targetYear,
      user_id:       userId,
    }))
    const { data: created, error } = await supabase
      .from('budgets')
      .insert(payload)
      .select()
    if (error) {
      toast({ title: 'Rollover failed', description: error.message, variant: 'destructive' })
    } else {
      const createdRows = created || []
      setBudgets(prev => [...createdRows, ...prev])
      toast({
        title: `Rolled over ${createdRows.length} budget${createdRows.length === 1 ? '' : 's'} to ${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
        description: skipped > 0
          ? `${skipped} skipped — already budgeted for that month`
          : undefined,
        variant: 'success',
      })
      setRolloverOpen(false)
    }
    setRolloverLoading(false)
  }
  const statusIcon = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return <XCircle       className="w-4 h-4 text-destructive" />
    if (s === 'warning')  return <AlertTriangle  className="w-4 h-4 text-warning"    />
    return                       <CheckCircle    className="w-4 h-4 text-success"     />
  }
  const progressClass = (pct: number) => {
    const s = getBudgetStatus(pct)
    if (s === 'exceeded') return '[&>div]:bg-destructive'
    if (s === 'warning')  return '[&>div]:bg-warning'
    return ''
  }
  const isCurrentMonth = viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear()
  const dialogKey = editing ? `edit-${editing.id}` : 'create'

  // ── Spending Guidance (aggregate) ─────────────────────────────────────
  const daysInPeriod = new Date(viewYear, viewMonth, 0).getDate()
  const periodStart  = new Date(viewYear, viewMonth - 1, 1)
  const periodEnd    = new Date(viewYear, viewMonth - 1, daysInPeriod)
  const daysElapsed = (() => {
    const beforePeriod = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < now.getMonth() + 1)
    const afterPeriod  = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth > now.getMonth() + 1)
    if (beforePeriod) return daysInPeriod
    if (afterPeriod)  return 0
    return now.getDate()
  })()
  const daysLeftInPeriod = daysInPeriod - daysElapsed

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

  const weekDay       = now.getDay()
  const diffToMonday  = (weekDay === 0 ? -6 : 1) - weekDay
  const weekMonday    = new Date(now); weekMonday.setDate(now.getDate() + diffToMonday)
  const weekSunday    = new Date(weekMonday); weekSunday.setDate(weekMonday.getDate() + 6)
  const weekStartClip = weekMonday < periodStart ? periodStart : weekMonday
  const weekEndClip   = weekSunday > periodEnd ? periodEnd : weekSunday
  const weekRangeLabel = `${weekStartClip.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEndClip.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const todayStr      = toISO(now)
  const weekStartStr  = toISO(weekStartClip)
  const weekEndStr    = toISO(weekEndClip)
  const spentToday    = monthExpenses.filter(e => e.date === todayStr).reduce((s, e) => s + e.amount, 0)
  const spentThisWeek = monthExpenses.filter(e => e.date >= weekStartStr && e.date <= weekEndStr).reduce((s, e) => s + e.amount, 0)

  const dailyTarget   = daysInPeriod > 0 ? summary.totalBudgeted / daysInPeriod : 0
  const weeklyTarget  = dailyTarget * 7
  const monthlyTarget = summary.totalBudgeted
  const remainingToday      = dailyTarget - spentToday
  const remainingThisWeek   = weeklyTarget - spentThisWeek
  const remainingThisMonth  = summary.totalBudgeted - summary.totalSpent
  const pctDailyUsed   = dailyTarget   > 0 ? (spentToday       / dailyTarget)   * 100 : 0
  const pctWeeklyUsed  = weeklyTarget  > 0 ? (spentThisWeek     / weeklyTarget)  * 100 : 0
  const pctMonthlyUsed = monthlyTarget > 0 ? (summary.totalSpent / monthlyTarget) * 100 : 0

  const aggregatePct = summary.totalBudgeted > 0 ? (summary.totalSpent / summary.totalBudgeted) * 100 : 0
  const aggregateStatusKey = getBudgetStatus(aggregatePct)
  const aggregateStatusMeta = aggregateStatusKey === 'exceeded'
    ? { label: 'Over Budget',       color: '#dc2626', bg: '#fee2e2' }
    : aggregateStatusKey === 'warning'
    ? { label: 'Approaching Limit', color: '#d97706', bg: '#fef3c7' }
    : { label: 'On Track',          color: '#16a34a', bg: '#dcfce7' }

  // ── Spending Guidance Breakdown (per category) ────────────────────────
  const breakdownRows = useMemo(() => {
    const now = new Date()
    const dayOfMonth = now.getDate()
    return budgetsWithSpent.map(b => {
      const daily   = daysInPeriod > 0 ? b.monthly_limit / daysInPeriod : 0
      const weekly  = daily * 7
      // Projected spend = (spent so far / days elapsed) × total days in month
      const projected = dayOfMonth > 0
        ? Math.round(((b.spent || 0) / dayOfMonth) * daysInPeriod)
        : 0
      const projectedStatus = projected > b.monthly_limit
        ? 'over'
        : projected > b.monthly_limit * 0.8
        ? 'warning'
        : 'ok'
      return { ...b, dailyTarget: daily, weeklyTarget: weekly, projectedSpend: projected, projectedStatus }
    })
  }, [budgetsWithSpent, daysInPeriod])

  const filteredBreakdownRows = useMemo(() => {
    return breakdownRows
      .filter(b => {
        if (statusFilter === 'on_track')  return (b.percentage || 0) < 80
        if (statusFilter === 'warning')   return (b.percentage || 0) >= 80 && (b.percentage || 0) < 100
        if (statusFilter === 'exceeded')  return (b.percentage || 0) >= 100
        return true
      })
      .filter(b => {
        if (!searchFilter.trim()) return true
        return b.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
               b.budget_name?.toLowerCase().includes(searchFilter.toLowerCase())
      })
  }, [breakdownRows, statusFilter, searchFilter])

  return (
    <div className="space-y-5">
    {view === 'overview' && (
    <div key="overview" className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Budgets
          </h1>
          <p className="text-muted-foreground text-sm">Monthly spending limits by category</p>
        </div>
       <div className="flex items-center gap-2 flex-wrap">

          {/* Month/Year picker */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 bg-white text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <select
              value={`${viewYear}-${String(viewMonth).padStart(2,'0')}`}
              onChange={e => {
                const [y, m] = e.target.value.split('-')
                setViewYear(Number(y))
                setViewMonth(Number(m))
              }}
              className="appearance-none bg-transparent outline-none cursor-pointer font-semibold text-xs pr-4"
            >
              {Array.from({ length: 24 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                const y = d.getFullYear(); const m = d.getMonth() + 1
                return (
                  <option key={`${y}-${m}`} value={`${y}-${String(m).padStart(2,'0')}`}>
                    {MONTH_NAMES[m - 1]} {y}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>

          <Button variant="outline" onClick={openRollover} disabled={monthBudgets.length === 0}>

            <Copy className="w-4 h-4 mr-1" /> Rollover Budgets

          </Button>

          <Button variant="outline" onClick={() => setView('breakdown')} disabled={monthBudgets.length === 0}>

            <LayoutGrid className="w-4 h-4 mr-1" /> Spending Guide

          </Button>

          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Create Budget
          </Button>
        </div>
      </div>
      {/* ── KPI Flip Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          label="Budgeted"
          value={fmt(summary.totalBudgeted)}
          sub={`${monthBudgets.length} budget(s)`}
          colorClass=""
          icon={Wallet}
          accentColor="#2563eb"
          tooltip={`Total budget allocated for ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
        />
        <KPICard
          label="Spent"
          value={fmt(summary.totalSpent)}
          sub={summary.totalBudgeted > 0 ? `${Math.round((summary.totalSpent / summary.totalBudgeted) * 100)}% of budget` : 'No budget set'}
          colorClass=""
          icon={TrendingDown}
          accentColor="#dc2626"
          tooltip={`Total spent across all budgets in ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
        />
        <KPICard
          label="On Track"
          value={String(summary.safe)}
          sub={`${summary.safe} of ${monthBudgets.length} budgets`}
          colorClass=""
          icon={CheckCircle}
          accentColor="#16a34a"
          tooltip="Budgets where spending is within the limit"
        />
        <KPICard
          label="Exceeded"
          value={String(summary.exceeded)}
          sub={summary.exceeded > 0 ? `${summary.exceeded} over budget` : 'All on track 🎉'}
          colorClass=""
          icon={XCircle}
          accentColor={summary.exceeded > 0 ? "#dc2626" : "#16a34a"}
          tooltip="Budgets where spending has gone over the limit"
        />
      </div>
      {/* Month Navigator — compact inline bar */}
      <div className="flex items-center justify-between bg-white border border-border rounded-xl px-4 py-2.5 shadow-sm">
        <button onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm" style={{ color: theme.colors.primary }}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </p>
          {isCurrentMonth && (
            <span className="text-[10px] text-white px-2 py-0.5 rounded-full font-semibold"
              style={{ background: theme.colors.accent }}>
              Current Month
            </span>
          )}
        </div>
        <button onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Monthly Budget summary */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div className="md:pr-8 md:border-r border-border">
              <p className="text-sm text-muted-foreground">Monthly Budget</p>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums mt-1" style={{ color: theme.colors.primary }}>
                {fmt(summary.totalBudgeted)}
              </p>
              <span
                className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: aggregateStatusMeta.bg, color: aggregateStatusMeta.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: aggregateStatusMeta.color }} />
                {aggregateStatusMeta.label}
              </span>
              <p className="text-xs text-muted-foreground mt-2">
                {summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}% of budget used` : 'No budget set'}
              </p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
                  <Wallet className="w-4 h-4" style={{ color: '#2563eb' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Spent So Far</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{fmt(summary.totalSpent)}</p>
                  <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}%` : '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                  <RefreshCw className="w-4 h-4" style={{ color: '#16a34a' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{fmt(remainingThisMonth)}</p>
                  <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}%` : '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#d97706' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-sm sm:text-base font-bold tabular-nums truncate">{daysLeftInPeriod} days</p>
                  <p className="text-[11px] text-muted-foreground">{Math.round((daysLeftInPeriod / Math.max(1, daysInPeriod)) * 100)}% of period left</p>
                </div>
              </div>
            </div>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mt-4">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, aggregatePct)}%`, background: aggregateStatusMeta.color }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Spending Guidance */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
            <div>
              <p className="text-sm font-bold">Spending Guidance</p>
              <p className="text-xs text-muted-foreground">Here's how much you can spend based on your monthly budget.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setView('breakdown')}
                disabled={monthBudgets.length === 0}
              >
                <LayoutGrid className="w-4 h-4 mr-1" /> Spending Guidance Breakdown
              </Button>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer select-none">
                Show details
                <button
                  type="button"
                  onClick={() => setShowGuidanceDetails(v => !v)}
                  className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                  style={{ background: showGuidanceDetails ? theme.colors.primary : '#cbd5e1' }}
                >
                  <span
                    className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                    style={{ left: showGuidanceDetails ? '18px' : '2px' }}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Daily */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#eff6ff' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#2563eb' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Daily</p>
                  <p className="text-[11px] text-muted-foreground">Target per day</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(dailyTarget)}</p>
              <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctDailyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent Today</span><span className="font-medium">{fmt(spentToday)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining Today</span><span className={`font-medium ${remainingToday < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingToday)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Left</span><span className="font-medium">{daysElapsed} of {daysInPeriod}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                {Math.round(Math.min(999, pctDailyUsed))}% of daily target used
              </div>
            </div>

            {/* Weekly */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#faf5ff' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f3e8ff' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#9333ea' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Weekly</p>
                  <p className="text-[11px] text-muted-foreground">Target per week</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(weeklyTarget)}</p>
              <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-purple-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctWeeklyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent This Week</span><span className="font-medium">{fmt(spentThisWeek)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining This Week</span><span className={`font-medium ${remainingThisWeek < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingThisWeek)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Week</span><span className="font-medium">{weekRangeLabel}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                {Math.round(Math.min(999, pctWeeklyUsed))}% of weekly target used
              </div>
            </div>

            {/* Monthly */}
            <div className="rounded-xl border border-border p-4" style={{ background: '#f0fdf4' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
                  <Calendar className="w-4 h-4" style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Monthly</p>
                  <p className="text-[11px] text-muted-foreground">Total for month</p>
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums mt-3">{fmt(monthlyTarget)}</p>
              <div className="h-1.5 bg-green-100 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-green-600 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, pctMonthlyUsed)}%` }} />
              </div>
              {showGuidanceDetails && (
                <div className="space-y-1.5 mt-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Spent This Month</span><span className="font-medium">{fmt(summary.totalSpent)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Remaining This Month</span><span className={`font-medium ${remainingThisMonth < 0 ? 'text-destructive' : 'text-success'}`}>{fmt(remainingThisMonth)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days Left</span><span className="font-medium">{daysElapsed} of {daysInPeriod}</span></div>
                </div>
              )}
              <div className="text-center text-xs font-semibold rounded-lg py-1.5 mt-3" style={{ background: '#dcfce7', color: '#15803d' }}>
                {Math.round(Math.min(999, pctMonthlyUsed))}% of monthly budget used
              </div>
            </div>
          </div>

          {/* Budget Pace Guide */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 mt-5 pt-4 border-t border-border">
            <div className="flex-shrink-0">
              <p className="text-sm font-semibold">Budget Pace Guide</p>
              <p className="text-xs text-muted-foreground">Based on your spending so far this month</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-semibold">On Track</span>
                <span className="text-muted-foreground">You're spending within your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-semibold">Approaching Limit</span>
                <span className="text-muted-foreground">You've used more than 80% of your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-semibold">Over Budget</span>
                <span className="text-muted-foreground">You've spent more than 100% of your budget.</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget Cards */}
      {budgetsWithSpent.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No budgets for {MONTH_NAMES[viewMonth - 1]} {viewYear}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create a budget for this month or navigate to another month
          </p>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Create Budget for {MONTH_NAMES[viewMonth - 1]}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgetsWithSpent.map(b => {
            const pct    = b.percentage || 0
            const status = getBudgetStatus(pct)
            return (
              <Card key={b.id} className={`bg-white p-4 sm:p-5 space-y-4 rounded-xl shadow-sm overflow-hidden ${
                status === 'exceeded' ? 'border-destructive/40 kpi-red'
                : status === 'warning' ? 'border-warning/40 kpi-orange'
                : 'kpi-green'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${CATEGORY_COLORS[b.category] || '#94a3b8'}20` }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{b.budget_name}</p>
                      <p className="text-xs text-muted-foreground capitalize truncate">
                        {b.category} · {MONTH_NAMES[(b.budget_month ?? 1) - 1]} {b.budget_year ?? viewYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {statusIcon(pct)}
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(b)}>
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive"
                      onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Spent</span>
                    <span className="font-medium tabular-nums truncate text-right">
                      {fmt(b.spent || 0)} / {fmt(b.monthly_limit)}
                    </span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className={`h-2 ${progressClass(pct)}`} />
                  <div className="flex justify-between text-xs gap-2">
                    <span className={
                      status === 'exceeded' ? 'text-destructive font-medium'
                      : status === 'warning' ? 'text-warning font-medium'
                      : 'text-muted-foreground'
                    }>
                      {pct.toFixed(0)}% used
                    </span>
                    <span className={`font-medium tabular-nums truncate ${
                      (b.remaining || 0) < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {(b.remaining || 0) < 0
                        ? `${fmt(Math.abs(b.remaining || 0))} over`
                        : `${fmt(b.remaining || 0)} left`}
                    </span>
                  </div>
                </div>
                {status === 'exceeded' && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    Budget exceeded — review your {b.category} spending
                  </div>
                )}
                {status === 'warning' && (
                  <div className="flex items-center gap-1.5 text-xs text-warning bg-warning/10 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Over 80% used — spend carefully this month
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
      {/* ── Dialog — key forces full remount on open/edit ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent key={dialogKey}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Budget' : 'Create Budget'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Budget Name</Label>
              <Input placeholder="e.g. Food Budget" {...register('budget_name')} />
              {errors.budget_name && <p className="text-xs text-destructive">{errors.budget_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={selCategory}
                onValueChange={v => { setSelCategory(v); setValue('category', v) }}
              >
                <SelectTrigger><SelectValue placeholder="Select expense category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Limit</Label>
              <Input type="number" step="0.01" placeholder="0.00" {...register('monthly_limit')} />
              {errors.monthly_limit && <p className="text-xs text-destructive">{errors.monthly_limit.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select
                  value={selMonth}
                  onValueChange={v => { setSelMonth(v); setValue('budget_month', Number(v)) }}
                >
                  <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.budget_month && <p className="text-xs text-destructive">{errors.budget_month.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select
                  value={selYear}
                  onValueChange={v => { setSelYear(v); setValue('budget_year', Number(v)) }}
                >
                  <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.budget_year && <p className="text-xs text-destructive">{errors.budget_year.message}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}
                style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Create Budget'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* ── Rollover Dialog ── */}
      <Dialog open={rolloverOpen} onOpenChange={setRolloverOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" style={{ color: theme.colors.primary }} />
              Rollover Budgets
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy selected budgets from {MONTH_NAMES[viewMonth - 1]} {viewYear} into another month.
              Only the name, category, and limit carry over — spending always starts fresh for the new month.
            </p>
            {monthBudgets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No budgets in {MONTH_NAMES[viewMonth - 1]} {viewYear} to roll over.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {rolloverSelected.size} of {monthBudgets.length} selected
                  </p>
                  <div className="flex gap-3">
                    <button type="button" onClick={selectAllRollover} className="text-xs font-semibold text-primary hover:underline">Select all</button>
                    <button type="button" onClick={clearAllRollover} className="text-xs font-semibold text-muted-foreground hover:underline">Clear all</button>
                  </div>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {monthBudgets.map(b => {
                    const checked = rolloverSelected.has(b.id)
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleRolloverBudget(b.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          checked ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: CATEGORY_COLORS[b.category] || '#94a3b8' }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{b.budget_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{b.category}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums flex-shrink-0">{fmt(b.monthly_limit)}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Target Month</Label>
                    <Select value={rolloverMonth} onValueChange={setRolloverMonth}>
                      <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Target Year</Label>
                    <Select value={rolloverYear} onValueChange={setRolloverYear}>
                      <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {rolloverIsSameMonth && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Target month is the same as the month you're viewing — pick a different month.
                  </p>
                )}
              </>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setRolloverOpen(false)}>Cancel</Button>
              <Button
                onClick={handleRollover}
                disabled={rolloverLoading || rolloverSelected.size === 0 || rolloverIsSameMonth || monthBudgets.length === 0}
                style={{ background: theme.colors.primary, color: '#fff' }}
              >
                {rolloverLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : `Rollover ${rolloverSelected.size > 0 ? rolloverSelected.size : ''} Budget${rolloverSelected.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    )}

    {/* ── Spending Guidance Breakdown — reached from the button above.
        Shares this component's state entirely (viewMonth/viewYear, budgets,
        expenses), so the selected month, filters, and everything else are
        already "preserved" simply because nothing was unmounted — this is
        a view swap within the same component tree, not a navigation. ──── */}
    {view === 'breakdown' && (

      <div key="breakdown" className="space-y-5 animate-fade-in">

        {/* Header */}

        <div className="flex items-center justify-between flex-wrap gap-3">

          <div>

            <button onClick={() => setView('overview')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">

              <ChevronLeft className="w-4 h-4" /> Back to Budgets

            </button>

            <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>Monthly Budgets</h1>

            <p className="text-muted-foreground text-sm mt-0.5">

              <Calendar className="w-3.5 h-3.5 inline mr-1" />

              {MONTH_NAMES[viewMonth - 1]} 1 – {MONTH_NAMES[viewMonth - 1]} {daysInPeriod}, {viewYear} ({daysInPeriod} days)

            </p>

          </div>

          <div className="flex items-center gap-2 flex-wrap">

            {/* Month/Year picker */}
            <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 bg-white text-xs font-medium">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <select
                value={`${viewYear}-${String(viewMonth).padStart(2,'0')}`}
                onChange={e => {
                  const [y, m] = e.target.value.split('-')
                  setViewYear(Number(y))
                  setViewMonth(Number(m))
                }}
                className="appearance-none bg-transparent outline-none cursor-pointer font-semibold text-xs pr-4"
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                  const y = d.getFullYear(); const m = d.getMonth() + 1
                  return (
                    <option key={`${y}-${m}`} value={`${y}-${String(m).padStart(2,'0')}`}>
                      {MONTH_NAMES[m - 1]} {y}
                    </option>
                  )
                })}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </div>

            {/* Category filter */}
            <div className="relative">
              <select
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="appearance-none border border-border rounded-lg pl-3 pr-7 py-1.5 bg-white text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">All Categories</option>
                {breakdownRows.map(b => (
                  <option key={b.category} value={b.category}>{b.category}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>

            <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>

              <Plus className="w-4 h-4 mr-1" /> Create Budget

            </Button>

          </div>

        </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Monthly Budget */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
            <Wallet className="w-6 h-6" style={{ color: '#16a34a' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Monthly Budget</p>
            <p className="text-lg font-bold tabular-nums truncate" style={{ color: theme.colors.primary }}>{fmt(summary.totalBudgeted)}</p>
            <p className="text-[11px] text-muted-foreground">100% of plan</p>
          </div>
        </div>

        {/* Spent So Far */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dbeafe' }}>
            <TrendingDown className="w-6 h-6" style={{ color: '#2563eb' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Spent So Far</p>
            <p className="text-lg font-bold tabular-nums truncate text-blue-600">{fmt(summary.totalSpent)}</p>
            <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.round(aggregatePct)}% of budget` : '—'}</p>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f3e8ff' }}>
            <RefreshCw className="w-6 h-6" style={{ color: '#7c3aed' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Remaining Budget</p>
            <p className="text-lg font-bold tabular-nums truncate text-violet-600">{fmt(Math.max(0, remainingThisMonth))}</p>
            <p className="text-[11px] text-muted-foreground">{summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}% left` : '—'}</p>
          </div>
        </div>

        {/* Days Left */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7' }}>
            <Calendar className="w-6 h-6" style={{ color: '#d97706' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Days Left in Month</p>
            <p className="text-lg font-bold tabular-nums truncate text-amber-600">{daysLeftInPeriod} Days</p>
            <p className="text-[11px] text-muted-foreground">
              Ends on {new Date(viewYear, viewMonth - 1, daysInPeriod).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Budget Health */}
        <div className="bg-white rounded-2xl border border-border shadow-sm p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#dcfce7' }}>
            <CheckCircle className="w-6 h-6" style={{ color: '#16a34a' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Budget Health</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: aggregateStatusMeta.color }}>
              {summary.totalBudgeted > 0 ? `${Math.max(0, 100 - Math.round(aggregatePct))}%` : '—'}
            </p>
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1,2,3,4,5].map(s => (
                <span key={s} className="text-[10px]" style={{
                  color: (100 - aggregatePct) >= s * 20 ? '#f59e0b' : '#d1d5db'
                }}>★</span>
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">
                {aggregateStatusMeta.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overall Progress + Budget Insight ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">

        {/* Overall Progress */}
        <Card className="bg-white rounded-2xl shadow-sm border border-border">
          <CardContent className="p-5">
            <p className="text-sm font-bold mb-1">Overall Progress</p>
            <div className="flex items-end justify-between gap-2 mb-2">
              <p className="text-2xl font-bold tabular-nums" style={{ color: aggregateStatusMeta.color }}>
                {Math.round(aggregatePct)}% <span className="text-base font-semibold text-muted-foreground">Used</span>
              </p>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mb-1"
                style={{ background: aggregateStatusMeta.bg, color: aggregateStatusMeta.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: aggregateStatusMeta.color }} />
                {aggregateStatusMeta.label}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, aggregatePct)}%`,
                  background: aggregatePct >= 100 ? '#dc2626' : aggregatePct >= 80 ? '#f59e0b' : '#16a34a',
                }} />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground flex-wrap gap-2">
              <span className="tabular-nums">{fmt(summary.totalSpent)} of {fmt(summary.totalBudgeted)} used</span>
              <span className="tabular-nums">{fmt(Math.max(0, remainingThisMonth))} remaining</span>
              <span>{daysLeftInPeriod} days left</span>
            </div>

            {/* Per-budget mini bars */}
            <div className="mt-4 space-y-2.5">
              {(showAllProgress ? budgetsWithSpent : budgetsWithSpent.slice(0, 4)).map(b => {
                const pct = Math.min(100, b.percentage || 0)
                const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a'
                return (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate max-w-[160px]">{b.budget_name}</span>
                      <span className="tabular-nums font-semibold" style={{ color: barColor }}>{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })}
             {budgetsWithSpent.length > 4 && (
                <button
                  onClick={() => setShowAllProgress(v => !v)}
                  className="w-full text-[11px] font-semibold text-center pt-1 hover:underline"
                  style={{ color: theme.colors.primary }}
                >
                  {showAllProgress ? '− Show less' : `+ ${budgetsWithSpent.length - 4} more budgets`}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Budget Insight */}
        <Card className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <CardContent className="p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💡</span>
                <p className="text-sm font-bold">Budget Insight</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {aggregatePct >= 100
                  ? `You've exceeded your total budget of ${fmt(summary.totalBudgeted)}. Review your spending and adjust your budget categories.`
                  : aggregatePct >= 80
                  ? `You've used ${Math.round(aggregatePct)}% of your total budget. With ${daysLeftInPeriod} days left, spend carefully — you have ${fmt(Math.max(0, remainingThisMonth))} remaining.`
                  : `You have spent ${Math.round(aggregatePct)}% of your total budget. You're on track! Try to keep your daily spending around ${fmt(dailyTarget)} to finish the month strong.`}
              </p>
              {daysLeftInPeriod > 0 && summary.totalBudgeted > 0 && (
                <div className="mt-4 p-3 rounded-xl" style={{ background: theme.colors.primary + '0f' }}>
                  <p className="text-xs font-semibold" style={{ color: theme.colors.primary }}>Suggested daily spend</p>
                  <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: theme.colors.primary }}>
                    {fmt(Math.max(0, remainingThisMonth) / Math.max(1, daysLeftInPeriod))}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ day</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">to stay within budget for the rest of {MONTH_NAMES[viewMonth - 1]}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
              <span>{summary.safe} of {monthBudgets.length} budgets on track</span>
              {summary.exceeded > 0 && (
                <span className="text-red-500 font-semibold">{summary.exceeded} exceeded</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily Spend / Budget vs Actual — toggle between the two, same card ── */}
      {(() => {
        const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
        const allDays = Array.from({ length: daysInPeriod }, (_, i) => {
          const d = new Date(viewYear, viewMonth - 1, i + 1)
          return {
            day:     i + 1,
            label:   String(i + 1),
            dayName: DAY_NAMES[d.getDay()],
            date:    `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(i + 1).padStart(2,'0')}`,
          }
        })
        return (
          <Card className="bg-white rounded-2xl shadow-sm border border-border">
            <CardContent className="p-5">
              <div className="flex gap-1 p-1 bg-muted/40 rounded-lg w-fit mb-4">
                <button
                  onClick={() => setGuideChartView('daily')}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={guideChartView === 'daily'
                    ? { background: theme.colors.primary, color: '#fff' }
                    : { color: '#64748b' }}
                >
                  Daily Spend
                </button>
                <button
                  onClick={() => setGuideChartView('budget')}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={guideChartView === 'budget'
                    ? { background: theme.colors.primary, color: '#fff' }
                    : { color: '#64748b' }}
                >
                  Budget vs Actual
                </button>
              </div>
              {guideChartView === 'daily' ? (
                <DailySpendChart
                  allDays={allDays}
                  monthExpenses={monthExpenses}
                  budgetsWithSpent={budgetsWithSpent}
                  dailyTarget={dailyTarget}
                  fmt={fmt}
                  theme={theme}
                  viewMonth={viewMonth}
                  viewYear={viewYear}
                  MONTH_NAMES={MONTH_NAMES}
                />
              ) : (
                <BudgetVsActualAreaChart
                  expenses={expenses}
                  budgets={budgets}
                  fmt={fmt}
                  theme={theme}
                  MONTH_NAMES={MONTH_NAMES}
                  defaultMonth={viewMonth}
                  defaultYear={viewYear}
                />
              )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Budget Breakdown table */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div>
              <p className="text-sm font-bold">Budget Breakdown</p>
              <p className="text-xs text-muted-foreground">See how much you can spend each day and week for every budget category.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Month/Year picker */}
              <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 bg-white text-xs font-medium cursor-pointer"
                onClick={() => {}}>
                <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
                <select
                  value={`${viewYear}-${String(viewMonth).padStart(2,'0')}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split('-')
                    setViewYear(Number(y))
                    setViewMonth(Number(m))
                  }}
                  className="appearance-none bg-transparent outline-none cursor-pointer font-semibold text-xs pr-4"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
                    const y = d.getFullYear(); const m = d.getMonth() + 1
                    return (
                      <option key={`${y}-${m}`} value={`${y}-${String(m).padStart(2,'0')}`}>
                        {MONTH_NAMES[m - 1]} {y}
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </div>

              {/* Status filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="appearance-none border border-border rounded-lg pl-3 pr-7 py-1.5 bg-white text-xs font-semibold outline-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="on_track">On Track</option>
                  <option value="warning">Warning</option>
                  <option value="exceeded">Exceeded</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-1.5 text-xs font-semibold bg-white hover:bg-muted/40 transition-colors"
                style={showFilters ? { background: theme.colors.primary, color: '#fff', borderColor: theme.colors.primary } : {}}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
              </button>
            </div>
          </div>

          {/* Expanded filters panel */}
          {showFilters && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/30 border border-border flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <input
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Search category or budget name…"
                  className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/60"
                />
                {searchFilter && (
                  <button onClick={() => setSearchFilter('')}>
                    <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Showing <span className="font-semibold text-foreground">{filteredBreakdownRows.length}</span> of <span className="font-semibold text-foreground">{breakdownRows.length}</span> budgets</span>
                {(statusFilter !== 'all' || searchFilter) && (
                  <button
                    onClick={() => { setStatusFilter('all'); setSearchFilter('') }}
                    className="text-xs font-semibold hover:underline flex items-center gap-1"
                    style={{ color: theme.colors.primary }}
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {breakdownRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {filteredBreakdownRows.length === 0 && breakdownRows.length > 0
                  ? 'No budgets match the selected filters'
                  : `No budgets for ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2.5 font-medium text-muted-foreground text-xs">Category</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Monthly Budget</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Daily Target<br /><span className="font-normal">(Average)</span></th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Weekly Target<br /><span className="font-normal">(Average)</span></th>
                    <th className="text-center px-3 py-2.5 font-medium text-muted-foreground text-xs w-36">Spent So Far / % Used</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Remaining</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Projected Spend<br /><span className="font-normal">(End of Month)</span></th>
                    <th className="text-right px-5 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakdownRows.map(b => {
                    const pct = b.percentage || 0
                    const status = getBudgetStatus(pct)
                    const spentPct  = b.monthly_limit > 0 ? Math.round(((b.spent || 0) / b.monthly_limit) * 100) : 0
                    const remainPct = 100 - spentPct
                    const statusMeta = status === 'exceeded'
                      ? { label: 'Over Budget',       color: '#dc2626', bg: '#fee2e2' }
                      : status === 'warning'
                      ? { label: 'Approaching',       color: '#d97706', bg: '#fef3c7' }
                      : { label: 'On Track',           color: '#16a34a', bg: '#dcfce7' }
                    return (
                      <tr key={b.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedBudgetId(p => p === b.id ? null : b.id)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                              style={{ background: `${CATEGORY_COLORS[b.category] || '#94a3b8'}20` }}>
                             {(() => {
                                const iconMap: Record<string, React.ReactNode> = {
                                  'Food & Dining':    <UtensilsCrossed className="w-4 h-4" />,
                                  'Transport':        <Car className="w-4 h-4" />,
                                  'Housing':          <Home className="w-4 h-4" />,
                                  'Utilities':        <Zap className="w-4 h-4" />,
                                  'Utilities Bills':  <Zap className="w-4 h-4" />,
                                  'Healthcare':       <HeartPulse className="w-4 h-4" />,
                                  'Education':        <GraduationCap className="w-4 h-4" />,
                                  'Entertainment':    <Tv2 className="w-4 h-4" />,
                                  'Shopping':         <ShoppingBag className="w-4 h-4" />,
                                  'Clothing':         <Shirt className="w-4 h-4" />,
                                  'Personal Care':    <Sparkles className="w-4 h-4" />,
                                  'Savings':          <PiggyBank className="w-4 h-4" />,
                                  'Debt Payment':     <CreditCard className="w-4 h-4" />,
                                  'Insurance':        <ShieldCheck className="w-4 h-4" />,
                                  'Travel':           <Plane className="w-4 h-4" />,
                                  'Communication':    <Smartphone className="w-4 h-4" />,
                                  'Family Support':   <Users className="w-4 h-4" />,
                                  'Emergency':        <Siren className="w-4 h-4" />,
                                  'Charity & Donations': <Heart className="w-4 h-4" />,
                                  'Charity & Donation':  <Heart className="w-4 h-4" />,
                                  'Tithe & Offerings': <Church className="w-4 h-4" />,
                                  'Tithe & Offerings - Church Donations': <Church className="w-4 h-4" />,
                                  'Church Donations': <Church className="w-4 h-4" />,
                                  'Investment':       <TrendingUp className="w-4 h-4" />,
                                  'Other':            <Package className="w-4 h-4" />,
                                }
                                if (iconMap[b.category]) return iconMap[b.category]
                                // Auto-match custom categories by keyword
                                const cat = b.category.toLowerCase()
                                if (cat.includes('food') || cat.includes('eat') || cat.includes('dining') || cat.includes('restaurant') || cat.includes('lunch') || cat.includes('dinner') || cat.includes('breakfast')) return <UtensilsCrossed className="w-4 h-4" />
                                if (cat.includes('transport') || cat.includes('fuel') || cat.includes('car') || cat.includes('uber') || cat.includes('taxi') || cat.includes('bus') || cat.includes('vehicle')) return <Car className="w-4 h-4" />
                                if (cat.includes('house') || cat.includes('rent') || cat.includes('home') || cat.includes('mortgage') || cat.includes('property')) return <Home className="w-4 h-4" />
                                if (cat.includes('util') || cat.includes('electric') || cat.includes('water') || cat.includes('gas') || cat.includes('power') || cat.includes('bill')) return <Zap className="w-4 h-4" />
                                if (cat.includes('health') || cat.includes('medical') || cat.includes('doctor') || cat.includes('hospital') || cat.includes('pharma') || cat.includes('clinic')) return <HeartPulse className="w-4 h-4" />
                                if (cat.includes('edu') || cat.includes('school') || cat.includes('tuition') || cat.includes('course') || cat.includes('training') || cat.includes('book')) return <GraduationCap className="w-4 h-4" />
                                if (cat.includes('entertain') || cat.includes('movie') || cat.includes('cinema') || cat.includes('stream') || cat.includes('tv') || cat.includes('netflix') || cat.includes('sport')) return <Tv2 className="w-4 h-4" />
                                if (cat.includes('shop') || cat.includes('grocery') || cat.includes('market') || cat.includes('supermarket') || cat.includes('mall')) return <ShoppingBag className="w-4 h-4" />
                                if (cat.includes('cloth') || cat.includes('fashion') || cat.includes('wear') || cat.includes('dress') || cat.includes('shoe')) return <Shirt className="w-4 h-4" />
                                if (cat.includes('personal') || cat.includes('salon') || cat.includes('hair') || cat.includes('beauty') || cat.includes('spa') || cat.includes('groom')) return <Sparkles className="w-4 h-4" />
                                if (cat.includes('sav') || cat.includes('invest') && !cat.includes('debt')) return <PiggyBank className="w-4 h-4" />
                                if (cat.includes('debt') || cat.includes('loan') || cat.includes('credit') || cat.includes('repay') || cat.includes('payment')) return <CreditCard className="w-4 h-4" />
                                if (cat.includes('insur') || cat.includes('protect') || cat.includes('cover') || cat.includes('policy')) return <ShieldCheck className="w-4 h-4" />
                                if (cat.includes('travel') || cat.includes('flight') || cat.includes('hotel') || cat.includes('trip') || cat.includes('holiday') || cat.includes('vacation')) return <Plane className="w-4 h-4" />
                                if (cat.includes('phone') || cat.includes('mobile') || cat.includes('internet') || cat.includes('data') || cat.includes('telecom') || cat.includes('network') || cat.includes('airtime')) return <Smartphone className="w-4 h-4" />
                                if (cat.includes('family') || cat.includes('child') || cat.includes('parent') || cat.includes('support') || cat.includes('depend')) return <Users className="w-4 h-4" />
                                if (cat.includes('emerg') || cat.includes('urgent') || cat.includes('crisis')) return <Siren className="w-4 h-4" />
                                if (cat.includes('charit') || cat.includes('donat') || cat.includes('ngo') || cat.includes('welfare')) return <Heart className="w-4 h-4" />
                                if (cat.includes('church') || cat.includes('tithe') || cat.includes('offer') || cat.includes('faith') || cat.includes('worship') || cat.includes('mosque') || cat.includes('religion')) return <Church className="w-4 h-4" />
                                if (cat.includes('invest') || cat.includes('stock') || cat.includes('fund') || cat.includes('portfolio') || cat.includes('asset')) return <TrendingUp className="w-4 h-4" />
                                return <Package className="w-4 h-4" />
                              })()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{b.budget_name}</p>
                              <p className="text-xs text-muted-foreground truncate capitalize">{b.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{fmt(b.monthly_limit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(b.dailyTarget)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{fmt(b.weeklyTarget)}</td>
                        
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1 min-w-[110px]">
                            <div className="flex items-center justify-between w-full text-xs">
                              <span className="font-semibold tabular-nums" style={{
                                color: pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a'
                              }}>
                                {Math.round(pct)}%
                              </span>
                              <span className="text-muted-foreground text-[10px]">{fmt(b.spent || 0)}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: pct >= 100 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">

                          {fmt(Math.max(0, b.remaining || 0))}

                          <span className="text-muted-foreground text-xs ml-1">{Math.max(0, remainPct)}%</span>

                        </td>

                        <td className="px-3 py-3 text-right tabular-nums">
                          <span
                            className="font-semibold"
                            style={{
                              color: b.projectedStatus === 'over'
                                ? '#dc2626'
                                : b.projectedStatus === 'warning'
                                ? '#d97706'
                                : '#16a34a',
                            }}
                          >
                            {fmt(b.projectedSpend ?? 0)}
                          </span>
                          {b.projectedSpend > b.monthly_limit && (
                            <p className="text-[10px] text-red-500 mt-0.5">
                              +{fmt(b.projectedSpend - b.monthly_limit)} over
                            </p>
                          )}
                          {b.projectedSpend <= b.monthly_limit && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {fmt(b.monthly_limit - b.projectedSpend)} under
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background: statusMeta.bg, color: statusMeta.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta.color }} />
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                      )
                      


                      {/* Detail panel row */}
                      {selectedBudgetId === b.id && (() => {
                       const txns = monthExpenses
                        .filter((e: any) => e.category === b.category)
                        .sort((a: any, c: any) => (c.date ?? '').localeCompare(a.date ?? ''))
                         const topDays: Record<string, number> = {}
                        txns.forEach((t: any) => { topDays[t.date ?? ''] = (topDays[t.date ?? ''] || 0) + Number(t.amount) })
                        const peakDay = Object.entries(topDays).sort((a, b) => b[1] - a[1])[0]
                        const avgTxn = txns.length > 0 ? txns.reduce((s: number, t: any) => s + Number(t.amount), 0) / txns.length : 0
                        return (
                          <tr className="bg-muted/20 border-b border-border">
                            <td colSpan={9} className="px-5 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* KPIs */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
                                  {[
                                    { label: 'Budget Limit',   value: fmt(b.monthly_limit) },
                                    { label: 'Spent',          value: fmt(b.spent || 0), color: '#dc2626' },
                                    { label: 'Remaining',      value: fmt(Math.max(0, b.remaining || 0)), color: '#16a34a' },
                                    { label: 'Transactions',   value: txns.length },
                                    { label: 'Avg per Txn',    value: fmt(avgTxn) },
                                    { label: 'Daily Budget',   value: fmt(b.dailyTarget) },
                                  ].map(({ label, value, color }) => (
                                    <div key={label} className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">{label}</span>
                                      <span className="font-semibold tabular-nums" style={color ? { color } : {}}>{value}</span>
                                    </div>
                                  ))}
                                </div>
                                {/* Progress bar */}
                                <div className="space-y-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Usage</p>
                                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                      style={{ width: `${Math.min(100, b.percentage || 0)}%`, background: (b.percentage || 0) >= 100 ? '#dc2626' : (b.percentage || 0) >= 80 ? '#f59e0b' : '#16a34a' }} />
                                  </div>
                                  <p className="text-xs text-muted-foreground">{Math.round(b.percentage || 0)}% used · {Math.round(100 - Math.min(100, b.percentage || 0))}% left</p>
                                  {peakDay && (
                                    <div className="mt-3">
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Peak Spend Day</p>
                                      <p className="text-sm font-bold mt-1">{new Date(peakDay[0]).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                      <p className="text-xs text-muted-foreground">{fmt(peakDay[1])} spent</p>
                                    </div>
                                  )}
                                </div>
                                {/* Recent transactions */}
                                <div className="sm:col-span-2 space-y-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent Transactions</p>
                                  {txns.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No transactions this month</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                      {txns.slice(0, 8).map((t: any, ti: number) => (
                                        <div key={ti} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                                          <div className="min-w-0">
                                            <p className="font-medium truncate">{t.title || t.category || 'Expense'}</p>
                                            <p className="text-[10px] text-muted-foreground">{t.date}</p>
                                          </div>
                                          <span className="font-semibold tabular-nums text-red-500 flex-shrink-0 ml-2">-{fmt(Number(t.amount))}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })()}
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to use + Budget Pace Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white rounded-xl shadow-sm">
          <CardContent className="py-4 px-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.colors.primary + '18' }}>
              <Info className="w-4 h-4" style={{ color: theme.colors.primary }} />
            </div>
            <div>
              <p className="text-sm font-semibold">How to use</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Use your daily and weekly targets as a guide to help you stay on track. Try not to exceed your daily target for better monthly control.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-xl shadow-sm">
          <CardContent className="py-4 px-5">
            <p className="text-sm font-semibold mb-2">Budget Pace Guide</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="font-semibold">On Track</span>
                <span className="text-muted-foreground">You're within your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-semibold">Approaching Limit</span>
                <span className="text-muted-foreground">You've used more than 80% of your budget pace.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-semibold">Over Budget</span>
                <span className="text-muted-foreground">You've spent more than 100% of your budget.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    )}
    </div>
  )
}