import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { requirePageAccess } from '@/lib/require-page-access'
import { RecurringContent } from './recurring-content'

export const metadata = { title: 'Recurring Transactions' }
export const dynamic  = 'force-dynamic'

export default async function RecurringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role, allowed_pages').eq('id', user.id).single()
  requirePageAccess(profile, 'recurring')

  const [{ data: recurring }, { data: accounts }] = await Promise.all([
    supabase.from('recurring_transactions').select('*')
      .eq('user_id', user.id).order('next_date', { ascending: true }),
    supabase.from('user_accounts').select('id, name, currency')
      .eq('user_id', user.id).eq('is_active', true),
  ])

  return (
    <AppShell>
      <RecurringContent
        initialRecurring={recurring || []}
        accounts={accounts || []}
        userId={user.id}
      />
    </AppShell>
  )
}