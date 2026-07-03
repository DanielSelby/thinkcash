import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { AdminDashboardContent } from './admin-dashboard-content'

export const metadata = { title: 'Admin Dashboard' }
export const dynamic  = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const now           = new Date()
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const yearStart     = `${now.getFullYear()}-01-01`
  const weekFromNow   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const todayStr      = now.toISOString().split('T')[0]
  const sixMonthsAgo  = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const [
    { data: users         },
    { data: subscriptions },
    { data: plans         },
    { data: recentActivity},
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, is_active, created_at'),
    supabase.from('user_subscriptions').select('*, subscription_plans(name, billing_cycle, amount, currency)'),
    supabase.from('subscription_plans').select('*'),
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <AppShell isAdmin>
      <AdminDashboardContent
        users={users         ?? []}
        subscriptions={subscriptions ?? []}
        plans={plans         ?? []}
        recentActivity={recentActivity ?? []}
        todayStr={todayStr}
        monthStart={monthStart}
        yearStart={yearStart}
        weekFromNow={weekFromNow}
      />
    </AppShell>
  )
}