import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { AdminUsersContent } from './admin-users-content'

export const metadata = { title: 'Admin — Users' }
export const dynamic  = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: users }, { data: templates }, { data: plans }, { data: subscriptions }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('access_templates').select('*').order('name'),
    supabase.from('subscription_plans').select('id, name, description, billing_cycle, custom_days, amount, currency, grace_period, status, allowed_pages').eq('status', 'active').order('name'),
    supabase.from('user_subscriptions').select('*, subscription_plans(name, billing_cycle, currency)').order('created_at', { ascending: false }),
  ])

  return (
    <AppShell isAdmin>
      <AdminUsersContent
        initialUsers={users || []}
        templates={templates || []}
        plans={plans || []}
        subscriptions={subscriptions || []}
        adminId={user.id}
      />
    </AppShell>
  )
}