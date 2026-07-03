'use client'

import { useMemo } from 'react'
import {
  Users, BadgeCheck, AlertTriangle, XCircle,
  TrendingUp, DollarSign, CalendarClock, Activity,
  LogIn, FileText,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { computeStatus, daysRemaining, BILLING_CYCLE_LABELS, STATUS_COLORS, type SubStatus } from '@/lib/subscription'
import { formatCurrency } from '@/lib/utils'

interface Props {
  users:          any[]
  subscriptions:  any[]
  plans:          any[]
  recentActivity: any[]
  todayStr:       string
  monthStart:     string
  yearStart:      string
  weekFromNow:    string
}

const PIE_COLORS = ['#16a34a','#dc2626','#f59e0b','#2563eb','#7c3aed','#0891b2']

function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: any; color: string
}) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="h-1" style={{ background: color }} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">{label}</p>
            <p className="text-lg sm:text-2xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs  < 24) return `${hrs}h ago`
  return `${days}d ago`
}

export function AdminDashboardContent({
  users, subscriptions, plans, recentActivity,
  todayStr, monthStart, yearStart, weekFromNow,
}: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  // ── Subscription KPIs ──────────────────────────────────────────────
  const subStats = useMemo(() => {
    const activeSubs   = subscriptions.filter(s => {
      const plan = plans.find(p => p.id === s.subscription_plan_id)
      const status = computeStatus(s.end_date, plan?.grace_period ?? 0, s.status)
      return status === 'active' || status === 'expiring_soon'
    })
    const expiredSubs  = subscriptions.filter(s => {
      const plan = plans.find(p => p.id === s.subscription_plan_id)
      return computeStatus(s.end_date, plan?.grace_period ?? 0, s.status) === 'expired'
    })
    const expiringSoon = subscriptions.filter(s => {
      const plan = plans.find(p => p.id === s.subscription_plan_id)
      return computeStatus(s.end_date, plan?.grace_period ?? 0, s.status) === 'expiring_soon'
    })
    const monthRevenue = subscriptions.filter(s => s.start_date >= monthStart && s.status !== 'cancelled')
      .reduce((sum, s) => sum + Number(s.amount ?? 0), 0)
    const yearRevenue  = subscriptions.filter(s => s.start_date >= yearStart && s.status !== 'cancelled')
      .reduce((sum, s) => sum + Number(s.amount ?? 0), 0)
    const totalRevenue = subscriptions.filter(s => s.status !== 'cancelled')
      .reduce((sum, s) => sum + Number(s.amount ?? 0), 0)
    return { activeSubs, expiredSubs, expiringSoon, monthRevenue, yearRevenue, totalRevenue }
  }, [subscriptions, plans, monthStart, yearStart])

  // ── Revenue by month (last 6 months) ───────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    subscriptions.filter(s => s.status !== 'cancelled').forEach(s => {
      const month = (s.start_date ?? '').slice(0, 7)
      if (!month) return
      map[month] = (map[month] || 0) + Number(s.amount ?? 0)
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenue]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-GH', { month: 'short', year: '2-digit' }),
        revenue: Math.round(revenue),
      }))
  }, [subscriptions])

  // ── Plan distribution ──────────────────────────────────────────────
  const planDist = useMemo(() => {
    const map: Record<string, number> = {}
    subscriptions.filter(s => s.status !== 'cancelled').forEach(s => {
      const name = s.subscription_plans?.name ?? 'Unknown'
      map[name] = (map[name] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [subscriptions])

  // ── Active vs Expired ──────────────────────────────────────────────
  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {}
    subscriptions.forEach(s => {
      const plan = plans.find(p => p.id === s.subscription_plan_id)
      const status = computeStatus(s.end_date, plan?.grace_period ?? 0, s.status)
      counts[status] = (counts[status] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value,
    }))
  }, [subscriptions, plans])

  // ── User stats ─────────────────────────────────────────────────────
  const userStats = useMemo(() => {
    const activeUsers  = users.filter(u => u.is_active).length
    const adminUsers   = users.filter(u => u.role === 'admin').length
    const thisMonthNew = users.filter(u => u.created_at >= monthStart).length
    return { activeUsers, adminUsers, thisMonthNew }
  }, [users, monthStart])

  const fmt = (n: number) => formatCurrency(n, 'GHS')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Platform health and subscription metrics</p>
      </div>

      {/* ── User KPIs ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Users</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total Users"   value={users.length}           icon={Users}        color="#2563eb" />
          <KPICard label="Active Users"  value={userStats.activeUsers}  icon={Activity}     color="#16a34a" />
          <KPICard label="Admins"        value={userStats.adminUsers}   icon={BadgeCheck}   color="#7c3aed" sub="with full access" />
          <KPICard label="New This Month"value={userStats.thisMonthNew} icon={TrendingUp}   color="#0891b2" sub="registrations" />
        </div>
      </div>

      {/* ── Subscription KPIs ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Subscriptions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard label="Total Subscribers" value={subscriptions.length}                  icon={BadgeCheck}    color={theme.colors.primary} />
          <KPICard label="Active"            value={subStats.activeSubs.length}             icon={BadgeCheck}    color="#16a34a" sub="incl. expiring soon" />
          <KPICard label="Expiring This Week"value={subStats.expiringSoon.length}           icon={AlertTriangle} color="#f59e0b" />
          <KPICard label="Expired"           value={subStats.expiredSubs.length}            icon={XCircle}       color="#dc2626" />
        </div>
      </div>

      {/* ── Revenue KPIs ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard label="Total Revenue"   value={fmt(subStats.totalRevenue)}  icon={DollarSign}    color="#16a34a" sub="all time" />
          <KPICard label="Monthly Revenue" value={fmt(subStats.monthRevenue)}  icon={CalendarClock} color="#2563eb" sub="this month" />
          <KPICard label="Annual Revenue"  value={fmt(subStats.yearRevenue)}   icon={TrendingUp}    color="#7c3aed" sub="this year" />
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue by Month */}
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Month</CardTitle>
            <p className="text-xs text-muted-foreground">Last 6 months · GHS</p>
          </CardHeader>
          <CardContent>
            {revenueByMonth.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} width={48} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: any) => [fmt(v), 'Revenue']} />
                  <Bar dataKey="revenue" fill={theme.colors.primary} radius={[4,4,0,0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Active vs Expired pie */}
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Subscription Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusDist.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No subscription data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius={70} paddingAngle={2} label={({ name, percent }) => `${name} (${(percent*100).toFixed(0)}%)`}
                    labelLine={false}>
                    {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Plan Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Subscribers per plan</p>
          </CardHeader>
          <CardContent>
            {planDist.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No plans assigned yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={planDist} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill={theme.colors.accent} radius={[0,4,4,0]} name="Subscribers" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No activity yet</div>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {recentActivity.map(entry => {
                  const isLogin = entry.event_type === 'login'
                  return (
                    <div key={entry.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isLogin ? 'bg-green-50' : 'bg-blue-50'}`}>
                        {isLogin ? <LogIn className="w-3 h-3 text-green-600" /> : <FileText className="w-3 h-3 text-blue-600" />}
                      </div>
                      <span className="flex-1 truncate text-muted-foreground">
                        {isLogin ? 'Login' : entry.page_path ?? 'Page view'}
                      </span>
                      <span className="text-muted-foreground flex-shrink-0">{timeAgo(entry.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Expiring soon table ── */}
      {subStats.expiringSoon.length > 0 && (
        <Card className="bg-white rounded-xl shadow-sm border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" /> Subscriptions Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">User ID</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Plan</th>
                    <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Expires</th>
                    <th className="text-left py-2 font-semibold text-muted-foreground">Days Left</th>
                  </tr>
                </thead>
                <tbody>
                  {subStats.expiringSoon.map(s => (
                    <tr key={s.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-4 font-mono text-muted-foreground">{s.user_id.slice(0,8)}…</td>
                      <td className="py-2 pr-4 font-medium">{s.subscription_plans?.name ?? '—'}</td>
                      <td className="py-2 pr-4">{s.end_date}</td>
                      <td className="py-2">
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 font-semibold">
                          {daysRemaining(s.end_date)}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}