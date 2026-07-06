'use client'

import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Target,
  RefreshCw, SlidersHorizontal, X,
  Eye, EyeOff, Bookmark, ChevronRight, ChevronDown, RotateCcw,
  Maximize2, ZoomIn, Tag, Percent, Receipt, Coins, Globe, AlertTriangle,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { formatCurrency } from '@/lib/utils'
import { KPICard } from '@/components/ui/kpi-card'

interface Props {
  accounts:  any[]
  transfers: any[]
  incomes:   any[]
  expenses:  any[]
  budgets:   any[]
  goals:     any[]
  profile:   any
  custodyTransactions?: any[]
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const INCOME_CATS  = ['All','Salary','Freelance','Business','Investment','Rental','Gift','Bonus','Other']
const EXPENSE_CATS = ['All','Food & Dining','Transport','Housing','Utilities','Healthcare',
                      'Education','Entertainment','Shopping','Clothing','Personal Care',
                      'Savings','Debt Payment','Insurance','Travel','Other']
const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: '#2563eb', mobile_money: '#f59e0b', cash: '#16a34a', investment: '#7c3aed',
}

// Outer ring — vivid category colors
const DONUT_COLORS = ['#16a34a','#2563eb','#f97316','#7c3aed','#dc2626','#0d9488','#db2777','#65a30d','#ca8a04']

// Inner ring — pastel currency colors
const CURRENCY_COLORS: Record<string, string> = {
  EUR: '#86efac',
  GBP: '#93c5fd',
  USD: '#fdba74',
  GHS: '#fca5a5',
  NGN: '#c4b5fd',
  KES: '#fde68a',
  ZAR: '#a5f3fc',
}
const CURRENCY_FALLBACK = ['#86efac','#93c5fd','#fdba74','#fca5a5','#c4b5fd','#fde68a','#a5f3fc']
const getCurrencyColor  = (name: string, i: number) =>
  CURRENCY_COLORS[name] ?? CURRENCY_FALLBACK[i % CURRENCY_FALLBACK.length]

const CURRENCY_SYMBOLS: Record<string, string> = {
  GHS: '₵', USD: '$', EUR: '€', GBP: '£', NGN: '₦', KES: 'KSh', ZAR: 'R',
}
const getCurrencySymbol = (c: string) => CURRENCY_SYMBOLS[c] ?? c

// ── Outer label: "Category (xx%)" outside the ring ───────────────────
const CategoryOuterLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, percent, name, viewBox } = props
  if (percent < 0.05) return null
  const RAD = Math.PI / 180
  const offset = (viewBox?.width ?? 400) < 340 ? 14 : 20
  const r = outerRadius + offset
  const x = cx + r * Math.cos(-midAngle * RAD)
  const y = cy + r * Math.sin(-midAngle * RAD)
  const fs = (viewBox?.width ?? 400) < 340 ? 9 : 11
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      fontSize={fs} fontWeight={600} fill="#374151">
      {`${name} (${(percent * 100).toFixed(0)}%)`}
    </text>
  )
}

// ── Decomposition Tree: Currency → Category, with transaction-level drill-down ──
interface DecompNode {
  key: string
  label: string
  amount: number
  pct: number
  color: string
  type: 'currency' | 'category'
  currency?: string
  category?: string
  children?: DecompNode[]
}

