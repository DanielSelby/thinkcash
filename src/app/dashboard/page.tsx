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

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Auto-create profile if missing
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: user.user_metadata?.full_name || '',
        email: user.email || '',
        role: 'user',
        is_active: true,
      })
      .select()
      .single()
    profile = newProfile
  }

  const [{ data: incomes }, { data: expenses }, { data: budgets }, { data: goals }] =
    await Promise.all([
      supabase.from('incomes').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('expenses').select('*').eq('user_id', user.id).gte('date', monthStart).lte('date', monthEnd),
      supabase.from('budgets').select('*').eq('user_id', user.id),
      supabase.from('savings_goals').select('*').eq('user_id', user.id),
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