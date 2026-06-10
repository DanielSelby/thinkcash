import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, DashboardStats } from '@/types'

interface AppState {
  profile: Profile | null
  stats: DashboardStats | null
  sidebarOpen: boolean
  currency: string
  setProfile: (profile: Profile | null) => void
  setStats: (stats: DashboardStats) => void
  setSidebarOpen: (open: boolean) => void
  setCurrency: (currency: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      stats: null,
      sidebarOpen: true,
      currency: 'GHS',
      setProfile: (profile) => set({ profile }),
      setStats: (stats) => set({ stats }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'fintrack-app',
      partialize: (state) => ({ currency: state.currency, sidebarOpen: state.sidebarOpen }),
    }
  )
)

interface FilterState {
  dateRange: { from: string | null; to: string | null }
  category: string
  type: string
  search: string
  setDateRange: (range: { from: string | null; to: string | null }) => void
  setCategory: (category: string) => void
  setType: (type: string) => void
  setSearch: (search: string) => void
  reset: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  dateRange: { from: null, to: null },
  category: '',
  type: '',
  search: '',
  setDateRange: (dateRange) => set({ dateRange }),
  setCategory: (category) => set({ category }),
  setType: (type) => set({ type }),
  setSearch: (search) => set({ search }),
  reset: () => set({ dateRange: { from: null, to: null }, category: '', type: '', search: '' }),
}))
