'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Search, Sun, Moon, Monitor, LogOut, User, Settings, ChevronDown, Shield, Palette } from 'lucide-react'
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

export function TopNav() {
  const { profile, getTheme, setThemeKey, activeTheme } = useAppStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const currentTheme = getTheme()
  const { topbar } = currentTheme

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
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
      {/* Search */}
      <div className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            placeholder="Search transactions..."
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
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