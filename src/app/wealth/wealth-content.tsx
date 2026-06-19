'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2, TrendingUp, TrendingDown,
  Landmark, Car, Gem, Smartphone, BarChart3, Bitcoin,
  Building2, CreditCard, AlertTriangle, ChevronDown, ChevronUp,
  Wallet, Target, ArrowUpRight, ArrowDownRight, PiggyBank,
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

// ── helpers ──────────────────────────────────────────────────────────
const fmt = (n: number) => formatCurrency(n, 'GHS')

const ASSET_TYPES = [
  { value: 'property',    label: 'Property',     icon: Building2  },
  { value: 'vehicle',     label: 'Vehicle',      icon: Car        },
  { value: 'electronics', label: 'Electronics',  icon: Smartphone },
  { value: 'jewelry',     label: 'Jewelry',      icon: Gem        },
  { value: 'other',       label: 'Other',        icon: Landmark   },
]

const INVESTMENT_TYPES = [
  { value: 'stocks',        label: 'Stocks',         icon: BarChart3  },
  { value: 'crypto',        label: 'Crypto',         icon: Bitcoin    },
  { value: 'mutual_funds',  label: 'Mutual Funds',   icon: PiggyBank  },
  { value: 'bonds',         label: 'Bonds',          icon: Landmark   },
  { value: 'fixed_deposit', label: 'Fixed Deposit',  icon: Building2  },
  { value: 'real_estate',   label: 'Real Estate',    icon: Building2  },
  { value: 'other',         label: 'Other',          icon: TrendingUp },
]

const DEBT_TYPES = [
  { value: 'credit_card',        label: 'Credit Card'         },
  { value: 'overdraft',          label: 'Overdraft'           },
  { value: 'buy_now_pay_later',  label: 'Buy Now Pay Later'   },
  { value: 'other',              label: 'Other'               },
]

const LOAN_TYPES = [
  { value: 'mortgage', label: 'Mortgage'        },
  { value: 'personal', label: 'Personal Loan'   },
  { value: 'car',      label: 'Car Loan'        },
  { value: 'student',  label: 'Student Loan'    },
  { value: 'business', label: 'Business Loan'   },
  { value: 'other',    label: 'Other'           },
]

const SECTION_COLORS = {
  asset:      { bg: '#16a34a', light: '#dcfce7', text: '#15803d' },
  investment: { bg: '#2563eb', light: '#dbeafe', text: '#1d4ed8' },
  debt:       { bg: '#dc2626', light: '#fee2e2', text: '#b91c1c' },
  loan:       { bg: '#f59e0b', light: '#fef3c7', text: '#d97706' },
}

