import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, DashboardStats } from '@/types'
import { THEMES, type ThemeKey, APP_CONFIG } from '@/lib/config'

interface AppState {
  profile: Profile | null
  stats: DashboardStats | null
  sidebarOpen: boolean
  currency: string
  activeTheme: ThemeKey
  appLogo: string | null
  logoSize: 'sm' | 'md' | 'lg'
  setProfile: (profile: Profile | null) => void
  setStats: (stats: DashboardStats) => void
  setSidebarOpen: (open: boolean) => void
  setCurrency: (currency: string) => void
  setThemeKey: (theme: ThemeKey) => void
  setAppLogo: (url: string | null) => void
  setLogoSize: (size: 'sm' | 'md' | 'lg') => void
  getTheme: () => typeof THEMES[ThemeKey]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile:     null,
      stats:       null,
      sidebarOpen: true,
      currency:    APP_CONFIG.currency,
      activeTheme: APP_CONFIG.defaultTheme,
      appLogo:     null,
      logoSize:    'md',
      setProfile:     (profile)     => set({ profile }),
      setStats:       (stats)       => set({ stats }),
      setSidebarOpen: (open)        => set({ sidebarOpen: open }),
      setCurrency:    (currency)    => set({ currency }),
      setThemeKey:    (activeTheme) => set({ activeTheme }),
      setAppLogo:     (appLogo)     => set({ appLogo }),
      setLogoSize:    (logoSize)    => set({ logoSize }),
      getTheme: () => THEMES[get().activeTheme],
    }),
    {
      name: 'fintrack-app',
      partialize: (state) => ({
        currency:    state.currency,
        sidebarOpen: state.sidebarOpen,
        activeTheme: state.activeTheme,
        appLogo:     state.appLogo,
        logoSize:    state.logoSize,
      }),
    }
  )
)

interface FilterState {
  dateRange: { from: string | null; to: string | null }
  category: string
  type: string
  search: string
  setDateRange: (range: { from: string | null; to: string | null }) => void
  setCategory:  (category: string) => void
  setType:      (type: string) => void
  setSearch:    (search: string) => void
  reset: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  dateRange: { from: null, to: null },
  category:  '',
  type:      '',
  search:    '',
  setDateRange: (dateRange) => set({ dateRange }),
  setCategory:  (category)  => set({ category }),
  setType:      (type)      => set({ type }),
  setSearch:    (search)    => set({ search }),
  reset: () => set({ dateRange: { from: null, to: null }, category: '', type: '', search: '' }),
}))