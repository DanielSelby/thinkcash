'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin?: boolean }) {
  const {
    profile, setAppLogo, setLogoSize,
    viewMode, sidebarOpen, setSidebarOpen,
  } = useAppStore()
  const adminMode = isAdmin || profile?.role === 'admin'

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