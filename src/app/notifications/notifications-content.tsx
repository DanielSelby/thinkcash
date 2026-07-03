'use client'

import { useState, useMemo } from 'react'
import {
  Bell, Check, CheckCheck, Trash2, Filter,
  TrendingUp, Wallet, BarChart3, RefreshCcw, AlertCircle,
  BadgeCheck, CalendarClock, AlertTriangle, XCircle, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import { computeStatus, daysRemaining, STATUS_COLORS, BILLING_CYCLE_LABELS, fmtDate, type SubStatus } from '@/lib/subscription'

// ── Types ─────────────────────────────────────────────────────────────
interface Notification {
  id: string
  type: 'budget' | 'goal' | 'report' | 'recurring' | 'system' | 'bill'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

interface Props {
  initialNotifications: Notification[]
  userId: string
  userSub?: any | null
}

// ── Notification type config ──────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: any; colorClass: string; accent: string }> = {
  budget:    { icon: Wallet,         colorClass: 'bg-red-50',     accent: '#dc2626' },
  goal:      { icon: TrendingUp,     colorClass: 'bg-green-50',   accent: '#16a34a' },
  report:    { icon: BarChart3,      colorClass: 'bg-blue-50',    accent: '#2563eb' },
  recurring: { icon: RefreshCcw,     colorClass: 'bg-purple-50',  accent: '#7c3aed' },
  bill:      { icon: AlertCircle,    colorClass: 'bg-orange-50',  accent: '#f59e0b' },
  system:    { icon: Bell,           colorClass: 'bg-gray-50',    accent: '#475569' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins  <  1) return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hrs   < 24) return `${hrs}h ago`
  if (days  <  7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })
}

// ── Subscription Status Card ──────────────────────────────────────────
function SubscriptionStatusCard({ sub }: { sub: any }) {
  const plan = sub.subscription_plans
  if (!plan) return null

  const gracePeriod = plan.grace_period ?? 0
  const status      = computeStatus(sub.end_date, gracePeriod, sub.status) as SubStatus
  const colors      = STATUS_COLORS[status]
  const days        = daysRemaining(sub.end_date)
  const totalDays   = Math.round(
    (new Date(sub.end_date).getTime() - new Date(sub.start_date).getTime()) / (1000 * 60 * 60 * 24)
  )
  const pct = totalDays > 0 ? Math.max(0, Math.min(100, (days / totalDays) * 100)) : 0

  const statusIcon = status === 'active'
    ? <BadgeCheck className="w-4 h-4" style={{ color: colors.text }} />
    : status === 'expiring_soon'
    ? <Clock className="w-4 h-4" style={{ color: colors.text }} />
    : status === 'expired'
    ? <XCircle className="w-4 h-4" style={{ color: colors.text }} />
    : <AlertTriangle className="w-4 h-4" style={{ color: colors.text }} />

  return (
    <Card className="rounded-xl shadow-sm border overflow-hidden" style={{ borderColor: colors.border }}>
      <div className="h-1.5" style={{ background: colors.text }} />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: colors.bg }}>
              {statusIcon}
            </div>
            <div>
              <p className="text-sm font-semibold">Your Subscription</p>
              <p className="text-xs text-muted-foreground">{plan.name}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-lg"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
            {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-xs">
          <div>
            <p className="text-muted-foreground">Billing Cycle</p>
            <p className="font-semibold mt-0.5">{BILLING_CYCLE_LABELS[plan.billing_cycle as keyof typeof BILLING_CYCLE_LABELS]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Amount</p>
            <p className="font-semibold mt-0.5">{plan.currency} {Number(plan.amount).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Days Remaining</p>
            <p className="font-semibold mt-0.5" style={{ color: days <= 7 ? '#dc2626' : days <= 30 ? '#d97706' : '#16a34a' }}>
              {days > 0 ? `${days} day${days === 1 ? '' : 's'}` : 'Expired'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Start Date</p>
            <p className="font-semibold mt-0.5">{fmtDate(sub.start_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expiry Date</p>
            <p className="font-semibold mt-0.5">{fmtDate(sub.end_date)}</p>
          </div>
          {gracePeriod > 0 && (
            <div>
              <p className="text-muted-foreground">Grace Period</p>
              <p className="font-semibold mt-0.5">{gracePeriod} days</p>
            </div>
          )}
        </div>

        {/* Days-remaining progress bar */}
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Subscription period</span>
            <span>{Math.round(pct)}% remaining</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: colors.text }} />
          </div>
        </div>

        {status === 'expiring_soon' && (
          <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Your subscription expires in <strong>{days} day{days === 1 ? '' : 's'}</strong>. Contact your administrator to renew.
            </p>
          </div>
        )}
        {status === 'expired' && (
          <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
            <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-700">
              Your subscription has expired. Contact your administrator to renew your plan.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Component ────────────────────────────────────────────────────
export function NotificationsContent({ initialNotifications, userId, userSub }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [filter,        setFilter]        = useState<'all' | 'unread'>('all')
  const [loading,       setLoading]       = useState<string | null>(null)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.is_read)
    return notifications
  }, [notifications, filter])

  const markRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    setLoading('all')
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    toast({ title: 'All notifications marked as read', variant: 'success' })
    setLoading(null)
  }

  const deleteNotification = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = async () => {
    if (!confirm('Clear all notifications?')) return
    setLoading('clear')
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('user_id', userId)
    setNotifications([])
    toast({ title: 'All notifications cleared' })
    setLoading(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            <Bell className="w-5 h-5" /> Notifications
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white"
                style={{ background: theme.colors.primary }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} · {notifications.length} total
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                style={filter === f
                  ? { background: theme.colors.primary, color: '#fff' }
                  : { color: '#64748b' }}>
                {f}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={loading === 'all'} className="h-8 text-xs gap-1">
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} disabled={loading === 'clear'} className="h-8 text-xs gap-1 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Subscription Status Card — shown if user has an active/expiring/expired sub */}
      {userSub && <SubscriptionStatusCard sub={userSub} />}

      {/* Notification list */}
      {filtered.length === 0 ? (
        <Card className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
          <h3 className="font-semibold text-lg mb-1">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-muted-foreground text-sm">
            {filter === 'unread'
              ? 'Switch to "All" to see your notification history.'
              : 'Budget alerts, savings milestones, and system messages will appear here.'}
          </p>
          {filter === 'unread' && (
            <Button variant="outline" className="mt-4" onClick={() => setFilter('all')}>View all</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => {
            const cfg  = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system
            const Icon = cfg.icon
            return (
              <div key={n.id}
                className={`group flex items-start gap-3 p-3 sm:p-4 rounded-xl border transition-all ${
                  n.is_read
                    ? 'bg-white border-border'
                    : 'bg-white border-l-4 shadow-sm'
                }`}
                style={!n.is_read ? { borderLeftColor: cfg.accent, borderTopColor: '#e2e8f0', borderRightColor: '#e2e8f0', borderBottomColor: '#e2e8f0' } : {}}>

                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.colorClass}`}>
                  <Icon className="w-4 h-4" style={{ color: cfg.accent }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${n.is_read ? 'text-foreground' : 'font-semibold'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)}
                        className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1">
                        <Check className="w-3 h-3" /> Mark read
                      </button>
                    )}
                    <button onClick={() => deleteNotification(n.id)}
                      className="text-[10px] font-semibold text-destructive hover:underline flex items-center gap-1 ml-auto">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>

                {/* Unread dot */}
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: cfg.accent }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}