import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ReportsContent } from './reports-content'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const yearStart = `${new Date().getFullYear()}-01-01`
  const [{ data: incomes }, { data: expenses }] = await Promise.all([
    supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', yearStart).order('date'),
    supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', yearStart).order('date'),
  ])

  return (
    <AppShell>
      <ReportsContent incomes={incomes || []} expenses={expenses || []} />
    </AppShell>
  )
}
