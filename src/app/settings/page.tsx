'use client'

import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, DollarSign, Bell, Shield } from 'lucide-react'
import { toast } from '@/components/ui/toaster'

export default function SettingsPage() {
  const { currency, setCurrency } = useAppStore()
  const { theme, setTheme } = useTheme()

  const handleSave = () => toast({ title: 'Settings saved', variant: 'success' })

  return (
    <AppShell>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Customize your FinTrack Pro experience</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sun className="w-4 h-4" />Appearance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3">Theme</p>
              <div className="flex gap-3">
                {[
                  { value: 'light', icon: Sun, label: 'Light' },
                  { value: 'dark', icon: Moon, label: 'Dark' },
                  { value: 'system', icon: Monitor, label: 'System' },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${theme === value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Currency</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground mb-3">Choose your preferred display currency</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GHS">🇬🇭 Ghanaian Cedi (GHS)</SelectItem>
                  <SelectItem value="USD">🇺🇸 US Dollar (USD)</SelectItem>
                  <SelectItem value="EUR">🇪🇺 Euro (EUR)</SelectItem>
                  <SelectItem value="GBP">🇬🇧 British Pound (GBP)</SelectItem>
                  <SelectItem value="NGN">🇳🇬 Nigerian Naira (NGN)</SelectItem>
                  <SelectItem value="KES">🇰🇪 Kenyan Shilling (KES)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4" />Notifications</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Budget limit alerts', description: 'Notify when you reach 80% of a budget' },
              { label: 'Savings goal milestones', description: 'Celebrate when you hit goal milestones' },
              { label: 'Recurring transaction reminders', description: 'Remind before upcoming recurring transactions' },
              { label: 'Weekly summary', description: 'Receive a weekly spending summary' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="w-9 h-5 bg-primary rounded-full relative cursor-pointer">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" />Privacy & Security</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your financial data is encrypted and stored securely on Supabase with Row Level Security enabled. 
              Only you can access your data.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/privacy" target="_blank">View Privacy Policy</a>
            </Button>
          </CardContent>
        </Card>

        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </AppShell>
  )
}
