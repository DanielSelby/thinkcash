import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { ExpensesContent } from './expenses-content'

export const metadata = { title: 'Expenses' }
export const dynamic  = 'force-dynamic'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages').eq('id', user.id).single()
  requirePageAccess(profile, 'expenses')

  const [{ data: expenses }, { data: accounts }] = await Promise.all([
    supabase.from('expenses').select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
    supabase.from('user_accounts').select('*')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  return (
    <AppShell>
      <ExpensesContent
        initialExpenses={expenses ?? []}
        accounts={accounts ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}