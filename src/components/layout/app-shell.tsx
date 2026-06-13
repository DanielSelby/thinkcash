'use client'

import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'
import { useAppStore } from '@/store'
import { createClient } from '@/lib/supabase/client'

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin?: boolean }) {
  const { profile, setAppLogo } = useAppStore()
  const adminMode = isAdmin || profile?.role === 'admin'

  useEffect(() => {
    const loadLogo = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'app_logo')
          .single()
        setAppLogo(data?.value ?? null)
      } catch {
        // table may not exist yet — fail silently
      }
    }
    loadLogo()
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isAdmin={adminMode} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}