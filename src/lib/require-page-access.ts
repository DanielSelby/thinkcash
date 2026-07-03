import { redirect } from 'next/navigation'
import { canAccessPage } from '@/lib/page-access'
import { DEFAULT_ALLOWED_PAGES } from '@/lib/default-access'

export function requirePageAccess(profile: { role?: string; allowed_pages?: string[] | null } | null, pageKey: string) {
  if (!profile) redirect('/auth/login')
  if (profile!.role === 'admin') return
  const effectivePages = profile!.allowed_pages ?? DEFAULT_ALLOWED_PAGES
  if (!effectivePages.includes(pageKey)) redirect('/dashboard')
}