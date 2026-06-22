'use client'

import { useRef, useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store'
import { useTheme } from 'next-themes'
import {
  Sun, Moon, Monitor, DollarSign, Bell, Shield,
  Palette, Image, Upload, Trash2, Maximize2, Plus, LogIn,
} from 'lucide-react'
import { toast } from '@/components/ui/toaster'
import { THEMES, type ThemeKey } from '@/lib/config'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = [
  { value: 'GHS', label: 'Ghanaian Cedi',        flag: '🇬🇭' },
  { value: 'USD', label: 'US Dollar',             flag: '🇺🇸' },
  { value: 'EUR', label: 'Euro',                  flag: '🇪🇺' },
  { value: 'GBP', label: 'British Pound',         flag: '🇬🇧' },
  { value: 'NGN', label: 'Nigerian Naira',        flag: '🇳🇬' },
  { value: 'KES', label: 'Kenyan Shilling',       flag: '🇰🇪' },
  { value: 'ZAR', label: 'South African Rand',    flag: '🇿🇦' },
  { value: 'EGP', label: 'Egyptian Pound',        flag: '🇪🇬' },
  { value: 'TZS', label: 'Tanzanian Shilling',    flag: '🇹🇿' },
  { value: 'UGX', label: 'Ugandan Shilling',      flag: '🇺🇬' },
  { value: 'XOF', label: 'CFA Franc (BCEAO)',     flag: '🌍' },
  { value: 'XAF', label: 'CFA Franc (BEAC)',      flag: '🌍' },
  { value: 'MAD', label: 'Moroccan Dirham',       flag: '🇲🇦' },
  { value: 'ETB', label: 'Ethiopian Birr',        flag: '🇪🇹' },
  { value: 'RWF', label: 'Rwandan Franc',         flag: '🇷🇼' },
  { value: 'ZMW', label: 'Zambian Kwacha',        flag: '🇿🇲' },
  { value: 'GNF', label: 'Guinean Franc',         flag: '🇬🇳' },
  { value: 'JPY', label: 'Japanese Yen',          flag: '🇯🇵' },
  { value: 'CNY', label: 'Chinese Yuan',          flag: '🇨🇳' },
  { value: 'INR', label: 'Indian Rupee',          flag: '🇮🇳' },
  { value: 'CAD', label: 'Canadian Dollar',       flag: '🇨🇦' },
  { value: 'AUD', label: 'Australian Dollar',     flag: '🇦🇺' },
  { value: 'CHF', label: 'Swiss Franc',           flag: '🇨🇭' },
  { value: 'SGD', label: 'Singapore Dollar',      flag: '🇸🇬' },
  { value: 'AED', label: 'UAE Dirham',            flag: '🇦🇪' },
  { value: 'SAR', label: 'Saudi Riyal',           flag: '🇸🇦' },
  { value: 'BRL', label: 'Brazilian Real',        flag: '🇧🇷' },
  { value: 'MXN', label: 'Mexican Peso',          flag: '🇲🇽' },
  { value: 'SEK', label: 'Swedish Krona',         flag: '🇸🇪' },
  { value: 'NOK', label: 'Norwegian Krone',       flag: '🇳🇴' },
  { value: 'DKK', label: 'Danish Krone',          flag: '🇩🇰' },
  { value: 'NZD', label: 'New Zealand Dollar',    flag: '🇳🇿' },
  { value: 'HKD', label: 'Hong Kong Dollar',      flag: '🇭🇰' },
  { value: 'KRW', label: 'South Korean Won',      flag: '🇰🇷' },
  { value: 'TRY', label: 'Turkish Lira',          flag: '🇹🇷' },
  { value: 'PLN', label: 'Polish Zloty',          flag: '🇵🇱' },
  { value: 'THB', label: 'Thai Baht',             flag: '🇹🇭' },
  { value: 'MYR', label: 'Malaysian Ringgit',     flag: '🇲🇾' },
  { value: 'IDR', label: 'Indonesian Rupiah',     flag: '🇮🇩' },
  { value: 'PHP', label: 'Philippine Peso',       flag: '🇵🇭' },
]

const CUSTOM_CURRENCIES_KEY = 'ts_custom_currencies'
type Currency = { value: string; label: string; flag: string }

const LOGO_SIZES: { value: 'sm' | 'md' | 'lg'; label: string; desc: string; previewH: string }[] = [
  { value: 'sm', label: 'Small',  desc: '32px', previewH: 'h-6'  },
  { value: 'md', label: 'Medium', desc: '48px', previewH: 'h-10' },
  { value: 'lg', label: 'Large',  desc: '72px', previewH: 'h-16' },
]

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

  // Sidebar logo
  const fileRef         = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Login page logo
  const loginLogoRef              = useRef<HTMLInputElement>(null)
  const [uploadingLoginLogo, setUploadingLoginLogo] = useState(false)
  const [loginLogo,          setLoginLogo]          = useState<string | null>(null)

  // Currency
  const [showAddCurrency, setShowAddCurrency] = useState(false)
  const [newCurrencyCode, setNewCurrencyCode] = useState('')
  const [newCurrencyName, setNewCurrencyName] = useState('')
  const [newCurrencyFlag, setNewCurrencyFlag] = useState('')
  const [customCurrencies, setCustomCurrencies] = useState<Currency[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(CUSTOM_CURRENCIES_KEY) || '[]') } catch { return [] }
  })

  const isAdmin = profile?.role === 'admin'
  const allCurrencies = [...CURRENCIES, ...customCurrencies]

  // Load login logo from DB on mount
  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'login_logo')
          .single()
        if (data?.value) setLoginLogo(data.value)
      } catch { /* not set yet */ }
    }
    load()
  }, [])

  // ── Sidebar logo handlers ──────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()
      const path = `logos/app-logo.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); setUploadingLogo(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('app_settings').upsert({ key: 'app_logo', value: publicUrl, updated_at: new Date().toISOString() })
      setAppLogo(publicUrl)
      toast({ title: 'Logo uploaded — visible to all users!', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' })
    }
    setUploadingLogo(false)
  }

  const handleRemoveLogo = async () => {
    try {
      const supabase = createClient()
      await supabase.from('app_settings').upsert({ key: 'app_logo', value: null, updated_at: new Date().toISOString() })
      setAppLogo(null)
      toast({ title: 'Logo removed for all users' })
    } catch (err: any) {
      toast({ title: 'Remove failed', description: String(err), variant: 'destructive' })
    }
  }

  const handleLogoSize = async (value: 'sm' | 'md' | 'lg', label: string) => {
    setLogoSize(value)
    try {
      const supabase = createClient()
      await supabase.from('app_settings').upsert({ key: 'logo_size', value, updated_at: new Date().toISOString() })
      toast({ title: `Logo size set to ${label} — applied for all users`, variant: 'success' })
    } catch {
      toast({ title: `Logo size set to ${label}`, variant: 'success' })
    }
  }

  // ── Login logo handlers ────────────────────────────────
  const handleLoginLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLoginLogo(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop()
      const path = `logos/login-logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); setUploadingLoginLogo(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('app_settings').upsert({ key: 'login_logo', value: publicUrl, updated_at: new Date().toISOString() })
      setLoginLogo(publicUrl)
      toast({ title: 'Login logo updated — visible on login page!', variant: 'success' })
    } catch (err: any) {
      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' })
    }
    setUploadingLoginLogo(false)
  }

  const handleRemoveLoginLogo = async () => {
    try {
      const supabase = createClient()
      await supabase.from('app_settings').upsert({ key: 'login_logo', value: null, updated_at: new Date().toISOString() })
      setLoginLogo(null)
      toast({ title: 'Login logo removed' })
    } catch (err: any) {
      toast({ title: 'Remove failed', description: String(err), variant: 'destructive' })
    }
  }

  // ── Currency handlers ──────────────────────────────────
  const addCustomCurrency = () => {
    const code = newCurrencyCode.trim().toUpperCase()
    const name = newCurrencyName.trim()
    if (!code || !name) { toast({ title: 'Code and name are required', variant: 'destructive' }); return }
    if (CURRENCIES.some(c => c.value === code) || customCurrencies.some(c => c.value === code)) {
      toast({ title: 'Currency already exists', variant: 'destructive' }); return
    }
    const updated = [...customCurrencies, { value: code, label: name, flag: newCurrencyFlag.trim() || '🏳️' }]
    setCustomCurrencies(updated)
    localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(updated))
    setCurrency(code)
    setNewCurrencyCode(''); setNewCurrencyName(''); setNewCurrencyFlag('')
    setShowAddCurrency(false)
    toast({ title: `${code} added and selected`, variant: 'success' })
  }

  const removeCustomCurrency = (code: string) => {
    const updated = customCurrencies.filter(c => c.value !== code)
    setCustomCurrencies(updated)
    localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(updated))
    if (currency === code) setCurrency('GHS')
    toast({ title: `${code} removed` })
  }

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: currentTheme.colors.primary }}>
            Settings
          </h1>
          <p className="text-muted-foreground text-sm">Customize your Think-Shika PA experience</p>
        </div>

        {/* ── App Theme ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="w-4 h-4" /> App Color Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Switch between brand color themes</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(THEMES) as ThemeKey[]).map(key => {
                const t        = THEMES[key]
                const isActive = activeTheme === key
                return (
                  <button key={key}
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

        {/* ── Display Mode ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sun className="w-4 h-4" /> Display Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {[
                { value: 'light',  icon: Sun,     label: 'Light'  },
                { value: 'dark',   icon: Moon,    label: 'Dark'   },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button key={value} onClick={() => setTheme(value)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    theme === value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Sidebar Logo — Admin Only ── */}
        {isAdmin && (
          <Card className="bg-white border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Image className="w-4 h-4" /> Sidebar Logo
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">
                  Admin Only
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Appears in the app sidebar. All changes apply instantly to every user.
                Recommended: PNG with transparent background.
              </p>
              <div className="flex items-start gap-4 flex-wrap">
                {appLogo ? (
                  <>
                    <div className={`rounded-xl border border-border bg-muted flex items-center justify-center p-3 transition-all duration-300 ${
                      logoSize === 'sm' ? 'h-16 w-32' : logoSize === 'lg' ? 'h-32 w-64' : 'h-24 w-48'
                    }`}>
                      <img src={appLogo} alt="App logo" className="h-full w-auto object-contain" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadingLogo}>
                        <Upload className="w-4 h-4 mr-1" />{uploadingLogo ? 'Uploading…' : 'Replace Logo'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemoveLogo}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                    className="flex flex-col items-center gap-2 w-full p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{uploadingLogo ? 'Uploading…' : 'Click to upload sidebar logo'}</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG up to 2MB</p>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>

              {appLogo && (
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <Maximize2 className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Logo Size in Sidebar</p>
                    <span className="text-xs text-muted-foreground">— saved for all users</span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {LOGO_SIZES.map(({ value, label, desc, previewH }) => {
                      const isActive = logoSize === value
                      return (
                        <button key={value} onClick={() => handleLogoSize(value, label)}
                          className={`flex flex-col items-center gap-2 px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                            isActive ? 'shadow-sm' : 'border-border hover:border-primary/50 text-muted-foreground'
                          }`}
                          style={isActive ? { borderColor: currentTheme.colors.primary, background: currentTheme.colors.primary + '08' } : {}}
                        >
                          <div className="w-20 h-14 bg-muted rounded-lg flex items-center justify-center overflow-hidden p-1">
                            <img src={appLogo} alt="" className={`object-contain w-auto ${previewH}`} />
                          </div>
                          <span className="font-semibold" style={isActive ? { color: currentTheme.colors.primary } : {}}>{label}</span>
                          <span className="text-xs opacity-60">{desc} height</span>
                          {isActive && <span className="text-xs font-bold" style={{ color: currentTheme.colors.accent }}>✓ Active</span>}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Click a size to apply instantly for all users.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Login Page Logo — Admin Only ── */}
        {isAdmin && (
          <Card className="bg-white border-primary/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LogIn className="w-4 h-4" /> Login Page Logo
                <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-normal">
                  Admin Only
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Shown on the login and register pages above the form.
                Recommended: 300×100px PNG with transparent background.
              </p>

              {/* Live preview */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-3">
                  Preview — Login Page
                </p>
                <div
                  style={{ background: currentTheme.colors.primary }}
                  className="rounded-xl p-6 flex flex-col items-center gap-3 max-w-xs mx-auto"
                >
                  {loginLogo ? (
                    <img src={loginLogo} alt="Login logo preview" className="h-16 w-auto object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <LogIn className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <p className="text-white font-bold text-sm">Think-Shika PA</p>
                  <p className="text-white/70 text-xs">Think Wise. Plan Smart. Build Wealth.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 flex-wrap">
                {loginLogo ? (
                  <>
                    <div className="h-20 w-52 rounded-xl border border-border bg-muted flex items-center justify-center p-3">
                      <img src={loginLogo} alt="Login logo" className="h-full w-auto object-contain" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" onClick={() => loginLogoRef.current?.click()} disabled={uploadingLoginLogo}>
                        <Upload className="w-4 h-4 mr-1" />{uploadingLoginLogo ? 'Uploading…' : 'Replace Logo'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemoveLoginLogo}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => loginLogoRef.current?.click()}
                    disabled={uploadingLoginLogo}
                    className="flex flex-col items-center gap-2 w-full p-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{uploadingLoginLogo ? 'Uploading…' : 'Click to upload login logo'}</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG up to 2MB</p>
                  </button>
                )}
                <input ref={loginLogoRef} type="file" accept="image/*" className="hidden" onChange={handleLoginLogoUpload} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Currency ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Currency
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {allCurrencies.length} currencies
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
              {allCurrencies.map(c => {
                const isActive = currency === c.value
                const isCustom = customCurrencies.some(cc => cc.value === c.value)
                return (
                  <button key={c.value} onClick={() => setCurrency(c.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all group relative ${
                      isActive ? 'shadow-sm' : 'border-border hover:border-primary/40 text-muted-foreground'
                    }`}
                    style={isActive ? { borderColor: currentTheme.colors.primary, background: currentTheme.colors.primaryPale } : {}}
                  >
                    <span className="text-base flex-shrink-0">{c.flag}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs truncate"
                        style={isActive ? { color: currentTheme.colors.primary } : {}}>
                        {c.value}
                      </p>
                      <p className="text-xs text-muted-foreground truncate leading-tight">{c.label}</p>
                    </div>
                    {isActive && (
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: currentTheme.colors.accent }}>✓</span>
                    )}
                    {isCustom && !isActive && (
                      <button
                        onClick={e => { e.stopPropagation(); removeCustomCurrency(c.value) }}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </button>
                )
              })}
            </div>

            {showAddCurrency ? (
              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-sm font-semibold">Add Custom Currency</p>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Code *</label>
                    <Input
                      placeholder="e.g. XOF"
                      value={newCurrencyCode}
                      onChange={e => setNewCurrencyCode(e.target.value.toUpperCase().slice(0, 5))}
                      className="h-8 text-sm bg-white w-24"
                      maxLength={5}
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-36">
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Name *</label>
                    <Input
                      placeholder="e.g. CFA Franc"
                      value={newCurrencyName}
                      onChange={e => setNewCurrencyName(e.target.value)}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-20">
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Flag</label>
                    <Input
                      placeholder="🏳️"
                      value={newCurrencyFlag}
                      onChange={e => setNewCurrencyFlag(e.target.value)}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addCustomCurrency}
                    style={{ background: currentTheme.colors.primary }}
                    className="h-8 px-4 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    Add Currency
                  </button>
                  <button
                    onClick={() => { setShowAddCurrency(false); setNewCurrencyCode(''); setNewCurrencyName(''); setNewCurrencyFlag('') }}
                    className="h-8 px-3 rounded-lg text-xs border border-border bg-white text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCurrency(true)}
                className="flex items-center gap-2 text-xs font-medium border border-dashed border-border rounded-xl px-4 py-2.5 hover:border-primary/50 transition-colors text-muted-foreground w-full justify-center"
              >
                <Plus className="w-3.5 h-3.5" /> Add Custom Currency
              </button>
            )}
          </CardContent>
        </Card>

        {/* ── Notifications ── */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Budget limit alerts',             description: 'Notify when you reach 80% of a budget'       },
              { label: 'Savings goal milestones',         description: 'Celebrate when you hit goal milestones'       },
              { label: 'Recurring transaction reminders', description: 'Remind before upcoming recurring transactions' },
              { label: 'Weekly summary',                  description: 'Receive a weekly spending summary'            },
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
              <Shield className="w-4 h-4" /> Privacy & Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your financial data is encrypted and stored securely on Supabase with
              Row Level Security. Only you can access your data.
            </p>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  )
}