import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { PlansContent } from './plans-content'

export const metadata = { title: 'Subscription Plans' }
export const dynamic  = 'force-dynamic'

export default async function SubscriptionPlansPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')
  const { data: plans } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: false })
  return (
    <AppShell isAdmin>
      <PlansContent initialPlans={plans || []} />
    </AppShell>
  )
}