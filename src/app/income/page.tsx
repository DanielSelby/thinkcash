import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { IncomeContent } from './income-content'

export const metadata = { title: 'Income' }
export const dynamic  = 'force-dynamic'

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: incomes }, { data: accounts }] = await Promise.all([
    supabase.from('incomes').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('user_accounts').select('*')
      .eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <AppShell>
      <IncomeContent
        initialIncomes={incomes ?? []}
        accounts={accounts ?? []}
        userId={user.id}
      />
    </AppShell>
  )
}