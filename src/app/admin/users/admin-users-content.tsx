'use client'

import { useState, useMemo } from 'react'
import { Search, UserCheck, UserX, Trash2, Users, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatDate } from '@/lib/utils'
import type { Profile } from '@/types'

interface Props { initialUsers: Profile[] }

export function AdminUsersContent({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  ), [users, search])

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    const supabase = createClient()
    const newStatus = !currentStatus
    const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', userId)
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
    else { setUsers(prev => prev.filter(u => u.id !== userId)); toast({ title: 'User deleted' }) }
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
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
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
                    <Badge variant={u.is_active ? 'success' : 'destructive'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost" className={`w-8 h-8 ${u.is_active ? 'text-warning hover:text-warning' : 'text-success hover:text-success'}`}
                        onClick={() => toggleStatus(u.id, u.is_active)}
                        title={u.is_active ? 'Suspend user' : 'Activate user'}
                      >
                        {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                      </Button>
                      {u.role !== 'admin' && (
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => deleteUser(u.id)}>
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
    </div>
  )
}
