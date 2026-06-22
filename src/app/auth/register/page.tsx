import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from './register-form'

export const metadata = { title: 'Create Account' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
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
  return <RegisterForm loginLogo={loginLogo} />
}
