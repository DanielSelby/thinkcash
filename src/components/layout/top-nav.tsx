'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bell, Search, Sun, Moon, Monitor, LogOut, User, Settings,
  ChevronDown, Shield, Palette, Smartphone, Laptop, X,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc'
import { APP_CONFIG, THEMES, type ThemeKey } from '@/lib/config'

const TAGLINE_PHRASES = ['Spend Wisely.', 'Grow Boldly.']

function AnimatedTagline() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % TAGLINE_PHRASES.length)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hidden md:flex items-center justify-center flex-1 px-4 overflow-hidden">
      <div className="relative h-5 flex items-center" style={{ minWidth: 160 }}>
        {TAGLINE_PHRASES.map((phrase, i) => (
          <span
            key={phrase}
            className="absolute left-0 right-0 text-center text-sm font-medium text-white/70 tracking-wide transition-all duration-500 ease-out"
            style={{
              opacity: i === index ? 1 : 0,
              transform: i === index ? 'translateY(0)' : 'translateY(6px)',
            }}
          >
            {phrase}
          </span>
        ))}
      </div>
    </div>
  )
}

export function TopNav() {
  const { profile, getTheme, setThemeKey, activeTheme, viewMode, setViewMode } = useAppStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const currentTheme = getTheme()
  const { topbar } = currentTheme

  const [searchValue, setSearchValue] = useState('')

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchValue.trim()) return
    router.push(`/transactions?search=${encodeURIComponent(searchValue.trim())}`)
  }

  const clearSearch = () => setSearchValue('')

  const toggleViewMode = () => {
    setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop')
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || APP_CONFIG.shortName

  return (
    <header
      style={{ background: topbar.background, borderColor: 'rgba(255,255,255,0.12)' }}
      className="h-16 border-b flex items-center gap-4 px-6 sticky top-0 z-40"
    >
      {/* Search — now functional, navigates to Transactions with search query */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            placeholder="Search transactions…"
            className="w-full h-9 pl-9 pr-8 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      <AnimatedTagline />

      <div className="ml-auto flex items-center gap-2">

        {/* Desktop / Mobile view toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleViewMode}
          className="w-9 h-9 text-white hover:bg-white/10"
          title={viewMode === 'desktop' ? 'Switch to Mobile View' : 'Switch to Desktop View'}
        >
          {viewMode === 'desktop'
            ? <Smartphone className="w-4 h-4" />
            : <Laptop     className="w-4 h-4" />}
        </Button>

        {/* Theme Color Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-9 h-9 text-white hover:bg-white/10" title="Switch Theme">
              <Palette className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>App Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(THEMES) as ThemeKey[]).map(key => (
              <DropdownMenuItem
                key={key}
                onClick={() => setThemeKey(key)}
                className="flex items-center gap-3"
              >
                <div className="flex gap-1.5">
                  <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: THEMES[key].colors.primary }} />
                  <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: THEMES[key].colors.accent }} />
                </div>
                <span>{THEMES[key].name}</span>
                {activeTheme === key && <span className="ml-auto text-xs text-green-500 font-bold">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Light/Dark mode */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="w-9 h-9 text-white hover:bg-white/10">
              <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}><Sun className="w-4 h-4 mr-2" />Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="w-4 h-4 mr-2" />Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}><Monitor className="w-4 h-4 mr-2" />System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="w-9 h-9 relative text-white hover:bg-white/10" asChild>
          <Link href="/notifications">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full" />
          </Link>
        </Button>

        {/* Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 text-white hover:bg-white/10">
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback style={{ background: currentTheme.colors.accent }} className="text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">{profile?.full_name || 'User'}</span>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{profile?.full_name || 'User'}</div>
              <div className="text-xs text-muted-foreground">{profile?.email || ''}</div>
              {profile?.role === 'admin' && (
                <div className="text-xs font-bold mt-0.5" style={{ color: currentTheme.colors.accent }}>Administrator</div>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/profile"><User className="w-4 h-4 mr-2" />Profile</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings"><Settings className="w-4 h-4 mr-2" />Settings</Link></DropdownMenuItem>
            {profile?.role === 'admin' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/dashboard"><Shield className="w-4 h-4 mr-2" />Admin Panel</Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}