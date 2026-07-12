'use client'

import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2,
  Banknote, Smartphone, Wallet, TrendingUp,
  ArrowUpRight, ArrowDownRight, Building2,
  ArrowLeftRight, History, X, Search, Filter,
  Download, Star, StarOff, MoreVertical,
  CreditCard, Eye, EyeOff, ChevronDown,
  BarChart3, List, AlertTriangle,
  CheckCircle2, Clock, FileText,
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from 'recharts'
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
import { KPICard } from '@/components/ui/kpi-card'
import type { UserAccount } from '@/types'
import { Users, ShieldOff, CalendarDays } from 'lucide-react'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

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

const TYPE_FILTER_LABELS: { value: string; label: string }[] = [
  { value: 'all',          label: 'All Wallets'      },
  { value: 'bank',         label: 'Bank'             },
  { value: 'mobile_money', label: 'Mobile Money'     },
  { value: 'cash',         label: 'Cash'             },
  { value: 'investment',   label: 'Investment'       },
]

const ALL_CURRENCIES = [
  { value: 'GHS', label: '🇬🇭 GHS — Cedi'         },
  { value: 'USD', label: '🇺🇸 USD — Dollar'        },
  { value: 'EUR', label: '🇪🇺 EUR — Euro'          },
  { value: 'GBP', label: '🇬🇧 GBP — Pound'        },
  { value: 'NGN', label: '🇳🇬 NGN — Naira'        },
  { value: 'KES', label: '🇰🇪 KES — Shilling'     },
  { value: 'ZAR', label: '🇿🇦 ZAR — Rand'         },
  { value: 'AED', label: '🇦🇪 AED — Dirham'       },
  { value: 'SAR', label: '🇸🇦 SAR — Riyal'        },
  { value: 'EGP', label: '🇪🇬 EGP — Pound'        },
  { value: 'JPY', label: '🇯🇵 JPY — Yen'          },
  { value: 'CNY', label: '🇨🇳 CNY — Yuan'         },
  { value: 'INR', label: '🇮🇳 INR — Rupee'        },
  { value: 'CAD', label: '🇨🇦 CAD — Dollar'       },
  { value: 'AUD', label: '🇦🇺 AUD — Dollar'       },
  { value: 'CHF', label: '🇨🇭 CHF — Franc'        },
  { value: 'SGD', label: '🇸🇬 SGD — Dollar'       },
  { value: 'BRL', label: '🇧🇷 BRL — Real'         },
  { value: 'MXN', label: '🇲🇽 MXN — Peso'         },
  { value: 'SEK', label: '🇸🇪 SEK — Krona'        },
  { value: 'NOK', label: '🇳🇴 NOK — Krone'        },
  { value: 'NZD', label: '🇳🇿 NZD — Dollar'       },
  { value: 'HKD', label: '🇭🇰 HKD — Dollar'       },
  { value: 'KRW', label: '🇰🇷 KRW — Won'          },
  { value: 'TRY', label: '🇹🇷 TRY — Lira'         },
  { value: 'THB', label: '🇹🇭 THB — Baht'         },
  { value: 'MYR', label: '🇲🇾 MYR — Ringgit'      },
  { value: 'PHP', label: '🇵🇭 PHP — Peso'         },
  { value: 'TZS', label: '🇹🇿 TZS — Shilling'    },
  { value: 'UGX', label: '🇺🇬 UGX — Shilling'    },
  { value: 'XOF', label: '🌍 XOF — CFA BCEAO'    },
  { value: 'XAF', label: '🌍 XAF — CFA BEAC'     },
  { value: 'MAD', label: '🇲🇦 MAD — Dirham'       },
  { value: 'ETB', label: '🇪🇹 ETB — Birr'         },
  { value: 'RWF', label: '🇷🇼 RWF — Franc'        },
  { value: 'ZMW', label: '🇿🇲 ZMW — Kwacha'       },
]

const CUSTOM_KEY = 'ts_custom_currencies'

const SORT_OPTIONS = [
  { value: 'balance_desc', label: 'Highest Balance' },
  { value: 'balance_asc',  label: 'Lowest Balance'  },
  { value: 'name_asc',     label: 'Name A–Z'        },
  { value: 'recent',       label: 'Most Recent'     },
]

// ── Schemas ───────────────────────────────────────────────────────────

const accountSchema = z.object({
  name:             z.string().min(1, 'Account name is required'),
  type:             z.string().min(1, 'Account type is required'),
  institution:      z.string().optional(),
  opening_balance:  z.coerce.number().min(0),
  currency:         z.string().default('GHS'),
  allow_negative:   z.boolean().optional(),
  is_custody:       z.boolean().optional(),
  exclude_from_net: z.boolean().optional(),
  custody_for:      z.string().optional(),
})
type AccountFormData = z.infer<typeof accountSchema>

const transferSchema = z.object({
  from_account_id: z.string().min(1, 'From account is required'),
  to_account_id:   z.string().min(1, 'To account is required'),
  amount:          z.coerce.number().positive('Amount must be positive'),
  exchange_rate:   z.coerce.number().positive('Exchange rate must be positive').optional(),
  date:            z.string().min(1, 'Date is required'),
  note:            z.string().optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'Cannot transfer to the same account',
  path: ['to_account_id'],
})
type TransferFormData = z.infer<typeof transferSchema>

const depositSchema = z.object({
  amount:     z.coerce.number().positive('Amount must be positive'),
  date:       z.string().min(1, 'Date required'),
  category:   z.string().default('other'),
  note:       z.string().optional(),
})
type DepositFormData = z.infer<typeof depositSchema>

const withdrawSchema = z.object({
  amount:     z.coerce.number().positive('Amount must be positive'),
  date:       z.string().min(1, 'Date required'),
  category:   z.string().default('other'),
  note:       z.string().optional(),
})
type WithdrawFormData = z.infer<typeof withdrawSchema>

interface Transfer {
  id: string
  from_account_id: string
  to_account_id:   string
  amount:          number
  to_amount?:      number | null
  exchange_rate?:  number | null
  note?:           string | null
  date:            string
  created_at:      string
}

// ── Props ─────────────────────────────────────────────────────────────

interface Props {
  initialAccounts:  UserAccount[]
  incomes:          { amount: number; account_id: string | null; date?: string }[]
  expenses:         { amount: number; account_id: string | null; date?: string }[]
  initialTransfers: Transfer[]
  custodyTransactions?: { amount: number; account_id: string | null; direction: string }[]
  userId: string
}

