import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { WealthContent } from './wealth-content'

export const metadata = { title: 'Net Worth — Wealth Tracker' }
export const dynamic  = 'force-dynamic'

export default async function WealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages, is_active').eq('id', user.id).single()
  requirePageAccess(profile, 'wealth')

  const [
    { data: assets },
    { data: investments },
    { data: debts },
    { data: loans },
    { data: accounts },
    { data: incomes },
    { data: expenses },
    { data: transfers },
    { data: loanPayments },
    { data: debtPayments },
  ] = await Promise.all([
    supabase.from('assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('investments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('loans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('user_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
    supabase.from('incomes').select('id, amount, account_id, date, title, category').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('expenses').select('id, amount, account_id, date, title, category').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('transfers').select('*').eq('user_id', user.id),
    supabase.from('loan_payments').select('*').eq('user_id', user.id).order('paid_date', { ascending: false }),
    supabase.from('debt_payments').select('*').eq('user_id', user.id).order('paid_date', { ascending: false }),
  ])

  return (
    <AppShell>
      <WealthContent
        initialAssets={assets           ?? []}
        initialInvestments={investments ?? []}
        initialDebts={debts             ?? []}
        initialLoans={loans             ?? []}
        initialAccounts={accounts       ?? []}
        incomes={incomes                ?? []}
        expenses={expenses              ?? []}
        transfers={transfers            ?? []}
        loanPayments={loanPayments      ?? []}
        debtPayments={debtPayments      ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}