import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardContent } from './dashboard-content'

export const metadata = { title: 'Dashboard' }
export const dynamic  = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Next.js 15 — searchParams is a Promise, must await
  const params = await searchParams

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0]

  const from = params?.from ?? monthStart
  const to   = params?.to   ?? monthEnd

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const [
    { data: incomes },
    { data: expenses },
    { data: budgets },
    { data: goals },
  ] = await Promise.all([
    supabase.from('incomes').select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    supabase.from('expenses').select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false }),
    supabase.from('budgets').select('*')
      .eq('user_id', user.id),
    supabase.from('savings_goals').select('*')
      .eq('user_id', user.id),
  ])

  return (
    <AppShell>
      <DashboardContent
        incomes={incomes   ?? []}
        expenses={expenses ?? []}
        budgets={budgets   ?? []}
        goals={goals       ?? []}
        profile={profile}
        from={from}
        to={to}
      />
    </AppShell>
  )
}