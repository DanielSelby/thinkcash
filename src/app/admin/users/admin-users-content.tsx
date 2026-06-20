'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Search, UserCheck, UserX, Trash2, Users,
  ShieldAlert, Lock, Loader2, Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { formatDate } from '@/lib/utils'
import { GATEABLE_PAGES } from '@/lib/page-access'
import type { Profile, AccessTemplate } from '@/types'

interface Props {
  initialUsers: Profile[]
  templates?: AccessTemplate[]
}

export function AdminUsersContent({ initialUsers, templates = [] }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [accessUser, setAccessUser] = useState<Profile | null>(null)
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set())
  const [restrictMode, setRestrictMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)

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

  const lastActive = (u: Profile) => {
    if (!u.last_active_at) return 'Never'
    try {
      return formatDistanceToNow(new Date(u.last_active_at), { addSuffix: true })
    } catch {
      return 'Unknown'
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-destructive" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm">{users.length} total users</p>
        </div>
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
                  <td className="px-6 py-4 text-xs text-muted-foreground">{lastActive(u)}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
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

      {/* Page Access Dialog */}
      <Dialog open={!!accessUser} onOpenChange={o => !o && setAccessUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Page Access — {accessUser?.full_name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Templates */}
            {templates.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setTemplateOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 text-sm transition-colors"
                >
                  <span className="text-muted-foreground">Apply a template...</span>
                  <span className="text-xs text-primary font-semibold">▾</span>
                </button>
                {templateOpen && (
                  <div className="absolute top-full mt-1 w-full z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                    {templates.map(t => (
                      <button
                        key={t.id}
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
              </div>
            )}

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
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {selectedPages.size} of {GATEABLE_PAGES.length} selected
                  </p>
                  <div className="flex gap-3">
                    <button onClick={selectAllPages} className="text-xs font-semibold text-primary hover:underline">Select all</button>
                    <button onClick={clearAllPages} className="text-xs font-semibold text-muted-foreground hover:underline">Clear all</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                  {GATEABLE_PAGES.map(p => {
                    const checked = selectedPages.has(p.key)
                    return (
                      <button
                        key={p.key}
                        onClick={() => togglePage(p.key)}
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
    </div>
  )
}