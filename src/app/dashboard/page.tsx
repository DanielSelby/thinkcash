import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardContent } from './dashboard-content'

export const metadata = { title: 'Dashboard' }
export const dynamic  = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const [
    { data: incomes },
    { data: expenses },
    { data: budgets },
    { data: goals },
    { data: accounts },
    { data: transfers },
    { data: custodyTransactions },
    { data: assets },
    { data: investments },
    { data: debts },
    { data: loans },
  ] = await Promise.all([
    supabase.from('incomes').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('expenses').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('savings_goals').select('*').eq('user_id', user.id),
    supabase.from('user_accounts').select('*')
      .eq('user_id', user.id).eq('is_active', true),
    supabase.from('transfers').select('*').eq('user_id', user.id),
    supabase.from('custody_transactions').select('*').eq('user_id', user.id),
    supabase.from('assets').select('id, current_value, purchase_value, status, asset_type, currency, exchange_rate, is_liquid, migrated_to_account')
      .eq('user_id', user.id),
    supabase.from('investments').select('id, current_value')
      .eq('user_id', user.id),
    supabase.from('debts').select('id, remaining')
      .eq('user_id', user.id),
    supabase.from('loans').select('id, remaining')
      .eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <DashboardContent
        incomes={incomes              ?? []}
        expenses={expenses            ?? []}
        budgets={budgets              ?? []}
        goals={goals                  ?? []}
        profile={profile}
        accounts={accounts            ?? []}
        transfers={transfers          ?? []}
        custodyTransactions={custodyTransactions ?? []}
        assets={assets                ?? []}
        investments={investments      ?? []}
        debts={debts                  ?? []}
        loans={loans                  ?? []}
      />
    </AppShell>
  )
}