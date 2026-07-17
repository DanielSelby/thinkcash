import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, DashboardStats } from '@/types'
import { THEMES, type ThemeKey, APP_CONFIG } from '@/lib/config'

interface AppState {
  profile:      Profile | null
  stats:        DashboardStats | null
  sidebarOpen:  boolean
  currency:     string
  activeTheme:  ThemeKey
  appLogo:      string | null
  logoSize:     'sm' | 'md' | 'lg'
  viewMode:     'desktop' | 'mobile'
  unreadCount:     number
  commandBarOpen:  boolean

  setProfile:     (profile: Profile | null) => void
  setCommandBarOpen: (open: boolean) => void
  setStats:       (stats: DashboardStats) => void
  setSidebarOpen: (open: boolean) => void
  setCurrency:    (currency: string) => void
  setThemeKey:    (theme: ThemeKey) => void
  setAppLogo:     (url: string | null) => void
  setLogoSize:    (size: 'sm' | 'md' | 'lg') => void
  setViewMode:    (mode: 'desktop' | 'mobile') => void
  setUnreadCount: (count: number) => void
  incrementUnread: () => void
  clearUnread:    () => void
  getTheme:       () => typeof THEMES[ThemeKey]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile:      null,
      stats:        null,
      sidebarOpen:  true,
      currency:     APP_CONFIG.currency,
      activeTheme:  APP_CONFIG.defaultTheme,
      appLogo:      null,
      logoSize:     'md',
      viewMode:     'desktop',
      unreadCount:     0,
      commandBarOpen:  false,

      setProfile:        (profile)  => set({ profile }),
      setCommandBarOpen: (open)     => set({ commandBarOpen: open }),
      setStats:        (stats)       => set({ stats }),
      setSidebarOpen:  (open)        => set({ sidebarOpen: open }),
      setCurrency:     (currency)    => set({ currency }),
      setThemeKey:     (activeTheme) => set({ activeTheme }),
      setAppLogo:      (appLogo)     => set({ appLogo }),
      setLogoSize:     (logoSize)    => set({ logoSize }),
      setViewMode:     (viewMode)    => set({ viewMode }),
      setUnreadCount:  (count)       => set({ unreadCount: count }),
      incrementUnread: ()            => set(s => ({ unreadCount: s.unreadCount + 1 })),
      clearUnread:     ()            => set({ unreadCount: 0 }),
      getTheme: () => THEMES[get().activeTheme],
    }),
    {
      name: 'Think-Shika-PA-app',
      partialize: (state) => ({
        currency:    state.currency,
        sidebarOpen: state.sidebarOpen,
        activeTheme: state.activeTheme,
        appLogo:     state.appLogo,
        logoSize:    state.logoSize,
        viewMode:    state.viewMode,
        // unreadCount intentionally NOT persisted — always freshly fetched on mount
      }),
    }
  )
)

interface FilterState {
  dateRange: { from: string | null; to: string | null }
  category:  string
  type:      string
  search:    string
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