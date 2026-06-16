import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { UserAccountsContent } from './user-accounts-content'

export const metadata = { title: 'My Accounts' }
export const dynamic  = 'force-dynamic'

export default async function UserAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: accounts },
    { data: incomes },
    { data: expenses },
    { data: transfers },
  ] = await Promise.all([
    supabase.from('user_accounts').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase.from('incomes').select('amount, account_id')
      .eq('user_id', user.id),
    supabase.from('expenses').select('amount, account_id')
      .eq('user_id', user.id),
    supabase.from('transfers').select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
  ])

  return (
    <AppShell>
      <UserAccountsContent
        initialAccounts={accounts ?? []}
        incomes={incomes ?? []}
        expenses={expenses ?? []}
        initialTransfers={transfers ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}