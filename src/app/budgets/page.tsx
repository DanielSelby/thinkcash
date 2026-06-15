import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { BudgetsContent } from './budgets-content'

export const metadata = { title: 'Budgets' }
export const dynamic  = 'force-dynamic'

export default async function BudgetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: budgets }, { data: expenses }] = await Promise.all([
    // All budgets — client filters by month/year
    supabase.from('budgets').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    // All expenses with date — client filters by month/year
    supabase.from('expenses').select('amount, category, date')
      .eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <BudgetsContent
        initialBudgets={budgets  ?? []}
        expenses={expenses ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}