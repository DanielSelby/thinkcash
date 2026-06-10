import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { TransactionsContent } from './transactions-content'

export const metadata = { title: 'Transactions' }

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: incomes }, { data: expenses }] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
  ])

  const transactions = [
    ...(incomes || []).map(i => ({ ...i, type: 'income' as const })),
    ...(expenses || []).map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <AppShell>
      <TransactionsContent transactions={transactions} />
    </AppShell>
  )
}
