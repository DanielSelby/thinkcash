'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Search, UserCheck, UserX, Trash2, Users,
  ShieldAlert, Lock, Loader2, Clock, LayoutTemplate, Plus, Pencil,
  Activity, LogIn, FileText, LogOut, BadgeCheck, Calendar, RefreshCw, XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatDate } from '@/lib/utils'
import { GATEABLE_PAGES } from '@/lib/page-access'
import type { Profile, AccessTemplate, ActivityLogEntry } from '@/types'

interface Props {
  initialUsers:  Profile[]
  templates:     AccessTemplate[]
  plans:         any[]
  subscriptions: any[]
  adminId:       string
}

interface TemplateForm {
  id?: string
  name: string
  description: string
  pageKeys: Set<string>
}

// Shared checkbox grid — used by both the per-user access dialog and the
// template editor, so the two never drift apart visually.
function PagesGrid({ selected, onToggle, onSelectAll, onClearAll }: {
  selected: Set<string>
  onToggle: (key: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {selected.size} of {GATEABLE_PAGES.length} selected
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onSelectAll} className="text-xs font-semibold text-primary hover:underline">Select all</button>
          <button type="button" onClick={onClearAll} className="text-xs font-semibold text-muted-foreground hover:underline">Clear all</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
        {GATEABLE_PAGES.map(p => {
          const checked = selected.has(p.key)
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onToggle(p.key)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                checked ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {checked && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <span className="truncate">{p.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

export function AdminUsersContent({ initialUsers, templates: initialTemplates, plans, subscriptions: initialSubs, adminId }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [templates, setTemplates] = useState(initialTemplates)
  const [subs, setSubs]   = useState(initialSubs)
  const [search, setSearch] = useState('')

  // ── Per-user page access dialog ──────────────────────────────────
  const [accessUser, setAccessUser] = useState<Profile | null>(null)
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set())
  const [restrictMode, setRestrictMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

  // ── Template manager dialog ──────────────────────────────────────
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<TemplateForm | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)

  // ── Activity log viewer ───────────────────────────────────────────
  const [activityUser, setActivityUser]   = useState<Profile | null>(null)
  const [activityLog, setActivityLog]     = useState<ActivityLogEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // ── Subscription management dialog ────────────────────────────────
  const [subUser,    setSubUser]    = useState<Profile | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [subPlanId,  setSubPlanId]  = useState('')
  const [subStartDate, setSubStartDate] = useState(new Date().toISOString().split('T')[0])
  const [subAction,   setSubAction]    = useState<'assign' | 'extend' | 'cancel' | 'renew'>('assign')
  const [extendDays,  setExtendDays]   = useState('30')

  const filtered = useMemo(() => users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ), [users, search])

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    const supabase = createClient()
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', userId)
    if (error) toast({ title: 'Action failed', description: error.message, variant: 'destructive' })
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: newStatus } : u))
      toast({ title: newStatus ? 'User activated' : 'User suspended', variant: 'success' })
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('Permanently delete this user and all their data?')) return
    const supabase = createClient()
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setUsers(prev => prev.filter(u => u.id !== userId))
      toast({ title: 'User deleted' })
    }
  }

  const openAccessDialog = (u: Profile) => {
    setAccessUser(u)
    setTemplateOpen(false)
    if (u.allowed_pages === null || u.allowed_pages === undefined) {
      setRestrictMode(false)
      setSelectedPages(new Set())
    } else {
      setRestrictMode(true)
      setSelectedPages(new Set(u.allowed_pages))
    }
  }

  // ── Subscription helpers ─────────────────────────────────────────
  const getUserSub = (userId: string) => subs.find((s: any) => s.user_id === userId && s.status !== 'cancelled')

  const openSubDialog = (u: Profile, action: typeof subAction) => {
    setSubUser(u); setSubAction(action); setSubPlanId(''); setExtendDays('30')
    setSubStartDate(new Date().toISOString().split('T')[0])
  }

  const logAudit = async (supabase: any, userId: string, subId: string, action: string, details: any) => {
    await supabase.from('subscription_audit').insert({ user_id: userId, subscription_id: subId, action, details, performed_by: adminId })
  }

  const sendSubNotification = async (supabase: any, userId: string, subId: string, type: string, title: string, message: string) => {
    await supabase.from('subscription_notifications').insert({ user_id: userId, subscription_id: subId, notification_type: type, title, message })
    await supabase.from('notifications').insert({ user_id: userId, type: 'system', title, message })
  }

  const handleSubAction = async () => {
    if (!subUser) return
    setSubLoading(true)
    const supabase = createClient()
    const existingSub = getUserSub(subUser.id)

    if (subAction === 'assign' || subAction === 'renew') {
      if (!subPlanId) { toast({ title: 'Select a plan', variant: 'destructive' }); setSubLoading(false); return }
      const plan = plans.find(p => p.id === subPlanId)
      if (!plan) { setSubLoading(false); return }
      const { calcEndDate } = await import('@/lib/subscription')
      const endDate = calcEndDate(subStartDate, plan.billing_cycle, plan.custom_days)

      if (existingSub) {
        // Cancel existing first
        await supabase.from('user_subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', existingSub.id)
      }

      const { data: created, error } = await supabase.from('user_subscriptions').insert({
        user_id: subUser.id, subscription_plan_id: subPlanId,
        start_date: subStartDate, end_date: endDate,
        amount: plan.amount, currency: plan.currency,
        status: 'active', assigned_by: adminId,
        ...(subAction === 'renew' ? { renewed_at: new Date().toISOString() } : {}),
      }).select('*, subscription_plans(name, billing_cycle, currency)').single()

      if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }) }
      else {
        setSubs(prev => [...prev.filter(s => s.user_id !== subUser.id || s.status === 'cancelled'), created])
        const action_label = subAction === 'renew' ? 'renewed' : 'assigned'
        // Apply the plan's page access to the user's profile —
        // plan.allowed_pages null = full access, array = restricted set.
        await supabase.from('profiles').update({
          allowed_pages: plan.allowed_pages ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', subUser.id)

        await logAudit(supabase, subUser.id, created.id, subAction, {
          plan: plan.name, end_date: endDate, allowed_pages: plan.allowed_pages ?? 'full',
        })
        await sendSubNotification(supabase, subUser.id, created.id, 'subscription_assigned',
          `Subscription ${action_label}: ${plan.name}`,
          `Your ${plan.name} subscription has been ${action_label}. Valid until ${endDate}.`
        )
        toast({ title: `Subscription ${action_label}`, variant: 'success' })
        setSubUser(null)
      }
    }

    if (subAction === 'extend' && existingSub) {
      const days = Number(extendDays)
      const newEnd = new Date(existingSub.end_date)
      newEnd.setDate(newEnd.getDate() + days)
      const newEndStr = newEnd.toISOString().split('T')[0]
      const { data: updated, error } = await supabase.from('user_subscriptions')
        .update({ end_date: newEndStr, updated_at: new Date().toISOString() }).eq('id', existingSub.id)
        .select('*, subscription_plans(name, billing_cycle, currency)').single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else {
        setSubs(prev => prev.map(s => s.id === existingSub.id ? updated : s))
        await logAudit(supabase, subUser.id, existingSub.id, 'extended', { days, new_end: newEndStr })
        await sendSubNotification(supabase, subUser.id, existingSub.id, 'subscription_extended',
          'Subscription Extended', `Your subscription has been extended by ${days} days until ${newEndStr}.`)
        toast({ title: 'Subscription extended', variant: 'success' }); setSubUser(null)
      }
    }

    if (subAction === 'cancel' && existingSub) {
      const { data: updated, error } = await supabase.from('user_subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', existingSub.id).select('*, subscription_plans(name, billing_cycle, currency)').single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else {
        setSubs(prev => prev.map(s => s.id === existingSub.id ? updated : s))
        // Revert access to the default restricted set on cancellation
        const { DEFAULT_ALLOWED_PAGES } = await import('@/lib/default-access')
        await supabase.from('profiles').update({
          allowed_pages: DEFAULT_ALLOWED_PAGES,
          updated_at: new Date().toISOString(),
        }).eq('id', subUser.id)

        await logAudit(supabase, subUser.id, existingSub.id, 'cancelled', {})
        await sendSubNotification(supabase, subUser.id, existingSub.id, 'subscription_cancelled',
          'Subscription Cancelled', 'Your subscription has been cancelled. Access has been reverted to default.')
        toast({ title: 'Subscription cancelled' }); setSubUser(null)
      }
    }
    setSubLoading(false)
  }

  const togglePage = (key: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAllPages = () => setSelectedPages(new Set(GATEABLE_PAGES.map(p => p.key)))
  const clearAllPages  = () => setSelectedPages(new Set())

  const applyTemplate = (t: AccessTemplate) => {
    setSelectedPages(new Set(t.page_keys))
    setRestrictMode(true)
    setTemplateOpen(false)
    toast({ title: `Template "${t.name}" applied` })
  }

  const saveAccess = async () => {
    if (!accessUser) return
    setSaving(true)
    const supabase = createClient()
    const value = restrictMode ? Array.from(selectedPages) : null
    const { error } = await supabase
      .from('profiles')
      .update({ allowed_pages: value })
      .eq('id', accessUser.id)
    if (error) {
      toast({ title: 'Failed to update access', description: error.message, variant: 'destructive' })
    } else {
      setUsers(prev => prev.map(u =>
        u.id === accessUser.id ? { ...u, allowed_pages: value } : u
      ))
      toast({ title: 'Access updated', variant: 'success' })
      setAccessUser(null)
    }
    setSaving(false)
  }

  // ── Template CRUD ─────────────────────────────────────────────────
  const openNewTemplate = () => setTemplateForm({ name: '', description: '', pageKeys: new Set() })

  const openEditTemplate = (t: AccessTemplate) =>
    setTemplateForm({ id: t.id, name: t.name, description: t.description || '', pageKeys: new Set(t.page_keys) })

  const toggleTemplatePage = (key: string) => {
    setTemplateForm(f => {
      if (!f) return f
      const next = new Set(f.pageKeys)
      next.has(key) ? next.delete(key) : next.add(key)
      return { ...f, pageKeys: next }
    })
  }

  const saveTemplate = async () => {
    if (!templateForm || !templateForm.name.trim()) return
    setTemplateSaving(true)
    const supabase = createClient()
    const payload = {
      name: templateForm.name.trim(),
      description: templateForm.description.trim() || null,
      page_keys: Array.from(templateForm.pageKeys),
    }

    if (templateForm.id) {
      const { data: updated, error } = await supabase
        .from('access_templates')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', templateForm.id).select().single()
      if (error) toast({ title: 'Failed to update template', description: error.message, variant: 'destructive' })
      else {
        setTemplates(prev => prev.map(t => t.id === templateForm.id ? updated : t))
        toast({ title: 'Template updated', variant: 'success' })
        setTemplateForm(null)
      }
    } else {
      const { data: created, error } = await supabase
        .from('access_templates')
        .insert(payload)
        .select().single()
      if (error) toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' })
      else {
        setTemplates(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        toast({ title: 'Template created', variant: 'success' })
        setTemplateForm(null)
      }
    }
    setTemplateSaving(false)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Users already restricted with it keep their current access — this only removes it from future use.')) return
    const supabase = createClient()
    const { error } = await supabase.from('access_templates').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast({ title: 'Template deleted' })
    }
  }

  const lastActive = (u: Profile) => {
    if (!u.last_active_at) return 'Never'
    try {
      return formatDistanceToNow(new Date(u.last_active_at), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  const openActivityLog = async (u: Profile) => {
    setActivityUser(u)
    setActivityLoading(true)
    setActivityLog([])
    const supabase = createClient()
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      toast({ title: 'Failed to load activity', description: error.message, variant: 'destructive' })
    } else {
      setActivityLog(data || [])
    }
    setActivityLoading(false)
  }

  const eventIcon = (type: ActivityLogEntry['event_type']) => {
    if (type === 'login')  return <LogIn  className="w-3.5 h-3.5 text-green-600" />
    if (type === 'logout') return <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
    return <FileText className="w-3.5 h-3.5 text-blue-600" />
  }

  const eventLabel = (entry: ActivityLogEntry) => {
    if (entry.event_type === 'login')  return 'Logged in'
    if (entry.event_type === 'logout') return 'Logged out'
    return entry.page_path ? `Viewed ${entry.page_path}` : 'Viewed a page'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm">{users.length} total users</p>
        </div>
        <Button variant="outline" onClick={() => { setTemplateManagerOpen(true); setTemplateForm(null) }}>
          <LayoutTemplate className="w-4 h-4 mr-1" /> Manage Templates
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Access</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Subscription</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Last Active
                  </div>
                </th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={u.role === 'admin' ? 'destructive' : 'secondary'}>{u.role}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={u.is_active ? 'success' : 'destructive'}>
                      {u.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-muted-foreground">Full (admin)</span>
                    ) : u.allowed_pages === null || u.allowed_pages === undefined ? (
                      <Badge variant="secondary">Full access</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {u.allowed_pages.length} page{u.allowed_pages.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const sub = getUserSub(u.id)
                      if (!sub) return <span className="text-xs text-muted-foreground">None</span>
                      const { computeStatus, STATUS_COLORS, daysRemaining, fmtDate } = require('@/lib/subscription')
                      const plan = plans.find((p: any) => p.id === sub.subscription_plan_id)
                      const gracePeriod = plan?.grace_period ?? 0
                      const status = computeStatus(sub.end_date, gracePeriod, sub.status)
                      const colors = STATUS_COLORS[status]
                      const days = daysRemaining(sub.end_date)
                      return (
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: colors.bg, color: colors.text }}>
                            {status.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                          <p className="text-[10px] text-muted-foreground">{sub.subscription_plans?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{days > 0 ? `${days}d left` : 'Expired'}</p>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <button
                      onClick={() => openActivityLog(u)}
                      className="text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                      title="View activity log"
                    >
                      {lastActive(u)}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openActivityLog(u)} title="View activity log">
                        <Activity className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-purple-600" onClick={() => openSubDialog(u, getUserSub(u.id) ? 'renew' : 'assign')} title={getUserSub(u.id) ? 'Manage subscription' : 'Assign subscription'}>
                        <BadgeCheck className="w-3.5 h-3.5" />
                      </Button>
                      {u.role !== 'admin' && (
                        <Button
                          size="icon" variant="ghost" className="w-8 h-8"
                          onClick={() => openAccessDialog(u)}
                          title="Manage page access"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon" variant="ghost"
                        className={`w-8 h-8 ${u.is_active ? 'text-warning hover:text-warning' : 'text-success hover:text-success'}`}
                        onClick={() => toggleStatus(u.id, u.is_active)}
                        title={u.is_active ? 'Suspend user' : 'Activate user'}
                      >
                        {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </Button>
                      {u.role !== 'admin' && (
                        <Button
                          size="icon" variant="ghost"
                          className="w-8 h-8 text-destructive hover:text-destructive"
                          onClick={() => deleteUser(u.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </Card>

      {/* Page Access Dialog (per user) */}
      <Dialog open={!!accessUser} onOpenChange={o => !o && setAccessUser(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Page Access — {accessUser?.full_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Templates */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplateOpen(v => !v)}
                disabled={templates.length === 0}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-muted-foreground">
                  {templates.length === 0 ? 'No templates yet — create one below' : 'Apply a template...'}
                </span>
                <span className="text-xs text-primary font-semibold">▾</span>
              </button>
              {templateOpen && templates.length > 0 && (
                <div className="absolute top-full mt-1 w-full z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                    >
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <p className="text-xs text-primary mt-0.5">{t.page_keys.length} pages</p>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => { setTemplateManagerOpen(true); openNewTemplate() }}
                className="text-xs font-semibold text-primary hover:underline mt-1.5"
              >
                + Create or edit templates
              </button>
            </div>

            {/* Restrict toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div>
                <p className="text-sm font-semibold">Restrict access</p>
                <p className="text-xs text-muted-foreground">
                  {restrictMode
                    ? 'User can only see pages checked below'
                    : 'User has full access to every page'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestrictMode(v => !v)}
                className="w-11 h-6 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: restrictMode ? '#dc2626' : '#cbd5e1' }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all"
                  style={{ left: restrictMode ? '22px' : '2px' }}
                />
              </button>
            </div>

            {/* Page checkboxes */}
            {restrictMode && (
              <PagesGrid
                selected={selectedPages}
                onToggle={togglePage}
                onSelectAll={selectAllPages}
                onClearAll={clearAllPages}
              />
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setAccessUser(null)}>Cancel</Button>
              <Button onClick={saveAccess} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Access'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Manager Dialog */}
      <Dialog
        open={templateManagerOpen}
        onOpenChange={o => { if (!o) { setTemplateManagerOpen(false); setTemplateForm(null) } }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {templateForm ? (templateForm.id ? 'Edit Template' : 'New Template') : 'Manage Access Templates'}
            </DialogTitle>
          </DialogHeader>

          {templateForm ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Template Name</Label>
                <Input
                  placeholder="e.g. Bookkeeper"
                  value={templateForm.name}
                  onChange={e => setTemplateForm(f => f && { ...f, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input
                  placeholder="e.g. Income, expenses, and reports only"
                  value={templateForm.description}
                  onChange={e => setTemplateForm(f => f && { ...f, description: e.target.value })}
                />
              </div>
              <PagesGrid
                selected={templateForm.pageKeys}
                onToggle={toggleTemplatePage}
                onSelectAll={() => setTemplateForm(f => f && { ...f, pageKeys: new Set(GATEABLE_PAGES.map(p => p.key)) })}
                onClearAll={() => setTemplateForm(f => f && { ...f, pageKeys: new Set() })}
              />
              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setTemplateForm(null)}>Back</Button>
                <Button onClick={saveTemplate} disabled={templateSaving || !templateForm.name.trim()}>
                  {templateSaving
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : templateForm.id ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button variant="outline" className="w-full" onClick={openNewTemplate}>
                <Plus className="w-4 h-4 mr-1" /> New Template
              </Button>

              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No templates yet</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.name}</p>
                        {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                        <p className="text-xs text-primary mt-0.5">{t.page_keys.length} pages</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEditTemplate(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-border">
                <Button variant="outline" onClick={() => setTemplateManagerOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={!!activityUser} onOpenChange={o => !o && setActivityUser(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Activity Log — {activityUser?.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Last active: <span className="font-medium">{activityUser ? lastActive(activityUser) : ''}</span>
              {' · '}Most recent 50 events
            </p>

            {activityLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No activity recorded yet</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {activityLog.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {eventIcon(entry.event_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{eventLabel(entry)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setActivityUser(null)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subscription Management Dialog */}
      <Dialog open={!!subUser} onOpenChange={o => !o && setSubUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-purple-600" />
              Manage Subscription — {subUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {subUser && (() => {
            const existingSub = getUserSub(subUser.id)
            const plan = existingSub ? plans.find((p: any) => p.id === existingSub.subscription_plan_id) : null
            return (
              <div className="space-y-4">
                {/* Current subscription summary */}
                {existingSub ? (
                  <div className="bg-purple-50 rounded-xl p-3 space-y-2 text-sm">
                    <p className="font-semibold text-purple-800">Current Subscription</p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div><p className="text-muted-foreground">Plan</p><p className="font-medium">{existingSub.subscription_plans?.name ?? '—'}</p></div>
                      <div><p className="text-muted-foreground">Status</p><p className="font-medium capitalize">{existingSub.status.replace('_', ' ')}</p></div>
                      <div><p className="text-muted-foreground">Start</p><p className="font-medium">{existingSub.start_date}</p></div>
                      <div><p className="text-muted-foreground">End</p><p className="font-medium">{existingSub.end_date}</p></div>
                      <div><p className="text-muted-foreground">Amount</p><p className="font-medium">{existingSub.currency} {Number(existingSub.amount).toLocaleString()}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 rounded-xl p-3 text-sm text-muted-foreground text-center">No active subscription</div>
                )}

                {/* Action selector */}
                <div className="flex gap-2 flex-wrap">
                  {(['assign', 'renew', 'extend', 'cancel'] as const).filter(a => {
                    if (a === 'cancel' || a === 'extend' || a === 'renew') return !!existingSub
                    return true
                  }).map(a => (
                    <button key={a} onClick={() => setSubAction(a)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${subAction === a ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground hover:border-purple-400'}`}>
                      {a === 'assign' ? 'Assign Plan' : a === 'renew' ? 'Change / Renew' : a === 'extend' ? 'Extend' : 'Cancel'}
                    </button>
                  ))}
                </div>

                {/* Action-specific inputs */}
                {(subAction === 'assign' || subAction === 'renew') && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Select Plan</Label>
                      <Select onValueChange={setSubPlanId}>
                        <SelectTrigger><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                        <SelectContent>
                          {plans.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} — {p.currency} {Number(p.amount).toLocaleString()} / {p.billing_cycle.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Start Date</Label>
                      <Input type="date" value={subStartDate} onChange={e => setSubStartDate(e.target.value)} />
                    </div>
                    {subPlanId && (() => {
                      const selectedPlan = plans.find((p: any) => p.id === subPlanId)
                      if (!selectedPlan) return null
                      const { calcEndDate, BILLING_CYCLE_LABELS } = require('@/lib/subscription')
                      const end = calcEndDate(subStartDate, selectedPlan.billing_cycle, selectedPlan.custom_days)
                      return (
                        <div className="bg-green-50 rounded-xl p-3 text-sm space-y-1">
                          <p className="font-semibold text-green-700">{selectedPlan.name}</p>
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{selectedPlan.currency} {Number(selectedPlan.amount).toLocaleString()}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Billing Cycle</span><span>{BILLING_CYCLE_LABELS[selectedPlan.billing_cycle]}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expires</span><span className="font-semibold">{end}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Grace Period</span><span>{selectedPlan.grace_period} days</span></div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {subAction === 'extend' && (
                  <div className="space-y-1.5">
                    <Label>Extend by (days)</Label>
                    <div className="flex gap-2">
                      {['7','14','30','60','90'].map(d => (
                        <button key={d} onClick={() => setExtendDays(d)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${extendDays === d ? 'bg-purple-600 text-white border-purple-600' : 'border-border text-muted-foreground'}`}>
                          {d}d
                        </button>
                      ))}
                    </div>
                    <Input type="number" value={extendDays} onChange={e => setExtendDays(e.target.value)} className="mt-2" />
                    {existingSub && (
                      <p className="text-xs text-muted-foreground">New end date: {(() => { const d = new Date(existingSub.end_date); d.setDate(d.getDate() + Number(extendDays)); return d.toISOString().split('T')[0] })()}</p>
                    )}
                  </div>
                )}

                {subAction === 'cancel' && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
                    <p className="font-semibold mb-1">Cancel subscription?</p>
                    <p className="text-xs">This will cancel {subUser.full_name}'s current subscription immediately. The user will be notified.</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setSubUser(null)}>Cancel</Button>
                  <Button onClick={handleSubAction} disabled={subLoading}
                    className={subAction === 'cancel' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-purple-600 text-white hover:bg-purple-700'}>
                    {subLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : subAction === 'assign' ? 'Assign Plan' : subAction === 'renew' ? 'Change / Renew' : subAction === 'extend' ? 'Extend' : 'Cancel Subscription'}
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}