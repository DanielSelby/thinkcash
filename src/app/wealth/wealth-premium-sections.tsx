'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Sparkles, Activity, Info,
  Landmark, Banknote, CreditCard, Building2, 
  AlertCircle, ChevronRight, Zap, ShieldCheck, PiggyBank,
  ArrowUpRight, ArrowDownRight, Laptop, DollarSign,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { THEMES } from '@/lib/config'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'

const fmt = (n: number) => formatCurrency(n, 'GHS')

// ── Color palette ─────────────────────────────────────────────────────
const ALLOC_COLORS = ['#16a34a', '#2563eb', '#7c3aed', '#dc2626', '#f59e0b']


// ── Wealth Score helpers ──────────────────────────────────────────────




// ── Types ─────────────────────────────────────────────────────────────
interface PremiumProps {
  assets:             any[]
  investments:        any[]
  debts:              any[]
  loans:              any[]
  accountsWithBalance: any[]
  incomes:            any[]
  expenses:           any[]
  totalPhysical:      number
  totalLiquid:        number
  totalInvested:      number
  totalDebts:         number
  totalLoans:         number
  netWorth:           number
}

// ── AI Insights (calls Claude API) ───────────────────────────────────
function AIWealthInsights({
  netWorth, totalLiquid, totalPhysical, totalInvested,
  totalDebts, totalLoans, savingsRate, theme,
}: {
  netWorth: number; totalLiquid: number; totalPhysical: number
  totalInvested: number; totalDebts: number; totalLoans: number
  savingsRate: number; theme: any
}) {
  const [insights, setInsights]   = useState<string[]>([])
  const [loading,  setLoading]    = useState(false)
  const [fetched,  setFetched]    = useState(false)

  const ICON_MAP = [
    { icon: TrendingUp,   bg: '#dcfce7', color: '#16a34a' },
    { icon: Banknote,     bg: '#dbeafe', color: '#2563eb' },
    { icon: ShieldCheck,  bg: '#fef3c7', color: '#d97706' },
    { icon: PiggyBank,    bg: '#f3e8ff', color: '#7c3aed' },
    { icon: Sparkles,     bg: '#fce7f3', color: '#db2777' },
  ]

  const fetchInsights = async () => {
    if (fetched) return
    setLoading(true)
    try {
      const prompt = `You are a personal finance advisor for a Ghanaian user. Based on these numbers, give exactly 4 short, specific, actionable wealth insights (1-2 sentences each). Be direct, encouraging, and practical.

Net Worth: GHS ${Math.round(netWorth).toLocaleString()}
Cash & Liquid: GHS ${Math.round(totalLiquid).toLocaleString()}
Physical Assets: GHS ${Math.round(totalPhysical).toLocaleString()}
Investments: GHS ${Math.round(totalInvested).toLocaleString()}
Total Debts: GHS ${Math.round(totalDebts).toLocaleString()}
Total Loans: GHS ${Math.round(totalLoans).toLocaleString()}
Savings Rate: ${savingsRate}%

Return ONLY a JSON array of 4 strings, no markdown, no explanation. Example format:
["Insight 1 here.", "Insight 2 here.", "Insight 3 here.", "Insight 4 here."]`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text ?? '[]'
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (Array.isArray(parsed)) setInsights(parsed.slice(0, 4))
    } catch {
      setInsights([
        'Your net worth is growing — keep tracking every transaction to maintain momentum.',
        `Cash holdings represent ${totalLiquid > 0 && netWorth > 0 ? Math.round((totalLiquid / netWorth) * 100) : 0}% of your net worth. Consider diversifying into investments.`,
        totalDebts + totalLoans > 0 ? 'Prioritize clearing high-interest debts first to improve your net worth faster.' : 'No debt is a big win! Keep it up and stay debt-free.',
        savingsRate >= 20 ? 'Your savings rate is healthy. Keep building your emergency fund.' : 'Aim to save at least 20% of your income each month for long-term wealth building.',
      ])
    }
    setFetched(true)
    setLoading(false)
  }

  // Auto-fetch on mount
  useMemo(() => { if (!fetched && !loading) fetchInsights() }, [])

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: theme.colors.primary }} />
          <CardTitle className="text-sm font-semibold tracking-tight">AI Wealth Insights</CardTitle>
          <Info className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
        </div>
        <p className="text-xs text-muted-foreground">Personalised recommendations</p>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-2.5 rounded-xl bg-muted/30 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-1.5 py-0.5">
                <div className="h-2.5 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-3/4" />
              </div>
            </div>
          ))
        ) : insights.map((ins, i) => {
          const { icon: Icon, bg, color } = ICON_MAP[i % ICON_MAP.length]
          return (
            <div key={i} className="flex gap-3 p-2.5 rounded-xl" style={{ background: bg + '55' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <p className="text-xs leading-relaxed text-foreground/80 flex-1">{ins}</p>
            </div>
          )
        })}
        <a href="/analytics"
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold pt-1 hover:underline"
          style={{ color: theme.colors.primary }}>
          View all insights <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}

