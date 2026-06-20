'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000 // only write last_active_at once every 5 min
const LAST_ACTIVE_SESSION_KEY = 'ts_last_active_ping'
const LOGIN_LOGGED_SESSION_KEY = 'ts_login_logged'

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin?: boolean }) {
  const {
    profile, setAppLogo, setLogoSize,
    viewMode, sidebarOpen, setSidebarOpen,
  } = useAppStore()
  const adminMode = isAdmin || profile?.role === 'admin'
  const pathname  = usePathname()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['app_logo', 'logo_size'])

        if (data) {
          const logo = data.find(r => r.key === 'app_logo')
          const size = data.find(r => r.key === 'logo_size')
          setAppLogo(logo?.value ?? null)
          if (size?.value) setLogoSize(size.value as 'sm' | 'md' | 'lg')
        }
      } catch {
        // fail silently
      }
    }
    loadSettings()
  }, [])

  // ── Activity tracking: throttled last_active_at ping + page_view log ──
  useEffect(() => {
    if (!profile?.id) return
    const supabase = createClient()

    // Throttled last_active_at update — at most once every 5 minutes per session
    const lastPing = Number(sessionStorage.getItem(LAST_ACTIVE_SESSION_KEY) || 0)
    const now = Date.now()
    if (now - lastPing > LAST_ACTIVE_THROTTLE_MS) {
      sessionStorage.setItem(LAST_ACTIVE_SESSION_KEY, String(now))
      supabase.from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', profile.id)
        .then(() => {}, () => {}) // fire-and-forget, never block UI on failure
    }

    // Log a 'login' event once per browser session, then 'page_view' on every route change
    if (!sessionStorage.getItem(LOGIN_LOGGED_SESSION_KEY)) {
      sessionStorage.setItem(LOGIN_LOGGED_SESSION_KEY, '1')
      supabase.from('activity_log')
        .insert({ user_id: profile.id, event_type: 'login', page_path: pathname })
        .then(() => {}, () => {})
    } else {
      supabase.from('activity_log')
        .insert({ user_id: profile.id, event_type: 'page_view', page_path: pathname })
        .then(() => {}, () => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, pathname])

  // Auto-collapse sidebar whenever mobile view is active — including on
  // initial mount/refresh, not just on a live toggle change
  useEffect(() => {
    if (viewMode === 'mobile' && sidebarOpen) {
      setSidebarOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, sidebarOpen])

  const isMobile = viewMode === 'mobile'

  return (
    <div className="flex h-screen overflow-hidden bg-background justify-center">
      <div className={cn(
        'flex',
        isMobile ? 'w-full max-w-[480px] border-x border-border shadow-xl' : 'w-full'
      )}>
        <Sidebar isAdmin={adminMode} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className={cn(isMobile ? 'p-3' : 'p-6 max-w-7xl mx-auto')}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}