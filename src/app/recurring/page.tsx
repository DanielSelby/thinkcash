import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { RecurringContent } from './recurring-content'

export const metadata = { title: 'Recurring Transactions' }
export const dynamic  = 'force-dynamic'

export default async function RecurringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: recurring } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('next_date', { ascending: true })

  return (
    <AppShell>
      <RecurringContent initialRecurring={recurring || []} userId={user.id} />
    </AppShell>
  )
}

