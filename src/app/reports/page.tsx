import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { ReportsContent } from './reports-content'

export const metadata = { title: 'Reports' }
export const dynamic  = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages, is_active').eq('id', user.id).single()
  requirePageAccess(profile, 'reports')

  const [
    { data: incomes },
    { data: expenses },
    { data: accounts },
    { data: assets },
    { data: investments },
    { data: debts },
    { data: loans },
    { data: goals },
  ] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).order('date', { ascending: true }),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: true }),
    supabase.from('user_accounts').select('*').eq('user_id', user.id),
    supabase.from('assets').select('*').eq('user_id', user.id),
    supabase.from('investments').select('*').eq('user_id', user.id),
    supabase.from('debts').select('*').eq('user_id', user.id),
    supabase.from('loans').select('*').eq('user_id', user.id),
    supabase.from('savings_goals').select('*').eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <ReportsContent
        incomes={incomes         ?? []}
        expenses={expenses       ?? []}
        accounts={accounts       ?? []}
        assets={assets           ?? []}
        investments={investments ?? []}
        debts={debts             ?? []}
        loans={loans             ?? []}
        goals={goals             ?? []}
      />
    </AppShell>
  )
}