import { redirect } from 'next/navigation'
import { canAccessPage } from '@/lib/page-access'

/**
 * Server-side guard: call this in a page.tsx after fetching the profile.
 * Redirects to /dashboard if the user's role isn't admin and they lack access to pageKey.
 */
export function requirePageAccess(profile: { role?: string; allowed_pages?: string[] | null } | null, pageKey: string) {
  if (!profile) redirect('/auth/login')
  if (profile!.role === 'admin') return // admins always have full access
  if (!canAccessPage(profile!.allowed_pages, pageKey)) {
    redirect('/dashboard')
  }
}