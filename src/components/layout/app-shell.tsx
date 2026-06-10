'use client'

import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'

export function AppShell({ children, isAdmin }: { children: React.ReactNode; isAdmin?: boolean }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isAdmin={isAdmin} />
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
