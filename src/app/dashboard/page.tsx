import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardContent } from './dashboard-content'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  // Fetch current month income & expenses
  const [{ data: incomes }, { data: expenses }, { data: budgets }, { data: goals }, { data: profile }] =
    await Promise.all([
      supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('savings_goals').select('*').eq('user_id', user.id),
      supabase.from('profiles').select('*').eq('id', user.id).single(),
    ])

  return (
    <AppShell>
      <DashboardContent
        incomes={incomes || []}
        expenses={expenses || []}
        budgets={budgets || []}
        goals={goals || []}
        profile={profile}
      />
    </AppShell>
  )
}
