'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Loader2, TrendingUp, TrendingDown,
  Landmark, Car, Gem, Smartphone, BarChart3, Bitcoin,
  Building2, CreditCard, AlertTriangle, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, PiggyBank, MoreVertical,
  MapPin, Calendar, ShieldCheck, DollarSign,
  TrendingDown as DepIcon,
  Banknote, Wallet2, Coins, Smartphone as PhoneIcon,
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
import type { Asset, Investment, Debt, Loan } from '@/types'
import { AssetDetailPanel } from './wealth-asset-detail'
import { KPICard } from '@/components/ui/kpi-card'
import { WealthPremiumSections } from './wealth-premium-sections'

const fmt = (n: number) => formatCurrency(n, 'GHS')

// ── Constants ─────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: 'property',    label: 'Property',      icon: Building2  },
  { value: 'vehicle',     label: 'Vehicle',       icon: Car        },
  { value: 'electronics', label: 'Electronics',   icon: Smartphone },
  { value: 'jewelry',     label: 'Jewelry',       icon: Gem        },
  { value: 'other',       label: 'Other',         icon: Landmark   },
]

const LIQUID_ASSET_SUBTYPES = [
  { value: 'cash_in_hand',  label: 'Cash in Hand',    icon: Banknote  },
  { value: 'bank_account',  label: 'Bank Account',    icon: Building2 },
  { value: 'mobile_money',  label: 'Mobile Money',    icon: PhoneIcon },
  { value: 'savings',       label: 'Savings Account', icon: PiggyBank },
  { value: 'fixed_deposit', label: 'Fixed Deposit',   icon: Coins     },
  { value: 'treasury_bill', label: 'Treasury Bill',   icon: Landmark  },
  { value: 'other_liquid',  label: 'Other Liquid',    icon: Wallet2   },
]

const INVESTMENT_TYPES = [
  { value: 'stocks',        label: 'Stocks',        icon: BarChart3  },
  { value: 'crypto',        label: 'Crypto',        icon: Bitcoin    },
  { value: 'mutual_funds',  label: 'Mutual Funds',  icon: PiggyBank  },
  { value: 'bonds',         label: 'Bonds',         icon: Landmark   },
  { value: 'fixed_deposit', label: 'Fixed Deposit', icon: Building2  },
  { value: 'real_estate',   label: 'Real Estate',   icon: Building2  },
  { value: 'other',         label: 'Other',         icon: TrendingUp },
]

const DEBT_TYPES = [
  { value: 'credit_card',       label: 'Credit Card'       },
  { value: 'overdraft',         label: 'Overdraft'         },
  { value: 'buy_now_pay_later', label: 'Buy Now Pay Later' },
  { value: 'other',             label: 'Other'             },
]

const LOAN_TYPES = [
  { value: 'mortgage', label: 'Mortgage'      },
  { value: 'personal', label: 'Personal Loan' },
  { value: 'car',      label: 'Car Loan'      },
  { value: 'student',  label: 'Student Loan'  },
  { value: 'business', label: 'Business Loan' },
  { value: 'other',    label: 'Other'         },
]

const ASSET_STATUSES = [
  { value: 'active',      label: 'Active',      color: '#16a34a' },
  { value: 'sold',        label: 'Sold',        color: '#2563eb' }, // kept for StatusBadge color lookups; not selectable in the main filter anymore
  { value: 'disposed',    label: 'Disposed',    color: '#dc2626' },
  { value: 'donated',     label: 'Donated',     color: '#9333ea' },
  { value: 'lost',        label: 'Lost',        color: '#f59e0b' },
  { value: 'maintenance', label: 'Maintenance', color: '#0891b2' },
]

const SELECTABLE_ASSET_STATUSES = ASSET_STATUSES.filter(s => s.value !== 'sold')

const ASSET_CONDITIONS = [
  { value: 'new',       label: 'New'       },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good'      },
  { value: 'fair',      label: 'Fair'      },
  { value: 'poor',      label: 'Poor'      },
]

const DEPRECIATION_METHODS = [
  { value: 'straight_line',     label: 'Straight Line'     },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'none',              label: 'None / Manual'     },
]

const SECTION_COLORS = {
  asset:      { bg: '#16a34a', light: '#dcfce7', text: '#15803d' },
  investment: { bg: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
  debt:       { bg: '#dc2626', light: '#fee2e2', text: '#b91c1c' },
  loan:       { bg: '#f59e0b', light: '#fef3c7', text: '#d97706' },
}

const INVEST_INCOME_TYPES = [
  { value: 'investment',   label: 'Investment Return' },
  { value: 'dividend',     label: 'Dividend'          },
  { value: 'interest',     label: 'Interest'          },
  { value: 'capital_gain', label: 'Capital Gain'      },
  { value: 'top_up',       label: 'Top-up / Deposit'  },
  { value: 'other',        label: 'Other'             },
]

// ── Helpers ───────────────────────────────────────────────────────────

function calcDepreciation(asset: any) {
  const purchaseVal  = Number(asset.purchase_value ?? 0)
  const rate         = Number(asset.annual_depreciation_rate ?? 0)
  const method       = asset.depreciation_method ?? 'none'
  const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null
  if (!purchaseDate || !rate || method === 'none' || purchaseVal === 0) {
    return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0 }
  }
  const yearsElapsed = Math.max(0, (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (method === 'straight_line') {
    const annualAmount = purchaseVal * (rate / 100)
    return { currentDepreciatedValue: Math.max(0, purchaseVal - annualAmount * yearsElapsed), annualAmount, yearsElapsed }
  }
  if (method === 'declining_balance') {
    return {
      currentDepreciatedValue: Math.max(0, purchaseVal * Math.pow(1 - rate / 100, yearsElapsed)),
      annualAmount: purchaseVal * (rate / 100),
      yearsElapsed,
    }
  }
  return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0 }
}

function getAssetAge(purchaseDate: string | null): string {
  if (!purchaseDate) return '—'
  const ms     = Date.now() - new Date(purchaseDate).getTime()
  const years  = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
  const months = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))
  return years > 0 ? `${years}y ${months}m` : `${months}m`
}

function generateTag(): string {
  return 'AST-' + Math.random().toString(36).slice(2, 7).toUpperCase()
}

// ── Sub-components ────────────────────────────────────────────────────

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = ASSET_STATUSES.find(x => x.value === status) ?? ASSET_STATUSES[0]
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: s.color + '20', color: s.color }}>
      {s.label}
    </span>
  )
}

function ConditionBadge({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    new: '#2563eb', excellent: '#16a34a', good: '#0891b2', fair: '#f59e0b', poor: '#dc2626',
  }
  const color = colors[condition] ?? '#94a3b8'
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: color + '20', color }}>
      {condition?.charAt(0).toUpperCase() + condition?.slice(1) || '—'}
    </span>
  )
}

