import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ExpensesContent } from './expenses-content'

export const metadata = { title: 'Expenses' }

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  return (
    <AppShell>
      <ExpensesContent initialExpenses={expenses || []} userId={user.id} />
    </AppShell>
  )
}
