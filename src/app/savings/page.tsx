import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { SavingsContent } from './savings-content'

export const metadata = { title: 'Savings Goals' }
export const dynamic = 'force-dynamic'

export default async function SavingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages, is_active').eq('id', user.id).single()
  requirePageAccess(profile, 'savings')

  const [
    { data: goals },
    { data: accounts },
    { data: incomes },
    { data: expenses },
    { data: transfers },
  ] = await Promise.all([
    supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('user_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
    supabase.from('incomes').select('amount, account_id').eq('user_id', user.id),
    supabase.from('expenses').select('amount, account_id').eq('user_id', user.id),
    supabase.from('transfers').select('from_account_id, to_account_id, amount, to_amount').eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <SavingsContent
        initialGoals={goals ?? []}
        initialAccounts={accounts ?? []}
        incomes={incomes ?? []}
        expenses={expenses ?? []}
        transfers={transfers ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}