// ── Schemas ───────────────────────────────────────────────────────────
const assetSchema = z.object({
  name:           z.string().min(1, 'Name required'),
  asset_type:     z.string().min(1, 'Type required'),
  current_value:  z.coerce.number().min(0),
  purchase_value: z.coerce.number().min(0),
  purchase_date:  z.string().optional(),
  notes:          z.string().optional(),
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

// ── Progress bar ──────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────
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

// ── Section wrapper ───────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────
interface Props {
  initialAssets:      Asset[]
  initialInvestments: Investment[]
  initialDebts:       Debt[]
  initialLoans:       Loan[]
  userId: string
}

export function WealthContent({ initialAssets, initialInvestments, initialDebts, initialLoans, userId }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [assets,      setAssets]      = useState(initialAssets)
  const [investments, setInvestments] = useState(initialInvestments)
  const [debts,       setDebts]       = useState(initialDebts)
  const [loans,       setLoans]       = useState(initialLoans)

  // Dialog state
  type DialogType = 'asset' | 'investment' | 'debt' | 'loan' | null
  const [dialogType,    setDialogType]    = useState<DialogType>(null)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)

  // Forms — explicitly typed via generics so register()/setValue() know every field
  const assetForm = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: { name: '', asset_type: '', current_value: 0, purchase_value: 0, purchase_date: '', notes: '' },
  })
  const investmentForm = useForm<InvestmentFormData>({
    resolver: zodResolver(investmentSchema),
    defaultValues: { name: '', investment_type: '', invested_amount: 0, current_value: 0, institution: '', notes: '' },
  })
  const debtForm = useForm<DebtFormData>({
    resolver: zodResolver(debtSchema),
    defaultValues: { name: '', debt_type: '', total_amount: 0, remaining: 0, interest_rate: 0, due_date: '', notes: '' },
  })
  const loanForm = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: { name: '', loan_type: '', principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0, start_date: '', end_date: '', institution: '', notes: '' },
  })

  // ── Totals ──────────────────────────────────────────────────────────
  const totalAssets      = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets])
  const totalInvested    = useMemo(() => investments.reduce((s, i) => s + Number(i.current_value), 0), [investments])
  const totalDebts       = useMemo(() => debts.reduce((s, d) => s + Number(d.remaining), 0), [debts])
  const totalLoans       = useMemo(() => loans.reduce((s, l) => s + Number(l.remaining), 0), [loans])
  const netWorth         = totalAssets + totalInvested - totalDebts - totalLoans
  const totalLiabilities = totalDebts + totalLoans

  const investmentGain = useMemo(() =>
    investments.reduce((s, i) => s + (Number(i.current_value) - Number(i.invested_amount)), 0),
    [investments])

  // ── Open dialog helpers ─────────────────────────────────────────────
  const openCreate = (type: DialogType) => {
    setEditingId(null)
    setDialogType(type)
    if (type === 'asset')      assetForm.reset({ name: '', asset_type: '', current_value: 0, purchase_value: 0, purchase_date: '', notes: '' })
    if (type === 'investment') investmentForm.reset({ name: '', investment_type: '', invested_amount: 0, current_value: 0, institution: '', notes: '' })
    if (type === 'debt')       debtForm.reset({ name: '', debt_type: '', total_amount: 0, remaining: 0, interest_rate: 0, due_date: '', notes: '' })
    if (type === 'loan')       loanForm.reset({ name: '', loan_type: '', principal: 0, remaining: 0, interest_rate: 0, monthly_payment: 0, start_date: '', end_date: '', institution: '', notes: '' })
  }

  const openEdit = (type: DialogType, item: any) => {
    setEditingId(item.id)
    setDialogType(type)
    if (type === 'asset')      assetForm.reset(item)
    if (type === 'investment') investmentForm.reset(item)
    if (type === 'debt')       debtForm.reset(item)
    if (type === 'loan')       loanForm.reset(item)
  }

  // ── CRUD helpers ────────────────────────────────────────────────────
  const handleDelete = async (table: string, id: string, setter: (fn: (prev: any[]) => any[]) => void) => {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setter(prev => prev.filter((x: any) => x.id !== id)); toast({ title: 'Deleted' }) }
  }

  const onSubmitAsset = async (data: AssetFormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editingId) {
      const { data: updated, error } = await supabase.from('assets').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editingId).select().single()
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

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast({ title: 'Fix form errors', description: first?.message, variant: 'destructive' })
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
          Net Worth Tracker
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Assets + Investments − Debts − Loans = Net Worth
        </p>
      </div>

      {/* Net Worth Hero */}
      <Card className="rounded-xl shadow-sm border border-border overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.accent})` }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Estimated Net Worth</p>
              <p className="text-white text-3xl sm:text-4xl font-bold tabular-nums mt-1">
                {fmt(netWorth)}
              </p>
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

          {/* Net worth progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/60 mb-1">
              <span>Liabilities {totalLiabilities > 0 ? Math.round((totalLiabilities / (totalAssets + totalInvested + totalLiabilities)) * 100) : 0}%</span>
              <span>Assets {totalAssets + totalInvested > 0 ? Math.round(((totalAssets + totalInvested) / (totalAssets + totalInvested + totalLiabilities)) * 100) : 100}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 rounded-full transition-all duration-700"
                style={{ width: `${totalAssets + totalInvested + totalLiabilities > 0 ? Math.round(((totalAssets + totalInvested) / (totalAssets + totalInvested + totalLiabilities)) * 100) : 100}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Physical Assets"  value={fmt(totalAssets)}      sub={`${assets.length} item(s)`}       bg={SECTION_COLORS.asset.bg}      icon={Landmark}    />
        <KPI label="Investments"      value={fmt(totalInvested)}    sub={investmentGain >= 0 ? `+${fmt(investmentGain)} gain` : `${fmt(investmentGain)} loss`} bg={SECTION_COLORS.investment.bg} icon={TrendingUp}  />
        <KPI label="Debts"            value={fmt(totalDebts)}       sub={`${debts.length} account(s)`}     bg={SECTION_COLORS.debt.bg}       icon={CreditCard}  />
        <KPI label="Loans"            value={fmt(totalLoans)}       sub={`${loans.length} loan(s)`}        bg={SECTION_COLORS.loan.bg}       icon={Building2}   />
      </div>

      {/* ── Assets Section ── */}
      <Section title="Physical Assets" count={assets.length} color={SECTION_COLORS.asset} icon={Landmark}
        onAdd={() => openCreate('asset')}>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No assets yet — add property, vehicles, electronics</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map(a => {
              const typeIcon = ASSET_TYPES.find(t => t.value === a.asset_type)
              const Icon = typeIcon?.icon ?? Landmark
              const gain = Number(a.current_value) - Number(a.purchase_value)
              return (
                <div key={a.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: SECTION_COLORS.asset.light }}>
                        <Icon className="w-4 h-4" style={{ color: SECTION_COLORS.asset.bg }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{typeIcon?.label}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit('asset', a)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete('assets', a.id, setAssets)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-bold text-sm" style={{ color: SECTION_COLORS.asset.bg }}>{fmt(Number(a.current_value))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purchase Value</p>
                      <p className="font-medium">{fmt(Number(a.purchase_value))}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {gain >= 0
                      ? <ArrowUpRight className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      : <ArrowDownRight className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    <span className={gain >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                      {gain >= 0 ? '+' : ''}{fmt(gain)} {Number(a.purchase_value) > 0 ? `(${Math.round((gain / Number(a.purchase_value)) * 100)}%)` : ''}
                    </span>
                  </div>
                  {a.purchase_date && <p className="text-[10px] text-muted-foreground">Purchased: {new Date(a.purchase_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
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
          <p className="text-sm text-muted-foreground text-center py-6">No investments yet — add stocks, crypto, mutual funds</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investments.map(inv => {
              const typeInfo = INVESTMENT_TYPES.find(t => t.value === inv.investment_type)
              const Icon = typeInfo?.icon ?? TrendingUp
              const gain = Number(inv.current_value) - Number(inv.invested_amount)
              const gainPct = Number(inv.invested_amount) > 0 ? (gain / Number(inv.invested_amount)) * 100 : 0
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
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit('investment', inv)}><Edit2 className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete('investments', inv.id, setInvestments)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Current Value</p>
                      <p className="font-bold text-sm" style={{ color: SECTION_COLORS.investment.bg }}>{fmt(Number(inv.current_value))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Invested</p>
                      <p className="font-medium">{fmt(Number(inv.invested_amount))}</p>
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
          <p className="text-sm text-muted-foreground text-center py-6">No debts — great! Add credit cards or overdrafts to track</p>
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
                    <div className="flex gap-1 flex-shrink-0">
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
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
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
          <p className="text-sm text-muted-foreground text-center py-6">No loans yet — add mortgage, personal or car loans</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {loans.map(l => {
              const paidPct = Number(l.principal) > 0 ? ((Number(l.principal) - Number(l.remaining)) / Number(l.principal)) * 100 : 0
              const loanTypeLabel = LOAN_TYPES.find(t => t.value === l.loan_type)?.label
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
                        <p className="text-xs text-muted-foreground">{loanTypeLabel}{l.institution ? ` · ${l.institution}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
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
                      <p className="text-muted-foreground">Interest Rate</p>
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

      {/* ── Asset Dialog ── */}
      <Dialog open={dialogType === 'asset'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Asset' : 'Add Asset'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={assetForm.handleSubmit(onSubmitAsset, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. My House, Toyota Corolla" {...assetForm.register('name')} />
              {assetForm.formState.errors.name && <p className="text-xs text-destructive">{assetForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select onValueChange={v => assetForm.setValue('asset_type', v, { shouldValidate: true })} defaultValue={assetForm.getValues('asset_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {assetForm.formState.errors.asset_type && <p className="text-xs text-destructive">{assetForm.formState.errors.asset_type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Value</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...assetForm.register('current_value')} />
              </div>
              <div className="space-y-1.5">
                <Label>Purchase Value</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...assetForm.register('purchase_value')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" {...assetForm.register('purchase_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Any notes…" {...assetForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.asset.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Asset'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Investment Dialog ── */}
      <Dialog open={dialogType === 'investment'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Investment' : 'Add Investment'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={investmentForm.handleSubmit(onSubmitInvestment, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. MTN Shares, Bitcoin Wallet" {...investmentForm.register('name')} />
              {investmentForm.formState.errors.name && <p className="text-xs text-destructive">{investmentForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Investment Type</Label>
              <Select onValueChange={v => investmentForm.setValue('investment_type', v, { shouldValidate: true })} defaultValue={investmentForm.getValues('investment_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{INVESTMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {investmentForm.formState.errors.investment_type && <p className="text-xs text-destructive">{investmentForm.formState.errors.investment_type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount Invested</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...investmentForm.register('invested_amount')} />
              </div>
              <div className="space-y-1.5">
                <Label>Current Value</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...investmentForm.register('current_value')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Institution <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. Databank, Binance" {...investmentForm.register('institution')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Any notes…" {...investmentForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.investment.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Investment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Debt Dialog ── */}
      <Dialog open={dialogType === 'debt'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Debt' : 'Add Debt'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={debtForm.handleSubmit(onSubmitDebt, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Visa Credit Card" {...debtForm.register('name')} />
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
              <div className="space-y-1.5">
                <Label>Total Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...debtForm.register('total_amount')} />
              </div>
              <div className="space-y-1.5">
                <Label>Remaining Balance</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...debtForm.register('remaining')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Interest Rate %</Label>
                <Input type="number" step="0.1" placeholder="0.0" {...debtForm.register('interest_rate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...debtForm.register('due_date')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Any notes…" {...debtForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.debt.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Debt'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Loan Dialog ── */}
      <Dialog open={dialogType === 'loan'} onOpenChange={o => !o && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Loan' : 'Add Loan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={loanForm.handleSubmit(onSubmitLoan, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Loan Name</Label>
              <Input placeholder="e.g. GCB Mortgage, Car Loan" {...loanForm.register('name')} />
              {loanForm.formState.errors.name && <p className="text-xs text-destructive">{loanForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Loan Type</Label>
              <Select onValueChange={v => loanForm.setValue('loan_type', v, { shouldValidate: true })} defaultValue={loanForm.getValues('loan_type')}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{LOAN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              {loanForm.formState.errors.loan_type && <p className="text-xs text-destructive">{loanForm.formState.errors.loan_type.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Principal Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('principal')} />
              </div>
              <div className="space-y-1.5">
                <Label>Remaining Balance</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('remaining')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Interest Rate % p.a.</Label>
                <Input type="number" step="0.1" placeholder="0.0" {...loanForm.register('interest_rate')} />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Payment</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...loanForm.register('monthly_payment')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Institution <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. GCB Bank, Ecobank" {...loanForm.register('institution')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...loanForm.register('start_date')} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="date" {...loanForm.register('end_date')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="Any notes…" {...loanForm.register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: SECTION_COLORS.loan.bg, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? 'Save Changes' : 'Add Loan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}