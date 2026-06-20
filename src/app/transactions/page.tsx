import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { TransactionsContent } from './transactions-content'

export const metadata = { title: 'Transactions' }
export const dynamic  = 'force-dynamic'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages').eq('id', user.id).single()
  requirePageAccess(profile, 'transactions')

  const [{ data: incomes }, { data: expenses }, { data: accounts }] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('user_accounts').select('id, name, currency').eq('user_id', user.id),
  ])

  const transactions = [
    ...(incomes || []).map(i => ({ ...i, type: 'income' as const })),
    ...(expenses || []).map(e => ({ ...e, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <AppShell>
      <TransactionsContent transactions={transactions} accounts={accounts ?? []} />
    </AppShell>
  )
}