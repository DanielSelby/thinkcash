'use client'

import { useState } from 'react'
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

const MARQUEE_TEXT = 'Spend Wisely  ·  Grow Boldly  ·  Track Every Penny Today  ·  Prosper Tomorrow  ·'

function MarqueeTagline() {
  return (
    <div className="hidden md:flex items-center flex-1 px-2 overflow-hidden">
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee 18s linear infinite;
          will-change: transform;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="overflow-hidden w-full">
        <div className="marquee-track">
          {[0, 1].map(n => (
            <span key={n} className="text-sm font-medium text-white/65 tracking-wide whitespace-nowrap pr-16 select-none">
              {MARQUEE_TEXT}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TopNav() {
  const { profile, getTheme, setThemeKey, activeTheme, viewMode, setViewMode, unreadCount, setCommandBarOpen } = useAppStore()
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

      {/* Command Bar Trigger */}
      <button
        onClick={() => setCommandBarOpen(true)}
        className="flex-shrink-0 w-56 flex items-center gap-2 h-9 pl-3 pr-3 rounded-lg text-sm bg-white/10 border border-white/20 text-white/60 hover:bg-white/15 hover:text-white/80 transition-colors group"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left text-sm">Search transactions…</span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-medium border border-white/20 rounded px-1.5 py-0.5 bg-white/10 flex-shrink-0">
          {typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'} /
        </kbd>
      </button>
          

      {/* Infinite Marquee */}
      <MarqueeTagline />

      <div className="ml-auto flex-shrink-0 flex items-center gap-2">

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

        {/* Notifications — live badge from store */}
        <Button variant="ghost" size="icon" className="w-9 h-9 relative text-white hover:bg-white/10" asChild>
          <Link href="/notifications">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full" />
            )}
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
