'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2,
  Banknote, Smartphone, Wallet, TrendingUp,
  ArrowUpRight, ArrowDownRight, Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import type { UserAccount } from '@/types'

const ACCOUNT_TYPES = [
  { value: 'bank',         label: 'Bank Account',    icon: Building2   },
  { value: 'mobile_money', label: 'Mobile Money',    icon: Smartphone  },
  { value: 'cash',         label: 'Cash',            icon: Banknote    },
  { value: 'investment',   label: 'Investment',      icon: TrendingUp  },
]

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank:         '#2563eb',
  mobile_money: '#f59e0b',
  cash:         '#16a34a',
  investment:   '#7c3aed',
}

const schema = z.object({
  name:            z.string().min(1, 'Account name is required'),
  type:            z.string().min(1, 'Account type is required'),
  institution:     z.string().optional(),
  opening_balance: z.coerce.number().min(0),
  currency:        z.string().default('GHS'),
})
type FormData = z.infer<typeof schema>

interface Props {
  initialAccounts: UserAccount[]
  incomes:  { amount: number; account_id: string | null }[]
  expenses: { amount: number; account_id: string | null }[]
  userId: string
}

export function UserAccountsContent({ initialAccounts, incomes, expenses, userId }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [accounts, setAccounts] = useState(initialAccounts)
  const [open,     setOpen]     = useState(false)
  const [editing,  setEditing]  = useState<UserAccount | null>(null)
  const [loading,  setLoading]  = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { opening_balance: 0, currency: 'GHS' },
  })

  // Compute balance per account
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome  = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + i.amount, 0)
      const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + e.amount, 0)
      const balance      = acc.opening_balance + totalIncome - totalExpense
      return { ...acc, total_income: totalIncome, total_expenses: totalExpense, balance }
    }), [accounts, incomes, expenses])

  const totalBalance    = accountsWithBalance.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalIncome     = accountsWithBalance.reduce((s, a) => s + (a.total_income ?? 0), 0)
  const totalExpenses   = accountsWithBalance.reduce((s, a) => s + (a.total_expenses ?? 0), 0)

  const openCreate = () => {
    setEditing(null)
    reset({ opening_balance: 0, currency: 'GHS' })
    setOpen(true)
  }

  const openEdit = (acc: UserAccount) => {
    setEditing(acc)
    reset({
      name:            acc.name,
      type:            acc.type,
      institution:     acc.institution ?? '',
      opening_balance: acc.opening_balance,
      currency:        acc.currency,
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase
        .from('user_accounts')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setAccounts(prev => prev.map(a => a.id === editing.id ? updated : a))
        toast({ title: 'Account updated', variant: 'success' })
        setOpen(false)
      }
    } else {
      const { data: created, error } = await supabase
        .from('user_accounts')
        .insert({ ...data, user_id: userId, is_active: true })
        .select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else {
        setAccounts(prev => [...prev, created])
        toast({ title: 'Account created', variant: 'success' })
        setOpen(false)
      }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? Transactions linked to it will remain but unlinked.')) return
    const supabase = createClient()
    const { error } = await supabase.from('user_accounts').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setAccounts(prev => prev.filter(a => a.id !== id))
      toast({ title: 'Account deleted' })
    }
  }

  const getIcon = (type: string) => {
    const t = ACCOUNT_TYPES.find(a => a.value === type)
    return t ? t.icon : Wallet
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            My Accounts
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your bank accounts, mobile money wallets, and cash
          </p>
        </div>
        <Button onClick={openCreate}
          style={{ background: theme.colors.primary, color: '#fff' }}>
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-white kpi-green p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Balance</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">{formatCurrency(totalBalance)}</p>
          <p className="text-xs text-muted-foreground mt-1">{accounts.length} account(s)</p>
        </Card>
        <Card className="bg-white kpi-blue p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Received</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card className="bg-white kpi-red p-5">
          <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Spent</p>
          <p className="kpi-value text-2xl font-bold tabular-nums mt-1">{formatCurrency(totalExpenses)}</p>
        </Card>
      </div>

      {/* Account Cards */}
      {accountsWithBalance.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No accounts yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Add your bank accounts, mobile money, or cash wallets to track balances
          </p>
          <Button onClick={openCreate}
            style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Add Your First Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accountsWithBalance.map(acc => {
            const Icon  = getIcon(acc.type)
            const color = ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
            const typeLabel = ACCOUNT_TYPES.find(t => t.value === acc.type)?.label || acc.type
            return (
              <Card key={acc.id} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Colored top bar */}
                <div className="h-1.5" style={{ background: color }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: color + '18' }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabel}{acc.institution ? ` · ${acc.institution}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7"
                        onClick={() => openEdit(acc)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        className="w-7 h-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(acc.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-0.5">Current Balance</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color }}>
                      {formatCurrency(acc.balance ?? 0)}
                    </p>
                    {acc.opening_balance > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Opening: {formatCurrency(acc.opening_balance)}
                      </p>
                    )}
                  </div>

                  {/* Income / Expense row */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Received</p>
                        <p className="text-sm font-semibold text-green-600 tabular-nums">
                          {formatCurrency(acc.total_income ?? 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Spent</p>
                        <p className="text-sm font-semibold text-red-500 tabular-nums">
                          {formatCurrency(acc.total_expenses ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Tip */}
      {accounts.length > 0 && (
        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> When adding income or expenses, select which account the money
              came from or went to. This keeps your account balances accurate.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder="e.g. GCB Savings, MTN MoMo, Cash Wallet"
                {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select onValueChange={v => setValue('type', v)}
                defaultValue={editing?.type}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Institution / Provider <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="e.g. GCB Bank, MTN, Ecobank"
                {...register('institution')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Balance (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00"
                  {...register('opening_balance')} />
                <p className="text-xs text-muted-foreground">
                  Current balance before using this app
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select onValueChange={v => setValue('currency', v)}
                  defaultValue={editing?.currency ?? 'GHS'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GHS">GHS — Cedi</SelectItem>
                    <SelectItem value="USD">USD — Dollar</SelectItem>
                    <SelectItem value="EUR">EUR — Euro</SelectItem>
                    <SelectItem value="GBP">GBP — Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}
                style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}