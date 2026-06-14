'use client'

import { useRef, useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, DollarSign, Bell, Shield, Palette, Image, Upload, Trash2, Maximize2 } from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { THEMES, type ThemeKey } from '@/lib/config'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const {
    currency, setCurrency,
    setThemeKey, activeTheme, getTheme,
    appLogo, setAppLogo,
    logoSize, setLogoSize,
    profile,
  } = useAppStore()
  const { theme, setTheme } = useTheme()
  const currentTheme = getTheme()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const isAdmin = profile?.role === 'admin'

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()
      const path = `logos/app-logo.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) {
        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' })
        setUploadingLogo(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase
        .from('app_settings')
        .upsert({ key: 'app_logo', value: publicUrl, updated_at: new Date().toISOString() })
      setAppLogo(publicUrl)
      toast({ title: 'Logo uploaded successfully!', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' })
    }
    setUploadingLogo(false)
  }

  const handleRemoveLogo = async () => {
    try {
      const supabase = createClient()
      await supabase
        .from('app_settings')
        .upsert({ key: 'app_logo', value: null, updated_at: new Date().toISOString() })
      setAppLogo(null)
      toast({ title: 'Logo removed successfully' })
    } catch (err: any) {
      toast({ title: 'Remove failed', description: String(err), variant: 'destructive' })
    }
  }

  const LOGO_SIZES: { value: 'sm' | 'md' | 'lg'; label: string; desc: string }[] = [
    { value: 'sm', label: 'Small',  desc: '28px height' },
    { value: 'md', label: 'Medium', desc: '40px height' },
    { value: 'lg', label: 'Large',  desc: '56px height' },
  ]

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: currentTheme.colors.primary }}>
            Settings
          </h1>
          <p className="text-muted-foreground text-sm">Customize your Think-Shika PA experience</p>
        </div>

        {/* ── App Theme Toggle ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4" />App Color Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Switch between brand color themes</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(THEMES) as ThemeKey[]).map(key => {
                const t        = THEMES[key]
                const isActive = activeTheme === key
                return (
                  <button
                    key={key}
                    onClick={() => { setThemeKey(key); toast({ title: `${t.name} theme applied`, variant: 'success' }) }}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                      isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex gap-1.5">
                      <span className="w-6 h-6 rounded-full shadow-sm" style={{ background: t.colors.primary }} />
                      <span className="w-6 h-6 rounded-full shadow-sm" style={{ background: t.colors.accent }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{isActive ? '✓ Active' : 'Click to apply'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Light / Dark Mode ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="w-4 h-4" />Display Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {[
                { value: 'light',  icon: Sun,     label: 'Light'  },
                { value: 'dark',   icon: Moon,    label: 'Dark'   },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    theme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Logo Upload + Size — Admin Only ── */}
        {isAdmin && (
          <Card className="bg-white border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" />App Logo
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">
                  Admin Only
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Upload a custom logo for the sidebar. Recommended: PNG with transparent background.
              </p>

              {/* Upload / Preview */}
              <div className="flex items-start gap-4 flex-wrap">
                {appLogo ? (
                  <>
                    {/* Preview box — height reflects current size setting */}
                    <div className={`rounded-xl border border-border bg-muted flex items-center justify-center p-3 transition-all ${
                      logoSize === 'sm' ? 'h-14 w-32' : logoSize === 'lg' ? 'h-24 w-48' : 'h-16 w-40'
                    }`}>
                      <img src={appLogo} alt="App logo" className="h-full w-auto object-contain" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => fileRef.current?.click()} disabled={uploadingLogo}>
                        <Upload className="w-4 h-4 mr-1" />
                        {uploadingLogo ? 'Uploading…' : 'Replace Logo'}
                      </Button>
                      <Button size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={handleRemoveLogo}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex flex-col items-center gap-2 w-full p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      {uploadingLogo ? 'Uploading…' : 'Click to upload logo'}
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG up to 2MB</p>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>

              {/* Logo Size — only shown when a logo is uploaded */}
              {appLogo && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Maximize2 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Logo Size in Sidebar</p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {LOGO_SIZES.map(({ value, label, desc }) => (
                      <button
                        key={value}
                        onClick={() => {
                          setLogoSize(value)
                          toast({ title: `Logo size set to ${label}`, variant: 'success' })
                        }}
                        className={`flex flex-col items-center gap-1 px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          logoSize === value
                            ? 'border-primary bg-primary/8 text-primary shadow-sm'
                            : 'border-border hover:border-primary/50 text-muted-foreground'
                        }`}
                      >
                        <span className="font-semibold">{label}</span>
                        <span className="text-xs opacity-70">{desc}</span>
                        {logoSize === value && (
                          <span className="text-xs font-bold" style={{ color: currentTheme.colors.accent }}>✓ Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Size change applies instantly in the sidebar for all users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Currency ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />Currency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-56 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GHS">🇬🇭 Ghanaian Cedi (GHS)</SelectItem>
                <SelectItem value="USD">🇺🇸 US Dollar (USD)</SelectItem>
                <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                <SelectItem value="GBP">🇬🇧 British Pound (GBP)</SelectItem>
                <SelectItem value="NGN">🇳🇬 Nigerian Naira (NGN)</SelectItem>
                <SelectItem value="KES">🇰🇪 Kenyan Shilling (KES)</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* ── Notifications ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Budget limit alerts',           description: 'Notify when you reach 80% of a budget' },
              { label: 'Savings goal milestones',       description: 'Celebrate when you hit goal milestones' },
              { label: 'Recurring transaction reminders', description: 'Remind before upcoming recurring transactions' },
              { label: 'Weekly summary',                description: 'Receive a weekly spending summary' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div
                  style={{ background: currentTheme.colors.primary }}
                  className="w-9 h-5 rounded-full relative cursor-pointer flex-shrink-0 ml-4"
                >
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Security ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your financial data is encrypted and stored securely on Supabase with Row Level Security. Only you can access your data.
            </p>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  )
}