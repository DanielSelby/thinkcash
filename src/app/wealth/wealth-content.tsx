'use client'

import { useState, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2, TrendingUp, TrendingDown,
  Landmark, Car, Gem, Smartphone, BarChart3, Bitcoin,
  Building2, CreditCard, AlertTriangle, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, PiggyBank, MoreVertical,
  Tag, MapPin, Calendar, ShieldCheck, DollarSign,
  TrendingDown as DepIcon, CheckCircle2, XCircle, Clock,
  Banknote, Wallet2, Coins, Smartphone as PhoneIcon,
  RefreshCw,
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

const fmt = (n: number) => formatCurrency(n, 'GHS')

// ── Constants ─────────────────────────────────────────────────────────
const ASSET_TYPES = [
  { value: 'property',    label: 'Property',         icon: Building2 },
  { value: 'vehicle',     label: 'Vehicle',          icon: Car       },
  { value: 'electronics', label: 'Electronics',      icon: Smartphone},
  { value: 'jewelry',     label: 'Jewelry',          icon: Gem       },
  { value: 'cash',        label: 'Cash & Liquid',    icon: Banknote  },
  { value: 'other',       label: 'Other',            icon: Landmark  },
]

const LIQUID_ASSET_SUBTYPES = [
  { value: 'cash_in_hand',   label: 'Cash in Hand',     icon: Banknote  },
  { value: 'bank_account',   label: 'Bank Account',     icon: Building2 },
  { value: 'mobile_money',   label: 'Mobile Money',     icon: PhoneIcon },
  { value: 'savings',        label: 'Savings Account',  icon: PiggyBank },
  { value: 'fixed_deposit',  label: 'Fixed Deposit',    icon: Coins     },
  { value: 'treasury_bill',  label: 'Treasury Bill',    icon: Landmark  },
  { value: 'other_liquid',   label: 'Other Liquid',     icon: Wallet2   },
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
  { value: 'buy_now_pay_later', label: 'Buy Now Pay Later'  },
  { value: 'other',             label: 'Other'             },
]

const LOAN_TYPES = [
  { value: 'mortgage', label: 'Mortgage'       },
  { value: 'personal', label: 'Personal Loan'  },
  { value: 'car',      label: 'Car Loan'       },
  { value: 'student',  label: 'Student Loan'   },
  { value: 'business', label: 'Business Loan'  },
  { value: 'other',    label: 'Other'          },
]

const ASSET_STATUSES = [
  { value: 'active',       label: 'Active',       color: '#16a34a' },
  { value: 'sold',         label: 'Sold',         color: '#2563eb' },
  { value: 'disposed',     label: 'Disposed',     color: '#dc2626' },
  { value: 'donated',      label: 'Donated',      color: '#9333ea' },
  { value: 'lost',         label: 'Lost',         color: '#f59e0b' },
  { value: 'maintenance',  label: 'Maintenance',  color: '#0891b2' },
]

const ASSET_CONDITIONS = [
  { value: 'new',       label: 'New'       },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good',      label: 'Good'      },
  { value: 'fair',      label: 'Fair'      },
  { value: 'poor',      label: 'Poor'      },
]

const DEPRECIATION_METHODS = [
  { value: 'straight_line',      label: 'Straight Line'      },
  { value: 'declining_balance',  label: 'Declining Balance'  },
  { value: 'none',               label: 'None / Manual'      },
]

const SECTION_COLORS = {
  asset:      { bg: '#16a34a', light: '#dcfce7', text: '#15803d' },
  investment: { bg: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
  debt:       { bg: '#dc2626', light: '#fee2e2', text: '#b91c1c' },
  loan:       { bg: '#f59e0b', light: '#fef3c7', text: '#d97706' },
}

// ── Helpers ───────────────────────────────────────────────────────────
function calcDepreciation(asset: any): { currentDepreciatedValue: number; annualAmount: number; yearsElapsed: number } {
  const purchaseVal = Number(asset.purchase_value ?? 0)
  const rate        = Number(asset.annual_depreciation_rate ?? 0)
  const method      = asset.depreciation_method ?? 'none'
  const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null

  if (!purchaseDate || !rate || method === 'none' || purchaseVal === 0) {
    return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0 }
  }

  const yearsElapsed = Math.max(0, (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))

  if (method === 'straight_line') {
    const annualAmount = purchaseVal * (rate / 100)
    const depreciatedValue = Math.max(0, purchaseVal - annualAmount * yearsElapsed)
    return { currentDepreciatedValue: depreciatedValue, annualAmount, yearsElapsed }
  }

  if (method === 'declining_balance') {
    const depreciatedValue = purchaseVal * Math.pow(1 - rate / 100, yearsElapsed)
    const annualAmount = purchaseVal * (rate / 100)
    return { currentDepreciatedValue: Math.max(0, depreciatedValue), annualAmount, yearsElapsed }
  }

  return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0 }
}

