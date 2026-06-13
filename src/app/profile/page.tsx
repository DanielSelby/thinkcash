import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ProfileContent } from './profile-content'

export const metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If profile doesn't exist yet, create it
  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || '',
      email: user.email || '',
      role: 'user',
      is_active: true,
    })
  }

  const finalProfile = profile || {
    id: user.id,
    full_name: user.user_metadata?.full_name || '',
    email: user.email || '',
    avatar_url: null,
    role: 'user',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <AppShell>
      <ProfileContent profile={finalProfile as any} userId={user.id} />
    </AppShell>
  )
}