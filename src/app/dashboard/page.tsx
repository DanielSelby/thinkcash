import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardContent } from './dashboard-content'

export const metadata = { title: 'Dashboard' }
export const dynamic  = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  // Fetch ALL transactions — no date filter
  // Dashboard shows full overview; user filters client-side when needed
  const [
    { data: incomes },
    { data: expenses },
    { data: budgets },
    { data: goals },
  ] = await Promise.all([
    supabase.from('incomes').select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
    supabase.from('expenses').select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
    supabase.from('budgets').select('*')
      .eq('user_id', user.id),
    supabase.from('savings_goals').select('*')
      .eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <DashboardContent
        incomes={incomes   ?? []}
        expenses={expenses ?? []}
        budgets={budgets   ?? []}
        goals={goals       ?? []}
        profile={profile}
      />
    </AppShell>
  )
}