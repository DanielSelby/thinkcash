import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { ForecastContent } from './forecast-content'

export const metadata = { title: 'Cash Flow Forecast' }
export const dynamic  = 'force-dynamic'

export default async function ForecastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages').eq('id', user.id).single()
  requirePageAccess(profile, 'forecast')

  const now          = new Date()
  const lookbackFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0]

  const [
    { data: accounts  },
    { data: incomes   },
    { data: expenses  },
    { data: transfers },
    { data: recurring },
  ] = await Promise.all([
    supabase.from('user_accounts').select('*')
      .eq('user_id', user.id).eq('is_active', true),
    supabase.from('incomes').select('amount, account_id, date, category')
      .eq('user_id', user.id).gte('date', lookbackFrom),
    supabase.from('expenses').select('amount, account_id, date, category')
      .eq('user_id', user.id).gte('date', lookbackFrom),
    supabase.from('transfers').select('*').eq('user_id', user.id),
    supabase.from('recurring_transactions').select('*')
      .eq('user_id', user.id).eq('is_active', true)
      .order('next_date', { ascending: true }),
  ])

  return (
    <AppShell>
      <ForecastContent
        rawAccounts={accounts  ?? []}
        incomes={incomes       ?? []}
        expenses={expenses     ?? []}
        transfers={transfers   ?? []}
        recurring={recurring   ?? []}
      />
    </AppShell>
  )
}