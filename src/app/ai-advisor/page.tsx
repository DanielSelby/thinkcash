import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { AIAdvisorContent } from './ai-advisor-content'

export const metadata = { title: 'AI Financial Advisor' }
export const dynamic  = 'force-dynamic'

export default async function AIAdvisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  requirePageAccess(profile, 'ai-advisor')

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [
    { data: incomes },
    { data: expenses },
    { data: budgets },
    { data: goals },
    { data: recurring },
  ] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('savings_goals').select('*').eq('user_id', user.id),
    supabase.from('recurring_transactions').select('*').eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <AppShell>
      <AIAdvisorContent
        incomes={incomes   ?? []}
        expenses={expenses ?? []}
        budgets={budgets   ?? []}
        goals={goals       ?? []}
        recurring={recurring ?? []}
        profile={profile}
      />
    </AppShell>
  )
}