import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { HealthScoreContent } from './health-score-content'

export const metadata = { title: 'Financial Health Score' }
export const dynamic  = 'force-dynamic'

export default async function HealthScorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]

  const [
    { data: incomes },
    { data: expenses },
    { data: budgets },
    { data: goals },
    { data: recurring },
  ] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', threeMonthsAgo),
    supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', threeMonthsAgo),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('savings_goals').select('*').eq('user_id', user.id),
    supabase.from('recurring_transactions').select('*').eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <AppShell>
      <HealthScoreContent
        incomes={incomes     ?? []}
        expenses={expenses   ?? []}
        budgets={budgets     ?? []}
        goals={goals         ?? []}
        recurring={recurring ?? []}
        monthStart={monthStart}
        monthEnd={monthEnd}
      />
    </AppShell>
  )
}