function IncomeDecompositionTree({
  filteredIncomes,
  getTransactionCurrency,
  themePrimary,
  exchangeRateMap,
}: {
  filteredIncomes: any[]
  getTransactionCurrency: (r: any) => string
  themePrimary: string
  exchangeRateMap: Record<string, number>
}) {
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<{ currency: string; category: string } | null>(null)
  const [sortMode,    setSortMode]    = useState<'amount' | 'name'>('amount')
  const [zoomedIn,    setZoomedIn]    = useState(false)
  const [expandedView, setExpandedView] = useState(false)

  // Live-measured curved connectors — root → each currency, and each
  // currency → its own categories — recomputed from actual DOM positions
  // so the curves always line up with the rendered cards, not a guessed layout.
  const containerRef    = useRef<HTMLDivElement>(null)
  const rootRef          = useRef<HTMLDivElement>(null)
  const currencyElsRef   = useRef<Map<string, HTMLDivElement>>(new Map())
  const categoryElsRef   = useRef<Map<string, HTMLDivElement>>(new Map())
  const [connectors, setConnectors] = useState<{ d: string; color: string }[]>([])

  // Converted grand total — each income record multiplied by its currency's
  // exchange rate (set on Net Worth page) before summing, so the root node and
  // percentages reflect real GHS-equivalent value, not a meaningless currency mix.
  const grandTotal = useMemo(() =>
    filteredIncomes.reduce((s, r) => {
      const cur  = getTransactionCurrency(r)
      const rate = exchangeRateMap[cur] ?? 1
      return s + Number(r.amount) * rate
    }, 0), [filteredIncomes, getTransactionCurrency, exchangeRateMap])

  const tree = useMemo(() => {
    const byCurrency: Record<string, { total: number; categories: Record<string, { total: number; rows: any[] }> }> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      const cat = r.category || 'Other'
      if (!byCurrency[cur]) byCurrency[cur] = { total: 0, categories: {} }
      byCurrency[cur].total += Number(r.amount)
      if (!byCurrency[cur].categories[cat]) byCurrency[cur].categories[cat] = { total: 0, rows: [] }
      byCurrency[cur].categories[cat].total += Number(r.amount)
      byCurrency[cur].categories[cat].rows.push(r)
    })

    const comparator = sortMode === 'amount'
      ? (a: [string, { total: number }], b: [string, { total: number }]) => b[1].total - a[1].total
      : (a: [string, { total: number }], b: [string, { total: number }]) => a[0].localeCompare(b[0])

    const currencyEntries = Object.entries(byCurrency).sort(comparator)
    return currencyEntries.map(([cur, data], i): DecompNode => ({
      key: cur,
      label: cur,
      amount: data.total,
      // pct uses converted currency total vs converted grand total
      pct: grandTotal > 0 ? ((data.total * (exchangeRateMap[cur] ?? 1)) / grandTotal) * 100 : 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      type: 'currency',
      currency: cur,
      children: Object.entries(data.categories)
        .sort(comparator)
        .map(([cat, catData], j): DecompNode => ({
          key: `${cur}-${cat}`,
          label: cat,
          amount: catData.total,
          pct: data.total > 0 ? (catData.total / data.total) * 100 : 0,
          color: getCurrencyColor(cur, i),
          type: 'category',
          currency: cur,
          category: cat,
        })),
    }))
  }, [filteredIncomes, grandTotal, getTransactionCurrency, sortMode])

  const currencyCount = tree.length
  const categoryCount = useMemo(() =>
    new Set(filteredIncomes.map(r => r.category || 'Other')).size, [filteredIncomes])
  const txnCount = filteredIncomes.length

  const selectedCurrencyNode = useMemo(() =>
    selectedCurrency ? tree.find(t => t.key === selectedCurrency) ?? null : null,
    [tree, selectedCurrency])

  const selectedCategoryNode = useMemo(() =>
    selectedCategory
      ? tree.find(t => t.key === selectedCategory.currency)?.children?.find(c => c.category === selectedCategory.category) ?? null
      : null,
    [tree, selectedCategory])

  const detailRows = useMemo(() => {
    if (!selectedCategoryNode) return []
    return filteredIncomes
      .filter(r => getTransactionCurrency(r) === selectedCategoryNode.currency && (r.category || 'Other') === selectedCategoryNode.category)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedCategoryNode, filteredIncomes, getTransactionCurrency])

  const selectCurrency = (key: string) => {
    setSelectedCategory(null)
    setSelectedCurrency(p => p === key ? null : key)
  }
  const selectCategory = (node: DecompNode) => {
    setSelectedCurrency(node.currency ?? null)
    setSelectedCategory(p =>
      p?.category === node.category && p?.currency === node.currency
        ? null
        : { currency: node.currency!, category: node.category! })
  }
  const resetView = () => {
    setSelectedCurrency(null)
    setSelectedCategory(null)
    setZoomedIn(false)
    setExpandedView(false)
  }

  useLayoutEffect(() => {
    function recompute() {
      const containerEl = containerRef.current
      const rootEl = rootRef.current
      if (!containerEl || !rootEl) return
      const containerRect = containerEl.getBoundingClientRect()
      const rootRect = rootEl.getBoundingClientRect()
      const next: { d: string; color: string }[] = []

      const curve = (fx: number, fy: number, tx: number, ty: number) => {
        const mx = (fx + tx) / 2
        return `M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`
      }

      tree.forEach(currencyNode => {
        const curEl = currencyElsRef.current.get(currencyNode.key)
        if (!curEl) return
        const curRect = curEl.getBoundingClientRect()
        next.push({
          d: curve(
            rootRect.right - containerRect.left, rootRect.top + rootRect.height / 2 - containerRect.top,
            curRect.left   - containerRect.left, curRect.top  + curRect.height  / 2 - containerRect.top,
          ),
          color: currencyNode.color,
        })
        currencyNode.children?.forEach(cat => {
          const catEl = categoryElsRef.current.get(cat.key)
          if (!catEl) return
          const catRect = catEl.getBoundingClientRect()
          next.push({
            d: curve(
              curRect.right - containerRect.left, curRect.top + curRect.height / 2 - containerRect.top,
              catRect.left  - containerRect.left, catRect.top + catRect.height / 2 - containerRect.top,
            ),
            color: currencyNode.color,
          })
        })
      })
      setConnectors(next)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', recompute)
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute) }
  }, [tree, zoomedIn, expandedView, selectedCurrency, selectedCategory])

  if (tree.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <TrendingUp className="w-8 h-8 opacity-20" />
        <p className="text-sm">Add income to see the breakdown</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Income</p>
          </div>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5" style={{ color: themePrimary }}>
            {Math.round(grandTotal).toLocaleString()}
          </p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Converted (GHS)</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Currencies</p>
          </div>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{currencyCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{tree.map(t => t.key).join(', ')}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Categories</p>
          </div>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{categoryCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Income categories</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5">
            <Receipt className="w-3 h-3 text-muted-foreground" />
            <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Transactions</p>
          </div>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{txnCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Total entries</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Tree */}
        <div className="rounded-xl border border-border p-3 sm:p-4 overflow-x-auto">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <select
                  value={sortMode}
                  onChange={e => setSortMode(e.target.value as 'amount' | 'name')}
                  className="appearance-none text-xs font-medium pl-2.5 pr-6 py-1.5 rounded-lg border border-border bg-white text-foreground focus:outline-none focus:ring-1 cursor-pointer"
                >
                  <option value="amount">Decomposition by Amount</option>
                  <option value="name">Decomposition by Name</option>
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground hidden md:block">Click any node to drill down</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setExpandedView(v => !v)} title="Toggle expanded layout"
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                  expandedView ? 'border-transparent text-white' : 'border-border bg-white text-muted-foreground hover:text-foreground'
                }`}
                style={expandedView ? { background: themePrimary } : {}}>
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setZoomedIn(v => !v)} title="Zoom in"
                className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                  zoomedIn ? 'border-transparent text-white' : 'border-border bg-white text-muted-foreground hover:text-foreground'
                }`}
                style={zoomedIn ? { background: themePrimary } : {}}>
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button onClick={resetView} title="Reset view"
                className="w-7 h-7 rounded-lg flex items-center justify-center border border-border bg-white text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3 md:hidden">Click any node to drill down</p>

          <div
            ref={containerRef}
            className="relative flex items-center gap-6 transition-transform duration-200"
            style={{
              minWidth: expandedView ? 640 : 460,
              transform: zoomedIn ? 'scale(1.08)' : 'scale(1)',
              transformOrigin: 'left center',
            }}
          >
            {/* Curved connectors — drawn from live-measured node positions */}
            <svg className="absolute inset-0 pointer-events-none overflow-visible" width="100%" height="100%">
              {connectors.map((c, i) => (
                <path key={i} d={c.d} stroke={c.color} strokeWidth={1.5} fill="none" opacity={0.55} />
              ))}
            </svg>

            {/* Root node */}
            <div ref={rootRef} className="flex-shrink-0 relative z-10">
              <button
                onClick={resetView}
                className="rounded-xl border-2 px-3 py-2.5 text-center flex flex-col items-center gap-1"
                style={{ borderColor: themePrimary, background: themePrimary + '0d' }}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: themePrimary }}>
                  <Wallet className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Income</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: themePrimary }}>
                  {Math.round(grandTotal).toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">100% (GHS)</p>
              </button>
            </div>

            {/* Currency rows — each paired with its own category list, all expanded at once */}
            <div className="flex flex-col gap-4 relative z-10">
              {tree.map(node => {
                const isCurSelected = selectedCurrency === node.key
                return (
                  <div key={node.key} className="flex items-start gap-6">
                    <div
                      ref={el => { if (el) currencyElsRef.current.set(node.key, el); else currencyElsRef.current.delete(node.key) }}
                      className="flex-shrink-0"
                    >
                      <button
                        onClick={() => selectCurrency(node.key)}
                        className="rounded-xl border-2 px-3 py-2 text-left transition-all flex items-center gap-2.5"
                        style={{
                          borderColor: isCurSelected ? node.color : 'var(--border)',
                          background: isCurSelected ? node.color + '12' : '#fff',
                        }}
                      >
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ background: node.color }}>
                          {node.label}
                        </span>
                        <div>
                          <p className="text-xs font-bold">{node.label}</p>
                          <p className="text-xs font-semibold tabular-nums">{Math.round(node.amount).toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground">{node.pct.toFixed(0)}%</p>
                        </div>
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 justify-center">
                      {node.children?.map(cat => {
                        const isCatSelected = selectedCategory?.currency === cat.currency && selectedCategory?.category === cat.category
                        return (
                          <div
                            key={cat.key}
                            ref={el => { if (el) categoryElsRef.current.set(cat.key, el); else categoryElsRef.current.delete(cat.key) }}
                          >
                            <button
                              onClick={() => selectCategory(cat)}
                              className="rounded-lg border px-2.5 py-1.5 text-left transition-all whitespace-nowrap"
                              style={{
                                borderColor: isCatSelected ? cat.color : 'var(--border)',
                                background: isCatSelected ? cat.color + '14' : '#fff',
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-xs font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                  {cat.label}
                                </span>
                                <span className="text-xs font-semibold tabular-nums">
                                  {Math.round(cat.amount).toLocaleString()} <span className="text-muted-foreground font-normal">({cat.pct.toFixed(0)}%)</span>
                                </span>
                              </div>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
            {tree.map(node => (
              <span key={node.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: node.color }} />
                {node.label} {Math.round(node.amount).toLocaleString()} ({node.pct.toFixed(0)}%)
              </span>
            ))}
          </div>

          {/* Breadcrumb + Reset */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs flex-wrap gap-2">
            <p className="text-muted-foreground flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-foreground">Path:</span>
              <button onClick={resetView} className="font-medium hover:underline" style={{ color: themePrimary }}>Income</button>
              {selectedCurrencyNode && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <button onClick={() => setSelectedCategory(null)} className="font-medium hover:underline" style={{ color: themePrimary }}>
                    {selectedCurrencyNode.label}
                  </button>
                </>
              )}
              {selectedCategoryNode && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium text-foreground">{selectedCategoryNode.label}</span>
                </>
              )}
            </p>
            <button onClick={resetView} className="flex items-center gap-1 font-semibold hover:underline" style={{ color: themePrimary }}>
              <RotateCcw className="w-3 h-3" /> Reset View
            </button>
          </div>
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-border p-3 sm:p-4">
          {selectedCategoryNode ? (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Details: {selectedCategoryNode.currency} {'>'} {selectedCategoryNode.label}
              </p>
              <p className="text-sm font-bold mt-0.5" style={{ color: selectedCategoryNode.color }}>
                {Math.round(selectedCategoryNode.amount).toLocaleString()} ({selectedCategoryNode.pct.toFixed(1)}% of {selectedCategoryNode.currency} total)
              </p>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      <th className="text-left pb-1.5 font-semibold">Transaction / Source</th>
                      <th className="text-left pb-1.5 font-semibold">Date</th>
                      <th className="text-right pb-1.5 font-semibold">Amount ({selectedCategoryNode.currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="py-1.5 pr-2 font-medium truncate max-w-[120px]">{r.title || r.description || selectedCategoryNode.label}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums" style={{ color: selectedCategoryNode.color }}>
                          {Math.round(Number(r.amount)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border">
                      <td className="py-1.5 font-bold" colSpan={2}>Total</td>
                      <td className="py-1.5 text-right font-bold tabular-nums" style={{ color: selectedCategoryNode.color }}>
                        {Math.round(detailRows.reduce((s, r) => s + Number(r.amount), 0)).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-3 pt-2 border-t border-border space-y-1.5 text-[11px]">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">About this node</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Coins className="w-3 h-3" /> Currency</span>
                  <span className="font-medium">{selectedCategoryNode.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3 h-3" /> Category</span>
                  <span className="font-medium">{selectedCategoryNode.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="w-3 h-3" /> Amount</span>
                  <span className="font-medium">{Math.round(selectedCategoryNode.amount).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Percent className="w-3 h-3" /> % of {selectedCategoryNode.currency} Total</span>
                  <span className="font-medium">{selectedCategoryNode.pct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="w-3 h-3" /> Transactions</span>
                  <span className="font-medium">{detailRows.length}</span>
                </div>
              </div>
            </>
          ) : selectedCurrencyNode ? (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Details: {selectedCurrencyNode.label}
              </p>
              <p className="text-sm font-bold mt-0.5" style={{ color: selectedCurrencyNode.color }}>
                {Math.round(selectedCurrencyNode.amount).toLocaleString()} ({selectedCurrencyNode.pct.toFixed(1)}% of total income)
              </p>

              <div className="mt-3 space-y-1">
                {selectedCurrencyNode.children?.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => selectCategory(cat)}
                    className="w-full flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded px-1 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                      {cat.label}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {Math.round(cat.amount).toLocaleString()} <span className="text-muted-foreground font-normal">({cat.pct.toFixed(0)}%)</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-2 border-t border-border space-y-1.5 text-[11px]">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">About this node</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Coins className="w-3 h-3" /> Currency</span>
                  <span className="font-medium">{selectedCurrencyNode.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Tag className="w-3 h-3" /> Categories</span>
                  <span className="font-medium">{selectedCurrencyNode.children?.length ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Wallet className="w-3 h-3" /> Amount</span>
                  <span className="font-medium">{Math.round(selectedCurrencyNode.amount).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Percent className="w-3 h-3" /> % of Total Income</span>
                  <span className="font-medium">{selectedCurrencyNode.pct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="w-3 h-3" /> Transactions</span>
                  <span className="font-medium">
                    {filteredIncomes.filter(r => getTransactionCurrency(r) === selectedCurrencyNode.currency).length}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10 text-muted-foreground">
              <Wallet className="w-7 h-7 opacity-20" />
              <p className="text-xs">Click a currency or category node<br />to see its details here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Classic decomposition tree — click a currency to expand it, then click
// one of its categories for transaction detail. Kept as a separate, distinct
// view (the "Tree Expand View" bookmark state) alongside the newer always-
// expanded IncomeDecompositionTree above. ──────────────────────────────────
function IncomeDecompositionTreeExpand({
  filteredIncomes,
  getTransactionCurrency,
  themePrimary,
  exchangeRateMap,
}: {
  filteredIncomes: any[]
  getTransactionCurrency: (r: any) => string
  themePrimary: string
  exchangeRateMap: Record<string, number>
}) {
  const [expandedCurrency, setExpandedCurrency] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<DecompNode | null>(null)

  const grandTotal = useMemo(() =>
    filteredIncomes.reduce((s, r) => {
      const cur  = getTransactionCurrency(r)
      const rate = exchangeRateMap[cur] ?? 1
      return s + Number(r.amount) * rate
    }, 0), [filteredIncomes, getTransactionCurrency, exchangeRateMap])

  const tree = useMemo(() => {
    const byCurrency: Record<string, { total: number; categories: Record<string, { total: number; rows: any[] }> }> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      const cat = r.category || 'Other'
      if (!byCurrency[cur]) byCurrency[cur] = { total: 0, categories: {} }
      byCurrency[cur].total += Number(r.amount)
      if (!byCurrency[cur].categories[cat]) byCurrency[cur].categories[cat] = { total: 0, rows: [] }
      byCurrency[cur].categories[cat].total += Number(r.amount)
      byCurrency[cur].categories[cat].rows.push(r)
    })

    const currencyEntries = Object.entries(byCurrency).sort((a, b) => b[1].total - a[1].total)
    return currencyEntries.map(([cur, data], i): DecompNode => ({
      key: cur,
      label: cur,
      amount: data.total,
      pct: grandTotal > 0 ? ((data.total * (exchangeRateMap[cur] ?? 1)) / grandTotal) * 100 : 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      type: 'currency',
      currency: cur,
      children: Object.entries(data.categories)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cat, catData], j): DecompNode => ({
          key: `${cur}-${cat}`,
          label: cat,
          amount: catData.total,
          pct: data.total > 0 ? (catData.total / data.total) * 100 : 0,
          color: getCurrencyColor(cur, i),
          type: 'category',
          currency: cur,
          category: cat,
        })),
    }))
  }, [filteredIncomes, grandTotal, getTransactionCurrency])

  const currencyCount = tree.length
  const categoryCount = useMemo(() =>
    new Set(filteredIncomes.map(r => r.category || 'Other')).size, [filteredIncomes])
  const txnCount = filteredIncomes.length

  const detailRows = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'category') return []
    return filteredIncomes
      .filter(r => getTransactionCurrency(r) === selectedNode.currency && (r.category || 'Other') === selectedNode.category)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedNode, filteredIncomes, getTransactionCurrency])

  if (tree.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <TrendingUp className="w-8 h-8 opacity-20" />
        <p className="text-sm">Add income to see the breakdown</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Income</p>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5" style={{ color: themePrimary }}>
            {Math.round(grandTotal).toLocaleString()}
          </p>
          <p className="text-sm font-bold tabular-nums" style={{ color: themePrimary }}>
                  {Math.round(grandTotal).toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">100% (GHS)</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Currencies</p>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{currencyCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{tree.map(t => t.key).join(', ')}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Categories</p>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{categoryCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Income categories</p>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <p className="text-[9px] sm:text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Transactions</p>
          <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5">{txnCount}</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground">Total entries</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Tree */}
        <div className="rounded-xl border border-border p-3 sm:p-4 overflow-x-auto">
          <p className="text-[10px] text-muted-foreground mb-3">Click a currency to expand · click a category for transaction detail</p>
          <div className="flex items-stretch gap-3 min-w-[460px]">
            {/* Root node */}
            <div className="flex items-center">
              <div className="rounded-xl border-2 px-3 py-2.5 text-center" style={{ borderColor: themePrimary, background: themePrimary + '0d' }}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Total Income</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: themePrimary }}>
                  {Math.round(grandTotal).toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground">100%</p>
              </div>
            </div>

            {/* Connector */}
            <div className="flex flex-col justify-center">
              <div className="w-4 border-t-2 border-dashed border-border" />
            </div>

            {/* Currency column */}
            <div className="flex flex-col gap-2 justify-center">
              {tree.map(node => {
                const isExpanded = expandedCurrency === node.key
                return (
                  <button
                    key={node.key}
                    onClick={() => setExpandedCurrency(p => p === node.key ? null : node.key)}
                    className="rounded-xl border-2 px-3 py-2 text-left transition-all"
                    style={{
                      borderColor: isExpanded ? node.color : 'var(--border)',
                      background: isExpanded ? node.color + '12' : '#fff',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: node.color }} />
                      <div>
                        <p className="text-xs font-bold">{node.label}</p>
                        <p className="text-xs font-semibold tabular-nums">{Math.round(node.amount).toLocaleString()}</p>
                        <p className="text-[9px] text-muted-foreground">{node.pct.toFixed(0)}%</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Connector + Category column — only when a currency is expanded */}
            {expandedCurrency && (
              <>
                <div className="flex flex-col justify-center">
                  <div className="w-4 border-t-2 border-dashed border-border" />
                </div>
                <div className="flex flex-col gap-1.5 justify-center">
                  {tree.find(t => t.key === expandedCurrency)?.children?.map(cat => {
                    const isSelected = selectedNode?.key === cat.key
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setSelectedNode(p => p?.key === cat.key ? null : cat)}
                        className="rounded-lg border px-2.5 py-1.5 text-left transition-all whitespace-nowrap"
                        style={{
                          borderColor: isSelected ? cat.color : 'var(--border)',
                          background: isSelected ? cat.color + '14' : '#fff',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium">{cat.label}</span>
                          <span className="text-xs font-semibold tabular-nums">
                            {Math.round(cat.amount).toLocaleString()} <span className="text-muted-foreground font-normal">({cat.pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border">
            {tree.map(node => (
              <span key={node.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: node.color }} />
                {node.label} {Math.round(node.amount).toLocaleString()} ({node.pct.toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-border p-3 sm:p-4">
          {selectedNode ? (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Details: {selectedNode.currency} {'>'} {selectedNode.category}
              </p>
              <p className="text-sm font-bold mt-0.5" style={{ color: selectedNode.color }}>
                {Math.round(selectedNode.amount).toLocaleString()} ({selectedNode.pct.toFixed(1)}% of {selectedNode.currency} total)
              </p>
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {detailRows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title || r.description || selectedNode.category}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums flex-shrink-0" style={{ color: selectedNode.color }}>
                      {Math.round(Number(r.amount)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-border space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-medium">{selectedNode.currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{selectedNode.category}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Transactions</span><span className="font-medium">{detailRows.length}</span></div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10 text-muted-foreground">
              <Wallet className="w-7 h-7 opacity-20" />
              <p className="text-xs">Expand a currency, then click a category<br />to see its transactions here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Flip Account Card — front shows the at-a-glance balance, back (tap to
// flip) shows the full breakdown: opening balance, income/expense, transfers,
// custody movements, and overdraft status. Kept as its own component so the
// per-card flip state doesn't re-render the whole account grid. ────────────
function FlipAccountCard({
  acc,
  color,
  isNeg,
}: {
  acc: any
  color: string
  isNeg: boolean
}) {
  const [flipped, setFlipped] = useState(false)
  const hasTransfers = (acc.transfers_in ?? 0) > 0 || (acc.transfers_out ?? 0) > 0
  const hasCustody   = (acc.custody_in ?? 0) > 0 || (acc.custody_out ?? 0) > 0

  return (
    <div
      className="relative h-[136px] sm:h-[156px] cursor-pointer select-none"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(v => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setFlipped(v => !v) }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front face */}
        <Card
          className="absolute inset-0 bg-white rounded-xl shadow-sm border border-border overflow-hidden"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <div className="h-1" style={{ background: color }} />
          <CardContent className="p-2.5 sm:p-4">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{acc.name}</p>
              {isNeg && <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color }} />}
            </div>
            <p className="text-sm sm:text-lg font-bold tabular-nums mt-0.5 sm:mt-1 truncate" style={{ color }}>
              {formatCurrency(acc.balance ?? 0, acc.currency)}
            </p>
            <div className="flex justify-between text-[10px] sm:text-xs mt-1 sm:mt-2 gap-1">
              <span className="text-green-600 truncate">+{formatCurrency(acc.total_income ?? 0, acc.currency)}</span>
              <span className="text-red-500 truncate">-{formatCurrency(acc.total_expenses ?? 0, acc.currency)}</span>
            </div>
            {hasTransfers && (
              <div className="flex justify-between text-[10px] sm:text-xs mt-0.5 sm:mt-1 gap-1">
                {(acc.transfers_in  ?? 0) > 0 && <span className="text-blue-500 truncate">↙{formatCurrency(acc.transfers_in  ?? 0, acc.currency)}</span>}
                {(acc.transfers_out ?? 0) > 0 && <span className="text-orange-500 truncate">↗{formatCurrency(acc.transfers_out ?? 0, acc.currency)}</span>}
              </div>
            )}
            <div className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[9px] text-muted-foreground/60">
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Tap for details</span>
            </div>
          </CardContent>
        </Card>

        {/* Back face */}
        <Card
          className="absolute inset-0 bg-white rounded-xl shadow-sm border border-border overflow-hidden"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="h-1" style={{ background: color }} />
          <CardContent className="p-2.5 sm:p-4 text-[10px] sm:text-[11px] space-y-1">
            <p className="text-[10px] sm:text-xs font-semibold truncate mb-1">{acc.name}</p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Opening</span>
              <span className="font-medium tabular-nums">{formatCurrency(acc.opening_balance ?? 0, acc.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="font-medium tabular-nums text-green-600">+{formatCurrency(acc.total_income ?? 0, acc.currency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expenses</span>
              <span className="font-medium tabular-nums text-red-500">-{formatCurrency(acc.total_expenses ?? 0, acc.currency)}</span>
            </div>
            {hasTransfers && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Transfers In</span>
                  <span className="font-medium tabular-nums text-blue-500">+{formatCurrency(acc.transfers_in ?? 0, acc.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Transfers Out</span>
                  <span className="font-medium tabular-nums text-orange-500">-{formatCurrency(acc.transfers_out ?? 0, acc.currency)}</span>
                </div>
              </>
            )}
            {hasCustody && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custody In</span>
                  <span className="font-medium tabular-nums">+{formatCurrency(acc.custody_in ?? 0, acc.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custody Out</span>
                  <span className="font-medium tabular-nums">-{formatCurrency(acc.custody_out ?? 0, acc.currency)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/60">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold" style={{ color }}>
                {acc.overdraftStatus === 'ok' ? 'Healthy' : acc.overdraftStatus === 'overdraft' ? 'Overdrawn' : 'Blocked'}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1.5 sm:mt-2 text-[9px] text-muted-foreground/60">
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Tap to flip back</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function DashboardContent({ accounts, transfers, incomes, expenses, budgets, goals, profile, custodyTransactions = [] }: Props) {
  const { setProfile, activeTheme, currency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const fmt      = useMemo(() => (n: number) => formatCurrency(n, currency), [currency])
  const shortFmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
    return String(Math.round(v))
  }

  useEffect(() => { if (profile) setProfile(profile) }, [profile])

  const [showFilter,        setShowFilter]        = useState(false)
  const [localFrom,         setLocalFrom]         = useState('')
  const [localTo,           setLocalTo]           = useState('')
  const [selMonth,          setSelMonth]          = useState('')
  const [selYear,           setSelYear]           = useState('')
  const [incomeCat,         setIncomeCat]         = useState('All')
  const [expenseCat,        setExpenseCat]        = useState('All')
  const [isFiltered,        setIsFiltered]        = useState(false)
  const [accountTypeFilter, setAccountTypeFilter] = useState('all')
  const [activeDonutIndex,  setActiveDonutIndex]  = useState<number | null>(null)
  const [showTotalAccBalance, setShowTotalAccBalance] = useState(false)
  const [chartView, setChartView] = useState<'monthly' | 'daily'>('monthly')
  const [showAccBalances,     setShowAccBalances]     = useState(false)
  const [incomeView,           setIncomeView]           = useState<'tree' | 'donut' | 'treeExpand'>('tree')
  // Budget Usage / Multi-Currency Breakdown / Savings Goals are heavy, detailed
  // sections — collapsed by default so the main dashboard stays scannable;
  // the Transactions page is already the place to dig into individual entries.
  const [showMoreCharts, setShowMoreCharts] = useState(false)

  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome   = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense  = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut  = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn   = transfers.filter(t => t.to_account_id   === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      // Custody: "received" adds cash into the linked account, "given" pays cash back out of it
      const custodyIn      = custodyTransactions.filter(c => c.account_id === acc.id && c.direction === 'received').reduce((s, c) => s + Number(c.amount), 0)
      const custodyOut     = custodyTransactions.filter(c => c.account_id === acc.id && c.direction === 'given').reduce((s, c) => s + Number(c.amount), 0)
      const balance        = acc.opening_balance + totalIncome - totalExpense - transfersOut + transfersIn + custodyIn - custodyOut
      const isNegative = balance < 0
      const overdraftAllowed = acc.allow_negative === true || acc.type === 'bank'
      return {
        ...acc,
        total_income: totalIncome, total_expenses: totalExpense,
        transfers_in: transfersIn, transfers_out: transfersOut,
        custody_in: custodyIn, custody_out: custodyOut,
        balance,
        isNegative,
        overdraftAllowed,
        overdraftStatus: !isNegative ? 'ok' : overdraftAllowed ? 'overdraft' : 'blocked',
      }
    }), [accounts, incomes, expenses, transfers, custodyTransactions])

  const setFrom   = (v: string) => { setLocalFrom(v);  setIsFiltered(true) }
  const setTo     = (v: string) => { setLocalTo(v);    setIsFiltered(true) }
  const setIncCat = (v: string) => { setIncomeCat(v);  setIsFiltered(true) }
  const setExpCat = (v: string) => { setExpenseCat(v); setIsFiltered(true) }

  const handleMonthChange = (m: string) => {
    setSelMonth(m)
    if (m) {
      const yr = Number(selYear || new Date().getFullYear())
      const mo = MONTHS.indexOf(m)
      setLocalFrom(new Date(yr, mo, 1).toISOString().split('T')[0])
      setLocalTo(new Date(yr, mo + 1, 0).toISOString().split('T')[0])
    }
    setIsFiltered(true)
  }

  const handleYearChange = (y: string) => {
    setSelYear(y)
    const yr = Number(y)
    if (selMonth) {
      const mo = MONTHS.indexOf(selMonth)
      setLocalFrom(new Date(yr, mo, 1).toISOString().split('T')[0])
      setLocalTo(new Date(yr, mo + 1, 0).toISOString().split('T')[0])
    } else {
      setLocalFrom(`${yr}-01-01`)
      setLocalTo(`${yr}-12-31`)
    }
    setIsFiltered(true)
  }

  const clearFilter = () => {
    setLocalFrom(''); setLocalTo('')
    setSelMonth('');  setSelYear('')
    setIncomeCat('All'); setExpenseCat('All')
    setIsFiltered(false); setShowFilter(false)
  }

  const filteredIncomes = useMemo(() => {
    let data = incomes
    if (isFiltered) {
      if (localFrom)           data = data.filter(r => r.date >= localFrom)
      if (localTo)             data = data.filter(r => r.date <= localTo)
      if (incomeCat !== 'All') data = data.filter(r => r.category === incomeCat)
    }
    return data
  }, [incomes, isFiltered, localFrom, localTo, incomeCat])

  const filteredExpenses = useMemo(() => {
    let data = expenses
    if (isFiltered) {
      if (localFrom)            data = data.filter(r => r.date >= localFrom)
      if (localTo)              data = data.filter(r => r.date <= localTo)
      if (expenseCat !== 'All') data = data.filter(r => r.category === expenseCat)
    }
    return data
  }, [expenses, isFiltered, localFrom, localTo, expenseCat])

  const getTransactionCurrency = (r: any) =>
    accounts.find(a => a.id === r.account_id)?.currency || currency

  const incomeByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, currency])

  const expenseByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(r => {
      const cur = getTransactionCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredExpenses, accounts, currency])

  const hasMixedIncome  = Object.keys(incomeByCurrency).length  > 1
  const hasMixedExpense = Object.keys(expenseByCurrency).length > 1

  const totalIncome  = incomeByCurrency[currency]  ?? Object.values(incomeByCurrency)[0]  ?? 0
  const totalExpense = expenseByCurrency[currency] ?? Object.values(expenseByCurrency)[0] ?? 0
  const net          = totalIncome - totalExpense
  const savingsRate  = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => {
      const cat = r.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(r.amount)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredIncomes])

  // ── Real (not fabricated) per-currency monthly series — powers the KPI
  // cards' previous-month comparison and sparklines. Unlike `chartData`
  // below (primary currency only, for the big area chart), this covers
  // every currency so each currency's own income/expense card gets an
  // honest trend instead of one borrowed from a different currency. ────
  const monthlyByCurrency = useMemo(() => {
    const map: Record<string, Record<string, { income: number; expense: number }>> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      const d = (r.date ?? '').slice(0, 7); if (!d) return
      if (!map[cur]) map[cur] = {}
      if (!map[cur][d]) map[cur][d] = { income: 0, expense: 0 }
      map[cur][d].income += Number(r.amount)
    })
    filteredExpenses.forEach(r => {
      const cur = getTransactionCurrency(r)
      const d = (r.date ?? '').slice(0, 7); if (!d) return
      if (!map[cur]) map[cur] = {}
      if (!map[cur][d]) map[cur][d] = { income: 0, expense: 0 }
      map[cur][d].expense += Number(r.amount)
    })
    const result: Record<string, { date: string; income: number; expense: number }[]> = {}
    Object.entries(map).forEach(([cur, byMonth]) => {
      result[cur] = Object.entries(byMonth)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
    })
    return result
  }, [filteredIncomes, filteredExpenses, accounts, currency])

  // Per-currency top category — so a USD income card shows its own top USD
  // category, not one borrowed from a blended, cross-currency ranking.
  const incomeByCategoryByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredIncomes.forEach(r => {
      const cur = getTransactionCurrency(r)
      const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    const result: Record<string, { name: string; value: number }[]> = {}
    Object.entries(map).forEach(([cur, byCat]) => {
      result[cur] = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    })
    return result
  }, [filteredIncomes, accounts, currency])

  const expenseByCategoryByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredExpenses.forEach(r => {
      const cur = getTransactionCurrency(r)
      const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    const result: Record<string, { name: string; value: number }[]> = {}
    Object.entries(map).forEach(([cur, byCat]) => {
      result[cur] = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    })
    return result
  }, [filteredExpenses, accounts, currency])

  const currencyBreakdown = useMemo(() =>
    Object.entries(incomeByCurrency)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    [incomeByCurrency])

  const incomeMatrix = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredIncomes.forEach(r => {
      const cat = r.category || 'Other'
      const cur = getTransactionCurrency(r)
      if (!map[cat]) map[cat] = {}
      map[cat][cur] = (map[cat][cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, currency])

  const grandTotalIncomeRaw = useMemo(() =>
    incomeByCategory.reduce((s, c) => s + c.value, 0), [incomeByCategory])

  // Exchange rates from user_accounts.exchange_rate — set on the Net Worth page.
  // GHS is always 1. Any currency without a matching account defaults to 1 (no conversion).
  const exchangeRateMap = useMemo(() => {
    const map: Record<string, number> = { GHS: 1 }
    accounts.forEach(a => {
      const cur  = a.currency || 'GHS'
      const rate = Number(a.exchange_rate ?? 1)
      if (cur !== 'GHS' && rate > 0 && !map[cur]) map[cur] = rate
    })
    return map
  }, [accounts])

  // True total: every currency's income converted to GHS using Net Worth rates.
  const grandTotalIncomeConverted = useMemo(() =>
    Object.entries(incomeByCurrency).reduce((sum, [cur, amt]) => {
      const rate = exchangeRateMap[cur] ?? 1
      return sum + amt * rate
    }, 0),
    [incomeByCurrency, exchangeRateMap]
  )

  // Per-currency converted subtotals — used in the matrix footer
  const currencyConvertedTotals = useMemo(() =>
    Object.fromEntries(
      currencyBreakdown.map(c => [
        c.name,
        { raw: c.value, converted: c.value * (exchangeRateMap[c.name] ?? 1), rate: exchangeRateMap[c.name] ?? 1 }
      ])
    ),
    [currencyBreakdown, exchangeRateMap]
  )

  // ── Area-chart series — monthly (default) or daily, toggled by chartView.
  // Monthly buckets by YYYY-MM as before. Daily buckets by YYYY-MM-DD and
  // fills any gap days with zero income/expense so the line stays
  // continuous instead of jumping across missing dates. Labels are thinned
  // to every 7th day once there are more than 60 days, so the X axis
  // doesn't turn into unreadable soup. ────────────────────────────────────
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; income: number; expense: number }> = {}
    const sliceLen = chartView === 'monthly' ? 7 : 10

    filteredIncomes
      .filter(r => getTransactionCurrency(r) === currency)
      .forEach(r => {
        const d = (r.date ?? '').slice(0, sliceLen); if (!d) return
        if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
        map[d].income += Number(r.amount)
      })
    filteredExpenses
      .filter(r => getTransactionCurrency(r) === currency)
      .forEach(r => {
        const d = (r.date ?? '').slice(0, sliceLen); if (!d) return
        if (!map[d]) map[d] = { date: d, income: 0, expense: 0 }
        map[d].expense += Number(r.amount)
      })

    const sorted = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))

    if (chartView === 'monthly') {
      return sorted.map(r => ({
        ...r,
        label: new Date(r.date + '-01').toLocaleDateString('en-GH', { month: 'short', year: '2-digit' }),
      }))
    }

    // Daily — fill zero-value gaps so line is continuous
    if (sorted.length < 2) return sorted.map(r => ({
      ...r,
      label: new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }),
    }))

    const filled: typeof sorted = []
    const cur = new Date(sorted[0].date)
    const end = new Date(sorted[sorted.length - 1].date)
    while (cur <= end) {
      const key = cur.toISOString().slice(0, 10)
      filled.push(map[key] ?? { date: key, income: 0, expense: 0 })
      cur.setDate(cur.getDate() + 1)
    }

    return filled.map((r, i) => ({
      ...r,
      label: (filled.length <= 60 || i % 7 === 0)
        ? new Date(r.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
        : '',
    }))
  }, [filteredIncomes, filteredExpenses, accounts, currency, chartView])

  const budgetData = useMemo(() =>
    budgets.map(b => {
      const spent  = filteredExpenses.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
      // Budget records store their limit as `monthly_limit`; `amount` is kept
      // only as a fallback for any older/differently-shaped rows. Without
      // this fallback chain, real budgets read `b.amount` (undefined) and
      // the chart/tooltip show "GH₵NaN" instead of the actual limit.
      const budget = Number(b.monthly_limit ?? b.amount ?? 0)
      return { name: b.category, budget, spent }
    }), [budgets, filteredExpenses])

  const visibleAccounts = accountsWithBalance.filter(a => accountTypeFilter === 'all' || a.type === accountTypeFilter)
  const balanceByCurrency: Record<string, number> = {}
  visibleAccounts.forEach(a => {
    const cur = a.currency || 'GHS'
    balanceByCurrency[cur] = (balanceByCurrency[cur] || 0) + Number(a.balance ?? 0)
  })
  const balanceCurrencies = Object.keys(balanceByCurrency)

  // Total Account Balance — every account, every type, unaffected by the type filter pills.
  // This is what the user sees as "what's actually sitting in my wallets right now."
  const totalAccountBalanceByCurrency: Record<string, number> = {}
  accountsWithBalance.forEach(a => {
    const cur = a.currency || 'GHC'
    totalAccountBalanceByCurrency[cur] = (totalAccountBalanceByCurrency[cur] || 0) + Number(a.balance ?? 0)
  })

  // Days actually covered by an explicit From/To filter — used for Net Balance's
  // "average per day" so it's never a fake "÷30" applied to an arbitrary range.
  const daysInRange = isFiltered && localFrom && localTo
    ? Math.max(1, Math.round((new Date(localTo).getTime() - new Date(localFrom).getTime()) / 86_400_000) + 1)
    : null

  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const selectCls = 'h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1 cursor-pointer'
  const dateCls   = 'h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1'
  const filterLabel = isFiltered
    ? `${localFrom || 'Start'} → ${localTo || 'End'}${incomeCat !== 'All' ? ` · Inc: ${incomeCat}` : ''}${expenseCat !== 'All' ? ` · Exp: ${expenseCat}` : ''}`
    : 'All time'

  return (
    <div className="space-y-5">

    {/* ── Overdraft / Negative Balance Alert Banner ─────────────────── */}
      {(() => {
        const overdraftAccounts = accountsWithBalance.filter(a => a.overdraftStatus === 'overdraft')
        const blockedAccounts   = accountsWithBalance.filter(a => a.overdraftStatus === 'blocked')
        if (!overdraftAccounts.length && !blockedAccounts.length) return null
        return (
          <div className="space-y-2">
            {overdraftAccounts.map(acc => (
              <div key={acc.id} className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">
                    {acc.name} is overdrawn by {formatCurrency(Math.abs(acc.balance), acc.currency || 'GHS')}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    This bank account has a negative balance. Add income or a deposit to clear the overdraft.
                  </p>
                </div>
                <a href="/user-accounts" className="text-xs font-semibold text-amber-700 hover:underline whitespace-nowrap">
                  Review →
                </a>
              </div>
            ))}
            {blockedAccounts.map(acc => (
              <div key={acc.id} className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-800">
                    {acc.name} shows a negative balance ({formatCurrency(acc.balance, acc.currency || 'GHS')})
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {acc.type === 'mobile_money' ? 'Mobile Money' : acc.type === 'cash' ? 'Cash' : 'Investment'} accounts should not go negative. Check for incorrect transactions.
                  </p>
                </div>
                <a href="/user-accounts" className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">
                  Fix →
                </a>
              </div>
            ))}
          </div>
        )
      })()}


      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Overview Dashboard
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {greeting}, {firstName} ·{' '}
            <span className={isFiltered ? 'text-orange-500 font-medium' : ''}>{filterLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <button onClick={clearFilter}
              className="flex items-center gap-1 text-xs text-orange-500 border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors">
              <X className="w-3 h-3" /> Clear Filter
            </button>
          )}
          <button onClick={() => setShowFilter(v => !v)}
            style={{ background: isFiltered ? theme.colors.accent : theme.colors.primary }}
            className="flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity">
            <SlidersHorizontal className="w-3 h-3" />
            {isFiltered ? 'Edit Filter' : 'Filter'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Filter Transactions</p>
              <button onClick={() => setShowFilter(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
                <input type="date" value={localFrom} onChange={e => setFrom(e.target.value)} className={dateCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
                <input type="date" value={localTo} onChange={e => setTo(e.target.value)} className={dateCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Month</label>
                <select value={selMonth} onChange={e => handleMonthChange(e.target.value)} className={selectCls}>
                  <option value="">All Months</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</label>
                <select value={selYear} onChange={e => handleYearChange(e.target.value)} className={selectCls}>
                  <option value="">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Income Cat.</label>
                <select value={incomeCat} onChange={e => setIncCat(e.target.value)} className={selectCls}>
                  {INCOME_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Expense Cat.</label>
                <select value={expenseCat} onChange={e => setExpCat(e.target.value)} className={selectCls}>
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={clearFilter}
                className="h-8 px-3 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:text-foreground flex items-center gap-1 mb-0.5">
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards — one Income card per currency present, then Net/Savings (primary currency) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {Object.entries(incomeByCurrency)
          .sort(([a], [b]) => a === currency ? -1 : b === currency ? 1 : 0)
          .map(([cur, amt]) => {
            const txnCount  = filteredIncomes.filter(r => getTransactionCurrency(r) === cur).length
            const series    = monthlyByCurrency[cur] || []
            const prevMonth = series.length > 1 ? series[series.length - 2] : null
            const topCat    = incomeByCategoryByCurrency[cur]?.[0]
            return (
              <KPICard key={`inc-${cur}`} label={`Total Income (${cur})`} colorClass="kpi-green" icon={TrendingUp}
                value={formatCurrency(amt, cur)}
                sub={`${txnCount} txn${txnCount === 1 ? '' : 's'}`}
                accentColor={cur === currency ? undefined : '#22c55e'}
                variant={cur === currency ? 'solid' : 'default'}
                prevValue={prevMonth ? formatCurrency(prevMonth.income, cur) : undefined}
                prevLabel="Last month"
                txnCount={`${txnCount} transaction${txnCount === 1 ? '' : 's'}`}
                avgValue={txnCount > 0 ? formatCurrency(amt / txnCount, cur) : undefined}
                topSource={topCat ? `${topCat.name} (${formatCurrency(topCat.value, cur)})` : undefined}
                sparkData={series.length > 1 ? series.slice(-8).map(d => d.income) : undefined}
                tooltip={`Exact: ${formatCurrency(amt, cur)}\n${txnCount} transaction(s) in ${cur}`}
              />
            )
          })}

        {Object.entries(expenseByCurrency)
          .sort(([a], [b]) => a === currency ? -1 : b === currency ? 1 : 0)
          .map(([cur, amt]) => {
            const txnCount  = filteredExpenses.filter(r => getTransactionCurrency(r) === cur).length
            const series    = monthlyByCurrency[cur] || []
            const prevMonth = series.length > 1 ? series[series.length - 2] : null
            const topCat    = expenseByCategoryByCurrency[cur]?.[0]
            return (
              <KPICard key={`exp-${cur}`} label={`Total Expenses (${cur})`} colorClass="kpi-red" icon={TrendingDown}
                value={formatCurrency(amt, cur)}
                sub={`${txnCount} txn${txnCount === 1 ? '' : 's'}`}
                accentColor="#ef4444"
                prevValue={prevMonth ? formatCurrency(prevMonth.expense, cur) : undefined}
                prevLabel="Last month"
                txnCount={`${txnCount} transaction${txnCount === 1 ? '' : 's'}`}
                avgValue={txnCount > 0 ? formatCurrency(amt / txnCount, cur) : undefined}
                topSource={topCat ? `${topCat.name} (${formatCurrency(topCat.value, cur)})` : undefined}
                sparkData={series.length > 1 ? series.slice(-8).map(d => d.expense) : undefined}
                tooltip={`Exact: ${formatCurrency(amt, cur)}\n${txnCount} transaction(s) in ${cur}`}
              />
            )
          })}

        {(() => {
          const prevMonth = chartData.length > 1 ? chartData[chartData.length - 2] : null
          const prevNet   = prevMonth ? prevMonth.income - prevMonth.expense : null
          const totalTxns = filteredIncomes.length + filteredExpenses.length
          return (
            <KPICard label="Net Balance" colorClass="kpi-blue" icon={Wallet}
              value={fmt(net)}
              sub={net >= 0 ? 'Surplus ✓' : 'Deficit ✗'}
              accentColor="#3b82f6"
              prevValue={prevMonth ? fmt(prevNet as number) : undefined}
              prevLabel="Last month"
              txnCount={`${totalTxns} total`}
              avgValue={daysInRange ? `${fmt(net / daysInRange)}/day` : undefined}
              topSource={net >= 0 ? 'Income exceeded expenses' : 'Expenses exceeded income'}
              sparkData={chartData.length > 1 ? chartData.slice(-8).map(d => d.income - d.expense) : undefined}
              tooltip={`Income − Expenses across all accounts (not tied to one wallet)\n${hasMixedIncome || hasMixedExpense
                ? `Primary currency (${currency}) only\n${fmt(totalIncome)} − ${fmt(totalExpense)} = ${fmt(net)}`
                : `${fmt(totalIncome)} − ${fmt(totalExpense)} = ${fmt(net)}`}`}
            />
          )
        })()}

        {(() => {
          const prevMonth = chartData.length > 1 ? chartData[chartData.length - 2] : null
          const prevRate  = prevMonth && prevMonth.income > 0
            ? Math.round(((prevMonth.income - prevMonth.expense) / prevMonth.income) * 100)
            : null
          return (
            <KPICard label="Savings Rate" colorClass="kpi-purple" icon={Target}
              value={`${savingsRate}%`}
              sub="Of income saved"
              accentColor="#a855f7"
              prevValue={prevRate !== null ? `${prevRate}%` : undefined}
              prevLabel="Last month"
              topSource={
                savingsRate >= 50 ? 'Strong savings habit'
                  : savingsRate >= 20 ? 'On track with the typical 20% guideline'
                  : savingsRate >= 0 ? 'Below the typical 20% guideline'
                  : 'Spending more than you earn'
              }
              sparkData={chartData.length > 1
                ? chartData.slice(-8).map(d => d.income > 0 ? Math.round(((d.income - d.expense) / d.income) * 100) : 0)
                : undefined}
              tooltip={`${savingsRate}% saved · Net ${fmt(net)} ÷ Income ${fmt(totalIncome)}\nPrimary currency (${currency}) only`}
            />
          )
        })()}
      </div>

      {/* Total Account Balance — sum of every account's actual balance, including opening balances.
          Shown separately from Net Balance since they measure different things: this card reflects
          what's really sitting in your wallets right now; Net Balance reflects income minus expenses. */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">Total Account Balance</p>
        <button
          onClick={() => setShowTotalAccBalance(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          {showTotalAccBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showTotalAccBalance ? 'Hide Acc Balance' : 'Show Acc Balance'}
        </button>
      </div>

      {showTotalAccBalance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
          {Object.entries(totalAccountBalanceByCurrency).map(([cur, bal]) => (
            <KPICard key={cur} label={`Total Account Balance (${cur})`} colorClass="kpi-blue" icon={Wallet}
              value={formatCurrency(bal, cur)}
              sub={`Across ${accountsWithBalance.filter(a => (a.currency || 'GHC') === cur).length} account(s)`}
              variant={cur === currency ? 'solid' : 'default'}
              tooltip={`Sum of every ${cur} account's current balance, including opening balances\n${accountsWithBalance.filter(a => (a.currency || 'GHS') === cur).map(a => `${a.name}: ${formatCurrency(a.balance ?? 0, cur)}`).join('\n')}`}
            />
          ))}
        </div>
      )}

      {/* Account Balances */}
      {accounts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold">Account Balances</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAccBalances(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                {showAccBalances ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showAccBalances ? 'Hide Acc Balance' : 'Show Acc Balance'}
              </button>
              <div className="flex gap-1.5 flex-wrap">
                {['all','bank','mobile_money','cash','investment'].map(type => (
                <button key={type} onClick={() => setAccountTypeFilter(type)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors border whitespace-nowrap ${
                    accountTypeFilter === type ? 'text-white border-transparent' : 'border-border bg-white text-muted-foreground hover:border-primary/50'
                  }`}
                  style={accountTypeFilter === type ? { background: theme.colors.primary } : {}}>
                  {type === 'mobile_money' ? 'MoMo' : type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
              </div>
            </div>
          </div>
          {showAccBalances && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {accountsWithBalance.filter(a => accountTypeFilter === 'all' || a.type === accountTypeFilter).map(acc => {
                  const color = acc.overdraftStatus === 'overdraft' ? '#d97706'
                    : acc.overdraftStatus === 'blocked'   ? '#dc2626'
                    : ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
                  const isNeg = acc.overdraftStatus !== 'ok'
                  return (
                    <FlipAccountCard
                      key={acc.id}
                      acc={acc}
                      color={color}
                      isNeg={isNeg}
                    />
                  )
                })}
              </div>
              <div className="px-3 sm:px-4 py-3 bg-white rounded-xl border border-border shadow-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs sm:text-sm font-semibold">
                    Total Balance
                    {accountTypeFilter !== 'all' && (
                      <span className="text-muted-foreground font-normal ml-1 capitalize">
                        ({accountTypeFilter === 'mobile_money' ? 'MoMo' : accountTypeFilter})
                      </span>
                    )}
                  </p>
                  {balanceCurrencies.length === 1 ? (
                    <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: theme.colors.primary }}>
                      {formatCurrency(balanceByCurrency[balanceCurrencies[0]], balanceCurrencies[0])}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 justify-end">
                      {balanceCurrencies.map(cur => (
                        <span key={cur} className="text-sm sm:text-base font-bold tabular-nums" style={{ color: theme.colors.primary }}>
                          {formatCurrency(balanceByCurrency[cur], cur)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {balanceCurrencies.length > 1 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Shown separately per currency — amounts are not combined
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Area Chart */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-semibold">
              Income vs Expenses by {chartView === 'monthly' ? 'Month' : 'Day'}
            </CardTitle>
            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg flex-shrink-0">
              <button
                onClick={() => setChartView('monthly')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  chartView === 'monthly' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView('daily')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  chartView === 'daily' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Daily
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {chartData.length === 0 ? (hasMixedIncome ? `No ${currency} transactions yet` : 'No transactions yet') : `${chartData.length} ${chartView === 'monthly' ? 'month(s)' : 'day(s)'} · ${currency} only`}
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <TrendingUp className="w-8 h-8 opacity-20" />
              <p className="text-sm">Add income or expenses to see your chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  interval={chartView === 'daily' && chartData.length > 30 ? 'preserveStartEnd' : 0}
                />
                <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} />
                <Area type="monotone" dataKey="income"  stroke="#16a34a" fill="url(#gInc)" strokeWidth={2} name="Income"  dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExp)" strokeWidth={2} name="Expense" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Income Trend & Expense Trend — same period/granularity as the combined
          chart above (driven by the shared chartView toggle), but each metric
          isolated on its own axis so a move in one doesn't get visually
          flattened by the scale of the other. ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" /> Income Trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {chartData.length === 0
                ? 'No income yet'
                : `${chartView === 'monthly' ? 'Monthly' : 'Daily'} · ${currency} only`}
            </p>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-7 h-7 opacity-20" />
                <p className="text-sm">Add income to see its trend</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncSolo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    interval={chartView === 'daily' && chartData.length > 30 ? 'preserveStartEnd' : 0}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Area type="monotone" dataKey="income" stroke="#16a34a" fill="url(#gIncSolo)" strokeWidth={2} name="Income" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Expense Trend
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {chartData.length === 0
                ? 'No expenses yet'
                : `${chartView === 'monthly' ? 'Monthly' : 'Daily'} · ${currency} only`}
            </p>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingDown className="w-7 h-7 opacity-20" />
                <p className="text-sm">Add expenses to see their trend</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gExpSolo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    interval={chartView === 'daily' && chartData.length > 30 ? 'preserveStartEnd' : 0}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="url(#gExpSolo)" strokeWidth={2} name="Expense" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toggle for the heavier detail sections below — collapsed by default.
          Styled as a solid, full-width button (not a muted link) since this
          is the only way to reach the Budget Usage, Multi-Currency Income
          Breakdown, and Savings Goals sections now that they're hidden by
          default. ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowMoreCharts(v => !v)}
        style={{ background: theme.colors.primary }}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-white font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity"
      >
        <span className="flex items-center gap-2">
          {showMoreCharts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          Budget Usage, Income Breakdown &amp; Savings Goals
        </span>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{ transform: showMoreCharts ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {showMoreCharts && (
      <>
      {/* Budget Usage */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Budget Usage</CardTitle>
          <p className="text-xs text-muted-foreground">
            {budgetData.length === 0 ? 'No budgets set yet' : `${budgetData.length} active budget(s)`}
          </p>
        </CardHeader>
        <CardContent>
          {budgetData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Wallet className="w-8 h-8 opacity-20" />
              <p className="text-sm">Create a budget to track spending</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, budgetData.length * 56)}>
              <BarChart data={budgetData} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={120}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const budget = (payload.find(p => p.dataKey === 'budget')?.value as number) ?? 0
                    const spent  = (payload.find(p => p.dataKey === 'spent')?.value  as number) ?? 0
                    const pct    = budget > 0 ? Math.round((spent / budget) * 100) : 0
                    const over   = budget > 0 && spent > budget
                    const catExpenses = filteredExpenses
                      .filter(e => e.category === label)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    return (
                      <div className="bg-white rounded-xl p-3 shadow-lg border border-border text-xs space-y-1.5 min-w-[210px]">
                        <p className="font-semibold text-sm">{label}</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Budget</span>
                          <span className="font-medium">{fmt(budget)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Spent</span>
                          <span className={`font-medium ${over ? 'text-destructive' : 'text-success'}`}>{fmt(spent)}</span>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">{over ? 'Over by' : 'Remaining'}</span>
                          <span className={`font-semibold ${over ? 'text-destructive' : 'text-success'}`}>
                            {fmt(Math.abs(budget - spent))}
                          </span>
                        </div>
                        <div className="mt-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">Used</span>
                            <span className={over ? 'text-destructive font-semibold' : 'font-medium'}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%`, background: over ? '#ef4444' : '#22c55e' }} />
                          </div>
                        </div>
                        {catExpenses.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Transactions ({catExpenses.length})
                            </p>
                            <div className="space-y-0.5 max-h-28 overflow-y-auto pr-1">
                              {catExpenses.map((e: any, i: number) => (
                                <div key={i} className="flex justify-between gap-3">
                                  <span className="truncate max-w-[120px]">{e.title || e.description || label}</span>
                                  <span className="text-destructive font-medium flex-shrink-0">-{fmt(Number(e.amount))}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="budget" fill={theme.colors.primary + '40'} name="Budget" radius={[0,4,4,0]} />
                <Bar dataKey="spent"  fill={theme.colors.primary}        name="Spent"  radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Multi-Currency & Category Income Breakdown — Tree, Donut, or classic Tree-Expand view, cycled with the bookmark button */}
      <Card className="rounded-xl shadow-sm bg-white">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Multi-Currency & Category Income Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">
                {incomeView === 'donut'
                  ? (incomeByCategory.length === 0 ? 'No income yet'
                      : `${incomeByCategory.length} categor${incomeByCategory.length === 1 ? 'y' : 'ies'} · ${currencyBreakdown.length} currenc${currencyBreakdown.length === 1 ? 'y' : 'ies'} · click outer slice to zoom`)
                  : incomeView === 'treeExpand'
                  ? 'Decomposition view — click a currency to expand, then a category to drill down'
                  : 'Decomposition view — explore income by currency and category'}
              </p>
            </div>
            <button
              onClick={() => setIncomeView(v => v === 'tree' ? 'donut' : v === 'donut' ? 'treeExpand' : 'tree')}
              title="Cycle view: Tree → Donut → Tree Expand"
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                incomeView === 'tree' ? 'border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40' : 'border-transparent text-white'
              }`}
              style={
                incomeView === 'donut' ? { background: theme.colors.primary }
                : incomeView === 'treeExpand' ? { background: theme.colors.accent }
                : {}
              }
            >
              <Bookmark className="w-3.5 h-3.5" fill={incomeView === 'tree' ? 'none' : 'currentColor'} />
              {incomeView === 'donut' ? 'Donut View' : incomeView === 'treeExpand' ? 'Tree Expand View' : 'Tree View'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {incomeView === 'donut' ? (
            incomeByCategory.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <TrendingUp className="w-8 h-8 opacity-20" />
                <p className="text-sm">Add income to see the breakdown</p>
              </div>
            ) : (
              <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-10 items-center">

                {/* ── Nested donut — responsive sizing ── */}
                <div className="relative w-full mx-auto" style={{ maxWidth: 480 }}>
                  <ResponsiveContainer width="100%" height={440}>
                    <PieChart margin={{ top: 32, right: 48, bottom: 44, left: 48 }}>

                      {/* Outer ring — categories */}
                      <Pie
                        data={incomeByCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="48%"
                        innerRadius="58%"
                        outerRadius="82%"
                        paddingAngle={2}
                        labelLine={false}
                        label={CategoryOuterLabel}
                        animationDuration={500}
                        onClick={(_, i) => setActiveDonutIndex(p => p === i ? null : i)}
                      >
                        {incomeByCategory.map((_, i) => (
                          <Cell key={i}
                            fill={activeDonutIndex !== null && activeDonutIndex !== i
                              ? DONUT_COLORS[i % DONUT_COLORS.length] + '55'
                              : DONUT_COLORS[i % DONUT_COLORS.length]}
                            stroke="#fff" strokeWidth={3}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          />
                        ))}
                      </Pie>

                      {/* Inner ring — currencies. No on-slice label here anymore (it was
                          the "₵ GHS / 13,000" text crowding small slices) — the legend
                          below and the matrix table to the right already carry that
                          same information without cluttering the ring itself. */}
                      <Pie
                        data={currencyBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="48%"
                        innerRadius="35%"
                        outerRadius="54%"
                        paddingAngle={2}
                        animationDuration={500}
                        isAnimationActive
                      >
                        {currencyBreakdown.map((c, i) => (
                          <Cell key={c.name}
                            fill={getCurrencyColor(c.name, i)}
                            stroke="#fff" strokeWidth={2}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(v: any, name: any) => [
                          `${getCurrencySymbol(name)} ${Math.round(Number(v)).toLocaleString()}`,
                          name,
                        ]}
                      />
                      <Legend
                        layout="horizontal" align="center" verticalAlign="bottom"
                        iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        payload={incomeByCategory.map((c, i) => ({
                          value: `${c.name} (${grandTotalIncomeRaw > 0 ? Math.round((c.value / grandTotalIncomeRaw) * 100) : 0}%)`,
                          type:  'square' as const,
                          color: DONUT_COLORS[i % DONUT_COLORS.length],
                        }))}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centre label */}
                  <div
                    className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
                    style={{ top: 0, height: 'calc(100% - 52px)' }}
                  >
                    <div className="text-center leading-tight" style={{ maxWidth: 110 }}>
                      <p className="text-[9px] sm:text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">
                        {activeDonutIndex !== null ? incomeByCategory[activeDonutIndex]?.name : 'Total Income'}
                      </p>
                      {currencyBreakdown.length > 1 && activeDonutIndex === null && (
                        <p className="text-[8px] sm:text-[10px] text-muted-foreground">Multi-currency</p>
                      )}
                      <p className="text-base sm:text-xl font-bold tabular-nums mt-0.5"
                        style={{ color: theme.colors.primary }}>
                        {activeDonutIndex !== null
                          ? Math.round(incomeByCategory[activeDonutIndex]?.value ?? 0).toLocaleString()
                          : formatCurrency(Math.round(grandTotalIncomeConverted), currency)}
                      </p>
                      {currencyBreakdown.length > 1 && activeDonutIndex === null && (
                        <p className="text-[7px] sm:text-[9px] text-muted-foreground mt-0.5">
                          Converted to {currency}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Matrix table */}
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-[10px] sm:text-xs border-collapse min-w-[260px]">
                    <thead>
                      <tr>
                        <th className="text-left align-bottom pb-2 pr-2 font-semibold text-muted-foreground">Category</th>
                        {currencyBreakdown.map((c, i) => {
                          const rate = exchangeRateMap[c.name] ?? 1
                          return (
                            <th key={c.name}
                              className="text-center pb-2 px-2 font-semibold whitespace-nowrap"
                              style={{ background: getCurrencyColor(c.name, i) + '90', borderRadius: '4px 4px 0 0' }}>
                              {getCurrencySymbol(c.name)} {c.name}
                              {c.name !== currency && (
                                <div className="text-[8px] font-normal text-muted-foreground">
                                  @ {rate} {currency}
                                </div>
                              )}
                            </th>
                          )
                        })}
                        <th className="text-center pb-2 px-2 font-semibold text-muted-foreground bg-muted/40"
                          style={{ borderRadius: '4px 4px 0 0' }}>
                          Total (GHC)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeByCategory.map((cat, idx) => (
                        <tr key={cat.name} className="border-t border-border/60">
                          <td className="py-2 pr-2 font-medium whitespace-nowrap">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                              style={{ background: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                            {cat.name}
                          </td>
                          {currencyBreakdown.map((c, i) => {
                            const v = incomeMatrix[cat.name]?.[c.name] ?? 0
                            return (
                              <td key={c.name} className="text-center py-2 px-2 tabular-nums"
                                style={{ background: getCurrencyColor(c.name, i) + '22' }}>
                                {v > 0
                                  ? <span className="font-medium">{Math.round(v).toLocaleString()}</span>
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
                            )
                          })}
                          <td className="text-center py-2 px-2 font-semibold tabular-nums bg-muted/30 whitespace-nowrap">
                            {(() => {
                              // Sum each currency's contribution for this category, converted to GHS
                              const convertedRowTotal = currencyBreakdown.reduce((sum, c) => {
                                const raw  = incomeMatrix[cat.name]?.[c.name] ?? 0
                                const rate = exchangeRateMap[c.name] ?? 1
                                return sum + raw * rate
                              }, 0)
                              const pct = grandTotalIncomeConverted > 0
                                ? Math.round((convertedRowTotal / grandTotalIncomeConverted) * 100)
                                : 0
                              return (
                                <>
                                  {Math.round(convertedRowTotal).toLocaleString()}
                                  <span className="text-muted-foreground font-normal ml-1 text-[9px]">
                                    ({pct}%)
                                  </span>
                                </>
                              )
                            })()}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border">
                        <td className="py-2 pr-2 font-bold">Total</td>
                        {currencyBreakdown.map((c, i) => {
                          const conv = currencyConvertedTotals[c.name]
                          return (
                            <td key={c.name} className="text-center py-2 px-2 font-bold tabular-nums"
                              style={{ background: getCurrencyColor(c.name, i) + '44' }}>
                              {Math.round(c.value).toLocaleString()}
                              {c.name !== currency && conv && (
                                <div className="text-[8px] font-normal text-muted-foreground">
                                  ≈ {formatCurrency(Math.round(conv.converted), currency)}
                                </div>
                              )}
                            </td>
                          )
                        })}
                        <td className="text-center py-2 px-2 font-bold tabular-nums bg-muted/50">
                          {Math.round(grandTotalIncomeConverted).toLocaleString()}
                          {currencyBreakdown.length > 1 && (
                            <div className="text-[8px] font-normal text-muted-foreground">converted</div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-2 italic">
                    Amounts shown per currency — not converted or combined.
                  </p>
                </div>
              </div>
            )
          ) : incomeView === 'treeExpand' ? (
            <IncomeDecompositionTreeExpand
              filteredIncomes={filteredIncomes}
              getTransactionCurrency={getTransactionCurrency}
              themePrimary={theme.colors.primary}
              exchangeRateMap={exchangeRateMap}
            />
          ) : (
            <IncomeDecompositionTree
              filteredIncomes={filteredIncomes}
              getTransactionCurrency={getTransactionCurrency}
              themePrimary={theme.colors.primary}
              exchangeRateMap={exchangeRateMap}
            />
          )}
        </CardContent>
      </Card>

      {/* Savings Goals */}
      {goals.length > 0 && (
        <Card className="rounded-xl shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Savings Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goals.map((g, i) => {
              const pct = Math.min(100, Number(g.target_amount) > 0
                ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0)
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs sm:text-sm mb-1.5 gap-2">
                    <span className="font-medium truncate">{g.name}</span>
                    <span className="text-muted-foreground tabular-nums flex-shrink-0">
                      {pct}% · {fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: theme.colors.primary }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  )
}