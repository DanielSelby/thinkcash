import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp, Activity, Database } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export const metadata = { title: 'Admin — Analytics' }

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Build monthly user registration counts for last 6 months
  const monthlyStats = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const d = subMonths(new Date(), 5 - i)
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59')
      return { month: format(d, 'MMM yyyy'), count: count || 0 }
    })
  )

  const [
    { count: totalUsers },
    { count: totalIncomes },
    { count: totalExpenses },
    { count: totalBudgets },
    { count: totalGoals },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('incomes').select('*', { count: 'exact', head: true }),
    supabase.from('expenses').select('*', { count: 'exact', head: true }),
    supabase.from('budgets').select('*', { count: 'exact', head: true }),
    supabase.from('savings_goals').select('*', { count: 'exact', head: true }),
  ])

  return (
    <AppShell isAdmin>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground text-sm">Overview of platform-wide usage and activity</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Users', value: totalUsers || 0, icon: Users },
            { label: 'Income Records', value: totalIncomes || 0, icon: TrendingUp },
            { label: 'Expense Records', value: totalExpenses || 0, icon: Activity },
            { label: 'Budgets Created', value: totalBudgets || 0, icon: Database },
            { label: 'Savings Goals', value: totalGoals || 0, icon: Activity },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-5">
              <Icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="font-display text-2xl font-bold tabular-nums mt-1">{value.toLocaleString()}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">New User Registrations (6 months)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthlyStats.map(m => (
                <div key={m.month} className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">{m.month}</span>
                  <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.max((m.count / Math.max(...monthlyStats.map(x => x.count), 1)) * 100, m.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-8 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