// ── Main export ───────────────────────────────────────────────────────
export function WealthPremiumSections({
  assets, investments, debts, loans, accountsWithBalance,
  incomes, expenses,
  totalPhysical, totalLiquid, totalInvested, totalDebts, totalLoans, netWorth,
}: PremiumProps) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [trendFilter, setTrendFilter] = useState<'30D' | '3M' | '6M' | '1Y' | 'All'>('3M')
  const [showAllActivities, setShowAllActivities] = useState(false)

  // ── Net Worth Trend ───────────────────────────────────────────────
  const trendData = useMemo(() => {
    const now = new Date()
    const days = trendFilter === '30D' ? 30 : trendFilter === '3M' ? 90 : trendFilter === '6M' ? 180 : trendFilter === '1Y' ? 365 : 730

    // Build daily net worth from transactions
    const allTransactions = [
      ...incomes.map(r => ({ date: r.date ?? '', amount: Number(r.amount), type: 'income' as const })),
      ...expenses.map(r => ({ date: r.date ?? '', amount: Number(r.amount), type: 'expense' as const })),
    ].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date))

    const startDate = new Date(now)
    startDate.setDate(now.getDate() - days)

    // Compute opening balance (everything before range start)
    const openingNetCash = allTransactions
      .filter(r => r.date < startDate.toISOString().slice(0, 10))
      .reduce((s, r) => r.type === 'income' ? s + r.amount : s - r.amount, 0)

    const physicalBase = totalPhysical
    const investBase   = totalInvested
    const liabBase     = totalDebts + totalLoans

    // Build daily points
    const points: { date: string; label: string; value: number }[] = []
    let runningCash = openingNetCash

    // Determine step size based on filter
    const step = days <= 30 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : days <= 365 ? 14 : 30

    for (let i = days; i >= 0; i -= step) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const ds = d.toISOString().slice(0, 10)

      // Add transactions up to this date
      const dayTxns = allTransactions.filter(r => r.date === ds)
      dayTxns.forEach(r => { runningCash += r.type === 'income' ? r.amount : -r.amount })

      const totalValue = physicalBase + Math.max(0, runningCash) + investBase - liabBase

      const label = days <= 30
        ? d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
        : days <= 90
        ? d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
        : days <= 365
        ? d.toLocaleDateString('en-GH', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-GH', { month: 'short', year: '2-digit' })

      points.push({ date: ds, label, value: Math.max(0, totalValue) })
    }

    return points
  }, [incomes, expenses, totalPhysical, totalInvested, totalDebts, totalLoans, trendFilter])

  const trendChange = useMemo(() => {
    if (trendData.length < 2) return { pct: 0, abs: 0, positive: true }
    const first = trendData[0].value
    const last  = trendData[trendData.length - 1].value
    const abs   = last - first
    const pct   = first > 0 ? (abs / first) * 100 : 0
    return { pct, abs, positive: abs >= 0 }
  }, [trendData])

  const trendFrom = trendData[0]?.date
    ? new Date(trendData[0].date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  const trendTo = trendData[trendData.length - 1]?.date
    ? new Date(trendData[trendData.length - 1].date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  // ── Asset Allocation ──────────────────────────────────────────────
  const total = totalPhysical + totalLiquid + totalInvested + totalDebts + totalLoans
  const allocData = [
    { name: 'Cash & Liquid',     value: totalLiquid,    pct: total > 0 ? (totalLiquid / total) * 100 : 0 },
    { name: 'Physical Assets',   value: totalPhysical,  pct: total > 0 ? (totalPhysical / total) * 100 : 0 },
    { name: 'Investments',       value: totalInvested,  pct: total > 0 ? (totalInvested / total) * 100 : 0 },
    { name: 'Debts',             value: totalDebts,     pct: total > 0 ? (totalDebts / total) * 100 : 0 },
    { name: 'Loans',             value: totalLoans,     pct: total > 0 ? (totalLoans / total) * 100 : 0 },
  ].filter(d => d.value > 0)

  const [allocHovered, setAllocHovered] = useState<number | null>(null)

  // ── Wealth Score ──────────────────────────────────────────────────
  

  // ── Recent Wealth Activities ──────────────────────────────────────
  const recentActivities = useMemo(() => {
    const events: { id: string; label: string; sub: string; icon: any; iconBg: string; iconColor: string; date: string }[] = []

    assets.filter(a => a.status === 'sold').slice(0, 2).forEach(a => {
      events.push({
        id: 'sold-' + a.id,
        label: `Sold ${a.name}`,
        sub: 'Physical Asset',
        icon: DollarSign,
        iconBg: '#dbeafe', iconColor: '#2563eb',
        date: a.sold_date ?? a.updated_at ?? '',
      })
    })

    assets.filter(a => a.status !== 'sold').slice(0, 3).forEach(a => {
      events.push({
        id: 'asset-' + a.id,
        label: a.name,
        sub: 'Physical Asset',
        icon: Landmark,
        iconBg: '#dcfce7', iconColor: '#16a34a',
        date: a.updated_at ?? a.created_at ?? '',
      })
    })

    investments.slice(0, 2).forEach(inv => {
      events.push({
        id: 'inv-' + inv.id,
        label: `Purchased ${inv.name}`,
        sub: 'Investment',
        icon: TrendingUp,
        iconBg: '#ede9fe', iconColor: '#7c3aed',
        date: inv.updated_at ?? inv.created_at ?? '',
      })
    })

    const recentIncome = [...incomes].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 2)
    recentIncome.forEach(r => {
      events.push({
        id: 'inc-' + (r.id ?? Math.random()),
        label: r.title || r.category || 'Income',
        sub: 'Added Cash',
        icon: Banknote,
        iconBg: '#d1fae5', iconColor: '#059669',
        date: r.date ?? '',
      })
    })

    return events
      .filter(e => e.date)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
  }, [assets, investments, incomes])

  const savingsRate = useMemo(() => {
    const totalInc = incomes.reduce((s, r) => s + Number(r.amount), 0)
    const totalExp = expenses.reduce((s, r) => s + Number(r.amount), 0)
    return totalInc > 0 ? Math.round(((totalInc - totalExp) / totalInc) * 100) : 0
  }, [incomes, expenses])

  const shortFmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
    return String(Math.round(v))
  }

  return (
    <div className="space-y-4">

      {/* ── Row 1: Net Worth Trend + Asset Allocation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Net Worth Trend */}
        <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold tracking-tight">Net Worth Trend</p>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>

            {/* Time filter pills */}
            <div className="flex gap-1 mb-3">
              {(['30D','3M','6M','1Y','All'] as const).map(f => (
                <button key={f} onClick={() => setTrendFilter(f)}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors"
                  style={trendFilter === f
                    ? { background: theme.colors.primary, color: '#fff' }
                    : { background: '#f1f5f9', color: '#64748b' }}>
                  {f}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={theme.colors.primary} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={theme.colors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9 }} width={36} tickFormatter={shortFmt} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-white border border-border rounded-lg p-2 text-xs shadow-lg">
                        <p className="text-muted-foreground mb-0.5">{label}</p>
                        <p className="font-bold" style={{ color: theme.colors.primary }}>{fmt(Number(payload[0]?.value ?? 0))}</p>
                      </div>
                    )
                  }}
                />
                <Area type="monotone" dataKey="value" stroke={theme.colors.primary} strokeWidth={2}
                  fill="url(#trendGrad)" dot={false} isAnimationActive animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-muted-foreground">From {trendFrom}</span>
              <span className={`flex items-center gap-0.5 font-semibold ${trendChange.positive ? 'text-green-600' : 'text-red-500'}`}>
                {trendChange.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trendChange.positive ? '+' : ''}{trendChange.pct.toFixed(2)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Asset Allocation */}
        <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-sm font-semibold tracking-tight">Asset Allocation</p>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            {allocData.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Landmark className="w-8 h-8 opacity-20" />
                <p className="text-xs">Add assets to see allocation</p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0" style={{ width: 110, height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocData} dataKey="value" cx="50%" cy="50%"
                        innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none"
                        isAnimationActive animationDuration={600}
                        onMouseEnter={(_, i) => setAllocHovered(i)}
                        onMouseLeave={() => setAllocHovered(null)}>
                        {allocData.map((_, i) => (
                          <Cell key={i} fill={ALLOC_COLORS[i % ALLOC_COLORS.length]}
                            opacity={allocHovered !== null && allocHovered !== i ? 0.4 : 1}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground leading-tight">
                      {allocHovered !== null ? allocData[allocHovered]?.name?.split(' ')[0] : 'Total'}
                    </p>
                    <p className="text-xs font-bold" style={{ color: theme.colors.primary }}>
                      {allocHovered !== null
                        ? fmt(allocData[allocHovered]?.value ?? 0)
                        : fmt(totalPhysical + totalLiquid + totalInvested)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-1.5 min-w-0">
                  {allocData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs"
                      onMouseEnter={() => setAllocHovered(i)}
                      onMouseLeave={() => setAllocHovered(null)}
                      style={{ opacity: allocHovered !== null && allocHovered !== i ? 0.45 : 1, cursor: 'default', transition: 'opacity 0.2s' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                      <span className="text-muted-foreground truncate flex-1">{d.name}</span>
                      <span className="font-semibold tabular-nums flex-shrink-0">{d.pct.toFixed(1)}%</span>
                      <span className="text-muted-foreground tabular-nums flex-shrink-0 text-[10px]">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Recent Activities + AI Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Wealth Activities */}
        <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: theme.colors.primary }} />
              <CardTitle className="text-sm font-semibold tracking-tight">Recent Wealth Activities</CardTitle>
              <Info className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {recentActivities.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Activity className="w-8 h-8 opacity-20" />
                <p className="text-xs">No recent activity yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(showAllActivities ? recentActivities : recentActivities.slice(0, 4)).map(ev => {
                  const Icon = ev.icon
                  const d = ev.date ? new Date(ev.date) : null
                  const timeStr = d ? d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
                  return (
                    <div key={ev.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: ev.iconBg }}>
                        <Icon className="w-4 h-4" style={{ color: ev.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ev.label}</p>
                        <p className="text-xs text-muted-foreground">{ev.sub}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex-shrink-0">{timeStr}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => setShowAllActivities(v => !v)}
              className="w-full flex items-center justify-center gap-1 text-xs font-semibold mt-3 pt-3 border-t border-border hover:underline"
              style={{ color: theme.colors.primary }}>
              {showAllActivities ? 'Show less' : 'View all activities'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </CardContent>
        </Card>

        {/* AI Wealth Insights */}
        <AIWealthInsights
          netWorth={netWorth}
          totalLiquid={totalLiquid}
          totalPhysical={totalPhysical}
          totalInvested={totalInvested}
          totalDebts={totalDebts}
          totalLoans={totalLoans}
          savingsRate={savingsRate}
          theme={theme}
        />
      </div>
    </div>
  )
}