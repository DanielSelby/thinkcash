'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2,
  Banknote, Smartphone, Wallet, TrendingUp,
  ArrowUpRight, ArrowDownRight, Building2,
  ArrowLeftRight, History, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import type { UserAccount } from '@/types'

const ACCOUNT_TYPES = [
  { value: 'bank',         label: 'Bank Account', icon: Building2  },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'cash',         label: 'Cash',         icon: Banknote   },
  { value: 'investment',   label: 'Investment',   icon: TrendingUp },
]

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank:         '#2563eb',
  mobile_money: '#f59e0b',
  cash:         '#16a34a',
  investment:   '#7c3aed',
}

const accountSchema = z.object({
  name:            z.string().min(1, 'Account name is required'),
  type:            z.string().min(1, 'Account type is required'),
  institution:     z.string().optional(),
  opening_balance: z.coerce.number().min(0),
  currency:        z.string().default('GHS'),
})
type AccountFormData = z.infer<typeof accountSchema>

const transferSchema = z.object({
  from_account_id: z.string().min(1, 'From account is required'),
  to_account_id:   z.string().min(1, 'To account is required'),
  amount:          z.coerce.number().positive('Amount must be positive'),
  date:            z.string().min(1, 'Date is required'),
  note:            z.string().optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'Cannot transfer to the same account',
  path: ['to_account_id'],
})
type TransferFormData = z.infer<typeof transferSchema>

interface Transfer {
  id: string
  from_account_id: string
  to_account_id: string
  amount: number
  note?: string | null
  date: string
  created_at: string
}

interface Props {
  initialAccounts:  UserAccount[]
  incomes:          { amount: number; account_id: string | null }[]
  expenses:         { amount: number; account_id: string | null }[]
  initialTransfers: Transfer[]
  userId: string
}