function Section({ title, count, color, children, onAdd, icon: Icon }: {
  title: string; count: number; color: typeof SECTION_COLORS['asset']
  children: React.ReactNode; onAdd: () => void; icon: any
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="h-1.5" style={{ background: color.bg }} />
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color.light }}>
              <Icon className="w-4 h-4" style={{ color: color.bg }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <p className="text-xs text-muted-foreground">{count} entr{count === 1 ? 'y' : 'ies'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" onClick={onAdd} style={{ background: color.bg, color: '#fff' }} className="h-8 text-xs gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
            <button onClick={() => setCollapsed(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && <CardContent className="px-5 pb-5 pt-0">{children}</CardContent>}
    </Card>
  )
}

function AssetActionsMenu({ type, onView, onEdit, onSell, onDispose, onDelete }: {
  type: 'physical'
  onView?: () => void; onEdit: () => void; onSell?: () => void
  onDispose?: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const physicalActions = [
    { label: 'View Details', fn: onView,    cls: ''                 },
    { label: 'Edit',         fn: onEdit,    cls: ''                 },
    { label: 'Sell',         fn: onSell,    cls: 'text-blue-600'    },
    { label: 'Dispose',      fn: onDispose, cls: 'text-orange-500'  },
    { label: 'Delete',       fn: onDelete,  cls: 'text-destructive' },
  ]
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {physicalActions.filter(a => a.fn).map(item => (
              <button key={item.label} onClick={() => { setOpen(false); item.fn?.() }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${item.cls}`}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SimpleMenu({ items }: { items: { label: string; fn: () => void; cls?: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {items.map(item => (
              <button key={item.label} onClick={() => { setOpen(false); item.fn() }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${item.cls ?? ''}`}>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Schemas ───────────────────────────────────────────────────────────

const assetSchema = z.object({
  name:                     z.string().min(1, 'Name required'),
  asset_type:               z.string().min(1, 'Type required'),
  asset_category:           z.string().optional(),
  description:              z.string().optional(),
  asset_tag:                z.string().optional(),
  current_value:            z.coerce.number().min(0),
  purchase_value:           z.coerce.number().min(0),
  purchase_date:            z.string().optional(),
  location:                 z.string().optional(),
  status:                   z.string().optional(),
  condition:                z.string().optional(),
  useful_life_years:        z.coerce.number().optional(),
  depreciation_method:      z.string().optional(),
  annual_depreciation_rate: z.coerce.number().min(0).max(100).optional(),
  notes:                    z.string().optional(),
})
type AssetFormData = z.infer<typeof assetSchema>

const investmentSchema = z.object({
  name:            z.string().min(1, 'Name required'),
  investment_type: z.string().min(1, 'Type required'),
  invested_amount: z.coerce.number().min(0),
  current_value:   z.coerce.number().min(0),
  institution:     z.string().optional(),
  notes:           z.string().optional(),
})
type InvestmentFormData = z.infer<typeof investmentSchema>

const debtSchema = z.object({
  name:              z.string().min(1, 'Name required'),
  debt_type:         z.string().min(1, 'Type required'),
  total_amount:      z.coerce.number().min(0),
  remaining:         z.coerce.number().min(0),
  interest_rate:     z.coerce.number().min(0).max(100),
  due_date:          z.string().optional(),
  account_id:        z.string().optional(),
  paying_account_id: z.string().optional(),
  debt_status:       z.string().default('active'),
  notes:             z.string().optional(),
})
type DebtFormData = z.infer<typeof debtSchema>

const loanSchema = z.object({
  name:              z.string().min(1, 'Name required'),
  loan_type:         z.string().min(1, 'Type required'),
  principal:         z.coerce.number().min(0),
  remaining:         z.coerce.number().min(0),
  interest_rate:     z.coerce.number().min(0).max(100),
  monthly_payment:   z.coerce.number().min(0),
  start_date:        z.string().optional(),
  end_date:          z.string().optional(),
  institution:       z.string().optional(),
  account_id:        z.string().optional(),
  paying_account_id: z.string().optional(),
  loan_status:       z.string().default('active'),
  custom_loan_type:  z.string().optional(),
  notes:             z.string().optional(),
})
type LoanFormData = z.infer<typeof loanSchema>

const sellSchema = z.object({
  sold_price: z.coerce.number().min(0, 'Sale price required'),
  sold_date:  z.string().min(1, 'Date required'),
  sold_to:    z.string().optional(),
  account_id: z.string().min(1, 'Choose which account receives the sale proceeds'),
  notes:      z.string().optional(),
})
type SellFormData = z.infer<typeof sellSchema>

const disposeSchema = z.object({
  disposal_reason: z.string().min(1, 'Reason required'),
  disposal_date:   z.string().min(1, 'Date required'),
  notes:           z.string().optional(),
})
type DisposeFormData = z.infer<typeof disposeSchema>

// ── Main Component ────────────────────────────────────────────────────

interface Props {
  initialAssets:      Asset[]
  initialInvestments: Investment[]
  initialDebts:       Debt[]
  initialLoans:       Loan[]
  initialAccounts:    any[]
  incomes:            { amount: number; account_id: string | null }[]
  expenses:           { amount: number; account_id: string | null }[]
  transfers:          { from_account_id: string; to_account_id: string; amount: number; to_amount?: number | null }[]
  loanPayments:       any[]
  debtPayments:       any[]
  userId:             string
}

export function WealthContent({
  initialAssets, initialInvestments, initialDebts, initialLoans, initialAccounts = [],
  incomes = [], expenses = [], transfers = [], loanPayments: initialLoanPayments = [],
  debtPayments: initialDebtPayments = [], userId,
}: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [assets,      setAssets]      = useState<any[]>(initialAssets)
  const [customAssetCategories, setCustomAssetCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ts_asset_categories') || '[]') } catch { return [] }
  })
  const [newAssetCat, setNewAssetCat] = useState('')
  const [accounts, setAccountsState]  = useState<any[]>(initialAccounts ?? [])
  const [investments, setInvestments] = useState<any[]>(initialInvestments)
  const [debts,       setDebts]       = useState<any[]>(initialDebts)
  const [loans,       setLoans]       = useState<any[]>(initialLoans)
  const [detailAsset,     setDetailAsset]     = useState<any | null>(null)
  const [loanPayments,    setLoanPayments]     = useState<any[]>(initialLoanPayments)
  const [debtPayments,    setDebtPayments]     = useState<any[]>(initialDebtPayments)
  const [historyItem,     setHistoryItem]      = useState<{ type: 'loan' | 'debt'; id: string; name: string } | null>(null)
  const [customLoanType,  setCustomLoanType]   = useState('')
  const [showCustomLoan,  setShowCustomLoan]   = useState(false)

  // ── Live account balances — the SAME formula My Accounts uses. ──────────
  // Cash & Liquid is no longer a separately-stored number; it's a read-only
  // mirror of real user_accounts, computed fresh from income/expense/transfer
  // history, so it can never drift out of sync with what's actually true.
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
      const totalIncome  = incomes.filter(i => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
      const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
      const transfersOut = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
      const transfersIn  = transfers.filter(t => t.to_account_id === acc.id).reduce((s, t) => s + Number(t.to_amount ?? t.amount), 0)
      const balance = Number(acc.opening_balance ?? 0) + totalIncome - totalExpense - transfersOut + transfersIn
      return { ...acc, balance }
    }), [accounts, incomes, expenses, transfers])

  // GHS-equivalent of a single account, using its own exchange_rate (defaults to 1 for GHS accounts)
  const accountToGHS = (acc: any) => {
    const cur = acc.currency || 'GHS'
    if (cur === 'GHS') return acc.balance
    return Number(acc.balance) * Number(acc.exchange_rate ?? 1)
  }

  type DialogType =
    | 'asset' | 'investment' | 'debt' | 'loan'
    | 'sell' | 'dispose'
    | 'invest_add' | 'debt_payment' | 'loan_payment'
    | null

  const [dialogType,       setDialogType]       = useState<DialogType>(null)
  const [editingId,        setEditingId]         = useState<string | null>(null)
  const [loading,          setLoading]           = useState(false)
  const [activeTab,        setActiveTab]         = useState<'basic' | 'financial' | 'details'>('basic')

  // shared action state
  const [paymentNote,      setPaymentNote]       = useState('')
  const [paymentAmt,       setPaymentAmt]        = useState('')
  const [newBalance,       setNewBalance]        = useState('')
  const [investDate,       setInvestDate]        = useState(new Date().toISOString().split('T')[0])
  const [investIncomeType, setInvestIncomeType]  = useState('investment')
  const [investAccountId,  setInvestAccountId]   = useState('')

  // search / filter
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')


  useEffect(() => {
    try {
      const stored = localStorage.getItem('ts_asset_categories')
      if (stored) setCustomAssetCategories(JSON.parse(stored))
    } catch {}
  }, [])

  

  // exchange rate editing (per currency, applied to all accounts of that currency)
  const [editingRateCurrency, setEditingRateCurrency] = useState<string | null>(null)
  const [rateInputValue,      setRateInputValue]      = useState('')
  const [savingRate,          setSavingRate]          = useState(false)

  // sold assets panel
  const [showSoldAssets, setShowSoldAssets] = useState(false)

  // related accounts panel (Cash & Liquid detail)
  const [showRelatedAccounts, setShowRelatedAccounts] = useState(false)

  // ── Forms ─────────────────────────────────────────────────────────
  const assetForm = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '', asset_type: '', description: '', asset_tag: generateTag(),
      current_value: 0, purchase_value: 0, purchase_date: '', location: '',
      status: 'active', condition: 'good', useful_life_years: undefined,
      depreciation_method: 'none', annual_depreciation_rate: 0, notes: '',
    },
  })
  const investmentForm = useForm<InvestmentFormData>({ resolver: zodResolver(investmentSchema) })
  const debtForm       = useForm<DebtFormData>({ resolver: zodResolver(debtSchema) })
  const loanForm       = useForm<LoanFormData>({ resolver: zodResolver(loanSchema) })
  const sellForm       = useForm<SellFormData>({
    resolver: zodResolver(sellSchema),
    defaultValues: { sold_date: new Date().toISOString().split('T')[0] },
  })
  const disposeForm = useForm<DisposeFormData>({
    resolver: zodResolver(disposeSchema),
    defaultValues: { disposal_date: new Date().toISOString().split('T')[0] },
  })

  // ── Totals ────────────────────────────────────────────────────────
  // Physical assets are still real, separate things (property, vehicles, electronics, jewelry)
  // with no other home — they keep their own table. Cash assets are retired: any legacy rows
  // were migrated to real user_accounts by the SQL migration, so we filter them out here even
  // if old rows are still visible in the table (migrated_to_account flag).
  const activeAssets = useMemo(() =>
    assets.filter(a =>
      a.status !== 'sold' && a.status !== 'disposed' && a.status !== 'donated' &&
      !a.is_liquid && a.asset_type !== 'cash' && !a.migrated_to_account
    ), [assets])
  const toGHS = (a: any) => {
    const cur = a.currency || 'GHS'
    if (cur === 'GHS') return Number(a.current_value ?? 0)
    return Number(a.current_value ?? 0) * Number(a.exchange_rate ?? 1)
  }
  const totalPhysical = useMemo(() => activeAssets.reduce((s, a) => s + toGHS(a), 0), [activeAssets])
  // Cash & Liquid total now comes from real accounts, converted to GHS via each
  // account's own exchange_rate — same live numbers My Accounts shows.
  const totalLiquid = useMemo(() =>
    accountsWithBalance
      .filter(a => !(a as any).is_custody && !(a as any).exclude_from_net)
      .reduce((s, a) => s + accountToGHS(a), 0),
  [accountsWithBalance])
  const totalAssets = totalPhysical + totalLiquid
  const totalInvested    = useMemo(() => investments.reduce((s, i) => s + Number(i.current_value ?? 0), 0), [investments])
  const totalDebts       = useMemo(() => debts.reduce((s, d) => s + Number(d.remaining ?? 0), 0), [debts])
  const totalLoans       = useMemo(() => loans.reduce((s, l) => s + Number(l.remaining ?? 0), 0), [loans])
  const netWorth         = totalAssets + totalInvested - totalDebts - totalLoans
  const totalLiabilities = totalDebts + totalLoans
  const investmentGain   = useMemo(() => investments.reduce((s, i) => s + (Number(i.current_value ?? 0) - Number(i.invested_amount ?? 0)), 0), [investments])

  // ── Analytics ─────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!activeAssets.length) return null
    const sorted = [...activeAssets].sort((a, b) => Number(b.current_value) - Number(a.current_value))
    const mostAppreciated = [...activeAssets].sort((a, b) =>
      (Number(b.current_value) - Number(b.purchase_value)) - (Number(a.current_value) - Number(a.purchase_value))
    )[0]
    return {
      highest: sorted[0],
      mostAppreciated,
      avgValue:  totalAssets / activeAssets.length,
      soldCount: assets.filter(a => a.status === 'sold').length,
    }
  }, [activeAssets, assets, totalAssets])

  const filteredAssets = useMemo(() =>
    assets.filter(a => {
      if (a.status === 'sold') return false // sold assets move to the dedicated Sold Assets panel
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      return matchSearch && matchStatus
    }), [assets, search, statusFilter])

  const soldAssets = useMemo(() =>
    assets.filter(a => a.status === 'sold').sort((a, b) =>
      new Date(b.sold_date ?? b.updated_at).getTime() - new Date(a.sold_date ?? a.updated_at).getTime()
    ), [assets])

  // ── Dialog helpers ────────────────────────────────────────────────
  const openCreate = (type: DialogType) => {
    setEditingId(null); setDialogType(type); setActiveTab('basic')
    if (type === 'asset') assetForm.reset({ name: '', asset_type: '', asset_category: '', description: '', asset_tag: generateTag(), current_value: 0, purchase_value: 0, purchase_date: '', location: '', status: 'active', condition: 'good', useful_life_years: undefined, depreciation_method: 'none', annual_depreciation_rate: 0, notes: '' })
    if (type === 'investment') investmentForm.reset({ name: '', investment_type: '', invested_amount: 0, current_value: 0, institution: '', notes: '' })
    if (type === 'debt')  debtForm.reset({ name: '', debt_type: '', total_amount: 0, remaining: 0, interest_rate: 0, due_date: '', notes: '' })
    if (type === 'loan')  loanForm.reset({ name: '', loan_type: '', principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0, start_date: '', end_date: '', institution: '', notes: '' })
  }

  const openEdit = (type: DialogType, item: any) => {
    setEditingId(item.id); setDialogType(type); setActiveTab('basic')
    if (type === 'asset')      assetForm.reset(item)
    if (type === 'investment') investmentForm.reset(item)
    if (type === 'debt')       debtForm.reset(item)
    if (type === 'loan')       loanForm.reset(item)
  }

  const openSell = (asset: any) => {
    setEditingId(asset.id)
    sellForm.reset({ sold_price: Number(asset.current_value), sold_date: new Date().toISOString().split('T')[0], sold_to: '', account_id: '', notes: '' })
    setDialogType('sell')
  }

  const openDispose = (asset: any) => {
    setEditingId(asset.id)
    disposeForm.reset({ disposal_reason: '', disposal_date: new Date().toISOString().split('T')[0], notes: '' })
    setDialogType('dispose')
  }

  const openInvestAdd = (inv: any) => {
    setEditingId(inv.id); setNewBalance(''); setPaymentAmt(''); setPaymentNote('')
    setInvestDate(new Date().toISOString().split('T')[0]); setInvestIncomeType('investment'); setInvestAccountId('')
    setDialogType('invest_add')
  }

  const [payingAccountId, setPayingAccountId] = useState('')

  const openDebtPayment = (debt: any) => {
    setEditingId(debt.id); setPaymentAmt(''); setPaymentNote('')
    setPayingAccountId(debt.paying_account_id || '')
    setDialogType('debt_payment')
  }

  const openLoanPayment = (loan: any) => {
    setEditingId(loan.id); setPaymentAmt(''); setPaymentNote('')
    setPayingAccountId(loan.paying_account_id || '')
    setDialogType('loan_payment')
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleDelete = async (table: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setter(prev => prev.filter((x: any) => x.id !== id)); toast({ title: 'Deleted' }) }
  }

  // Rate is set per CURRENCY, applied to every account using that currency at once —
  // setting it twice for two USD accounts would be redundant and error-prone.
  const openRateEditor = (currency: string, currentRate: number) => {
    setEditingRateCurrency(currency)
    setRateInputValue(String(currentRate))
  }

  const saveExchangeRate = async () => {
    if (!editingRateCurrency || !rateInputValue || Number(rateInputValue) <= 0) {
      toast({ title: 'Enter a valid exchange rate', variant: 'destructive' }); return
    }
    setSavingRate(true)
    const supabase = createClient()
    const rate = Number(rateInputValue)
    const accountIdsForCurrency = accounts.filter(a => (a.currency || 'GHS') === editingRateCurrency).map(a => a.id)
    const { error } = await supabase
      .from('user_accounts')
      .update({ exchange_rate: rate, updated_at: new Date().toISOString() })
      .in('id', accountIdsForCurrency)
    if (error) {
      toast({ title: 'Failed to update rate', description: error.message, variant: 'destructive' })
    } else {
      setAccountsState(prev => prev.map(a => (a.currency || 'GHS') === editingRateCurrency ? { ...a, exchange_rate: rate } : a))
      toast({ title: `Rate updated for ${editingRateCurrency}`, variant: 'success' })
      setEditingRateCurrency(null)
    }
    setSavingRate(false)
  }

  const onSubmitAsset = async (data: AssetFormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload: any = {
      ...data,
      updated_at: new Date().toISOString(),
    }
    if (editingId) {
      const { data: updated, error } = await supabase.from('assets').update(payload).eq('id', editingId).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setAssets(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Asset updated', variant: 'success' }); setDialogType(null) }
    } else {
      const { data: created, error } = await supabase.from('assets').insert({ ...payload, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setAssets(p => [created, ...p]); toast({ title: 'Asset added', variant: 'success' }); setDialogType(null) }
    }
    setLoading(false)
  }

  const onSubmitInvestment = async (data: InvestmentFormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editingId) {
      const { data: updated, error } = await supabase.from('investments').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setInvestments(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Investment updated', variant: 'success' }); setDialogType(null) }
    } else {
      const { data: created, error } = await supabase.from('investments').insert({ ...data, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setInvestments(p => [created, ...p]); toast({ title: 'Investment added', variant: 'success' }); setDialogType(null) }
    }
    setLoading(false)
  }

  const onSubmitDebt = async (data: DebtFormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editingId) {
      const { data: updated, error } = await supabase.from('debts').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setDebts(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Debt updated', variant: 'success' }); setDialogType(null) }
    } else {
      const { data: created, error } = await supabase.from('debts').insert({ ...data, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setDebts(p => [created, ...p]); toast({ title: 'Debt added', variant: 'success' }); setDialogType(null) }
    }
    setLoading(false)
  }

  const onSubmitLoan = async (data: LoanFormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editingId) {
      const { data: updated, error } = await supabase.from('loans').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setLoans(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Loan updated', variant: 'success' }); setDialogType(null) }
    } else {
      const { data: created, error } = await supabase.from('loans').insert({ ...data, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setLoans(p => [created, ...p]); toast({ title: 'Loan added', variant: 'success' }); setDialogType(null) }
    }
    setLoading(false)
  }

  const onSubmitSell = async (data: SellFormData) => {
    if (!editingId) return
    setLoading(true)
    const supabase = createClient()
    const asset = assets.find(a => a.id === editingId)
    const gain  = Number(data.sold_price) - Number(asset?.purchase_value ?? 0)

    const { data: updated, error } = await supabase.from('assets').update({
      status: 'sold', sold_price: data.sold_price, sold_date: data.sold_date,
      sold_to: data.sold_to || null, sold_account_id: data.account_id,
      notes: data.notes || asset?.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId).select().single()

    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }

    // Sale proceeds flow into Cash & Liquid via a real income record — same
    // consolidated cash system everything else in the app uses.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const destAccount = accounts.find(a => a.id === data.account_id)
      await supabase.from('incomes').insert({
        user_id:    user.id,
        title:      `Sale of asset: ${asset?.name ?? 'Asset'}`,
        amount:     data.sold_price,
        category:   'other',
        date:       data.sold_date,
        account_id: data.account_id,
        notes:      data.notes || `Asset sold${data.sold_to ? ` to ${data.sold_to}` : ''}${destAccount ? ` — proceeds to ${destAccount.name}` : ''}`,
      })
    }

    setAssets(p => p.map(x => x.id === editingId ? updated : x))
    toast({ title: `Asset sold — ${gain >= 0 ? '+' : ''}${fmt(gain)} gain/loss, proceeds added to Cash & Liquid`, variant: 'success' })
    setDialogType(null)
    setLoading(false)
  }

  const onSubmitDispose = async (data: DisposeFormData) => {
    if (!editingId) return
    setLoading(true)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('assets').update({
      status: 'disposed', disposal_reason: data.disposal_reason,
      disposal_date: data.disposal_date, notes: data.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else { setAssets(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Asset disposed', variant: 'success' }); setDialogType(null) }
    setLoading(false)
  }

  const handleInvestAdd = async () => {
    if (!editingId || !newBalance || Number(newBalance) <= 0) {
      toast({ title: 'Enter the amount to add', variant: 'destructive' }); return
    }
    setLoading(true)
    const supabase = createClient()
    const inv = investments.find(i => i.id === editingId)
    if (!inv) { setLoading(false); return }
    const addedAmount    = Number(newBalance)
    const newCurrentVal  = Number(inv.current_value ?? 0) + addedAmount
    const newInvestedAmt = Number(inv.invested_amount ?? 0) + addedAmount
    const { data: updated, error } = await supabase.from('investments').update({
      current_value: newCurrentVal, invested_amount: newInvestedAmt,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId).select().single()
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }
    if (investAccountId && investAccountId !== 'none') {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('incomes').insert({
          user_id:    user.id,
          title:      `${INVEST_INCOME_TYPES.find(t => t.value === investIncomeType)?.label ?? 'Investment'}: ${inv.name}`,
          amount:     addedAmount,
          category:   investIncomeType,
          date:       investDate || new Date().toISOString().split('T')[0],
          account_id: investAccountId,
          notes:      paymentNote ? `${paymentNote} — Added to investment: ${inv.name}` : `Added to investment: ${inv.name}`,
        })
      }
    }
    setInvestments(p => p.map(i => i.id === editingId ? updated : i))
    toast({ title: `+${fmt(addedAmount)} added to ${inv.name}`, variant: 'success' })
    setDialogType(null)
    setNewBalance(''); setPaymentAmt(''); setPaymentNote(''); setInvestAccountId('')
    setLoading(false)
  }

  const handleDebtPayment = async () => {
    if (!editingId || !paymentAmt || Number(paymentAmt) <= 0) {
      toast({ title: 'Enter a valid payment amount', variant: 'destructive' }); return
    }
    setLoading(true)
    const supabase = createClient()
    const debt = debts.find(d => d.id === editingId)
    if (!debt) { setLoading(false); return }
    const newRemaining = Math.max(0, Number(debt.remaining) - Number(paymentAmt))
    const newStatus = newRemaining === 0 ? 'paid_off' : debt.debt_status ?? 'active'
    const { data: updated, error } = await supabase.from('debts')
      .update({ remaining: newRemaining, debt_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', editingId).select().single()
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }

    // Record payment history
    await supabase.from('debt_payments').insert({
      user_id:    userId,
      debt_id:    editingId,
      amount:     Number(paymentAmt),
      account_id: payingAccountId || null,
      note:       paymentNote || null,
      paid_date:  new Date().toISOString().split('T')[0],
    })

    // Deduct from linked account as an expense
    if (payingAccountId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('expenses').insert({
          user_id:        user.id,
          title:          `Debt payment: ${debt.name}`,
          amount:         Number(paymentAmt),
          category:       'debt payment',
          payment_method: 'bank_transfer',
          date:           new Date().toISOString().split('T')[0],
          account_id:     payingAccountId,
          notes:          paymentNote || `Payment toward ${debt.name}`,
        })
      }
    }

    setDebts(p => p.map(d => d.id === editingId ? updated : d))
    setDebtPayments(prev => [{
      id: Date.now().toString(), debt_id: editingId, amount: Number(paymentAmt),
      account_id: payingAccountId || null, note: paymentNote,
      paid_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString(),
    }, ...prev])
    toast({ title: newRemaining === 0 ? '🎉 Debt fully paid off!' : `Payment recorded — ${fmt(newRemaining)} remaining`, variant: 'success' })
    setDialogType(null); setPaymentAmt(''); setPayingAccountId('')
    setLoading(false)
  }

  const handleLoanPayment = async () => {
    if (!editingId || !paymentAmt || Number(paymentAmt) <= 0) {
      toast({ title: 'Enter a valid payment amount', variant: 'destructive' }); return
    }
    setLoading(true)
    const supabase = createClient()
    const loan = loans.find(l => l.id === editingId)
    if (!loan) { setLoading(false); return }
    const newRemaining = Math.max(0, Number(loan.remaining) - Number(paymentAmt))
    const newStatus = newRemaining === 0 ? 'paid_off' : loan.loan_status ?? 'active'
    const { data: updated, error } = await supabase.from('loans')
      .update({ remaining: newRemaining, loan_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', editingId).select().single()
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }

    // Record payment history
    await supabase.from('loan_payments').insert({
      user_id:    userId,
      loan_id:    editingId,
      amount:     Number(paymentAmt),
      account_id: payingAccountId || null,
      note:       paymentNote || null,
      paid_date:  new Date().toISOString().split('T')[0],
    })

    // Deduct from linked account as an expense
    if (payingAccountId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('expenses').insert({
          user_id:        user.id,
          title:          `Loan payment: ${loan.name}`,
          amount:         Number(paymentAmt),
          category:       'debt payment',
          payment_method: 'bank_transfer',
          date:           new Date().toISOString().split('T')[0],
          account_id:     payingAccountId,
          notes:          paymentNote || `Payment toward ${loan.name}`,
        })
      }
    }

    setLoans(p => p.map(l => l.id === editingId ? updated : l))
    setLoanPayments(prev => [{
      id: Date.now().toString(), loan_id: editingId, amount: Number(paymentAmt),
      account_id: payingAccountId || null, note: paymentNote,
      paid_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString(),
    }, ...prev])
    toast({ title: newRemaining === 0 ? '🎉 Loan fully paid off!' : `Payment recorded — ${fmt(newRemaining)} remaining`, variant: 'success' })
    setDialogType(null); setPaymentAmt(''); setPayingAccountId('')
    setLoading(false)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast({ title: 'Fix form errors', description: first?.message, variant: 'destructive' })
  }
const getAccountName = (id?: string | null) => accounts.find(a => a.id === id)?.name ?? '—'

  const LOAN_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active:   { bg: '#dcfce7', text: '#15803d' },
    paid_off: { bg: '#dbeafe', text: '#1d4ed8' },
    overdue:  { bg: '#fee2e2', text: '#b91c1c' },
  }

  const LoanStatusBadge = ({ status }: { status?: string }) => {
    const s = status ?? 'active'
    const c = LOAN_STATUS_COLORS[s] ?? LOAN_STATUS_COLORS.active
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
        style={{ background: c.bg, color: c.text }}>
        {s === 'paid_off' ? 'Paid Off' : s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    )
  }



  const Tab = ({ id, label }: { id: 'basic' | 'financial' | 'details'; label: string }) => (
    <button onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${activeTab === id ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
      style={activeTab === id ? { background: SECTION_COLORS.asset.bg } : {}}>
      {label}
    </button>
  )

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>Net Worth Tracker</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Assets + Investments − Debts − Loans = Net Worth</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openCreate('asset')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: SECTION_COLORS.asset.bg }}
          >
            <Plus className="w-3.5 h-3.5" /> Asset
          </button>
          <button
            onClick={() => openCreate('investment')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: SECTION_COLORS.investment.bg }}
          >
            <Plus className="w-3.5 h-3.5" /> Investment
          </button>
          <button
            onClick={() => openCreate('debt')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: SECTION_COLORS.debt.bg }}
          >
            <Plus className="w-3.5 h-3.5" /> Debt
          </button>
          <button
            onClick={() => openCreate('loan')}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: SECTION_COLORS.loan.bg }}
          >
            <Plus className="w-3.5 h-3.5" /> Loan
          </button>
        </div>
      </div>

      {/* Net Worth Hero */}
      <Card className="rounded-xl shadow-sm border border-border overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Estimated Net Worth</p>
              <p className="text-white text-3xl sm:text-4xl font-bold tabular-nums mt-1">{fmt(netWorth)}</p>
              <p className="text-white/70 text-xs mt-2">{netWorth >= 0 ? '✓ Positive net worth' : '⚠ Liabilities exceed assets'}</p>
            </div>
            <div className="flex flex-col gap-1.5 text-right">
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-wide">Total Assets</p>
                <p className="text-white font-bold tabular-nums">{fmt(totalAssets + totalInvested)}</p>
              </div>
              <div>
                <p className="text-white/60 text-[10px] uppercase tracking-wide">Total Liabilities</p>
                <p className="text-white font-bold tabular-nums">{fmt(totalLiabilities)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/60 mb-1">
              <span>Liabilities {totalLiabilities > 0 ? Math.round((totalLiabilities / (totalAssets + totalInvested + totalLiabilities)) * 100) : 0}%</span>
              <span>Assets {Math.round(((totalAssets + totalInvested) / Math.max(1, totalAssets + totalInvested + totalLiabilities)) * 100)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 rounded-full transition-all duration-700"
                style={{ width: `${Math.round(((totalAssets + totalInvested) / Math.max(1, totalAssets + totalInvested + totalLiabilities)) * 100)}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Premium Analytics Sections ── */}
      <WealthPremiumSections
        assets={assets}
        investments={investments}
        debts={debts}
        loans={loans}
        accountsWithBalance={accountsWithBalance}
        incomes={incomes}
        expenses={expenses}
        totalPhysical={totalPhysical}
        totalLiquid={totalLiquid}
        totalInvested={totalInvested}
        totalDebts={totalDebts}
        totalLoans={totalLoans}
        netWorth={netWorth}
      />

      {/* KPI row — all flip cards (hover on desktop, tap on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3"></div>

      {/* KPI row — all flip cards (hover on desktop, tap on mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard label="Physical Assets" value={fmt(totalPhysical)} sub={`${activeAssets.length} items`}
          colorClass="" icon={Landmark} accentColor={SECTION_COLORS.asset.bg}
          tooltip={activeAssets.map(a => `${a.name}: ${fmt(Number(a.current_value ?? 0))}`).join('\n') || 'No physical assets yet'} />
        <KPICard label="Cash & Liquid" value={fmt(totalLiquid)} sub={`${accountsWithBalance.filter(a => !(a as any).is_custody && !(a as any).exclude_from_net).length} account(s)`}
          colorClass="" icon={Banknote} accentColor="#059669"
          tooltip={accountsWithBalance.map(a => `${a.name}: ${formatCurrency(a.balance ?? 0, a.currency || 'GHS')}`).join('\n') || 'No accounts yet'} />
        <KPICard label="Investments" value={fmt(totalInvested)} sub={investmentGain >= 0 ? `+${fmt(investmentGain)} gain` : `${fmt(investmentGain)} loss`}
          colorClass="" icon={TrendingUp} accentColor={SECTION_COLORS.investment.bg}
          tooltip={investments.map(i => `${i.name}: ${fmt(Number(i.current_value ?? 0))}`).join('\n') || 'No investments yet'} />
        <KPICard label="Debts" value={fmt(totalDebts)} sub={`${debts.length} account(s)`}
          colorClass="" icon={CreditCard} accentColor={SECTION_COLORS.debt.bg}
          tooltip={debts.map(d => `${d.name}: ${fmt(Number(d.remaining))} remaining`).join('\n') || 'No debts'} />
        <KPICard label="Loans" value={fmt(totalLoans)} sub={`${loans.length} loan(s)`}
          colorClass="" icon={Building2} accentColor={SECTION_COLORS.loan.bg}
          tooltip={loans.map(l => `${l.name}: ${fmt(Number(l.remaining))} remaining`).join('\n') || 'No loans'} />
      </div>

      {/* Analytics — moved above Cash & Liquid */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Highest Value</p>
            <p className="font-bold text-sm mt-1 truncate">{analytics.highest?.name || '—'}</p>
            <p className="text-xs text-green-600 tabular-nums">{fmt(Number(analytics.highest?.current_value ?? 0))}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Most Appreciated</p>
            <p className="font-bold text-sm mt-1 truncate">{analytics.mostAppreciated?.name || '—'}</p>
            <p className="text-xs text-green-600 tabular-nums">+{fmt(Math.max(0, Number(analytics.mostAppreciated?.current_value ?? 0) - Number(analytics.mostAppreciated?.purchase_value ?? 0)))}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Average Value</p>
            <p className="font-bold text-sm mt-1">{fmt(analytics.avgValue)}</p>
            <p className="text-xs text-muted-foreground">{activeAssets.length} active assets</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Sold Assets</p>
            <p className="font-bold text-sm mt-1">{analytics.soldCount}</p>
            <p className="text-xs text-muted-foreground">Total sold</p>
          </div>
        </div>
      )}

      {/* Cash & Liquid — live mirror of My Accounts. Read-only here by design:
          this is a REPORT, not a second place to edit cash. To add income,
          log an expense, or adjust an opening balance, go to Income/Expenses/
          My Accounts — those are the only places cash balances ever change.
          Exchange rate per currency CAN be set here since it's specific to
          how Net Worth converts foreign cash into GHS. */}
      {accountsWithBalance.length > 0 && (() => {
        const liquidByCurrency: Record<string, number> = {}
        accountsWithBalance
          .filter(a => !(a as any).is_custody && !(a as any).exclude_from_net)
          .forEach(a => {
            const cur = a.currency || 'GHS'
            liquidByCurrency[cur] = (liquidByCurrency[cur] || 0) + Number(a.balance ?? 0)
          })
        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Cash & Liquid Assets</p>
                <span className="text-xs text-emerald-600">{accountsWithBalance.length} account(s)</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowRelatedAccounts(true)}
                  className="text-xs font-semibold text-emerald-700 hover:underline">
                  Related Accounts →
                </button>
                <a href="/user-accounts" className="text-xs font-semibold text-emerald-700 hover:underline">
                  Manage in My Accounts →
                </a>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(liquidByCurrency).map(([cur, amt]) => {
                const rateForCur = Number(accountsWithBalance.find(a => (a.currency || 'GHS') === cur)?.exchange_rate) || 1
                return (
                  <div key={cur} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{cur}</p>
                      {cur !== 'GHS' && (
                        <button onClick={() => openRateEditor(cur, rateForCur)}
                          className="text-[10px] font-semibold text-blue-600 hover:underline">
                          Set Rate
                        </button>
                      )}
                    </div>
                    <p className="font-bold tabular-nums text-emerald-700">{formatCurrency(amt, cur)}</p>
                    {cur !== 'GHS' && (
                      <p className="text-[10px] text-muted-foreground">≈ {fmt(amt * rateForCur)} @ rate {rateForCur}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Assets Section ── */}
      <Section title="Physical Assets" count={filteredAssets.length} color={SECTION_COLORS.asset} icon={Landmark} onAdd={() => openCreate('asset')}>
        <div className="flex gap-3 mb-4 flex-wrap items-center">
          <Input placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[160px] h-8 text-sm bg-white" />
          {soldAssets.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowSoldAssets(true)} className="h-8 text-xs gap-1">
              <DollarSign className="w-3.5 h-3.5" /> View Sold Assets ({soldAssets.length})
            </Button>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {SELECTABLE_ASSET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {filteredAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No assets found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAssets.map(a => {
              const typeInfo = ASSET_TYPES.find(t => t.value === a.asset_type)
              const Icon     = typeInfo?.icon ?? Landmark
              const gain     = Number(a.current_value ?? 0) - Number(a.purchase_value ?? 0)
              const dep      = calcDepreciation(a)
              const hasDepreciation = a.depreciation_method !== 'none' && Number(a.annual_depreciation_rate ?? 0) > 0
              return (
                <div key={a.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: SECTION_COLORS.asset.light }}>
                        <Icon className="w-4 h-4" style={{ color: SECTION_COLORS.asset.bg }} />
                      </div>
                      <div className="min-w-0">
                        <button onClick={() => setDetailAsset(a)} className="font-semibold text-sm truncate hover:underline text-left" style={{ color: SECTION_COLORS.asset.bg }}>
                          {a.name}
                        </button>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground capitalize">{typeInfo?.label}</span>
                          {a.asset_tag && <span className="text-[10px] text-muted-foreground font-mono">· {a.asset_tag}</span>}
                        </div>
                      </div>
                    </div>
                    <AssetActionsMenu
                      type="physical"
                      onView={() => setDetailAsset(a)}
                      onEdit={() => openEdit('asset', a)}
                      onSell={() => openSell(a)}
                      onDispose={() => openDispose(a)}
                      onDelete={() => handleDelete('assets', a.id, setAssets)}
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusBadge status={a.status ?? 'active'} />
                    {a.condition && <ConditionBadge condition={a.condition} />}
                    {a.asset_category && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100 text-violet-700">
                        {a.asset_category}
                      </span>
                    )}
                    {a.currency && a.currency !== 'GHS' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700">{a.currency}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-bold text-sm" style={{ color: SECTION_COLORS.asset.bg }}>
                        {formatCurrency(Number(a.current_value ?? 0), a.currency || 'GHS')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purchase Value</p>
                      <p className="font-medium">{fmt(Number(a.purchase_value ?? 0))}</p>
                    </div>
                    {hasDepreciation && (
                      <div>
                        <p className="text-muted-foreground">Depreciated Value</p>
                        <p className="font-medium text-orange-600">{fmt(dep.currentDepreciatedValue)}</p>
                      </div>
                    )}
                    {a.purchase_date && (
                      <div>
                        <p className="text-muted-foreground">Age</p>
                        <p className="font-medium">{getAssetAge(a.purchase_date)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {gain >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    <span className={gain >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)}{Number(a.purchase_value) > 0 && ` (${Math.round((gain / Number(a.purchase_value)) * 100)}%)`}
                    </span>
                  </div>
                  {hasDepreciation && Number(a.purchase_value) > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Remaining value</span>
                        <span>{Math.round((dep.currentDepreciatedValue / Number(a.purchase_value)) * 100)}%</span>
                      </div>
                      <ProgressBar value={dep.currentDepreciatedValue} max={Number(a.purchase_value)} color={SECTION_COLORS.asset.bg} />
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    {a.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{a.location}</span>}
                    {a.purchase_date && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(a.purchase_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── Investments Section ── */}
      <Section title="Investments" count={investments.length} color={SECTION_COLORS.investment} icon={TrendingUp} onAdd={() => openCreate('investment')}>
        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No investments yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investments.map(inv => {
              const typeInfo = INVESTMENT_TYPES.find(t => t.value === inv.investment_type)
              const Icon     = typeInfo?.icon ?? TrendingUp
              const gain     = Number(inv.current_value ?? 0) - Number(inv.invested_amount ?? 0)
              const gainPct  = Number(inv.invested_amount ?? 0) > 0 ? (gain / Number(inv.invested_amount)) * 100 : 0
              return (
                <div key={inv.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: SECTION_COLORS.investment.light }}>
                        <Icon className="w-4 h-4" style={{ color: SECTION_COLORS.investment.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{inv.name}</p>
                        <p className="text-xs text-muted-foreground">{typeInfo?.label}{inv.institution ? ` · ${inv.institution}` : ''}</p>
                      </div>
                    </div>
                    <SimpleMenu items={[
                      { label: 'Add Value', fn: () => openInvestAdd(inv), cls: 'text-blue-600' },
                      { label: 'Edit',      fn: () => openEdit('investment', inv) },
                      { label: 'Delete',    fn: () => handleDelete('investments', inv.id, setInvestments), cls: 'text-destructive' },
                    ]} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-bold text-sm" style={{ color: SECTION_COLORS.investment.bg }}>{fmt(Number(inv.current_value ?? 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Invested</p>
                      <p className="font-medium">{fmt(Number(inv.invested_amount ?? 0))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {gain >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    <span className={gain >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── Debts Section ── */}
      <Section title="Debts" count={debts.length} color={SECTION_COLORS.debt} icon={CreditCard} onAdd={() => openCreate('debt')}>
        {debts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No debts recorded</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {debts.map(d => {
              const paidPct = Number(d.total_amount) > 0 ? ((Number(d.total_amount) - Number(d.remaining)) / Number(d.total_amount)) * 100 : 0
              return (
                <div key={d.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: SECTION_COLORS.debt.light }}>
                        <CreditCard className="w-4 h-4" style={{ color: SECTION_COLORS.debt.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{DEBT_TYPES.find(t => t.value === d.debt_type)?.label}</p>
                      </div>
                    </div>
                    <SimpleMenu items={[
                      { label: 'Make Payment', fn: () => openDebtPayment(d), cls: 'text-green-600' },
                      { label: 'Edit',         fn: () => openEdit('debt', d) },
                      { label: 'Delete',       fn: () => handleDelete('debts', d.id, setDebts), cls: 'text-destructive' },
                    ]} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <LoanStatusBadge status={d.debt_status} />
                    {d.account_id && (
                      <span className="text-[10px] text-muted-foreground">← {getAccountName(d.account_id)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-bold text-sm text-destructive">{fmt(Number(d.remaining))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total / Rate</p>
                      <p className="font-medium">{fmt(Number(d.total_amount))} · {d.interest_rate}%</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{paidPct.toFixed(0)}% paid off</span>
                      <span>{fmt(Number(d.total_amount) - Number(d.remaining))} paid</span>
                    </div>
                    <ProgressBar value={Number(d.total_amount) - Number(d.remaining)} max={Number(d.total_amount)} color={SECTION_COLORS.debt.bg} />
                  </div>
                  {d.due_date && (
                    <div className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertTriangle className="w-3 h-3" />
                      Due: {new Date(d.due_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── Loans Section ── */}
      <Section title="Loans" count={loans.length} color={SECTION_COLORS.loan} icon={Building2} onAdd={() => openCreate('loan')}>
        {loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No loans recorded</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {loans.map(l => {
              const paidPct = Number(l.principal) > 0 ? ((Number(l.principal) - Number(l.remaining)) / Number(l.principal)) * 100 : 0
              return (
                <div key={l.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: SECTION_COLORS.loan.light }}>
                        <Building2 className="w-4 h-4" style={{ color: SECTION_COLORS.loan.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{LOAN_TYPES.find(t => t.value === l.loan_type)?.label}{l.institution ? ` · ${l.institution}` : ''}</p>
                      </div>
                    </div>
                    <SimpleMenu items={[
                      { label: 'Make Payment',   fn: () => openLoanPayment(l), cls: 'text-green-600' },
                      { label: 'View History',   fn: () => setHistoryItem({ type: 'loan', id: l.id, name: l.name }) },
                      { label: 'Edit',           fn: () => openEdit('loan', l) },
                      { label: 'Delete',         fn: () => handleDelete('loans', l.id, setLoans), cls: 'text-destructive' },
                    ]} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <LoanStatusBadge status={l.loan_status} />
                    {l.account_id && (
                      <span className="text-[10px] text-muted-foreground">← {getAccountName(l.account_id)}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-bold text-sm" style={{ color: SECTION_COLORS.loan.bg }}>{fmt(Number(l.remaining))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Payment</p>
                      <p className="font-medium">{fmt(Number(l.monthly_payment))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Principal</p>
                      <p className="font-medium">{fmt(Number(l.principal))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-medium">{l.interest_rate}% p.a.</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{paidPct.toFixed(0)}% repaid</span>
                      <span>{fmt(Number(l.principal) - Number(l.remaining))} paid</span>
                    </div>
                    <ProgressBar value={Number(l.principal) - Number(l.remaining)} max={Number(l.principal)} color={SECTION_COLORS.loan.bg} />
                  </div>
                  {l.end_date && (
                    <p className="text-[10px] text-muted-foreground">
                      Ends: {new Date(l.end_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ══ DIALOGS ══════════════════════════════════════════════════ */}

      {/* Asset Dialog */}
      <Dialog open={dialogType === 'asset'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Asset' : 'Add Asset'}</DialogTitle></DialogHeader>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            <Tab id="basic" label="Basic Info" /><Tab id="financial" label="Financial" /><Tab id="details" label="Details" />
          </div>
          <form onSubmit={assetForm.handleSubmit(onSubmitAsset, onInvalid)} className="space-y-4">
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Asset Name *</Label>
                  <Input placeholder="e.g. MacBook Pro, Toyota Corolla" {...assetForm.register('name')} />
                  {assetForm.formState.errors.name && <p className="text-xs text-destructive">{assetForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select onValueChange={v => assetForm.setValue('asset_type', v, { shouldValidate: true })} defaultValue={assetForm.getValues('asset_type')}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {assetForm.formState.errors.asset_type && <p className="text-xs text-destructive">{assetForm.formState.errors.asset_type.message}</p>}
                </div>

                {/* Asset Category */}
                <div className="space-y-1.5">
                  <Label>Asset Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="flex gap-2">
                    <Select
                      onValueChange={v => assetForm.setValue('asset_category' as any, v)}
                      defaultValue={assetForm.getValues('asset_category' as any) || ''}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select or add category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Built-in groups */}
                        <SelectItem value="">No category</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="investment">Investment</SelectItem>
                        <SelectItem value="rental">Rental Property</SelectItem>
                        {/* Custom categories */}
                        {customAssetCategories.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Add custom category inline */}
                  <div className="flex gap-2 mt-1.5">
                    <input
                      className="flex-1 h-8 text-xs px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Add custom category..."
                      value={newAssetCat}
                      onChange={e => setNewAssetCat(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const v = newAssetCat.trim()
                          if (!v || customAssetCategories.map(c => c.toLowerCase()).includes(v.toLowerCase())) return
                          const updated = [...customAssetCategories, v]
                          setCustomAssetCategories(updated)
                          localStorage.setItem('ts_asset_categories', JSON.stringify(updated))
                          assetForm.setValue('asset_category' as any, v)
                          setNewAssetCat('')
                          toast({ title: `"${v}" added as asset category`, variant: 'success' })
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const v = newAssetCat.trim()
                        if (!v || customAssetCategories.map(c => c.toLowerCase()).includes(v.toLowerCase())) return
                        const updated = [...customAssetCategories, v]
                        setCustomAssetCategories(updated)
                        localStorage.setItem('ts_asset_categories', JSON.stringify(updated))
                        assetForm.setValue('asset_category' as any, v)
                        setNewAssetCat('')
                        toast({ title: `"${v}" added`, variant: 'success' })
                      }}
                      className="h-8 px-3 rounded-lg text-xs font-semibold border border-border hover:bg-muted transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Categories help you group assets (e.g. Business assets, Rental properties).
                  </p>
                </div>


                <div className="space-y-1.5">
                  <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Brief description…" {...assetForm.register('description')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select onValueChange={v => assetForm.setValue('status', v)} defaultValue={assetForm.getValues('status') || 'active'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <Select onValueChange={v => assetForm.setValue('condition', v)} defaultValue={assetForm.getValues('condition') || 'good'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Asset Tag</Label>
                    <div className="relative">
                      <Input {...assetForm.register('asset_tag')} className="pr-16" />
                      <button type="button" onClick={() => assetForm.setValue('asset_tag', generateTag())} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-semibold hover:underline">Regen</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input placeholder="e.g. Home, Office" {...assetForm.register('location')} />
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'financial' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Purchase Price *</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...assetForm.register('purchase_value')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Current Market Value *</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...assetForm.register('current_value')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Purchase Date</Label>
                  <Input type="date" {...assetForm.register('purchase_date')} />
                </div>
                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DepIcon className="w-3.5 h-3.5" /> Depreciation
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <Select onValueChange={v => assetForm.setValue('depreciation_method', v)} defaultValue={assetForm.getValues('depreciation_method') || 'none'}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DEPRECIATION_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Annual Rate %</Label>
                      <Input type="number" step="0.1" placeholder="e.g. 20" {...assetForm.register('annual_depreciation_rate')} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Useful Life (years)</Label>
                    <Input type="number" placeholder="e.g. 5" {...assetForm.register('useful_life_years')} />
                  </div>
                  {(() => {
                    const vals = assetForm.watch()
                    const dep  = calcDepreciation(vals)
                    if (!vals.annual_depreciation_rate || vals.depreciation_method === 'none') return null
                    return (
                      <div className="bg-orange-50 rounded-xl p-3 space-y-1 text-xs">
                        <p className="font-semibold text-orange-700">Depreciation Preview</p>
                        <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span><span className="font-medium">{fmt(Number(vals.purchase_value ?? 0))}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Annual Depr.</span><span className="font-medium text-orange-600">-{fmt(dep.annualAmount)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Current Depr. Value</span><span className="font-semibold">{fmt(dep.currentDepreciatedValue)}</span></div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Any additional notes…" {...assetForm.register('notes')} />
                </div>
                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Warranty
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label className="text-xs">Warranty Start</Label><Input type="date" {...assetForm.register('warranty_start' as any)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Warranty End</Label><Input type="date" {...assetForm.register('warranty_end' as any)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Provider</Label><Input placeholder="e.g. Samsung, HP" {...assetForm.register('warranty_provider' as any)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Warranty Number</Label><Input placeholder="e.g. WR-12345" {...assetForm.register('warranty_number' as any)} /></div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.asset.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Asset'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Investment Dialog */}
      <Dialog open={dialogType === 'investment'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Investment' : 'Add Investment'}</DialogTitle></DialogHeader>
          <form onSubmit={investmentForm.handleSubmit(onSubmitInvestment, onInvalid)} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. MTN Shares, Bitcoin Wallet" {...investmentForm.register('name')} />{investmentForm.formState.errors.name && <p className="text-xs text-destructive">{investmentForm.formState.errors.name.message}</p>}</div>
            <div className="space-y-1.5">
              <Label>Investment Type</Label>
              <Select onValueChange={v => investmentForm.setValue('investment_type', v, { shouldValidate: true })} defaultValue={investmentForm.getValues('investment_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {investmentForm.formState.errors.investment_type && <p className="text-xs text-destructive">{investmentForm.formState.errors.investment_type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Amount Invested</Label><Input type="number" step="0.01" placeholder="0.00" {...investmentForm.register('invested_amount')} /></div>
              <div className="space-y-1.5"><Label>Current Value</Label><Input type="number" step="0.01" placeholder="0.00" {...investmentForm.register('current_value')} /></div>
            </div>
            <div className="space-y-1.5"><Label>Institution <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="e.g. Databank, Binance" {...investmentForm.register('institution')} /></div>
            <div className="space-y-1.5"><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Any notes…" {...investmentForm.register('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.investment.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Investment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Debt Dialog */}
      <Dialog open={dialogType === 'debt'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Debt' : 'Add Debt'}</DialogTitle></DialogHeader>
          <form onSubmit={debtForm.handleSubmit(onSubmitDebt, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Money borrowed from Kofi, Phone on credit" {...debtForm.register('name')} />
              {debtForm.formState.errors.name && <p className="text-xs text-destructive">{debtForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Debt Type</Label>
              <Select onValueChange={v => debtForm.setValue('debt_type', v, { shouldValidate: true })} defaultValue={debtForm.getValues('debt_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{DEBT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {debtForm.formState.errors.debt_type && <p className="text-xs text-destructive">{debtForm.formState.errors.debt_type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Total Amount</Label><Input type="number" step="0.01" placeholder="0.00" {...debtForm.register('total_amount')} /></div>
              <div className="space-y-1.5"><Label>Remaining Balance</Label><Input type="number" step="0.01" placeholder="0.00" {...debtForm.register('remaining')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Interest Rate %</Label><Input type="number" step="0.1" placeholder="0.0" {...debtForm.register('interest_rate')} /></div>
              <div className="space-y-1.5"><Label>Due Date <span className="text-muted-foreground text-xs">(optional)</span></Label><Input type="date" {...debtForm.register('due_date')} /></div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select onValueChange={v => debtForm.setValue('debt_status', v)} defaultValue={debtForm.getValues('debt_status') || 'active'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paid_off">Paid Off</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Money received into account <span className="text-muted-foreground text-xs">(cash / where it arrived)</span></Label>
              <Select onValueChange={v => debtForm.setValue('account_id', v === 'none' ? '' : v)} defaultValue={debtForm.getValues('account_id') || 'none'}>
                <SelectTrigger><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default paying account <span className="text-muted-foreground text-xs">(used for repayments)</span></Label>
              <Select onValueChange={v => debtForm.setValue('paying_account_id', v === 'none' ? '' : v)} defaultValue={debtForm.getValues('paying_account_id') || 'none'}>
                <SelectTrigger><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Any notes…" {...debtForm.register('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.debt.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Debt'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loan Dialog */}
      <Dialog open={dialogType === 'loan'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Loan' : 'Add Loan'}</DialogTitle></DialogHeader>
          <form onSubmit={loanForm.handleSubmit(onSubmitLoan, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Loan Name</Label>
              <Input placeholder="e.g. GCB Mortgage" {...loanForm.register('name')} />
              {loanForm.formState.errors.name && <p className="text-xs text-destructive">{loanForm.formState.errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Loan Type</Label>
              <Select onValueChange={v => {
                if (v === '__custom__') { setShowCustomLoan(true) }
                else { loanForm.setValue('loan_type', v, { shouldValidate: true }); setShowCustomLoan(false) }
              }} defaultValue={loanForm.getValues('loan_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  <SelectItem value="__custom__">+ Add custom type…</SelectItem>
                </SelectContent>
              </Select>
              {showCustomLoan && (
                <div className="flex gap-2 mt-1">
                  <Input placeholder="e.g. Salary Advance, Co-op Loan" value={customLoanType}
                    onChange={e => setCustomLoanType(e.target.value)} className="flex-1" />
                  <Button type="button" size="sm" onClick={() => {
                    if (customLoanType.trim()) {
                      loanForm.setValue('loan_type', 'custom', { shouldValidate: true })
                      loanForm.setValue('custom_loan_type', customLoanType.trim())
                      setShowCustomLoan(false)
                    }
                  }}>Use</Button>
                </div>
              )}
              {loanForm.watch('custom_loan_type') && !showCustomLoan && (
                <p className="text-xs text-primary">Custom type: {loanForm.watch('custom_loan_type')}</p>
              )}
              {loanForm.formState.errors.loan_type && <p className="text-xs text-destructive">{loanForm.formState.errors.loan_type.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Principal</Label><Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('principal')} /></div>
              <div className="space-y-1.5"><Label>Remaining</Label><Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('remaining')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Interest % p.a.</Label><Input type="number" step="0.1" placeholder="0.0" {...loanForm.register('interest_rate')} /></div>
              <div className="space-y-1.5"><Label>Monthly Payment</Label><Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('monthly_payment')} /></div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select onValueChange={v => loanForm.setValue('loan_status', v)} defaultValue={loanForm.getValues('loan_status') || 'active'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paid_off">Paid Off</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Loan received into account <span className="text-muted-foreground text-xs">(where money landed)</span></Label>
              <Select onValueChange={v => loanForm.setValue('account_id', v === 'none' ? '' : v)} defaultValue={loanForm.getValues('account_id') || 'none'}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default paying account <span className="text-muted-foreground text-xs">(used for repayments)</span></Label>
              <Select onValueChange={v => loanForm.setValue('paying_account_id', v === 'none' ? '' : v)} defaultValue={loanForm.getValues('paying_account_id') || 'none'}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5"><Label>Institution <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="e.g. GCB Bank" {...loanForm.register('institution')} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" {...loanForm.register('start_date')} /></div>
              <div className="space-y-1.5"><Label>End Date</Label><Input type="date" {...loanForm.register('end_date')} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Any notes…" {...loanForm.register('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.loan.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Loan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={dialogType === 'sell'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" /> Sell Asset</DialogTitle></DialogHeader>
          {editingId && (() => {
            const asset = assets.find(a => a.id === editingId)
            const soldPrice = sellForm.watch('sold_price')
            const gain = Number(soldPrice ?? 0) - Number(asset?.purchase_value ?? 0)
            return (
              <form onSubmit={sellForm.handleSubmit(onSubmitSell, onInvalid)} className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-3 text-sm"><p className="font-semibold">{asset?.name}</p><p className="text-xs text-muted-foreground mt-0.5">Purchase price: {fmt(Number(asset?.purchase_value ?? 0))}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Sale Price *</Label><Input type="number" step="0.01" placeholder="0.00" {...sellForm.register('sold_price')} /></div>
                  <div className="space-y-1.5"><Label>Sale Date *</Label><Input type="date" {...sellForm.register('sold_date')} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Deposit proceeds to *</Label>
                  <Select onValueChange={v => sellForm.setValue('account_id', v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Which account receives the cash?" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {sellForm.formState.errors.account_id && <p className="text-xs text-destructive">{sellForm.formState.errors.account_id.message}</p>}
                  {accounts.length === 0 && <p className="text-xs text-amber-600">Add an account in My Accounts first.</p>}
                </div>
                <div className="space-y-1.5"><Label>Buyer <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Buyer name" {...sellForm.register('sold_to')} /></div>
                <div className="space-y-1.5"><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Any notes…" {...sellForm.register('notes')} /></div>
                {soldPrice > 0 && (
                  <div className={`rounded-xl p-3 text-sm ${gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex justify-between"><span className="text-muted-foreground">Sale Price</span><span className="font-semibold">{fmt(Number(soldPrice))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Purchase Price</span><span>{fmt(Number(asset?.purchase_value ?? 0))}</span></div>
                    <div className="flex justify-between border-t border-border mt-2 pt-2"><span className="font-semibold">Gain / Loss</span><span className={`font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</span></div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
                  <Button type="submit" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Sale'}</Button>
                </div>
              </form>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Dispose Dialog */}
      <Dialog open={dialogType === 'dispose'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-orange-500" /> Dispose Asset</DialogTitle></DialogHeader>
          <form onSubmit={disposeForm.handleSubmit(onSubmitDispose, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Disposal Reason *</Label>
              <Select onValueChange={v => disposeForm.setValue('disposal_reason', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>{['Donated','Lost','Destroyed','Scrapped','Transferred','Other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              {disposeForm.formState.errors.disposal_reason && <p className="text-xs text-destructive">{disposeForm.formState.errors.disposal_reason.message}</p>}
            </div>
            <div className="space-y-1.5"><Label>Disposal Date *</Label><Input type="date" {...disposeForm.register('disposal_date')} /></div>
            <div className="space-y-1.5"><Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="Any notes…" {...disposeForm.register('notes')} /></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Disposal'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Investment Value Dialog */}
      <Dialog open={dialogType === 'invest_add'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" /> Add Investment Value</DialogTitle></DialogHeader>
          {editingId && (() => {
            const inv         = investments.find(i => i.id === editingId)
            const added       = Number(newBalance || 0)
            const newCurrent  = Number(inv?.current_value ?? 0) + added
            const newInvTotal = Number(inv?.invested_amount ?? 0) + added
            return (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-3 text-sm space-y-1">
                  <p className="font-semibold">{inv?.name}</p>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Current value</span><span className="font-bold text-blue-700">{fmt(Number(inv?.current_value ?? 0))}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total invested</span><span>{fmt(Number(inv?.invested_amount ?? 0))}</span></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount to Add *</Label>
                  <Input type="number" step="0.01" placeholder="Enter amount e.g. 500.00" value={newBalance} onChange={e => setNewBalance(e.target.value)} autoFocus />
                  <p className="text-xs text-muted-foreground">Added to both current value and total invested.</p>
                </div>
                {added > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-1.5 text-sm">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">After this addition</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Value</span><span className="font-bold text-blue-600">{fmt(newCurrent)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Total Invested</span><span className="font-medium">{fmt(newInvTotal)}</span></div>
                    <div className="flex justify-between border-t border-blue-100 pt-1.5"><span className="text-muted-foreground">Amount Added</span><span className="font-bold text-green-600">+{fmt(added)}</span></div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={investDate} onChange={e => setInvestDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Income Type</Label>
                  <Select value={investIncomeType} onValueChange={setInvestIncomeType}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{INVEST_INCOME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Record income to account <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select value={investAccountId || 'none'} onValueChange={v => setInvestAccountId(v === 'none' ? '' : v)}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">If selected, an income record will be created in that account.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="e.g. Monthly dividend from MTN shares…" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => { setDialogType(null); setNewBalance(''); setInvestAccountId('') }}>Cancel</Button>
                  <Button onClick={handleInvestAdd} disabled={loading || !newBalance || Number(newBalance) <= 0} className="bg-blue-600 text-white hover:bg-blue-700">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Value'}
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Debt Payment Dialog */}
      <Dialog open={dialogType === 'debt_payment'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-green-600" /> Make Debt Payment</DialogTitle></DialogHeader>
          {editingId && (() => {
            const debt         = debts.find(d => d.id === editingId)
            const newRemaining = Math.max(0, Number(debt?.remaining ?? 0) - Number(paymentAmt || 0))
            const pct          = Number(debt?.total_amount ?? 0) > 0 ? Math.round(((Number(debt?.total_amount ?? 0) - newRemaining) / Number(debt?.total_amount ?? 0)) * 100) : 0
            return (
              <div className="space-y-4">
                <div className="bg-red-50 rounded-xl p-3 text-sm space-y-1">
                  <p className="font-semibold">{debt?.name}</p>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining</span><span className="font-bold text-destructive">{fmt(Number(debt?.remaining ?? 0))}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Interest rate</span><span>{debt?.interest_rate}%</span></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Amount</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={paymentAmt} onChange={e => setPaymentAmt(e.target.value)} autoFocus />
                </div>
                {paymentAmt && Number(paymentAmt) > 0 && (
                  <div className="rounded-xl p-3 space-y-2 bg-green-50 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-semibold text-green-600">-{fmt(Number(paymentAmt))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Balance</span><span className="font-bold">{fmt(newRemaining)}</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} /></div>
                    <p className="text-xs text-muted-foreground">{pct}% of debt cleared</p>
                    {newRemaining === 0 && <p className="text-green-700 font-semibold text-center">🎉 Debt will be fully cleared!</p>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Pay from account</Label>
                  <Select value={payingAccountId || 'none'} onValueChange={v => setPayingAccountId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {payingAccountId && <p className="text-xs text-muted-foreground">This will also record an expense in that account.</p>}
                </div>
                <div className="space-y-1.5"><Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="e.g. Monthly installment…" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
                  <Button onClick={handleDebtPayment} disabled={loading} className="bg-green-600 text-white hover:bg-green-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Loan Payment Dialog */}
      <Dialog open={dialogType === 'loan_payment'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-green-600" /> Make Loan Payment</DialogTitle></DialogHeader>
          {editingId && (() => {
            const loan         = loans.find(l => l.id === editingId)
            const newRemaining = Math.max(0, Number(loan?.remaining ?? 0) - Number(paymentAmt || 0))
            const pct          = Number(loan?.principal ?? 0) > 0 ? Math.round(((Number(loan?.principal ?? 0) - newRemaining) / Number(loan?.principal ?? 0)) * 100) : 0
            const overpay      = Number(paymentAmt || 0) > Number(loan?.remaining ?? 0)
            return (
              <div className="space-y-4">
                <div className="bg-amber-50 rounded-xl p-3 text-sm space-y-1">
                  <p className="font-semibold">{loan?.name}</p>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining</span><span className="font-bold" style={{ color: SECTION_COLORS.loan.bg }}>{fmt(Number(loan?.remaining ?? 0))}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Monthly payment</span><span>{fmt(Number(loan?.monthly_payment ?? 0))}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Interest rate</span><span>{loan?.interest_rate}% p.a.</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPaymentAmt(String(loan?.monthly_payment ?? 0))} className="flex-1 text-xs py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium">
                    Monthly ({fmt(Number(loan?.monthly_payment ?? 0))})
                  </button>
                  <button onClick={() => setPaymentAmt(String(loan?.remaining ?? 0))} className="flex-1 text-xs py-1.5 rounded-lg border border-border hover:bg-muted transition-colors font-medium text-green-600">
                    Pay Off All
                  </button>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Amount</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={paymentAmt} onChange={e => setPaymentAmt(e.target.value)} autoFocus />
                  {overpay && <p className="text-xs text-orange-500">Amount exceeds remaining — will clear the loan fully.</p>}
                </div>
                {paymentAmt && Number(paymentAmt) > 0 && (
                  <div className="rounded-xl p-3 space-y-2 bg-green-50 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-semibold text-green-600">-{fmt(Number(paymentAmt))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">New Balance</span><span className="font-bold">{fmt(newRemaining)}</span></div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} /></div>
                    <p className="text-xs text-muted-foreground">{pct}% of loan repaid</p>
                    {newRemaining === 0 && <p className="text-green-700 font-semibold text-center">🎉 Loan will be fully paid off!</p>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Pay from account</Label>
                  <Select value={payingAccountId || 'none'} onValueChange={v => setPayingAccountId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No account</SelectItem>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {payingAccountId && <p className="text-xs text-muted-foreground">This will also record an expense in that account.</p>}
                </div>
                <div className="space-y-1.5"><Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label><Input placeholder="e.g. Monthly installment, extra payment…" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} /></div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
                  <Button onClick={handleLoanPayment} disabled={loading} className="bg-green-600 text-white hover:bg-green-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Set Exchange Rate Dialog (per currency, applied to all accounts in that currency) */}
      <Dialog open={!!editingRateCurrency} onOpenChange={o => !o && setEditingRateCurrency(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" /> Set Exchange Rate — {editingRateCurrency}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Applies to every {editingRateCurrency} account. Used to convert this currency into GHS for Net Worth totals.
            </p>
            <div className="space-y-1.5">
              <Label>1 {editingRateCurrency} = ? GHS</Label>
              <Input type="number" step="0.0001" placeholder="e.g. 12.50" value={rateInputValue} onChange={e => setRateInputValue(e.target.value)} autoFocus />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingRateCurrency(null)}>Cancel</Button>
              <Button onClick={saveExchangeRate} disabled={savingRate || !rateInputValue || Number(rateInputValue) <= 0} className="bg-blue-600 text-white hover:bg-blue-700">
                {savingRate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Rate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sold Assets Panel */}
      <Dialog open={showSoldAssets} onOpenChange={setShowSoldAssets}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-blue-600" /> Sold Assets ({soldAssets.length})</DialogTitle></DialogHeader>
          {soldAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assets sold yet</p>
          ) : (
            <div className="space-y-3">
              {soldAssets.map(a => {
                const gain = Number(a.sold_price ?? 0) - Number(a.purchase_value ?? 0)
                const destAccount = accounts.find(acc => acc.id === a.sold_account_id)
                return (
                  <div key={a.id} className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{a.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 font-semibold">Sold</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p className="text-muted-foreground">Sale Price</p><p className="font-medium">{fmt(Number(a.sold_price ?? 0))}</p></div>
                      <div><p className="text-muted-foreground">Purchase Price</p><p className="font-medium">{fmt(Number(a.purchase_value ?? 0))}</p></div>
                      <div><p className="text-muted-foreground">Gain / Loss</p><p className={`font-semibold ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>{gain >= 0 ? '+' : ''}{fmt(gain)}</p></div>
                      <div><p className="text-muted-foreground">Sale Date</p><p className="font-medium">{a.sold_date ? new Date(a.sold_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p></div>
                    </div>
                    {a.sold_to && <p className="text-xs text-muted-foreground">Buyer: {a.sold_to}</p>}
                    {destAccount && <p className="text-xs text-muted-foreground">Proceeds deposited to: <span className="font-medium">{destAccount.name}</span></p>}
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setShowSoldAssets(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Related Accounts Panel — the per-account breakdown previously shown inline in Cash & Liquid */}
      <Dialog open={showRelatedAccounts} onOpenChange={setShowRelatedAccounts}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" /> Related Accounts</DialogTitle></DialogHeader>
          {accountsWithBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No accounts yet</p>
          ) : (
            <div className="space-y-1.5">
              {accountsWithBalance.filter(a => !(a as any).is_custody && !(a as any).exclude_from_net).map(a => {
                const typeInfo = [
                  { value: 'bank', icon: Building2 },
                  { value: 'mobile_money', icon: PhoneIcon },
                  { value: 'cash', icon: Banknote },
                  { value: 'investment', icon: TrendingUp },
                ].find(t => t.value === a.type)
                const Icon = typeInfo?.icon ?? Banknote
                return (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(Number(a.balance ?? 0), a.currency || 'GHS')}</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <a href="/user-accounts" className="text-xs font-semibold text-emerald-700 hover:underline">
              Manage all accounts →
            </a>
            <Button variant="outline" onClick={() => setShowRelatedAccounts(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction History Dialog — Loan or Debt */}
      <Dialog open={!!historyItem} onOpenChange={o => !o && setHistoryItem(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Payment History — {historyItem?.name}
            </DialogTitle>
          </DialogHeader>
          {historyItem && (() => {
            const payments = historyItem.type === 'loan'
              ? loanPayments.filter(p => p.loan_id === historyItem.id)
              : debtPayments.filter(p => p.debt_id === historyItem.id)
            const total = payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
            return (
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No payments recorded yet</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
                      <p className="text-sm font-semibold text-green-800">Total Paid</p>
                      <p className="text-sm font-bold text-green-700 tabular-nums">{fmt(total)}</p>
                    </div>
                    <div className="divide-y divide-border">
                      {payments.map((p: any) => (
                        <div key={p.id} className="flex items-center gap-3 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                            <ArrowDownRight className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{fmt(Number(p.amount))}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.paid_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {p.account_id && ` · from ${getAccountName(p.account_id)}`}
                              {p.note && ` · ${p.note}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="flex justify-end pt-2 border-t border-border">
                  <Button variant="outline" onClick={() => setHistoryItem(null)}>Close</Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      

      {/* Asset Detail Panel */}
      {detailAsset && (
        <AssetDetailPanel
          asset={detailAsset}
          onClose={() => setDetailAsset(null)}
          onUpdate={updated => { setAssets(p => p.map(a => a.id === updated.id ? updated : a)); setDetailAsset(updated) }}
        />
      )}
    </div>
  )
}