import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { IncomeContent } from './income-content'

export const metadata = { title: 'Income' }

export default async function IncomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: incomes } = await supabase
    .from('incomes')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  return (
    <AppShell>
      <IncomeContent initialIncomes={incomes || []} userId={user.id} />
    </AppShell>
  )
}