export function UserAccountsContent({
  initialAccounts, incomes, expenses, initialTransfers, userId,
}: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [accounts,  setAccounts]  = useState(initialAccounts)
  const [transfers, setTransfers] = useState(initialTransfers)
  const [open,      setOpen]      = useState(false)
  const [editing,   setEditing]   = useState<UserAccount | null>(null)
  const [loading,   setLoading]   = useState(false)

  // Transfer dialog state
  const [transferOpen,    setTransferOpen]    = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [showHistory,     setShowHistory]     = useState(false)

  // Account form
  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { opening_balance: 0, currency: 'GHS' },
  })

  // Transfer form
  const transferForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  // Compute balance per account (including transfers)
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome    = incomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense   = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut   = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn    = transfers.filter(t => t.to_account_id   === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const balance        = acc.opening_balance + totalIncome - totalExpense - transfersOut + transfersIn
      return { ...acc, total_income: totalIncome, total_expenses: totalExpense, transfers_in: transfersIn, transfers_out: transfersOut, balance }
    }), [accounts, incomes, expenses, transfers])

  const totalBalance  = accountsWithBalance.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalIncome   = accountsWithBalance.reduce((s, a) => s + (a.total_income ?? 0), 0)
  const totalExpenses = accountsWithBalance.reduce((s, a) => s + (a.total_expenses ?? 0), 0)

  // Account CRUD
  const openCreate = () => {
    setEditing(null)
    accountForm.reset({ opening_balance: 0, currency: 'GHS' })
    setOpen(true)
  }

  const openEdit = (acc: UserAccount) => {
    setEditing(acc)
    accountForm.reset({
      name:            acc.name,
      type:            acc.type,
      institution:     acc.institution ?? '',
      opening_balance: acc.opening_balance,
      currency:        acc.currency,
    })
    setOpen(true)
  }

  const onAccountSubmit = async (data: AccountFormData) => {
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

  // Transfer
  const onTransferSubmit = async (data: TransferFormData) => {
    setTransferLoading(true)
    const supabase = createClient()
    const { data: created, error } = await supabase
      .from('transfers')
      .insert({
        user_id:         userId,
        from_account_id: data.from_account_id,
        to_account_id:   data.to_account_id,
        amount:          data.amount,
        date:            data.date,
        note:            data.note || null,
      })
      .select().single()

    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' })
    } else {
      setTransfers(prev => [created, ...prev])
      toast({ title: `${formatCurrency(data.amount)} transferred successfully`, variant: 'success' })
      transferForm.reset({ date: new Date().toISOString().split('T')[0] })
      setTransferOpen(false)
    }
    setTransferLoading(false)
  }

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm('Delete this transfer? Account balances will be updated.')) return
    const supabase = createClient()
    const { error } = await supabase.from('transfers').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setTransfers(prev => prev.filter(t => t.id !== id))
      toast({ title: 'Transfer deleted' })
    }
  }

  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '—'
  const getIcon = (type: string) => ACCOUNT_TYPES.find(a => a.value === type)?.icon ?? Wallet

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
        <div className="flex gap-2 flex-wrap">
          {accounts.length >= 2 && (
            <>
              <Button variant="outline" onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Transfer History
                {transfers.length > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full font-semibold">
                    {transfers.length}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={() => { transferForm.reset({ date: new Date().toISOString().split('T')[0] }); setTransferOpen(true) }}
                className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" /> Transfer
              </Button>
            </>
          )}
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Add Account
          </Button>
        </div>
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

      {/* Transfer History Panel */}
      {showHistory && (
        <Card className="bg-white rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" /> Transfer History
              </CardTitle>
              <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No transfers yet</p>
            ) : (
              <div className="space-y-0">
                {transfers.map(t => (
                  <div key={t.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0 group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{getAccountName(t.from_account_id)}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{getAccountName(t.to_account_id)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(t.date)}{t.note ? ` · ${t.note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-blue-600">
                        {formatCurrency(Number(t.amount))}
                      </span>
                      <button
                        onClick={() => handleDeleteTransfer(t.id)}
                        className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Cards */}
      {accountsWithBalance.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No accounts yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Add your bank accounts, mobile money, or cash wallets to track balances
          </p>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Add Your First Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accountsWithBalance.map(acc => {
            const Icon      = getIcon(acc.type)
            const color     = ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
            const typeLabel = ACCOUNT_TYPES.find(t => t.value === acc.type)?.label || acc.type
            return (
              <Card key={acc.id} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
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
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(acc)}>
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

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
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
                    {(acc.transfers_in ?? 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Transferred In</p>
                          <p className="text-sm font-semibold text-blue-500 tabular-nums">
                            {formatCurrency(acc.transfers_in ?? 0)}
                          </p>
                        </div>
                      </div>
                    )}
                    {(acc.transfers_out ?? 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">Transferred Out</p>
                          <p className="text-sm font-semibold text-orange-500 tabular-nums">
                            {formatCurrency(acc.transfers_out ?? 0)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick transfer button */}
                  {accounts.length >= 2 && (
                    <button
                      onClick={() => {
                        transferForm.reset({
                          from_account_id: acc.id,
                          date: new Date().toISOString().split('T')[0],
                        })
                        setTransferOpen(true)
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer from this account
                    </button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {accounts.length > 0 && (
        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> When adding income or expenses, select which account the money
              came from or went to. Use the Transfer button to move money between your accounts.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Add / Edit Account Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder="e.g. GCB Savings, MTN MoMo, Cash Wallet"
                {...accountForm.register('name')} />
              {accountForm.formState.errors.name && (
                <p className="text-xs text-destructive">{accountForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select onValueChange={v => accountForm.setValue('type', v)} defaultValue={editing?.type}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {accountForm.formState.errors.type && (
                <p className="text-xs text-destructive">{accountForm.formState.errors.type.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Institution / Provider <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="e.g. GCB Bank, MTN, Ecobank" {...accountForm.register('institution')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Balance (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00"
                  {...accountForm.register('opening_balance')} />
                <p className="text-xs text-muted-foreground">Balance before using this app</p>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select onValueChange={v => accountForm.setValue('currency', v)}
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" />
                  : editing ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Dialog ── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5" /> Transfer Between Accounts
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4">

            <div className="space-y-1.5">
              <Label>From Account</Label>
              <Select
                onValueChange={v => transferForm.setValue('from_account_id', v)}
                defaultValue={transferForm.getValues('from_account_id')}
              >
                <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                <SelectContent>
                  {accountsWithBalance.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <span>{a.name}</span>
                        <span className="text-muted-foreground text-xs">({formatCurrency(a.balance ?? 0)})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.from_account_id && (
                <p className="text-xs text-destructive">{transferForm.formState.errors.from_account_id.message}</p>
              )}
            </div>

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-12 bg-border" />
                <ArrowDownRight className="w-5 h-5" />
                <div className="h-px w-12 bg-border" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>To Account</Label>
              <Select onValueChange={v => transferForm.setValue('to_account_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                <SelectContent>
                  {accountsWithBalance.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <span>{a.name}</span>
                        <span className="text-muted-foreground text-xs">({formatCurrency(a.balance ?? 0)})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.to_account_id && (
                <p className="text-xs text-destructive">{transferForm.formState.errors.to_account_id.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00"
                  {...transferForm.register('amount')} />
                {transferForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{transferForm.formState.errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...transferForm.register('date')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Moving savings to bank" {...transferForm.register('note')} />
            </div>

            {/* Preview */}
            {transferForm.watch('from_account_id') && transferForm.watch('to_account_id') && transferForm.watch('amount') > 0 && (
              <div className="p-3 rounded-xl text-sm"
                style={{ background: theme.colors.primaryPale }}>
                <p className="font-medium" style={{ color: theme.colors.primary }}>Transfer Summary</p>
                <p className="text-muted-foreground mt-1">
                  {formatCurrency(Number(transferForm.watch('amount')))} from{' '}
                  <strong>{getAccountName(transferForm.watch('from_account_id'))}</strong> to{' '}
                  <strong>{getAccountName(transferForm.watch('to_account_id'))}</strong>
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={transferLoading}
                style={{ background: theme.colors.primary, color: '#fff' }}>
                {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" />
                  : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}