import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign In' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  let loginLogo: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'login_logo')
      .single()
    loginLogo = data?.value ?? null
  } catch { }
  return <LoginForm loginLogo={loginLogo} />
}
