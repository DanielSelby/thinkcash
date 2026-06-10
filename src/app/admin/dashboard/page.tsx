import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Users, Activity, UserCheck, TrendingUp, Shield, Database } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const metadata = { title: 'Admin Dashboard' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (currentProfile?.role !== 'admin') redirect('/dashboard')

  const [{ count: totalUsers }, { count: activeUsers }, { data: recentUsers }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id, full_name, email, created_at, is_active, role').order('created_at', { ascending: false }).limit(10),
  ])

  const thisMonth = new Date(); thisMonth.setDate(1)
  const { count: newThisMonth } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonth.toISOString())

  const stats = [
    { label: 'Total Users', value: totalUsers || 0, icon: Users, color: 'text-primary bg-primary/10' },
    { label: 'Active Users', value: activeUsers || 0, icon: UserCheck, color: 'text-success bg-success/10' },
    { label: 'New This Month', value: newThisMonth || 0, icon: TrendingUp, color: 'text-accent bg-accent/10' },
  ]

  return (
    <AppShell isAdmin>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">System overview and user management</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map(s => (
            <Card key={s.label} className="p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl font-bold tabular-nums mt-1">{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: '/admin/users', icon: Users, label: 'Manage Users' },
            { href: '/admin/analytics', icon: Activity, label: 'Analytics' },
            { href: '/admin/monitoring', icon: Database, label: 'Monitoring' },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-accent/5 hover:border-accent/30 transition-all group">
              <Icon className="w-5 h-5 text-muted-foreground group-hover:text-accent" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>

        {/* Recent users */}
        <Card>
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent Registrations</h2>
            <Link href="/admin/users" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers || []).map(u => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-3.5">
                      <p className="font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={u.role === 'admin' ? 'destructive' : 'secondary'}>{u.role}</Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={u.is_active ? 'success' : 'destructive'}>{u.is_active ? 'Active' : 'Suspended'}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-muted-foreground">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
