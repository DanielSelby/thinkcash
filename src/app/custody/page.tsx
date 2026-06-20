import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { CustodyContent } from './custody-content'

export const metadata = { title: 'Custody Account' }
export const dynamic  = 'force-dynamic'

export default async function CustodyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: transactions }, { data: accounts }] = await Promise.all([
    supabase.from('custody_transactions').select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false }),
    supabase.from('user_accounts').select('id, name, currency')
      .eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <CustodyContent
        initialTransactions={transactions || []}
        accounts={accounts || []}
        userId={user.id}
      />
    </AppShell>
  )
}