export function UserAccountsContent({
  initialAccounts, incomes, expenses, initialTransfers, custodyTransactions = [], userId,
}: Props) {
  const { activeTheme, currency: appCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const fmt = (n: number) => formatCurrency(n, appCurrency)

  const allCurrencies = useMemo(() => {
    try {
      const custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]') as { value: string; label: string }[]
      return [...ALL_CURRENCIES, ...custom.map(c => ({ value: c.value, label: `${c.value} — ${c.label}` }))]
    } catch { return ALL_CURRENCIES }
  }, [])

  // ── State ─────────────────────────────────────────────────────────
  const [accounts,        setAccounts]        = useState(initialAccounts)
  const [transfers,       setTransfers]       = useState(initialTransfers)
  const [open,            setOpen]            = useState(false)
  const [editing,         setEditing]         = useState<UserAccount | null>(null)
  const [loading,         setLoading]         = useState(false)
  const [transferOpen,    setTransferOpen]    = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [showHistory,     setShowHistory]     = useState(false)
  const [selectedAcc,     setSelectedAcc]     = useState<string | null>(null)
  const [typeFilter,      setTypeFilter]      = useState('all')
  const [search,          setSearch]          = useState('')
  const [sortBy,          setSortBy]          = useState('balance_desc')
  const [showBalances,    setShowBalances]    = useState(true)
  const [starredAccs,     setStarredAccs]     = useState<Set<string>>(new Set())
  const [quickAction,     setQuickAction]     = useState<{ type: 'deposit' | 'withdraw' | 'transfer' | 'statement'; accId: string } | null>(null)
  const [depositOpen,    setDepositOpen]    = useState(false)
  const [withdrawOpen,   setWithdrawOpen]   = useState(false)
  const [statementOpen,  setStatementOpen]  = useState(false)
  const [actionAccount,  setActionAccount]  = useState<typeof accountsWithBalance[0] | null>(null)
  const [depositLoading, setDepositLoading] = useState(false)
  const [withdrawLoading,setWithdrawLoading]= useState(false)
  const [stmtDateFrom,   setStmtDateFrom]   = useState('')
  const [stmtDateTo,     setStmtDateTo]     = useState('')
  const [stmtTypeFilter, setStmtTypeFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all')
  const [localIncomes,   setLocalIncomes]   = useState(incomes)
  const [localExpenses,  setLocalExpenses]  = useState(expenses)

  // ── Forms ─────────────────────────────────────────────────────────
  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: { opening_balance: 0, currency: 'GHS', allow_negative: false },
  })
  const transferForm = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const depositForm  = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], category: 'other' },
  })
  const withdrawForm = useForm<WithdrawFormData>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], category: 'other' },
  })

  const watchedFromId = transferForm.watch('from_account_id')
  const watchedToId   = transferForm.watch('to_account_id')
  const watchedAmount = transferForm.watch('amount')
  const watchedRate   = transferForm.watch('exchange_rate')
  const fromAccountSelected = accounts.find(a => a.id === watchedFromId)
  const toAccountSelected   = accounts.find(a => a.id === watchedToId)
  const isCrossCurrencyTransfer = !!fromAccountSelected && !!toAccountSelected && fromAccountSelected.currency !== toAccountSelected.currency
  const convertedAmount = Number(watchedAmount || 0) * Number(watchedRate || 0)

  // ── Balance Computation ───────────────────────────────────────────
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome   = localIncomes.filter(i  => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense  = localExpenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut  = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn   = transfers.filter(t => t.to_account_id   === acc.id).reduce((s, t) => s + Number(t.to_amount ?? t.amount), 0)
      const custodyIn     = custodyTransactions.filter(c => c.account_id === acc.id && c.direction === 'received').reduce((s, c) => s + Number(c.amount), 0)
      const custodyOut    = custodyTransactions.filter(c => c.account_id === acc.id && c.direction === 'given').reduce((s, c) => s + Number(c.amount), 0)
      const balance       = acc.opening_balance + totalIncome - totalExpense - transfersOut + transfersIn + custodyIn - custodyOut
      const overdraftAllowed = (acc as any).allow_negative === true || acc.type === 'bank'
      const isNegative    = balance < 0
      const overdraftStatus = !isNegative ? 'ok' : overdraftAllowed ? 'overdraft' : 'blocked'

      // Per-account monthly trend (last 6 months)
      const monthlyMap: Record<string, { income: number; expense: number }> = {}
      incomes.filter(i => i.account_id === acc.id).forEach(i => {
        const d = (i.date ?? '').slice(0, 7); if (!d) return
        if (!monthlyMap[d]) monthlyMap[d] = { income: 0, expense: 0 }
        monthlyMap[d].income += Number(i.amount)
      })
      expenses.filter(e => e.account_id === acc.id).forEach(e => {
        const d = (e.date ?? '').slice(0, 7); if (!d) return
        if (!monthlyMap[d]) monthlyMap[d] = { income: 0, expense: 0 }
        monthlyMap[d].expense += Number(e.amount)
      })
      const trendData = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([date, v]) => ({ date, net: v.income - v.expense }))

      // Transaction count for this account
      const txnCount = incomes.filter(i => i.account_id === acc.id).length +
                       expenses.filter(e => e.account_id === acc.id).length

      return {
        ...acc,
        total_income: totalIncome, total_expenses: totalExpense,
        transfers_in: transfersIn, transfers_out: transfersOut,
        custody_in: custodyIn, custody_out: custodyOut,
        balance, overdraftAllowed, overdraftStatus, trendData, txnCount,
        isCustody:         (acc as any).is_custody        ?? false,
        isExcludedFromNet: (acc as any).exclude_from_net  ?? (acc as any).is_custody ?? false,
      }
    }), [accounts, localIncomes, localExpenses, transfers, custodyTransactions])

  // ── Totals ────────────────────────────────────────────────────────
  const totalBalance  = accountsWithBalance.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalIncome   = accountsWithBalance.reduce((s, a) => s + (a.total_income ?? 0), 0)
  const totalExpenses = accountsWithBalance.reduce((s, a) => s + (a.total_expenses ?? 0), 0)
  const totalTransfers = transfers.length
  const activeCount    = accounts.filter(a => (a as any).is_active !== false).length

  // ── Monthly series for KPI sparklines ────────────────────────────
  const monthlySeries = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {}
    incomes.forEach(i => { const d = (i.date ?? '').slice(0, 7); if (!d) return; if (!map[d]) map[d] = { income: 0, expense: 0 }; map[d].income += Number(i.amount) })
    expenses.forEach(e => { const d = (e.date ?? '').slice(0, 7); if (!d) return; if (!map[d]) map[d] = { income: 0, expense: 0 }; map[d].expense += Number(e.amount) })
    return Object.entries(map).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date))
  }, [incomes, expenses])

  const incomeSeries  = monthlySeries.slice(-8).map(m => m.income)
  const expenseSeries = monthlySeries.slice(-8).map(m => m.expense)

  const now              = new Date()
  const lastMonthKey     = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`
  const lastMonthBucket  = monthlySeries.find(m => m.date === lastMonthKey) ?? null
  const lastMonthIncome  = lastMonthBucket?.income ?? null
  const lastMonthExpense = lastMonthBucket?.expense ?? null

  const topBalanceAccount = accountsWithBalance.length
    ? accountsWithBalance.reduce((best, a) => (a.balance ?? 0) > (best.balance ?? 0) ? a : best)
    : null
  const topIncomeAccount = accountsWithBalance.length
    ? accountsWithBalance.reduce((best, a) => (a.total_income ?? 0) > (best.total_income ?? 0) ? a : best)
    : null
  const topExpenseAccount = accountsWithBalance.length
    ? accountsWithBalance.reduce((best, a) => (a.total_expenses ?? 0) > (best.total_expenses ?? 0) ? a : best)
    : null

  // ── Filtered & sorted accounts ───────────────────────────────────
  const filteredAccounts = useMemo(() => {
    let list = [...accountsWithBalance]
    if (typeFilter !== 'all') list = list.filter(a => a.type === typeFilter)
    if (search) list = list.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || (a.institution ?? '').toLowerCase().includes(search.toLowerCase()))
    switch (sortBy) {
      case 'balance_asc':  list.sort((a, b) => (a.balance ?? 0) - (b.balance ?? 0)); break
      case 'balance_desc': list.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)); break
      case 'name_asc':     list.sort((a, b) => a.name.localeCompare(b.name)); break
    }
    // Starred accounts always first
    list.sort((a, b) => (starredAccs.has(b.id) ? 1 : 0) - (starredAccs.has(a.id) ? 1 : 0))
    return list
  }, [accountsWithBalance, typeFilter, search, sortBy, starredAccs])

  const selectedAccount = selectedAcc ? accountsWithBalance.find(a => a.id === selectedAcc) : null

  // ── Helpers ───────────────────────────────────────────────────────
  const getIcon = (type: string) => ACCOUNT_TYPES.find(a => a.value === type)?.icon ?? Wallet
  const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '—'
  const getAccountCurrency = (id: string) => accounts.find(a => a.id === id)?.currency

  const toggleStar = (id: string) => setStarredAccs(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  // ── CRUD ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    accountForm.reset({ opening_balance: 0, currency: appCurrency || 'GHS', allow_negative: false, is_custody: false, exclude_from_net: false, custody_for: '' })
    setOpen(true)
  }

  const openEdit = (acc: UserAccount) => {
    setEditing(acc)
    accountForm.reset({
      name: acc.name, type: acc.type, institution: acc.institution ?? '',
      opening_balance: acc.opening_balance, currency: acc.currency,
      allow_negative:   (acc as any).allow_negative   ?? (acc.type === 'bank'),
      is_custody:       (acc as any).is_custody        ?? false,
      exclude_from_net: (acc as any).exclude_from_net  ?? false,
      custody_for:      (acc as any).custody_for       ?? '',
    })
    setOpen(true)
  }

  const onAccountSubmit = async (data: AccountFormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload = {
      ...data,
      allow_negative:   data.allow_negative   ?? false,
      is_custody:       data.is_custody        ?? false,
      exclude_from_net: data.is_custody        ? true : (data.exclude_from_net ?? false),
      custody_for:      data.custody_for       || null,
    }
    if (editing) {
      const { data: updated, error } = await supabase.from('user_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else { setAccounts(prev => prev.map(a => a.id === editing.id ? updated : a)); toast({ title: 'Account updated', variant: 'success' }); setOpen(false) }
    } else {
      const { data: created, error } = await supabase.from('user_accounts').insert({ ...payload, user_id: userId, is_active: true }).select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else { setAccounts(prev => [...prev, created]); toast({ title: 'Account created', variant: 'success' }); setOpen(false) }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? Transactions linked to it will remain but unlinked.')) return
    const supabase = createClient()
    const { error } = await supabase.from('user_accounts').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setAccounts(prev => prev.filter(a => a.id !== id)); if (selectedAcc === id) setSelectedAcc(null); toast({ title: 'Account deleted' }) }
  }

  const onTransferSubmit = async (data: TransferFormData) => {
    const fromAccForGuard = accountsWithBalance.find(a => a.id === data.from_account_id)
    if (fromAccForGuard && !fromAccForGuard.overdraftAllowed) {
      const projectedBalance = (fromAccForGuard.balance ?? 0) - Number(data.amount)
      if (projectedBalance < 0) {
        const confirmed = confirm(`⚠ This will put ${fromAccForGuard.name} into a negative balance of ${formatCurrency(projectedBalance, fromAccForGuard.currency || 'GHS')}.\n\nProceed anyway?`)
        if (!confirmed) return
      }
    }
    setTransferLoading(true)
    const supabase = createClient()
    const fromAcc = accounts.find(a => a.id === data.from_account_id)
    const toAcc   = accounts.find(a => a.id === data.to_account_id)
    const isCrossCurrency = !!fromAcc && !!toAcc && fromAcc.currency !== toAcc.currency
    const rate = isCrossCurrency ? Number(data.exchange_rate) : 1
    const toAmount = Number(data.amount) * rate
    const { data: created, error } = await supabase.from('transfers').insert({
      user_id: userId, from_account_id: data.from_account_id, to_account_id: data.to_account_id,
      amount: data.amount, to_amount: toAmount, exchange_rate: rate, date: data.date, note: data.note || null,
    }).select().single()
    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' })
    } else {
      setTransfers(prev => [created, ...prev])
      toast({ title: isCrossCurrency ? `${formatCurrency(data.amount, fromAcc?.currency)} → ${formatCurrency(toAmount, toAcc?.currency)} transferred` : `${fmt(data.amount)} transferred successfully`, variant: 'success' })
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
    else { setTransfers(prev => prev.filter(t => t.id !== id)); toast({ title: 'Transfer deleted' }) }
  }

  const openDeposit = (acc: typeof accountsWithBalance[0]) => {
    setActionAccount(acc)
    depositForm.reset({ date: new Date().toISOString().split('T')[0], category: 'other', note: '' })
    setDepositOpen(true)
  }

  const openWithdraw = (acc: typeof accountsWithBalance[0]) => {
    setActionAccount(acc)
    withdrawForm.reset({ date: new Date().toISOString().split('T')[0], category: 'other', note: '' })
    setWithdrawOpen(true)
  }

  const openStatement = (acc: typeof accountsWithBalance[0]) => {
    setActionAccount(acc)
    setStmtDateFrom('')
    setStmtDateTo('')
    setStmtTypeFilter('all')
    setStatementOpen(true)
  }

  const onDepositSubmit = async (data: DepositFormData) => {
    if (!actionAccount) return
    setDepositLoading(true)
    const supabase = createClient()
    const { data: created, error } = await supabase.from('incomes').insert({
      user_id:    userId,
      title:      data.note || `Deposit to ${actionAccount.name}`,
      amount:     data.amount,
      category:   data.category,
      date:       data.date,
      account_id: actionAccount.id,
      notes:      data.note || null,
    }).select().single()
    if (error) {
      toast({ title: 'Deposit failed', description: error.message, variant: 'destructive' })
    } else {
      setLocalIncomes(prev => [...prev, { amount: data.amount, account_id: actionAccount.id, date: data.date }])
      toast({ title: `+${formatCurrency(data.amount, actionAccount.currency)} deposited to ${actionAccount.name}`, variant: 'success' })
      setDepositOpen(false)
    }
    setDepositLoading(false)
  }

  const onWithdrawSubmit = async (data: WithdrawFormData) => {
    if (!actionAccount) return
    // Balance guard
    const currentBal = actionAccount.balance ?? 0
    if (data.amount > currentBal && !actionAccount.overdraftAllowed) {
      const confirmed = confirm(
        `⚠ This will put ${actionAccount.name} into a negative balance of ${formatCurrency(currentBal - data.amount, actionAccount.currency)}.\n\n${ACCOUNT_TYPES.find(t => t.value === actionAccount.type)?.label} accounts normally cannot go negative.\n\nProceed anyway?`
      )
      if (!confirmed) return
    }
    setWithdrawLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').insert({
      user_id:        userId,
      title:          data.note || `Withdrawal from ${actionAccount.name}`,
      amount:         data.amount,
      category:       data.category,
      date:           data.date,
      account_id:     actionAccount.id,
      payment_method: 'bank_transfer',
      notes:          data.note || null,
    }).select().single()
    if (error) {
      toast({ title: 'Withdrawal failed', description: error.message, variant: 'destructive' })
    } else {
      setLocalExpenses(prev => [...prev, { amount: data.amount, account_id: actionAccount.id, date: data.date }])
      toast({ title: `-${formatCurrency(data.amount, actionAccount.currency)} withdrawn from ${actionAccount.name}`, variant: 'success' })
      setWithdrawOpen(false)
    }
    setWithdrawLoading(false)
  }

  // Statement helpers
  const getStatementRows = (acc: typeof accountsWithBalance[0]) => {
    const rows: { id: string; date: string; title: string; type: 'income' | 'expense' | 'transfer'; amount: number; balance?: number }[] = []

    localIncomes.filter(i => i.account_id === acc.id).forEach((i: any) => {
      rows.push({ id: i.id ?? Math.random().toString(), date: i.date ?? '', title: i.title || 'Income', type: 'income', amount: Number(i.amount) })
    })
    localExpenses.filter(e => e.account_id === acc.id).forEach((e: any) => {
      rows.push({ id: e.id ?? Math.random().toString(), date: e.date ?? '', title: e.title || 'Expense', type: 'expense', amount: -Number(e.amount) })
    })
    transfers.filter(t => t.from_account_id === acc.id || t.to_account_id === acc.id).forEach(t => {
      const isOut = t.from_account_id === acc.id
      rows.push({
        id: t.id, date: t.date,
        title: isOut ? `Transfer to ${getAccountName(t.to_account_id)}` : `Transfer from ${getAccountName(t.from_account_id)}`,
        type: 'transfer',
        amount: isOut ? -Number(t.amount) : Number(t.to_amount ?? t.amount),
      })
    })

    return rows
      .filter(r => {
        if (stmtTypeFilter !== 'all' && r.type !== stmtTypeFilter) return false
        if (stmtDateFrom && r.date < stmtDateFrom) return false
        if (stmtDateTo   && r.date > stmtDateTo)   return false
        return true
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r, i, arr) => {
        const runningBal = acc.opening_balance + arr.slice(0, i + 1).reduce((s, x) => s + x.amount, 0)
        return { ...r, balance: runningBal }
      })
  }

  const exportStatementPDF = (acc: typeof accountsWithBalance[0], rows: ReturnType<typeof getStatementRows>) => {
    const doc = new jsPDF()

    // jsPDF's default font lacks ₵ and other non-Latin symbols — strip them
    // to their ISO fallback so nothing renders as a replacement glyph (µ, ?, □).
    const CURRENCY_TEXT: Record<string, string> = {
      GHS: 'GHS', USD: 'USD', EUR: 'EUR', GBP: 'GBP',
      NGN: 'NGN', KES: 'KES', ZAR: 'ZAR',
    }
    const currLabel = CURRENCY_TEXT[acc.currency] ?? acc.currency

    // Replace any unicode currency symbols in a formatted amount string with
    // the plain ISO code so the PDF font can render it correctly.
    const safeFmt = (n: number) =>
      formatCurrency(n, acc.currency)
        .replace(/₵/g, 'GHS ')
        .replace(/\$/g, 'USD ')
        .replace(/€/g, 'EUR ')
        .replace(/£/g, 'GBP ')
        .replace(/₦/g, 'NGN ')
        .replace(/KSh/g, 'KES ')
        .replace(/R\s/g, 'ZAR ')

    doc.setFontSize(16)
    doc.text(`Account Statement - ${acc.name}`, 14, 20)
    doc.setFontSize(10)
    doc.text(`Currency: ${currLabel}  |  Opening Balance: ${safeFmt(acc.opening_balance)}`, 14, 30)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36)

    let y = 48
    doc.setFontSize(9)
    doc.text('Date', 14, y)
    doc.text('Description', 45, y)
    doc.text('Amount', 130, y)
    doc.text('Balance', 165, y)
    y += 4
    doc.line(14, y, 196, y)
    y += 5

    rows.forEach(r => {
      if (y > 275) { doc.addPage(); y = 20 }
      doc.text(r.date, 14, y)
      doc.text(r.title.slice(0, 40), 45, y)
      const amtStr = (r.amount >= 0 ? '+' : '') + safeFmt(Math.abs(r.amount))
      doc.text(amtStr, 130, y)
      doc.text(safeFmt(r.balance ?? 0), 165, y)
      y += 7
    })

    doc.save(`statement-${acc.name.replace(/\s+/g, '-')}.pdf`)
  }

  const exportStatementExcel = (acc: typeof accountsWithBalance[0], rows: ReturnType<typeof getStatementRows>) => {
    const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
      Date: r.date, Description: r.title, Type: r.type,
      Amount: r.amount, Balance: r.balance ?? 0, Currency: acc.currency,
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Statement')
    XLSX.writeFile(wb, `statement-${acc.name.replace(/\s+/g, '-')}.xlsx`)
  }

  const exportStatementCSV = (acc: typeof accountsWithBalance[0], rows: ReturnType<typeof getStatementRows>) => {
    const header = 'Date,Description,Type,Amount,Balance,Currency\n'
    const body   = rows.map(r => `${r.date},"${r.title}",${r.type},${r.amount},${r.balance ?? 0},${acc.currency}`).join('\n')
    const blob   = new Blob([header + body], { type: 'text/csv' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a'); a.href = url; a.download = `statement-${acc.name.replace(/\s+/g, '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            <Wallet className="w-5 h-5" /> Wallets
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your bank accounts, mobile money wallets, cash wallets, savings accounts, and foreign currency accounts.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {accounts.length >= 2 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowHistory(h => !h)
                  if (!showHistory) {
                    toast({
                      title: 'Transfer History',
                      description: 'Scroll down to see your transfer history below the accounts.',
                      variant: 'success',
                    })
                  }
                }}
                className="gap-2 h-9 text-sm transition-colors"
                style={showHistory ? {
                  background: theme.colors.primary,
                  color: '#fff',
                  borderColor: theme.colors.primary,
                } : {}}
              >
                <History className="w-4 h-4" /> Transfer History
                {transfers.length > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={showHistory
                      ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                      : { background: theme.colors.primary + '20', color: theme.colors.primary }
                    }
                  >
                    {transfers.length}
                  </span>
                )}
              </Button>
              <Button variant="outline" onClick={() => { transferForm.reset({ date: new Date().toISOString().split('T')[0] }); setTransferOpen(true) }} className="gap-2 h-9 text-sm">
                <ArrowLeftRight className="w-4 h-4" /> Transfer Money
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              if (!selectedAccount) {
                toast({ title: 'Select a wallet first', description: 'Click any wallet card to select it, then export its statement.', variant: 'destructive' })
                return
              }
              openStatement(selectedAccount)
            }}
            variant="outline" className="gap-2 h-9 text-sm"
          >
            <Download className="w-4 h-4" /> Export Statement
          </Button>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }} className="gap-2 h-9 text-sm">
            <Plus className="w-4 h-4" /> Add Wallet
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Total Wallet Balance" value={fmt(totalBalance)} sub={`${accounts.length} account(s)`} colorClass="" icon={Wallet} accentColor="#16a34a"
          avgValue={accounts.length > 0 ? `${fmt(totalBalance / accounts.length)} / account` : undefined}
          topSource={topBalanceAccount && (topBalanceAccount.balance ?? 0) > 0 ? `${topBalanceAccount.name} (${fmt(topBalanceAccount.balance ?? 0)})` : undefined}
          tooltip={`Sum of every account's current balance\n${accountsWithBalance.map(a => `${a.name}: ${formatCurrency(a.balance ?? 0, a.currency)}`).join('\n')}`}
        />
        <KPICard label="Total Money Received" value={fmt(totalIncome)} sub={`${incomes.length} transaction(s)`} colorClass="" icon={ArrowUpRight} accentColor="#3b82f6"
          prevValue={lastMonthIncome !== null ? fmt(lastMonthIncome) : undefined} prevLabel="Last month"
          sparkData={incomeSeries.length > 1 ? incomeSeries : undefined}
          topSource={topIncomeAccount && (topIncomeAccount.total_income ?? 0) > 0 ? `${topIncomeAccount.name} (${fmt(topIncomeAccount.total_income ?? 0)})` : undefined}
        />
        <KPICard label="Total Money Spent" value={fmt(totalExpenses)} sub={`${expenses.length} transaction(s)`} colorClass="" icon={ArrowDownRight} accentColor="#ef4444"
          prevValue={lastMonthExpense !== null ? fmt(lastMonthExpense) : undefined} prevLabel="Last month"
          sparkData={expenseSeries.length > 1 ? expenseSeries : undefined}
          topSource={topExpenseAccount && (topExpenseAccount.total_expenses ?? 0) > 0 ? `${topExpenseAccount.name} (${fmt(topExpenseAccount.total_expenses ?? 0)})` : undefined}
        />
        <KPICard label="Total Transfers" value={String(totalTransfers)} sub={`${transfers.length} transfer(s)`} colorClass="" icon={ArrowLeftRight} accentColor="#8b5cf6"
          tooltip="Total number of transfers between your accounts"
        />
        <KPICard label="Active Wallets" value={String(activeCount)} sub={`${accounts.length} total`} colorClass="" icon={CheckCircle2} accentColor="#0891b2"
          tooltip="Number of active accounts"
        />
      </div>

      {/* ── Search, Filter, Sort bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search wallet..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-white text-sm" />
        </div>
        <div className="flex gap-1 p-1 bg-white border border-border rounded-lg overflow-x-auto flex-shrink-0">
          {TYPE_FILTER_LABELS.map(f => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap"
              style={typeFilter === f.value ? { background: theme.colors.primary, color: '#fff' } : { color: '#64748b' }}>
              {f.label}
            </button>
          ))}
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 h-9 text-xs bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={() => setShowBalances(v => !v)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
          {showBalances ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showBalances ? 'Hide Acc Balance' : 'Show Acc Balance'}
        </button>
      </div>

      {/* ── Account count label ── */}
      {filteredAccounts.length > 0 && (
        <p className="text-xs text-muted-foreground">{filteredAccounts.length} Wallet{filteredAccounts.length !== 1 ? 's' : ''}</p>
      )}

      {/* ── Main Content: Cards + Detail Panel ── */}
      <div className={`flex gap-5 ${selectedAccount ? 'flex-col lg:flex-row' : ''}`}>

        {/* ── Account Cards Grid ── */}
        <div className={selectedAccount ? 'flex-1 min-w-0' : 'w-full'}>
          {accountsWithBalance.length === 0 ? (
            <Card className="bg-white p-12 text-center rounded-xl">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold text-lg mb-1">No accounts yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Add your bank accounts, mobile money, or cash wallets to track balances</p>
              <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
                <Plus className="w-4 h-4 mr-1" /> Add Your First Account
              </Button>
            </Card>
          ) : filteredAccounts.length === 0 ? (
            <Card className="bg-white p-12 text-center rounded-xl">
              <Search className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">No accounts match your filters</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAccounts.map(acc => {
                const Icon      = getIcon(acc.type)
                const color     = acc.overdraftStatus === 'overdraft' ? '#d97706' : acc.overdraftStatus === 'blocked' ? '#dc2626' : ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
                const typeLabel = ACCOUNT_TYPES.find(t => t.value === acc.type)?.label || acc.type
                const isSelected = selectedAcc === acc.id
                const isStarred  = starredAccs.has(acc.id)

                return (
                  <Card
                    key={acc.id}
                    onClick={() => setSelectedAcc(isSelected ? null : acc.id)}
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'shadow-md' : 'border-border'
                    }`}
                    style={isSelected ? { boxShadow: `0 0 0 2px ${color}`, borderColor: color + '60' } : {}}
                  >
                    <div className="h-1.5" style={{ background: color }} />
                    <CardContent className="p-4">

                      {/* Card header */}
                      <div className="flex items-start justify-between mb-3 gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
                            <Icon className="w-5 h-5" style={{ color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm truncate">{acc.name}</p>
                              {(acc as any).is_primary && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: color + '20', color }}>Primary</span>
                              )}
                            </div>
                            {(acc as any).is_custody && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700 mt-0.5">
                                <Users className="w-2.5 h-2.5" />
                                Custody{(acc as any).custody_for ? `: ${(acc as any).custody_for}` : ''}
                              </span>
                            )}
                            {!(acc as any).is_custody && (acc as any).exclude_from_net && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 text-orange-700 mt-0.5">
                                <ShieldOff className="w-2.5 h-2.5" /> Excluded from Net Worth
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{typeLabel}{acc.institution ? ` · ${acc.institution}` : ''}</p>
                          </div>
                        </div>
                        {/* Actions row */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleStar(acc.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                            {isStarred ? <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> : <Star className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                          <button onClick={() => openEdit(acc)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(acc.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>

                      {/* Overdraft badge */}
                      {acc.overdraftStatus === 'overdraft' && (
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                          <AlertTriangle className="w-3 h-3" /> Overdraft — {formatCurrency(Math.abs(acc.balance), acc.currency || 'GHS')} overdrawn
                        </div>
                      )}
                      {acc.overdraftStatus === 'blocked' && (
                        <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-lg">
                          <AlertTriangle className="w-3 h-3" /> Negative balance — review transactions
                        </div>
                      )}

                      {/* Balance */}
                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Current Balance</p>
                        {showBalances ? (
                          <p className="text-xl font-bold tabular-nums" style={{ color }}>
                            {formatCurrency(acc.balance ?? 0, acc.currency)}
                          </p>
                        ) : (
                          <p className="text-xl font-bold text-muted-foreground">••••••</p>
                        )}
                        {acc.opening_balance > 0 && showBalances && (
                          <p className="text-xs text-muted-foreground mt-0.5">Opening: {formatCurrency(acc.opening_balance, acc.currency)}</p>
                        )}
                      </div>

                      {/* Received / Spent */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                            <p className="text-xs text-muted-foreground">Received</p>
                          </div>
                          <p className="text-sm font-semibold text-green-600 tabular-nums">
                            {showBalances ? formatCurrency(acc.total_income ?? 0, acc.currency) : '••••'}
                            {acc.total_income > 0 && showBalances && (
                              <span className="text-[10px] text-green-500 ml-1">▲ {Math.round((acc.total_income / Math.max(1, acc.total_income + acc.total_expenses)) * 100)}%</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
                            <p className="text-xs text-muted-foreground">Spent</p>
                          </div>
                          <p className="text-sm font-semibold text-red-500 tabular-nums">
                            {showBalances ? formatCurrency(acc.total_expenses ?? 0, acc.currency) : '••••'}
                            {acc.total_expenses > 0 && showBalances && (
                              <span className="text-[10px] text-red-400 ml-1">▼ {Math.round((acc.total_expenses / Math.max(1, acc.total_income + acc.total_expenses)) * 100)}%</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Last transaction + count */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Last Transaction
                        </span>
                        <span>{acc.txnCount} Transaction{acc.txnCount !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Quick action buttons */}
                      <div className="grid grid-cols-4 gap-1" onClick={e => e.stopPropagation()}>
                        {[
                          { icon: ArrowUpRight,   label: 'Deposit',   action: 'deposit'   as const, color: '#16a34a' },
                          { icon: ArrowDownRight, label: 'Withdraw',  action: 'withdraw'  as const, color: '#ef4444' },
                          { icon: ArrowLeftRight, label: 'Transfer',  action: 'transfer'  as const, color: '#2563eb' },
                          { icon: FileText,       label: 'Statement', action: 'statement' as const, color: '#7c3aed' },
                        ].map(({ icon: BtnIcon, label, action, color: btnColor }) => (
                          <button
                            key={action}
                            onClick={() => {
                              if (action === 'transfer' || label === 'Transfer') {
                            transferForm.reset({ from_account_id: acc.id, date: new Date().toISOString().split('T')[0] })
                            setTransferOpen(true)
                          } else if (action === 'deposit' || label === 'Deposit') {
                            openDeposit(acc)
                          } else if (action === 'withdraw' || label === 'Withdraw') {
                            openWithdraw(acc)
                          } else if (action === 'statement' || label === 'Statement') {
                            openStatement(acc)
                          }
                            }}
                            className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-muted/60 transition-colors group"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: btnColor + '15' }}>
                              <BtnIcon className="w-3.5 h-3.5" style={{ color: btnColor }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground">{label}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Detail Panel ── */}
        {selectedAccount && (() => {
          const acc   = selectedAccount
          const color = acc.overdraftStatus === 'overdraft' ? '#d97706' : acc.overdraftStatus === 'blocked' ? '#dc2626' : ACCOUNT_TYPE_COLORS[acc.type] || '#94a3b8'
          const Icon  = getIcon(acc.type)
          const recentTxns = [
            ...transfers.filter(t => t.from_account_id === acc.id || t.to_account_id === acc.id).map(t => ({
              id: t.id, date: t.date, title: t.from_account_id === acc.id ? `Transfer to ${getAccountName(t.to_account_id)}` : `Transfer from ${getAccountName(t.from_account_id)}`,
              amount: t.from_account_id === acc.id ? -Number(t.amount) : Number(t.to_amount ?? t.amount), type: 'transfer' as const,
            })),
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8)

          return (
            <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden sticky top-4">
                <div className="h-1.5" style={{ background: color }} />
                <CardContent className="p-4 space-y-4">

                  {/* Panel header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{acc.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#16a34a20', color: '#16a34a' }}>Active</span>
                          {(acc as any).is_primary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: color + '20', color }}>Primary Wallet</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedAcc(null)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Balance */}
                  <div className="bg-muted/30 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Current Balance</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color }}>{formatCurrency(acc.balance ?? 0, acc.currency)}</p>
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Opening Balance</span>
                        <span className="font-medium">{formatCurrency(acc.opening_balance, acc.currency)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Available Balance</span>
                        <span className="font-medium text-foreground">{formatCurrency(acc.balance ?? 0, acc.currency)}</span>
                      </div>
                      {acc.currency !== 'GHS' && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Currency</span>
                          <span className="font-semibold" style={{ color }}>{acc.currency}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { icon: ArrowUpRight,   label: 'Deposit',   color: '#16a34a' },
                      { icon: ArrowDownRight, label: 'Withdraw',  color: '#ef4444' },
                      { icon: ArrowLeftRight, label: 'Transfer',  color: '#2563eb' },
                      { icon: FileText,       label: 'Statement', color: '#7c3aed' },
                    ].map(({ icon: BtnIcon, label, color: btnColor }) => (
                      <button key={label}
                        onClick={() => {
                       if (label === 'Transfer') {
                         transferForm.reset({
                           from_account_id: acc.id,
                          date: new Date().toISOString().split('T')[0]
                         })
                        setTransferOpen(true)
                       } else if (label === 'Deposit') {
                        openDeposit(acc)
                       } else if (label === 'Withdraw') {
                       openWithdraw(acc)
                      } else if (label === 'Statement') {
                       openStatement(acc)
                       }
                     }}
                        className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl hover:bg-muted/60 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: btnColor + '15' }}>
                          <BtnIcon className="w-4 h-4" style={{ color: btnColor }} />
                        </div>
                        <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Monthly Cash Flow */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold">Monthly Cash Flow</p>
                      <span className="text-[10px] text-muted-foreground">This Month</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Received</p>
                        <p className="font-bold text-green-600 tabular-nums">{formatCurrency(acc.total_income, acc.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Spent</p>
                        <p className="font-bold text-red-500 tabular-nums">{formatCurrency(acc.total_expenses, acc.currency)}</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground">Net Cash Flow</p>
                      <p className={`font-bold tabular-nums ${acc.total_income - acc.total_expenses >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatCurrency(acc.total_income - acc.total_expenses, acc.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Balance Trend chart */}
                  {acc.trendData.length > 1 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Balance Trend <span className="text-muted-foreground font-normal">(This Month)</span></p>
                      <div style={{ height: 80 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={acc.trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id={`grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis hide />
                            <Tooltip
                              formatter={(v: any) => [formatCurrency(Number(v), acc.currency), 'Net']}
                              labelFormatter={() => ''}
                              contentStyle={{ fontSize: 10, borderRadius: 8 }}
                            />
                            <Area type="monotone" dataKey="net" stroke={color} strokeWidth={1.5} fill={`url(#grad-${acc.id})`} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Recent Transfers */}
                  {recentTxns.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">Recent Transactions</p>
                        <button className="text-[10px] font-semibold" style={{ color: theme.colors.primary }}>View All</button>
                      </div>
                      <div className="space-y-2">
                        {recentTxns.map(txn => (
                          <div key={txn.id} className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${txn.amount >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                              {txn.amount >= 0
                                ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                                : <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{txn.title}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(txn.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${txn.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {txn.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(txn.amount), acc.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
          )
        })()}
      </div>

      {/* ── Transfer History Panel ── */}
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
              <div>
                {transfers.map(t => {
                  const fromCur = getAccountCurrency(t.from_account_id)
                  const toCur   = getAccountCurrency(t.to_account_id)
                  const isCross = !!t.to_amount && fromCur !== toCur
                  return (
                    <div key={t.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 group gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-medium flex-wrap">
                            <span className="truncate">{getAccountName(t.from_account_id)}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{getAccountName(t.to_account_id)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDate(t.date)}{t.note ? ` · ${t.note}` : ''}
                            {isCross && t.exchange_rate ? ` · Rate: ${t.exchange_rate}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {isCross ? (
                          <span className="text-sm font-semibold tabular-nums text-blue-600 text-right">
                            {formatCurrency(Number(t.amount), fromCur)}
                            <span className="text-muted-foreground"> → </span>
                            {formatCurrency(Number(t.to_amount), toCur)}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold tabular-nums text-blue-600">{formatCurrency(Number(t.amount), fromCur)}</span>
                        )}
                        <button onClick={() => handleDeleteTransfer(t.id)} className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Total Balance footer ── */}
      {accountsWithBalance.length > 0 && (() => {
        const byCurrency: Record<string, number> = {}
        accountsWithBalance.forEach(a => {
          const cur = a.currency || 'GHS'
          byCurrency[cur] = (byCurrency[cur] || 0) + (a.balance ?? 0)
        })
        return (
          <Card className="bg-white rounded-xl shadow-sm border border-border">
            <CardContent className="py-3 px-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold">Total Balance</p>
                  <p className="text-[10px] text-muted-foreground">
                    Shown separately per currency — <span className="text-primary font-medium">amounts are not combined</span>
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {Object.entries(byCurrency).map(([cur, amt]) => (
                    <div key={cur} className="text-right">
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(amt, cur)}</p>
                      <p className="text-[10px] text-muted-foreground">{cur}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* ── Tip card ── */}
      {accounts.length > 0 && (
        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> When adding income or expenses, select which account the money came from or went to. Use the Transfer button to move money between your accounts.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ══ Add / Edit Account Dialog ══════════════════════════════ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input placeholder="e.g. GCB Savings, MTN MoMo, Cash Wallet" {...accountForm.register('name')} />
              {accountForm.formState.errors.name && <p className="text-xs text-destructive">{accountForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Account Type</Label>
              <Select onValueChange={v => { accountForm.setValue('type', v); if (!editing) accountForm.setValue('allow_negative', v === 'bank') }} defaultValue={editing?.type}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {accountForm.formState.errors.type && <p className="text-xs text-destructive">{accountForm.formState.errors.type.message}</p>}
            </div>

            {/* Allow Negative Balance */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-semibold">Allow Negative Balance</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {accountForm.watch('type') === 'bank' ? 'Bank accounts can have an overdraft facility.' : 'Enable only if this account can technically go below zero.'}
                </p>
              </div>
              <button type="button" onClick={() => accountForm.setValue('allow_negative', !accountForm.watch('allow_negative'))}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${accountForm.watch('allow_negative') ? 'bg-amber-500' : 'bg-muted'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${accountForm.watch('allow_negative') ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Custody Account */}
            <div className={`rounded-xl border-2 transition-all ${accountForm.watch('is_custody') ? 'border-violet-300 bg-violet-50' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center justify-between p-3">
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${accountForm.watch('is_custody') ? 'bg-violet-100' : 'bg-muted'}`}>
                    <Users className={`w-4 h-4 ${accountForm.watch('is_custody') ? 'text-violet-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">Custody Account</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Money held on behalf of other people or groups. Excluded from your personal net worth automatically.</p>
                  </div>
                </div>
                <button type="button" onClick={() => { const next = !accountForm.getValues('is_custody'); accountForm.setValue('is_custody', next); accountForm.setValue('exclude_from_net', next) }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${accountForm.watch('is_custody') ? 'bg-violet-500' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${accountForm.watch('is_custody') ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              {accountForm.watch('is_custody') && (
                <div className="px-3 pb-3 space-y-1.5 border-t border-violet-200 pt-3">
                  <Label className="text-xs text-violet-700 font-semibold">Held on behalf of</Label>
                  <Input placeholder="e.g. UCT Church Group, Family Fund, John Doe..." {...accountForm.register('custody_for')} className="bg-white border-violet-200 text-sm" />
                  <p className="text-[10px] text-violet-600">This label will appear on the account card as a reminder.</p>
                </div>
              )}
            </div>

            {/* Exclude from Net Worth */}
            {!accountForm.watch('is_custody') && (
              <div className={`rounded-xl border-2 transition-all ${accountForm.watch('exclude_from_net') ? 'border-orange-300 bg-orange-50' : 'border-border bg-muted/30'}`}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${accountForm.watch('exclude_from_net') ? 'bg-orange-100' : 'bg-muted'}`}>
                      <ShieldOff className={`w-4 h-4 ${accountForm.watch('exclude_from_net') ? 'text-orange-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Exclude from Net Worth</p>
                      <p className="text-xs text-muted-foreground mt-0.5">This account's balance won't count toward your personal net worth or wealth tracker totals.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => accountForm.setValue('exclude_from_net', !accountForm.watch('exclude_from_net'))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${accountForm.watch('exclude_from_net') ? 'bg-orange-500' : 'bg-muted'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${accountForm.watch('exclude_from_net') ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Institution / Provider <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="e.g. GCB Bank, MTN, Ecobank" {...accountForm.register('institution')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Opening Balance</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...accountForm.register('opening_balance')} />
                <p className="text-xs text-muted-foreground">Balance before using this app</p>
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select onValueChange={v => accountForm.setValue('currency', v)} defaultValue={editing?.currency ?? appCurrency ?? 'GHS'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {allCurrencies.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Account'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ Transfer Dialog ════════════════════════════════════════ */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" /> Transfer Between Accounts</DialogTitle>
          </DialogHeader>
          <form onSubmit={transferForm.handleSubmit(onTransferSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>From Account</Label>
              <Select onValueChange={v => { transferForm.setValue('from_account_id', v); transferForm.setValue('exchange_rate', undefined as any) }} defaultValue={transferForm.getValues('from_account_id')}>
                <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                <SelectContent>
                  {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance ?? 0, a.currency)})</SelectItem>)}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.from_account_id && <p className="text-xs text-destructive">{transferForm.formState.errors.from_account_id.message}</p>}
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
              <Select onValueChange={v => { transferForm.setValue('to_account_id', v); transferForm.setValue('exchange_rate', undefined as any) }}>
                <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                <SelectContent>
                  {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance ?? 0, a.currency)})</SelectItem>)}
                </SelectContent>
              </Select>
              {transferForm.formState.errors.to_account_id && <p className="text-xs text-destructive">{transferForm.formState.errors.to_account_id.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...transferForm.register('amount')} />
                {transferForm.formState.errors.amount && <p className="text-xs text-destructive">{transferForm.formState.errors.amount.message}</p>}
                {fromAccountSelected && <p className="text-xs text-muted-foreground">In {fromAccountSelected.currency}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...transferForm.register('date')} />
              </div>
            </div>
            {isCrossCurrencyTransfer && (
              <div className="space-y-1.5">
                <Label>Exchange Rate <span className="text-muted-foreground text-xs ml-1">(1 {fromAccountSelected?.currency} = ? {toAccountSelected?.currency})</span></Label>
                <Input type="number" step="0.000001" placeholder="e.g. 12.5" {...transferForm.register('exchange_rate')} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Moving savings to bank" {...transferForm.register('note')} />
            </div>
            {transferForm.watch('from_account_id') && transferForm.watch('to_account_id') && Number(transferForm.watch('amount')) > 0 && (!isCrossCurrencyTransfer || Number(transferForm.watch('exchange_rate')) > 0) && (
              <div className="p-3 rounded-xl text-sm" style={{ background: theme.colors.primaryPale }}>
                <p className="font-medium" style={{ color: theme.colors.primary }}>Transfer Summary</p>
                {isCrossCurrencyTransfer ? (
                  <p className="text-muted-foreground mt-1">
                    {formatCurrency(Number(transferForm.watch('amount')), fromAccountSelected?.currency)} from <strong>{getAccountName(transferForm.watch('from_account_id'))}</strong> → {formatCurrency(convertedAmount, toAccountSelected?.currency)} into <strong>{getAccountName(transferForm.watch('to_account_id'))}</strong>
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1">
                    {fmt(Number(transferForm.watch('amount')))} from <strong>{getAccountName(transferForm.watch('from_account_id'))}</strong> to <strong>{getAccountName(transferForm.watch('to_account_id'))}</strong>
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={transferLoading} style={{ background: theme.colors.primary, color: '#fff' }}>
                {transferLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Transfer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══ Deposit Dialog ════════════════════════════════════════ */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-green-600" /> Deposit Funds
            </DialogTitle>
          </DialogHeader>
          {actionAccount && (
            <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-4">
              <div className="bg-green-50 rounded-xl p-3 text-sm">
                <p className="font-semibold">{actionAccount.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current balance: <span className="font-semibold text-green-700">{formatCurrency(actionAccount.balance ?? 0, actionAccount.currency)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Amount ({actionAccount.currency})</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...depositForm.register('amount')} autoFocus />
                {depositForm.formState.errors.amount && <p className="text-xs text-destructive">{depositForm.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...depositForm.register('date')} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={depositForm.watch('category')} onValueChange={v => depositForm.setValue('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['salary','freelance','business','investment','rental','gift','bonus','other'].map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="e.g. Salary payment, Cash deposit..." {...depositForm.register('note')} />
              </div>
              {Number(depositForm.watch('amount')) > 0 && (
                <div className="bg-green-50 rounded-xl p-3 text-sm flex justify-between">
                  <span className="text-muted-foreground">New balance</span>
                  <span className="font-bold text-green-700 tabular-nums">
                    {formatCurrency((actionAccount.balance ?? 0) + Number(depositForm.watch('amount')), actionAccount.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setDepositOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={depositLoading} className="bg-green-600 text-white hover:bg-green-700">
                  {depositLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deposit'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ Withdraw Dialog ═══════════════════════════════════════ */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-red-500" /> Withdraw Funds
            </DialogTitle>
          </DialogHeader>
          {actionAccount && (
            <form onSubmit={withdrawForm.handleSubmit(onWithdrawSubmit)} className="space-y-4">
              <div className="bg-red-50 rounded-xl p-3 text-sm">
                <p className="font-semibold">{actionAccount.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Available: <span className="font-semibold text-red-600">{formatCurrency(actionAccount.balance ?? 0, actionAccount.currency)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Amount ({actionAccount.currency})</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...withdrawForm.register('amount')} autoFocus />
                {withdrawForm.formState.errors.amount && <p className="text-xs text-destructive">{withdrawForm.formState.errors.amount.message}</p>}
                {Number(withdrawForm.watch('amount')) > (actionAccount.balance ?? 0) && !actionAccount.overdraftAllowed && (
                  <p className="text-xs text-orange-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Exceeds available balance — you'll be prompted to confirm
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...withdrawForm.register('date')} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={withdrawForm.watch('category')} onValueChange={v => withdrawForm.setValue('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['food & dining','transport','utilities','healthcare','education','entertainment','shopping','savings','debt payment','other'].map(c => (
                      <SelectItem key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input placeholder="e.g. ATM withdrawal, Bill payment..." {...withdrawForm.register('note')} />
              </div>
              {Number(withdrawForm.watch('amount')) > 0 && (
                <div className={`rounded-xl p-3 text-sm flex justify-between ${(actionAccount.balance ?? 0) - Number(withdrawForm.watch('amount')) < 0 ? 'bg-red-50' : 'bg-muted/50'}`}>
                  <span className="text-muted-foreground">New balance</span>
                  <span className={`font-bold tabular-nums ${(actionAccount.balance ?? 0) - Number(withdrawForm.watch('amount')) < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency((actionAccount.balance ?? 0) - Number(withdrawForm.watch('amount')), actionAccount.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={withdrawLoading} className="bg-red-600 text-white hover:bg-red-700">
                  {withdrawLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ Statement Dialog ══════════════════════════════════════ */}
      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-600" />
              Account Statement — {actionAccount?.name}
            </DialogTitle>
          </DialogHeader>
          {actionAccount && (() => {
            const rows = getStatementRows(actionAccount)
            const totalIn  = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0)
            const totalOut = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0)
            const netFlow  = totalIn - totalOut
            return (
              <div className="space-y-4">
                {/* Account info */}
                <div className="bg-muted/30 rounded-xl p-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Currency</p>
                    <p className="font-semibold">{actionAccount.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Opening Balance</p>
                    <p className="font-semibold">{formatCurrency(actionAccount.opening_balance, actionAccount.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Balance</p>
                    <p className="font-semibold" style={{ color: ACCOUNT_TYPE_COLORS[actionAccount.type] }}>{formatCurrency(actionAccount.balance ?? 0, actionAccount.currency)}</p>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap items-end">
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={stmtDateFrom} onChange={e => setStmtDateFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={stmtDateTo} onChange={e => setStmtDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={stmtTypeFilter} onValueChange={(v: any) => setStmtTypeFilter(v)}>
                      <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => exportStatementPDF(actionAccount, rows)}>
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => exportStatementExcel(actionAccount, rows)}>
                      <Download className="w-3 h-3" /> Excel
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => exportStatementCSV(actionAccount, rows)}>
                      <Download className="w-3 h-3" /> CSV
                    </Button>
                  </div>
                </div>

                {/* Summary totals */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-600 font-semibold">Total In</p>
                    <p className="font-bold text-green-700 tabular-nums">{formatCurrency(totalIn, actionAccount.currency)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-red-600 font-semibold">Total Out</p>
                    <p className="font-bold text-red-600 tabular-nums">{formatCurrency(totalOut, actionAccount.currency)}</p>
                  </div>
                  <div className={`rounded-xl p-3 ${netFlow >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                    <p className={`text-xs font-semibold ${netFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net Flow</p>
                    <p className={`font-bold tabular-nums ${netFlow >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow, actionAccount.currency)}
                    </p>
                  </div>
                </div>

                {/* Transaction table */}
                {rows.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No transactions match the selected filters</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      <span className="col-span-2">Date</span>
                      <span className="col-span-4">Description</span>
                      <span className="col-span-2">Type</span>
                      <span className="col-span-2 text-right">Amount</span>
                      <span className="col-span-2 text-right">Balance</span>
                    </div>
                    <div className="divide-y divide-border max-h-72 overflow-y-auto">
                      {rows.map(r => (
                        <div key={r.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                          <span className="col-span-2 text-muted-foreground tabular-nums">{r.date}</span>
                          <span className="col-span-4 truncate font-medium">{r.title}</span>
                          <span className="col-span-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${
                              r.type === 'income'   ? 'bg-green-100 text-green-700' :
                              r.type === 'expense'  ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{r.type}</span>
                          </span>
                          <span className={`col-span-2 text-right font-semibold tabular-nums ${r.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {r.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(r.amount), actionAccount.currency)}
                          </span>
                          <span className="col-span-2 text-right tabular-nums text-muted-foreground">
                            {formatCurrency(r.balance ?? 0, actionAccount.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30 text-xs font-semibold border-t border-border">
                      <span className="col-span-8">{rows.length} transaction{rows.length !== 1 ? 's' : ''}</span>
                      <span className={`col-span-2 text-right ${netFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow, actionAccount.currency)}
                      </span>
                      <span className="col-span-2 text-right">{formatCurrency(actionAccount.balance ?? 0, actionAccount.currency)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setStatementOpen(false)}>Close</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

    </div>
  )
}