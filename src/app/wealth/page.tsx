import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { WealthContent } from './wealth-content'

export const metadata = { title: 'Net Worth — Wealth Tracker' }
export const dynamic  = 'force-dynamic'

export default async function WealthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { data: assets },
    { data: investments },
    { data: debts },
    { data: loans },
  ] = await Promise.all([
    supabase.from('assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('investments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('loans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <AppShell>
      <WealthContent
        initialAssets={assets || []}
        initialInvestments={investments || []}
        initialDebts={debts || []}
        initialLoans={loans || []}
        userId={user.id}
      />
    </AppShell>
  )
}