function getAssetAge(purchaseDate: string | null): string {
  if (!purchaseDate) return '—'
  const ms = Date.now() - new Date(purchaseDate).getTime()
  const years  = Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000))
  const months = Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000))
  if (years > 0) return `${years}y ${months}m`
  return `${months}m`
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
    new: '#2563eb', excellent: '#16a34a', good: '#0891b2', fair: '#f59e0b', poor: '#dc2626'
  }
  const color = colors[condition] ?? '#94a3b8'
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: color + '20', color }}>
      {condition?.charAt(0).toUpperCase() + condition?.slice(1) || '—'}
    </span>
  )
}

function KPI({ label, value, sub, bg, icon: Icon }: {
  label: string; value: string; sub?: string; bg: string; icon: any
}) {
  return (
    <Card className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="h-1" style={{ background: bg }} />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">{label}</p>
            <p className="text-lg sm:text-2xl font-bold tabular-nums mt-1 truncate">{value}</p>
            {sub && <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: bg + '18' }}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: bg }} />
          </div>
        </div>
      </CardContent>
    </Card>
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: color.light }}>
              <Icon className="w-4 h-4" style={{ color: color.bg }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
              <p className="text-xs text-muted-foreground">{count} entr{count === 1 ? 'y' : 'ies'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" onClick={onAdd}
              style={{ background: color.bg, color: '#fff' }}
              className="h-8 text-xs gap-1">
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

// ── Actions dropdown ──────────────────────────────────────────────────
function AssetActionsMenu({ onView, onEdit, onSell, onDispose, onDelete }: {
  onView: () => void; onEdit: () => void; onSell: () => void; onDispose: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {[
              { label: 'View Details', fn: onView,    cls: '' },
            { label: 'Edit',         fn: onEdit,    cls: '' },
              { label: 'Sell',    fn: onSell,    cls: 'text-blue-600' },
              { label: 'Dispose', fn: onDispose, cls: 'text-orange-500' },
              { label: 'Delete',  fn: onDelete,  cls: 'text-destructive' },
            ].map(item => (
              <button key={item.label}
                onClick={() => { setOpen(false); item.fn() }}
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

// ── Schemas ───────────────────────────────────────────────────────────
const assetSchema = z.object({
  name:                     z.string().min(1, 'Name required'),
  asset_type:               z.string().min(1, 'Type required'),
  is_liquid:                z.boolean().optional(),
  liquid_subtype:           z.string().optional(),
  currency:                 z.string().optional(),
  account_id:               z.string().optional(),
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
  name:          z.string().min(1, 'Name required'),
  debt_type:     z.string().min(1, 'Type required'),
  total_amount:  z.coerce.number().min(0),
  remaining:     z.coerce.number().min(0),
  interest_rate: z.coerce.number().min(0).max(100),
  due_date:      z.string().optional(),
  notes:         z.string().optional(),
})
type DebtFormData = z.infer<typeof debtSchema>

const loanSchema = z.object({
  name:            z.string().min(1, 'Name required'),
  loan_type:       z.string().min(1, 'Type required'),
  principal:       z.coerce.number().min(0),
  remaining:       z.coerce.number().min(0),
  interest_rate:   z.coerce.number().min(0).max(100),
  monthly_payment: z.coerce.number().min(0),
  start_date:      z.string().optional(),
  end_date:        z.string().optional(),
  institution:     z.string().optional(),
  notes:           z.string().optional(),
})
type LoanFormData = z.infer<typeof loanSchema>

const sellSchema = z.object({
  sold_price:  z.coerce.number().min(0, 'Sale price required'),
  sold_date:   z.string().min(1, 'Date required'),
  sold_to:     z.string().optional(),
  notes:       z.string().optional(),
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
  userId:             string
}

export function WealthContent({ initialAssets, initialInvestments, initialDebts, initialLoans, initialAccounts, userId }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [assets,      setAssets]      = useState<any[]>(initialAssets)
  const [accounts]                    = useState<any[]>(initialAccounts)
  const [investments, setInvestments] = useState<any[]>(initialInvestments)
  const [debts,       setDebts]       = useState<any[]>(initialDebts)
  const [loans,       setLoans]       = useState<any[]>(initialLoans)

  // dialog states
  type DialogType = 'asset' | 'investment' | 'debt' | 'loan' | 'sell' | 'dispose' | null
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [activeTab,  setActiveTab]  = useState<'basic' | 'financial' | 'details'>('basic')

  const [detailAsset, setDetailAsset] = useState<any | null>(null)

  // search/filter
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Forms
  const assetForm = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: { name: '', asset_type: '', description: '', asset_tag: generateTag(), current_value: 0, purchase_value: 0, purchase_date: '', location: '', status: 'active', condition: 'good', useful_life_years: undefined, depreciation_method: 'none', annual_depreciation_rate: 0, notes: '' },
  })
  const investmentForm = useForm<InvestmentFormData>({ resolver: zodResolver(investmentSchema) })
  const debtForm       = useForm<DebtFormData>({ resolver: zodResolver(debtSchema) })
  const loanForm       = useForm<LoanFormData>({ resolver: zodResolver(loanSchema) })
  const sellForm       = useForm<SellFormData>({ resolver: zodResolver(sellSchema), defaultValues: { sold_date: new Date().toISOString().split('T')[0] } })
  const disposeForm    = useForm<DisposeFormData>({ resolver: zodResolver(disposeSchema), defaultValues: { disposal_date: new Date().toISOString().split('T')[0] } })

  // ── Totals ────────────────────────────────────────────────────────
  const activeAssets     = useMemo(() => assets.filter(a => a.status !== 'sold' && a.status !== 'disposed' && a.status !== 'donated'), [assets])
  const totalAssets      = useMemo(() => activeAssets.reduce((s, a) => s + Number(a.current_value ?? 0), 0), [activeAssets])
  const totalLiquid      = useMemo(() => activeAssets.filter(a => a.is_liquid || a.asset_type === 'cash').reduce((s, a) => s + Number(a.current_value ?? 0), 0), [activeAssets])
  const totalPhysical    = useMemo(() => activeAssets.filter(a => !a.is_liquid && a.asset_type !== 'cash').reduce((s, a) => s + Number(a.current_value ?? 0), 0), [activeAssets])
  const totalInvested    = useMemo(() => investments.reduce((s, i) => s + Number(i.current_value ?? 0), 0), [investments])
  const totalDebts       = useMemo(() => debts.reduce((s, d) => s + Number(d.remaining ?? 0), 0), [debts])
  const totalLoans       = useMemo(() => loans.reduce((s, l) => s + Number(l.remaining ?? 0), 0), [loans])
  const netWorth         = totalAssets + totalInvested - totalDebts - totalLoans
  const totalLiabilities = totalDebts + totalLoans

  const investmentGain = useMemo(() =>
    investments.reduce((s, i) => s + (Number(i.current_value ?? 0) - Number(i.invested_amount ?? 0)), 0),
    [investments])

  // Analytics
  const analytics = useMemo(() => {
    if (!activeAssets.length) return null
    const sorted = [...activeAssets].sort((a, b) => Number(b.current_value) - Number(a.current_value))
    const mostAppreciated = [...activeAssets].sort((a, b) =>
      (Number(b.current_value) - Number(b.purchase_value)) - (Number(a.current_value) - Number(a.purchase_value))
    )[0]
    const mostDepreciated = [...activeAssets].sort((a, b) =>
      (Number(a.current_value) - Number(a.purchase_value)) - (Number(b.current_value) - Number(b.purchase_value))
    )[0]
    return {
      highest: sorted[0],
      lowest:  sorted[sorted.length - 1],
      mostAppreciated,
      mostDepreciated,
      avgValue: totalAssets / activeAssets.length,
      soldCount: assets.filter(a => a.status === 'sold').length,
    }
  }, [activeAssets, assets, totalAssets])

  // Filtered assets
  const filteredAssets = useMemo(() =>
    assets.filter(a => {
      const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || a.status === statusFilter
      return matchSearch && matchStatus
    }), [assets, search, statusFilter])

  // ── Dialog helpers ────────────────────────────────────────────────
  const openCreate = (type: DialogType) => {
    setEditingId(null); setDialogType(type); setActiveTab('basic')
    if (type === 'asset') assetForm.reset({ name: '', asset_type: '', is_liquid: false, liquid_subtype: '', currency: 'GHS', account_id: '', description: '', asset_tag: generateTag(), current_value: 0, purchase_value: 0, purchase_date: '', location: '', status: 'active', condition: 'good', useful_life_years: undefined, depreciation_method: 'none', annual_depreciation_rate: 0, notes: '' })
    if (type === 'investment') investmentForm.reset({ name: '', investment_type: '', invested_amount: 0, current_value: 0, institution: '', notes: '' })
    if (type === 'debt') debtForm.reset({ name: '', debt_type: '', total_amount: 0, remaining: 0, interest_rate: 0, due_date: '', notes: '' })
    if (type === 'loan') loanForm.reset({ name: '', loan_type: '', principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0, start_date: '', end_date: '', institution: '', notes: '' })
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
    sellForm.reset({ sold_price: Number(asset.current_value), sold_date: new Date().toISOString().split('T')[0], sold_to: '', notes: '' })
    setDialogType('sell')
  }

  const openDispose = (asset: any) => {
    setEditingId(asset.id)
    disposeForm.reset({ disposal_reason: '', disposal_date: new Date().toISOString().split('T')[0], notes: '' })
    setDialogType('dispose')
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  const handleDelete = async (table: string, id: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setter(prev => prev.filter((x: any) => x.id !== id)); toast({ title: 'Deleted' }) }
  }

  const onSubmitAsset = async (data: AssetFormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload = { ...data, updated_at: new Date().toISOString() }
    if (editingId) {
      const { data: updated, error } = await supabase.from('assets').update(payload).eq('id', editingId).select().single()
      if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
      else { setAssets(p => p.map(x => x.id === editingId ? updated : x)); toast({ title: 'Asset updated', variant: 'success' }); setDialogType(null) }
    } else {
      const { data: created, error } = await supabase.from('assets').insert({ ...data, user_id: userId }).select().single()
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
      sold_to: data.sold_to || null, notes: data.notes || asset?.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else {
      setAssets(p => p.map(x => x.id === editingId ? updated : x))
      toast({ title: `Asset sold — ${gain >= 0 ? '+' : ''}${fmt(gain)} gain/loss`, variant: 'success' })
      setDialogType(null)
    }
    setLoading(false)
  }

  const onSubmitDispose = async (data: DisposeFormData) => {
    if (!editingId) return
    setLoading(true)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('assets').update({
      status: 'disposed', disposal_reason: data.disposal_reason,
      disposal_date: data.disposal_date,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else {
      setAssets(p => p.map(x => x.id === editingId ? updated : x))
      toast({ title: 'Asset disposed', variant: 'success' })
      setDialogType(null)
    }
    setLoading(false)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast({ title: 'Fix form errors', description: first?.message, variant: 'destructive' })
  }

  // Tab pill
  const Tab = ({ id, label }: { id: 'basic' | 'financial' | 'details'; label: string }) => (
    <button onClick={() => setActiveTab(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        activeTab === id ? 'text-white' : 'text-muted-foreground hover:text-foreground'
      }`}
      style={activeTab === id ? { background: SECTION_COLORS.asset.bg } : {}}>
      {label}
    </button>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
          Net Worth Tracker
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Assets + Investments − Debts − Loans = Net Worth</p>
      </div>

      {/* Net Worth Hero */}
      <Card className="rounded-xl shadow-sm border border-border overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Estimated Net Worth</p>
              <p className="text-white text-3xl sm:text-4xl font-bold tabular-nums mt-1">{fmt(netWorth)}</p>
              <p className="text-white/70 text-xs mt-2">
                {netWorth >= 0 ? '✓ Positive net worth' : '⚠ Liabilities exceed assets'}
              </p>
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

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Physical Assets"  value={fmt(totalPhysical)} sub={`${activeAssets.filter(a => !a.is_liquid && a.asset_type !== 'cash').length} items`} bg={SECTION_COLORS.asset.bg} icon={Landmark} />
        <KPI label="Cash & Liquid"    value={fmt(totalLiquid)}   sub={`${activeAssets.filter(a => a.is_liquid || a.asset_type === 'cash').length} items`}  bg="#059669"                 icon={Banknote}  />
        <KPI label="Investments"      value={fmt(totalInvested)} sub={investmentGain >= 0 ? `+${fmt(investmentGain)} gain` : `${fmt(investmentGain)} loss`} bg={SECTION_COLORS.investment.bg} icon={TrendingUp} />
        <KPI label="Debts"            value={fmt(totalDebts)}    sub={`${debts.length} account(s)`}    bg={SECTION_COLORS.debt.bg}       icon={CreditCard}  />
        <KPI label="Loans"            value={fmt(totalLoans)}    sub={`${loans.length} loan(s)`}       bg={SECTION_COLORS.loan.bg}       icon={Building2}   />
      </div>

      {/* Liquid Assets Summary */}
      {assets.filter(a => a.is_liquid || a.asset_type === 'cash').length > 0 && (() => {
        const liquidAssets = assets.filter(a => (a.is_liquid || a.asset_type === 'cash') && a.status === 'active')
        const liquidByCurrency: Record<string, number> = {}
        liquidAssets.forEach(a => {
          const cur = a.currency || 'GHS'
          liquidByCurrency[cur] = (liquidByCurrency[cur] || 0) + Number(a.current_value ?? 0)
        })
        return (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Cash & Liquid Assets</p>
              <span className="ml-auto text-xs text-emerald-600">{liquidAssets.length} item(s)</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(liquidByCurrency).map(([cur, amt]) => (
                <div key={cur} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                  <p className="text-xs text-muted-foreground">{cur}</p>
                  <p className="font-bold tabular-nums text-emerald-700">{formatCurrency(amt, cur)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5">
              {liquidAssets.map(a => {
                const subtype = LIQUID_ASSET_SUBTYPES.find(s => s.value === a.liquid_subtype)
                const Icon = subtype?.icon ?? Banknote
                return (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Icon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="font-semibold tabular-nums text-emerald-700">
                      {formatCurrency(Number(a.current_value ?? 0), a.currency || 'GHS')}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Analytics row */}
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
            <p className="text-xs text-green-600 tabular-nums">
              +{fmt(Math.max(0, Number(analytics.mostAppreciated?.current_value ?? 0) - Number(analytics.mostAppreciated?.purchase_value ?? 0)))}
            </p>
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

      {/* ── Assets Section ── */}
      <Section title="Physical Assets" count={filteredAssets.length} color={SECTION_COLORS.asset} icon={Landmark}
        onAdd={() => openCreate('asset')}>

        {/* Asset search + filter */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Input placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[160px] h-8 text-sm bg-white" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {ASSET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: SECTION_COLORS.asset.light }}>
                        <Icon className="w-4 h-4" style={{ color: SECTION_COLORS.asset.bg }} />
                      </div>
                      <div className="min-w-0">
                        <button
  onClick={() => setDetailAsset(a)}
  className="font-semibold text-sm truncate hover:underline text-left"
  style={{ color: SECTION_COLORS.asset.bg }}
>
  {a.name}
</button>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground capitalize">{typeInfo?.label}</span>
                          {a.asset_tag && (
                            <span className="text-[10px] text-muted-foreground font-mono">· {a.asset_tag}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <AssetActionsMenu
                      onView={() => setDetailAsset(a)}
                      onEdit={() => openEdit('asset', a)}
                      onSell={() => openSell(a)}
                      onDispose={() => openDispose(a)}
                      onDelete={() => handleDelete('assets', a.id, setAssets)}
                    />
                  </div>

                  {/* Badges */}
                  <div className="flex gap-1.5 flex-wrap">
                    <StatusBadge status={a.status ?? 'active'} />
                    {a.condition && !a.is_liquid && <ConditionBadge condition={a.condition} />}
                    {(a.is_liquid || a.asset_type === 'cash') && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        <Banknote className="w-2.5 h-2.5 mr-0.5" />
                        {LIQUID_ASSET_SUBTYPES.find(s => s.value === a.liquid_subtype)?.label || 'Liquid'}
                      </span>
                    )}
                    {a.currency && a.currency !== 'GHS' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-700">
                        {a.currency}
                      </span>
                    )}
                  </div>

                  {/* Values */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-bold text-sm" style={{ color: (a.is_liquid || a.asset_type === 'cash') ? '#059669' : SECTION_COLORS.asset.bg }}>
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

                  {/* Gain/loss */}
                  <div className="flex items-center gap-1 text-xs">
                    {gain >= 0
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    <span className={gain >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)}
                      {Number(a.purchase_value) > 0 && ` (${Math.round((gain / Number(a.purchase_value)) * 100)}%)`}
                    </span>
                  </div>

                  {/* Depreciation bar */}
                  {hasDepreciation && Number(a.purchase_value) > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Remaining value</span>
                        <span>{Math.round((dep.currentDepreciatedValue / Number(a.purchase_value)) * 100)}%</span>
                      </div>
                      <ProgressBar value={dep.currentDepreciatedValue} max={Number(a.purchase_value)} color={SECTION_COLORS.asset.bg} />
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    {a.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />{a.location}
                      </span>
                    )}
                    {a.purchase_date && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(a.purchase_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {a.status === 'sold' && a.sold_price && (
                      <span className="flex items-center gap-0.5 text-blue-600">
                        <DollarSign className="w-3 h-3" />Sold: {fmt(Number(a.sold_price))}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── Investments Section ── */}
      <Section title="Investments" count={investments.length} color={SECTION_COLORS.investment} icon={TrendingUp}
        onAdd={() => openCreate('investment')}>
        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No investments yet</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investments.map(inv => {
              const typeInfo = INVESTMENT_TYPES.find(t => t.value === inv.investment_type)
              const Icon = typeInfo?.icon ?? TrendingUp
              const gain    = Number(inv.current_value ?? 0) - Number(inv.invested_amount ?? 0)
              const gainPct = Number(inv.invested_amount ?? 0) > 0 ? (gain / Number(inv.invested_amount)) * 100 : 0
              return (
                <div key={inv.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: SECTION_COLORS.investment.light }}>
                        <Icon className="w-4 h-4" style={{ color: SECTION_COLORS.investment.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{inv.name}</p>
                        <p className="text-xs text-muted-foreground">{typeInfo?.label}{inv.institution ? ` · ${inv.institution}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit('investment', inv)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete('investments', inv.id, setInvestments)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
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
                    {gain >= 0
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
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
      <Section title="Debts" count={debts.length} color={SECTION_COLORS.debt} icon={CreditCard}
        onAdd={() => openCreate('debt')}>
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
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: SECTION_COLORS.debt.light }}>
                        <CreditCard className="w-4 h-4" style={{ color: SECTION_COLORS.debt.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{DEBT_TYPES.find(t => t.value === d.debt_type)?.label}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit('debt', d)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete('debts', d.id, setDebts)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
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
      <Section title="Loans" count={loans.length} color={SECTION_COLORS.loan} icon={Building2}
        onAdd={() => openCreate('loan')}>
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
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: SECTION_COLORS.loan.light }}>
                        <Building2 className="w-4 h-4" style={{ color: SECTION_COLORS.loan.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{LOAN_TYPES.find(t => t.value === l.loan_type)?.label}{l.institution ? ` · ${l.institution}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit('loan', l)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete('loans', l.id, setLoans)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
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

      {/* ══ ASSET DIALOG — tabbed ══════════════════════════════════════ */}
      <Dialog open={dialogType === 'asset'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>

          {/* Tab pills */}
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            <Tab id="basic"     label="Basic Info"   />
            <Tab id="financial" label="Financial"    />
            <Tab id="details"   label="Details"      />
          </div>

          <form onSubmit={assetForm.handleSubmit(onSubmitAsset, onInvalid)} className="space-y-4">

            {/* ── Basic Tab ── */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Asset Name *</Label>
                  <Input placeholder="e.g. MacBook Pro 2024, Toyota Corolla" {...assetForm.register('name')} />
                  {assetForm.formState.errors.name && <p className="text-xs text-destructive">{assetForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Category *</Label>
                  <Select onValueChange={v => assetForm.setValue('asset_type', v, { shouldValidate: true })}
                    defaultValue={assetForm.getValues('asset_type')}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {assetForm.formState.errors.asset_type && <p className="text-xs text-destructive">{assetForm.formState.errors.asset_type.message}</p>}
                </div>


                {/* Liquid asset toggle — appears when category = cash */}
                {assetForm.watch('asset_type') === 'cash' && (
                  <div className="space-y-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5" /> Cash & Liquid Asset Details
                    </p>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Liquid Asset Type</Label>
                      <Select
                        onValueChange={v => {
                          assetForm.setValue('liquid_subtype', v, { shouldValidate: true })
                          assetForm.setValue('is_liquid', true)
                          // Auto-fill name if empty
                          const sub = LIQUID_ASSET_SUBTYPES.find(s => s.value === v)
                          if (!assetForm.getValues('name') && sub) assetForm.setValue('name', sub.label)
                        }}
                        defaultValue={assetForm.getValues('liquid_subtype') || ''}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select liquid type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LIQUID_ASSET_SUBTYPES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Currency</Label>
                        <Select
                          onValueChange={v => assetForm.setValue('currency', v)}
                          defaultValue={assetForm.getValues('currency') || 'GHS'}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['GHS','USD','EUR','GBP','NGN','KES','ZAR','AED'].map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Linked Account <span className="text-muted-foreground">(optional)</span></Label>
                        <Select
                          onValueChange={v => assetForm.setValue('account_id', v === 'none' ? '' : v)}
                          defaultValue={assetForm.getValues('account_id') || 'none'}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Link account" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No account</SelectItem>
                            {accounts.map(a => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs text-emerald-600 bg-emerald-100/50 rounded-lg px-3 py-2">
                      💡 Tip: Enter the <strong>Current Value</strong> as the cash amount available. This will count toward your net worth as a liquid asset.
                    </div>
                  </div>
                )}

                 {/* Description */}
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
                      <button type="button" onClick={() => assetForm.setValue('asset_tag', generateTag())}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-semibold hover:underline">
                        Regen
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input placeholder="e.g. Home, Office" {...assetForm.register('location')} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Financial Tab ── */}
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

                {/* Depreciation */}
                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <DepIcon className="w-3.5 h-3.5" /> Depreciation
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Method</Label>
                      <Select onValueChange={v => assetForm.setValue('depreciation_method', v)}
                        defaultValue={assetForm.getValues('depreciation_method') || 'none'}>
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

                  {/* Live depreciation preview */}
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

            {/* ── Details Tab ── */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Any additional notes…" {...assetForm.register('notes')} />
                </div>
                <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground mb-2">Coming in Phase 2</p>
                  <p>📷 Asset photo upload</p>
                  <p>📄 Receipt & warranty document upload</p>
                  <p>🔧 Maintenance log & reminders</p>
                  <p>🛡 Warranty expiry tracking</p>
                  <p>📋 Full asset timeline</p>
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

      {/* ══ INVESTMENT DIALOG ══════════════════════════════════════════ */}
      <Dialog open={dialogType === 'investment'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Investment' : 'Add Investment'}</DialogTitle></DialogHeader>
          <form onSubmit={investmentForm.handleSubmit(onSubmitInvestment, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. MTN Shares, Bitcoin Wallet" {...investmentForm.register('name')} />
              {investmentForm.formState.errors.name && <p className="text-xs text-destructive">{investmentForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Investment Type</Label>
              <Select onValueChange={v => investmentForm.setValue('investment_type', v, { shouldValidate: true })}
                defaultValue={investmentForm.getValues('investment_type')}>
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

      {/* ══ DEBT DIALOG ════════════════════════════════════════════════ */}
      <Dialog open={dialogType === 'debt'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Debt' : 'Add Debt'}</DialogTitle></DialogHeader>
          <form onSubmit={debtForm.handleSubmit(onSubmitDebt, onInvalid)} className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label><Input placeholder="e.g. Visa Credit Card" {...debtForm.register('name')} />{debtForm.formState.errors.name && <p className="text-xs text-destructive">{debtForm.formState.errors.name.message}</p>}</div>
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

      {/* ══ LOAN DIALOG ════════════════════════════════════════════════ */}
      <Dialog open={dialogType === 'loan'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit Loan' : 'Add Loan'}</DialogTitle></DialogHeader>
          <form onSubmit={loanForm.handleSubmit(onSubmitLoan, onInvalid)} className="space-y-4">
            <div className="space-y-1.5"><Label>Loan Name</Label><Input placeholder="e.g. GCB Mortgage" {...loanForm.register('name')} />{loanForm.formState.errors.name && <p className="text-xs text-destructive">{loanForm.formState.errors.name.message}</p>}</div>
            <div className="space-y-1.5">
              <Label>Loan Type</Label>
              <Select onValueChange={v => loanForm.setValue('loan_type', v, { shouldValidate: true })} defaultValue={loanForm.getValues('loan_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{LOAN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
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

      {/* ══ SELL DIALOG ════════════════════════════════════════════════ */}
      <Dialog open={dialogType === 'sell'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" /> Sell Asset
            </DialogTitle>
          </DialogHeader>
          {editingId && (() => {
            const asset = assets.find(a => a.id === editingId)
            const soldPrice = sellForm.watch('sold_price')
            const gain = Number(soldPrice ?? 0) - Number(asset?.purchase_value ?? 0)
            return (
              <form onSubmit={sellForm.handleSubmit(onSubmitSell, onInvalid)} className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-3 text-sm">
                  <p className="font-semibold">{asset?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Purchase price: {fmt(Number(asset?.purchase_value ?? 0))}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Sale Price *</Label>
                    <Input type="number" step="0.01" placeholder="0.00" {...sellForm.register('sold_price')} />
                    {sellForm.formState.errors.sold_price && <p className="text-xs text-destructive">{sellForm.formState.errors.sold_price.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sale Date *</Label>
                    <Input type="date" {...sellForm.register('sold_date')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Buyer <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Buyer name or company" {...sellForm.register('sold_to')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Any notes…" {...sellForm.register('notes')} />
                </div>
                {soldPrice > 0 && (
                  <div className={`rounded-xl p-3 text-sm ${gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-semibold">{fmt(Number(soldPrice))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purchase Price</span>
                      <span>{fmt(Number(asset?.purchase_value ?? 0))}</span>
                    </div>
                    <div className="flex justify-between border-t border-border mt-2 pt-2">
                      <span className="font-semibold">Gain / Loss</span>
                      <span className={`font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {gain >= 0 ? '+' : ''}{fmt(gain)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
                  <Button type="submit" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Sale'}
                  </Button>
                </div>
              </form>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ══ DISPOSE DIALOG ════════════════════════════════════════════ */}
      <Dialog open={dialogType === 'dispose'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" /> Dispose Asset
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={disposeForm.handleSubmit(onSubmitDispose, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Disposal Reason *</Label>
              <Select onValueChange={v => disposeForm.setValue('disposal_reason', v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  {['Donated', 'Lost', 'Destroyed', 'Scrapped', 'Transferred', 'Other'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {disposeForm.formState.errors.disposal_reason && <p className="text-xs text-destructive">{disposeForm.formState.errors.disposal_reason.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Disposal Date *</Label>
              <Input type="date" {...disposeForm.register('disposal_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Any notes…" {...disposeForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Disposal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Asset Detail Panel ── */}
      {detailAsset && (
        <AssetDetailPanel
          asset={detailAsset}
          onClose={() => setDetailAsset(null)}
          onUpdate={updated => {
            setAssets(p => p.map(a => a.id === updated.id ? updated : a))
            setDetailAsset(updated)
          }}
        />
      )}
    </div>
  )
}