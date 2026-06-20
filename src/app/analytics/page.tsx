import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { AnalyticsContent } from './analytics-content'

export const metadata = { title: 'Analytics' }
export const dynamic  = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages').eq('id', user.id).single()
  requirePageAccess(profile, 'analytics')

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]

  const [{ data: incomes }, { data: expenses }] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', sixMonthsAgo),
    supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', sixMonthsAgo),
  ])

  return (
    <AppShell>
      <AnalyticsContent incomes={incomes || []} expenses={expenses || []} />
    </AppShell>
  )
}