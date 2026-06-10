import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { BudgetsContent } from './budgets-content'

export const metadata = { title: 'Budgets' }

export default async function BudgetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: budgets }, { data: expenses }] = await Promise.all([
    supabase.from('budgets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('expenses').select('amount,category').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
  ])

  return (
    <AppShell>
      <BudgetsContent initialBudgets={budgets || []} expenses={expenses || []} userId={user.id} />
    </AppShell>
  )
}
