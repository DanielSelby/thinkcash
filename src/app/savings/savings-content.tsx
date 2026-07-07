'use client'
import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, PiggyBank, Loader2, TrendingUp,
  MoreVertical, Banknote, Building2, Smartphone, ArrowUpRight,
  ArrowDownRight, ArrowLeftRight, Pause, Play, CheckCircle2,
  Archive, List, Clock, ChevronDown, ChevronUp, AlertTriangle,
  DollarSign, RefreshCw,Target,
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { KPICard } from '@/components/ui/kpi-card'
import { Progress } from '@/components/ui/misc'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { SavingsGoal } from '@/types'
const GOAL_ICONS: Record<string, string> = {
  emergency: '🛡️', car: '🚗', vacation: '✈️', house: '🏠',
  education: '🎓', wedding: '💍', tech: '💻', default: '🎯',
}
function getGoalEmoji(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes('emergency') || lower.includes('fund')) return GOAL_ICONS.emergency
  if (lower.includes('car') || lower.includes('vehicle')) return GOAL_ICONS.car
  if (lower.includes('vacation') || lower.includes('travel') || lower.includes('trip')) return GOAL_ICONS.vacation
  if (lower.includes('house') || lower.includes('home') || lower.includes('property')) return GOAL_ICONS.house
  if (lower.includes('education') || lower.includes('school') || lower.includes('college')) return GOAL_ICONS.education
  if (lower.includes('wedding') || lower.includes('ring')) return GOAL_ICONS.wedding
  if (lower.includes('laptop') || lower.includes('phone') || lower.includes('tech')) return GOAL_ICONS.tech
  return GOAL_ICONS.default
}
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#16a34a', bg: '#dcfce7' },
  paused: { label: 'Paused', color: '#f59e0b', bg: '#fef3c7' },
  completed: { label: 'Completed', color: '#2563eb', bg: '#dbeafe' },
  archived: { label: 'Archived', color: '#94a3b8', bg: '#f1f5f9' },
}
const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly',
}
// ── Goal Actions Menu ──────────────────────────────────────────────────
function GoalActionsMenu({ goal, onAction }: {
    goal: any
    onAction: (action: string) => void
  }) {
  const [open, setOpen] = useState(false)
  const actions = [
    { label: 'Add Savings', action: 'add', cls: 'text-emerald-600', show: goal.status !== 'archived' && goal.status !== 'completed' },
    { label: 'Withdraw Savings', action: 'withdraw', cls: 'text-orange-500', show: goal.status !== 'archived' && goal.current_amount > 0 },
    { label: 'Transfer to Goal', action: 'transfer_in', cls: 'text-blue-600', show: goal.status === 'active' },
    { label: 'Transfer from Goal', action: 'transfer_out', cls: 'text-blue-600', show: goal.status === 'active' && goal.current_amount > 0 },
    { label: 'divider1', action: '', cls: '', show: true },
    { label: 'Edit Goal', action: 'edit', cls: '', show: true },
    { label: 'Change Linked Account', action: 'link_account', cls: '', show: true },
    { label: 'Set Auto Contribution', action: 'auto', cls: '', show: goal.status === 'active' },
    { label: 'divider2', action: '', cls: '', show: true },
    { label: goal.status === 'paused' ? 'Resume Goal' : 'Pause Goal',
      action: goal.status === 'paused' ? 'resume' : 'pause',
      cls: 'text-amber-600',
      show: goal.status === 'active' || goal.status === 'paused' },
    { label: 'Complete Goal', action: 'complete', cls: 'text-blue-600', show: goal.status !== 'completed' && goal.status !== 'archived' },
    { label: 'Archive Goal', action: 'archive', cls: 'text-slate-500', show: goal.status !== 'archived' },
    { label: 'divider3', action: '', cls: '', show: true },
    { label: 'View Transactions', action: 'transactions', cls: '', show: true },
    { label: 'Delete Goal', action: 'delete', cls: 'text-destructive', show: true },
  ].filter(a => a.show)
  return (
    <div className="relative">
    <button onClick={() => setOpen(v => !v)}
    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
    <MoreVertical className="w-4 h-4 text-muted-foreground" />
  </button>
    {open && (
        <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-8 z-50 w-52 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
        {actions.map((item, idx) => {
              if (item.action === '' && item.label.startsWith('divider')) {
                return <div key={idx} className="h-px bg-border my-1" />
              }
              return (
                <button key={item.label}
                  onClick={() => { setOpen(false); onAction(item.action) }}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${item.cls}`}>
                {item.label}
              </button>
              )
            })}
      </div>
      </>
      )}
  </div>
  )
}
// ── Schemas ────────────────────────────────────────────────────────────
const goalSchema = z.object({
    goal_name: z.string().min(1, 'Goal name is required'),
    target_amount: z.coerce.number().positive('Target must be positive'),
    current_amount: z.coerce.number().min(0, 'Cannot be negative'),
    target_date: z.string().optional(),
    account_id: z.string().optional(),
    notes: z.string().optional(),
  })
type GoalFormData = z.infer<typeof goalSchema>
const transactionSchema = z.object({
    amount: z.coerce.number().positive('Amount must be positive'),
    date: z.string().min(1, 'Date required'),
    account_id: z.string().optional(),
    note: z.string().optional(),
  })
type TransactionFormData = z.infer<typeof transactionSchema>
const transferSchema = z.object({
    amount: z.coerce.number().positive('Amount must be positive'),
    date: z.string().min(1, 'Date required'),
    from_account_id: z.string().min(1, 'Select source account'),
    to_account_id: z.string().min(1, 'Select destination account'),
    note: z.string().optional(),
  })
type TransferFormData = z.infer<typeof transferSchema>
const autoSchema = z.object({
    amount: z.coerce.number().positive('Amount required'),
    frequency: z.string().min(1, 'Select frequency'),
  })
type AutoFormData = z.infer<typeof autoSchema>
// ── Props ─────────────────────────────────────────────────────────────
interface Props {
  initialGoals: SavingsGoal[]
  initialAccounts: any[]
  incomes: { amount: number; account_id: string | null }[]
  expenses: { amount: number; account_id: string | null }[]
  transfers: { from_account_id: string; to_account_id: string; amount: number; to_amount?: number | null }[]
  userId: string
}
export function SavingsContent({ initialGoals, initialAccounts = [], incomes = [], expenses = [], transfers = [], userId }: Props) {
  const [goals, setGoals] = useState<any[]>(initialGoals)
  const [accounts] = useState<any[]>(initialAccounts)
// Live account balances — same formula as Wealth Tracker
  const accountsWithBalance = useMemo(() =>
    accounts.map(acc => {
        const totalIncome = incomes.filter(i => i.account_id === acc.id).reduce((s, i) => s + Number(i.amount), 0)
        const totalExpense = expenses.filter(e => e.account_id === acc.id).reduce((s, e) => s + Number(e.amount), 0)
        const txOut = transfers.filter(t => t.from_account_id === acc.id).reduce((s, t) => s + Number(t.amount), 0)
        const txIn = transfers.filter(t => t.to_account_id === acc.id).reduce((s, t) => s + Number(t.to_amount ?? t.amount), 0)
        const balance = Number(acc.opening_balance ?? 0) + totalIncome - totalExpense - txOut + txIn
        return { ...acc, balance }
      }), [accounts, incomes, expenses, transfers])
// Dialog state
  type ActionType = 'create' | 'edit' | 'add' | 'withdraw' | 'transfer_in' | 'transfer_out'
  | 'link_account' | 'auto' | 'transactions' | null
  const [actionType, setActionType] = useState<ActionType>(null)
  const [activeGoal, setActiveGoal] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
// ── Trend analysis state ─────────────────────────────────────────
  const [allTxns, setAllTxns] = useState<any[]>([])
  const [txnsLoaded, setTxnsLoaded] = useState(false)
  const [trendGoalIds, setTrendGoalIds] = useState<string[]>([]) // empty = all goals
  const [trendDateFrom, setTrendDateFrom] = useState('')
  const [trendDateTo, setTrendDateTo] = useState('')
  const [showTrend, setShowTrend] = useState(false)
// Load all savings transactions once (only when the trend panel is first opened)
  useEffect(() => {
      if (!showTrend || txnsLoaded) return
      const load = async () => {
        const supabase = createClient()
        const { data } = await supabase
        .from('savings_transactions')
        .select('*')
        .order('date', { ascending: true })
        setAllTxns(data || [])
        setTxnsLoaded(true)
      }
      load()
    }, [showTrend, txnsLoaded])
// Build chart data: one data point per unique date, one line per goal
  const trendChartData = useMemo(() => {
      if (!allTxns.length) return []
      const goalPool = goals.filter(g =>
        trendGoalIds.length === 0 || trendGoalIds.includes(g.id)
      )
    // All relevant txns, filtered by date range + selected goals
      const filtered = allTxns.filter(tx => {
          if (trendGoalIds.length > 0 && !trendGoalIds.includes(tx.goal_id)) return false
          if (trendDateFrom && tx.date < trendDateFrom) return false
          if (trendDateTo && tx.date > trendDateTo) return false
          return true
        })
      if (!filtered.length) return []
    // Unique sorted dates
      const dates = Array.from(new Set(filtered.map(tx => tx.date))).sort()
    // Running balance per goal per date
      const runningBalance: Record<string, number> = {}
      goalPool.forEach(g => { runningBalance[g.id] = 0 })
    // Pre-populate balances from txns BEFORE the date range so we start at the right baseline
      if (trendDateFrom) {
        allTxns
        .filter(tx => tx.date < trendDateFrom && goalPool.find(g => g.id === tx.goal_id))
        .forEach(tx => {
            const delta = (tx.type === 'add' || tx.type === 'transfer_in')
            ? Number(tx.amount) : -Number(tx.amount)
            runningBalance[tx.goal_id] = (runningBalance[tx.goal_id] ?? 0) + delta
          })
      }
      return dates.map(date => {
        // Apply all txns on this date
          filtered
          .filter(tx => tx.date === date)
          .forEach(tx => {
              const delta = (tx.type === 'add' || tx.type === 'transfer_in')
              ? Number(tx.amount) : -Number(tx.amount)
              runningBalance[tx.goal_id] = (runningBalance[tx.goal_id] ?? 0) + delta
            })
          const point: Record<string, any> = {
            date,
            label: new Date(date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }),
            total: goalPool.reduce((s, g) => s + Math.max(0, runningBalance[g.id] ?? 0), 0),
          }
          goalPool.forEach(g => {
              point[g.id] = Math.max(0, runningBalance[g.id] ?? 0)
            })
          return point
        })
    }, [allTxns, goals, trendGoalIds, trendDateFrom, trendDateTo])
// One stable color per goal so lines don't flicker on re-render
  const TREND_COLORS = ['#16a34a','#2563eb','#f59e0b','#dc2626','#9333ea','#0891b2','#ea580c','#0d9488']
  const trendGoals = useMemo(() =>
    goals.filter(g => trendGoalIds.length === 0 || trendGoalIds.includes(g.id)),
    [goals, trendGoalIds]
  )
  const showPerGoalLines = trendGoalIds.length !== 1 && trendGoals.length <= 6
// ── Totals ───────────────────────────────────────────────────────
  const activeGoals = useMemo(() => goals.filter(g => g.status !== 'archived'), [goals])
  const visibleGoals = useMemo(() => showArchived ? goals : activeGoals, [goals, activeGoals, showArchived])
  const archivedCount = useMemo(() => goals.filter(g => g.status === 'archived').length, [goals])
  const totalSaved = useMemo(() => activeGoals.reduce((s, g) => s + Number(g.current_amount ?? 0), 0), [activeGoals])
  const totalTarget = useMemo(() => activeGoals.reduce((s, g) => s + Number(g.target_amount ?? 0), 0), [activeGoals])
  const completed = useMemo(() => activeGoals.filter(g => g.status === 'completed' || Number(g.current_amount) >= Number(g.target_amount)).length, [activeGoals])
// ── Forms ─────────────────────────────────────────────────────────
  const goalForm = useForm<GoalFormData>({ resolver: zodResolver(goalSchema) })
  const txForm = useForm<TransactionFormData>({
      resolver: zodResolver(transactionSchema),
      defaultValues: { date: new Date().toISOString().split('T')[0] },
    })
  const transferForm = useForm<TransferFormData>({
      resolver: zodResolver(transferSchema),
      defaultValues: { date: new Date().toISOString().split('T')[0] },
    })
  const autoForm = useForm<AutoFormData>({ resolver: zodResolver(autoSchema) })
// ── Open helpers ─────────────────────────────────────────────────
  const openCreate = () => {
    setActiveGoal(null)
    goalForm.reset({ goal_name: '', target_amount: 0, current_amount: 0, target_date: '', account_id: 'none', notes: '' })
    setActionType('create')
  }
  const openEdit = (g: any) => {
    setActiveGoal(g)
    goalForm.reset({
        goal_name: g.goal_name, target_amount: g.target_amount, current_amount: g.current_amount,
        target_date: g.target_date || '', account_id: g.account_id || 'none', notes: g.notes || '',
      })
    setActionType('edit')
  }
  const openAction = (g: any, action: string) => {
    setActiveGoal(g)
    switch (action) {
      case 'edit': openEdit(g); break
      case 'add': txForm.reset({ amount: 0, date: new Date().toISOString().split('T')[0], account_id: g.account_id || 'none', note: '' }); setActionType('add'); break
      case 'withdraw': txForm.reset({ amount: 0, date: new Date().toISOString().split('T')[0], account_id: g.account_id || 'none', note: '' }); setActionType('withdraw'); break
      case 'transfer_in': transferForm.reset({ amount: 0, date: new Date().toISOString().split('T')[0], from_account_id: '', to_account_id: g.account_id || '', note: '' }); setActionType('transfer_in'); break
      case 'transfer_out': transferForm.reset({ amount: 0, date: new Date().toISOString().split('T')[0], from_account_id: g.account_id || '', to_account_id: '', note: '' }); setActionType('transfer_out'); break
      case 'link_account': goalForm.reset({ ...g, account_id: g.account_id || 'none' }); setActionType('link_account'); break
      case 'auto': autoForm.reset({ amount: g.auto_contribution_amount || 0, frequency: g.auto_contribution_freq || '' }); setActionType('auto'); break
      case 'transactions': loadTransactions(g); break
      case 'pause': updateGoalStatus(g, 'paused'); break
      case 'resume': updateGoalStatus(g, 'active'); break
      case 'complete': updateGoalStatus(g, 'completed'); break
      case 'archive': updateGoalStatus(g, 'archived'); break
      case 'delete': handleDelete(g.id); break
    }
  }
  const loadTransactions = async (g: any) => {
    setActiveGoal(g)
    setTxLoading(true)
    setActionType('transactions')
    const supabase = createClient()
    const { data } = await supabase
    .from('savings_transactions')
    .select('*')
    .eq('goal_id', g.id)
    .order('date', { ascending: false })
    setTransactions(data || [])
    setTxLoading(false)
  }
// ── CRUD ──────────────────────────────────────────────────────────
  const updateGoalStatus = async (g: any, status: string) => {
    if (status === 'delete') { handleDelete(g.id); return }
    if (!confirm(`${status === 'archived' ? 'Archive' : status === 'completed' ? 'Mark as complete' : status === 'paused' ? 'Pause' : 'Resume'} "${g.goal_name}"?`)) return
    const supabase = createClient()
    const { data: updated, error } = await supabase
    .from('savings_goals')
    .update({ status, archived_at: status === 'archived' ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', g.id).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else {
      setGoals(p => p.map(x => x.id === g.id ? updated : x))
      toast({ title: `Goal ${status}`, variant: 'success' })
    }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this goal? All transaction history will be lost.')) return
    const supabase = createClient()
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setGoals(p => p.filter(g => g.id !== id)); toast({ title: 'Goal deleted' }) }
  }
  const checkGoalNotification = async (savedGoal: any) => {
    if (savedGoal.target_amount > 0 && Number(savedGoal.current_amount) >= Number(savedGoal.target_amount)) {
      await notify({
          userId, type: 'goal',
          title: `Goal reached: ${savedGoal.goal_name}`,
          message: `Congratulations! You've reached your savings goal of ${formatCurrency(savedGoal.target_amount)} for "${savedGoal.goal_name}".`,
          dedupeWindowHours: 24 * 30,
        })
    }
  }
  const onSubmitGoal = async (data: GoalFormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload = {
      ...data,
      account_id: data.account_id === 'none' ? null : data.account_id || null,
      target_date: data.target_date || null,
      notes: data.notes || null,
    }
    if (activeGoal) {
      const { data: updated, error } = await supabase.from('savings_goals')
      .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', activeGoal.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else { setGoals(p => p.map(g => g.id === activeGoal.id ? updated : g)); toast({ title: 'Goal updated', variant: 'success' }); setActionType(null); checkGoalNotification(updated) }
    } else {
      const { data: created, error } = await supabase.from('savings_goals')
      .insert({ ...payload, user_id: userId, status: 'active' }).select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else { setGoals(p => [created, ...p]); toast({ title: 'Goal created!', variant: 'success' }); setActionType(null); checkGoalNotification(created) }
    }
    setLoading(false)
  }
  const onSubmitTransaction = async (data: TransactionFormData, type: 'add' | 'withdraw') => {
    if (!activeGoal) return
    setLoading(true)
    const supabase = createClient()
    const delta = type === 'add' ? Number(data.amount) : -Number(data.amount)
    const newAmount = Math.max(0, Number(activeGoal.current_amount) + delta)
    const accountId = data.account_id && data.account_id !== 'none' ? data.account_id : null
  // Update goal balance
    const { data: updated, error } = await supabase.from('savings_goals')
    .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', activeGoal.id).select().single()
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }
  // Log transaction
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('savings_transactions').insert({
          user_id: user.id, goal_id: activeGoal.id, type,
          amount: Number(data.amount), date: data.date, account_id: accountId, note: data.note || null,
        })
    // Mirror to income/expense so Cash & Liquid reflects it
      if (accountId) {
        if (type === 'add') {
          await supabase.from('expenses').insert({
              user_id: user.id, title: `Savings: ${activeGoal.goal_name}`,
              amount: Number(data.amount), category: 'savings',
              payment_method: 'bank_transfer', date: data.date, account_id: accountId,
              notes: data.note || `Added to savings goal: ${activeGoal.goal_name}`,
            })
        } else {
          await supabase.from('incomes').insert({
              user_id: user.id, title: `Withdrawal: ${activeGoal.goal_name}`,
              amount: Number(data.amount), category: 'other',
              date: data.date, account_id: accountId,
              notes: data.note || `Withdrawn from savings goal: ${activeGoal.goal_name}`,
            })
        }
      }
    }
    setGoals(p => p.map(g => g.id === activeGoal.id ? updated : g))
    toast({ title: `${type === 'add' ? '+' : '-'}${formatCurrency(Number(data.amount))} — balance now ${formatCurrency(newAmount)}`, variant: 'success' })
    setActionType(null)
    checkGoalNotification(updated)
    setLoading(false)
  }
  const onSubmitTransfer = async (data: TransferFormData, direction: 'in' | 'out') => {
    if (!activeGoal) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
  // Create a real transfer record between the two accounts
    await supabase.from('transfers').insert({
        user_id: user.id,
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        amount: Number(data.amount),
        to_amount: Number(data.amount),
        date: data.date,
        notes: data.note || `${direction === 'in' ? 'Transfer to' : 'Transfer from'} goal: ${activeGoal.goal_name}`,
      })
  // Update goal balance
    const delta = direction === 'in' ? Number(data.amount) : -Number(data.amount)
    const newAmount = Math.max(0, Number(activeGoal.current_amount) + delta)
    const { data: updated, error } = await supabase.from('savings_goals')
    .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', activeGoal.id).select().single()
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); setLoading(false); return }
  // Log savings transaction
    await supabase.from('savings_transactions').insert({
        user_id: user.id, goal_id: activeGoal.id,
        type: direction === 'in' ? 'transfer_in' : 'transfer_out',
        amount: Number(data.amount), date: data.date,
        account_id: direction === 'in' ? data.from_account_id : data.to_account_id,
        note: data.note || null,
      })
    setGoals(p => p.map(g => g.id === activeGoal.id ? updated : g))
    toast({ title: `Transfer recorded — goal balance now ${formatCurrency(newAmount)}`, variant: 'success' })
    setActionType(null)
    setLoading(false)
  }
  const onSubmitLinkAccount = async (data: GoalFormData) => {
    if (!activeGoal) return
    setLoading(true)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('savings_goals')
    .update({ account_id: data.account_id === 'none' ? null : data.account_id, updated_at: new Date().toISOString() })
    .eq('id', activeGoal.id).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else { setGoals(p => p.map(g => g.id === activeGoal.id ? updated : g)); toast({ title: 'Linked account updated', variant: 'success' }); setActionType(null) }
    setLoading(false)
  }
  const onSubmitAuto = async (data: AutoFormData) => {
    if (!activeGoal) return
    setLoading(true)
    const supabase = createClient()
    const { data: updated, error } = await supabase.from('savings_goals')
    .update({ auto_contribution_amount: data.amount, auto_contribution_freq: data.frequency, updated_at: new Date().toISOString() })
    .eq('id', activeGoal.id).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else { setGoals(p => p.map(g => g.id === activeGoal.id ? updated : g)); toast({ title: 'Auto-contribution saved', variant: 'success' }); setActionType(null) }
    setLoading(false)
  }
  const TX_ICONS: Record<string, any> = {
    add: ArrowUpRight, withdraw: ArrowDownRight,
    transfer_in: ArrowLeftRight, transfer_out: ArrowLeftRight,
  }
  const TX_COLORS: Record<string, string> = {
    add: 'text-green-600', withdraw: 'text-red-500',
    transfer_in: 'text-blue-600', transfer_out: 'text-orange-500',
  }
// ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between">
    <div>
    <h1 className="font-display text-2xl font-bold">Savings Goals</h1>
    <p className="text-muted-foreground text-sm">Track progress toward your financial targets</p>
  </div>
    <div className="flex items-center gap-2">
    {archivedCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowArchived(v => !v)} className="h-9 text-xs gap-1">
        <Archive className="w-3.5 h-3.5" />
        {showArchived ? 'Hide' : 'Show'} Archived ({archivedCount})
      </Button>
      )}
    <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Goal</Button>
  </div>
  </div>
    {/* Summary */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <KPICard label="Total Saved" value={formatCurrency(totalSaved)} sub={`across ${activeGoals.length} goal(s)`} colorClass="" icon={PiggyBank} accentColor="#16a34a" tooltip="Total amount saved across all active goals" />
    <KPICard label="Total Target" value={formatCurrency(totalTarget)} sub="Combined goal targets" colorClass="" icon={Target} accentColor="#2563eb" tooltip="Sum of all active goal targets" />
    <KPICard label="Overall Progress" value={`${totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(0) : 0}%`} sub={`${formatCurrency(Math.max(0, totalTarget - totalSaved))} remaining`} colorClass="" icon={TrendingUp} accentColor="#f59e0b" tooltip="Percentage of total target amount saved so far" />
    <KPICard label="Completed" value={`${completed} / ${activeGoals.length}`} sub={completed === activeGoals.length && activeGoals.length > 0 ? 'All goals achieved! 🎉' : `${activeGoals.length - completed} in progress`} colorClass="" icon={CheckCircle2} accentColor={completed === activeGoals.length && activeGoals.length > 0 ? '#16a34a' : '#7c3aed'} tooltip="Goals that have reached their target amount" />
  </div>
    {/* ── Trend Analysis ── */}
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
    {/* Collapsible header */}
    <button
      onClick={() => setShowTrend(v => !v)}
    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
    >
    <div className="flex items-center gap-2.5">
    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
    <TrendingUp className="w-4 h-4 text-emerald-600" />
  </div>
    <div className="text-left">
    <p className="font-semibold text-sm">Savings Trend</p>
    <p className="text-xs text-muted-foreground">Cumulative balance over time</p>
  </div>
  </div>
    {showTrend
      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
      : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
  </button>
    {showTrend && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
        {/* Goal filter — multi-select via toggle chips */}
        <div className="space-y-1.5 flex-1 min-w-[200px]">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Goals</p>
        <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setTrendGoalIds([])}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
            trendGoalIds.length === 0
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-muted-foreground border-border hover:border-emerald-400'
          }`}
        >
        All goals
      </button>
        {goals.filter(g => g.status !== 'archived').map((g, idx) => {
              const selected = trendGoalIds.includes(g.id)
              const color = TREND_COLORS[idx % TREND_COLORS.length]
              return (
                <button
                  key={g.id}
                onClick={() => setTrendGoalIds(prev =>
                    selected ? prev.filter(id => id !== g.id) : [...prev, g.id]
                  )}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    selected ? 'text-white border-transparent' : 'bg-white text-muted-foreground border-border hover:border-gray-400'
                  }`}
                style={selected ? { background: color, borderColor: color } : {}}
                >
                {getGoalEmoji(g.goal_name)} {g.goal_name}
              </button>
              )
            })}
      </div>
      </div>
        {/* Date range */}
        <div className="flex gap-2 items-end">
        <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">From</p>
        <input
          type="date"
        value={trendDateFrom}
        onChange={e => setTrendDateFrom(e.target.value)}
        className="h-8 px-2.5 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
      </div>
        <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
        <input
          type="date"
        value={trendDateTo}
        onChange={e => setTrendDateTo(e.target.value)}
        className="h-8 px-2.5 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
        />
      </div>
        {(trendDateFrom || trendDateTo || trendGoalIds.length > 0) && (
            <button
              onClick={() => { setTrendDateFrom(''); setTrendDateTo(''); setTrendGoalIds([]) }}
            className="h-8 px-3 text-xs font-semibold text-orange-500 hover:text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
            >
            Clear
          </button>
          )}
      </div>
      </div>
        {/* Chart */}
        {!txnsLoaded ? (
            <div className="h-56 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
          ) : trendChartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <TrendingUp className="w-8 h-8 opacity-20" />
            <p className="text-sm">No transaction data in this range.</p>
            <p className="text-xs">Add savings to a goal to see the trend line.</p>
          </div>
          ) : (
            <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Latest Total</p>
            <p className="font-bold tabular-nums text-emerald-700 mt-1">
            {formatCurrency(trendChartData[trendChartData.length - 1]?.total ?? 0)}
          </p>
          </div>
            <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Data Points</p>
            <p className="font-bold tabular-nums text-blue-700 mt-1">{trendChartData.length}</p>
          </div>
            <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Goals Shown</p>
            <p className="font-bold tabular-nums text-purple-700 mt-1">
            {trendGoalIds.length === 0 ? goals.filter(g => g.status !== 'archived').length : trendGoalIds.length}
          </p>
          </div>
          </div>
            <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            width={40}
            />
            <Tooltip
              contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(value: number, name: string) => {
                const goal = goals.find(g => g.id === name)
                return [formatCurrency(value), goal ? `${getGoalEmoji(goal.goal_name)} ${goal.goal_name}` : name]
              }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            {(showPerGoalLines || trendGoalIds.length > 1) && <Legend
              formatter={(value) => {
                  const goal = goals.find(g => g.id === value)
                  return goal ? `${getGoalEmoji(goal.goal_name)} ${goal.goal_name}` : value
                }}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              />}
            {/* Total line — always shown when multiple goals visible */}
            {trendGoalIds.length !== 1 && (
                <Line
                  type="monotone"
                dataKey="total"
                name="Total"
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={trendChartData.length <= 20}
                activeDot={{ r: 5 }}
                />
              )}
            {/* Per-goal lines — shown when ≤6 goals to keep chart readable */}
            {showPerGoalLines && trendGoals.map((g, idx) => (
                  <Line
                    key={g.id}
                  type="monotone"
                  dataKey={g.id}
                  name={g.id}
                  stroke={TREND_COLORS[idx % TREND_COLORS.length]}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4 }}
                  />
                ))}
            {/* Single goal selected — show just that one solid line */}
            {trendGoalIds.length === 1 && (() => {
                  const g = trendGoals[0]
                  const idx = goals.findIndex(x => x.id === g?.id)
                  return g ? (
                    <Line
                      key={g.id}
                    type="monotone"
                    dataKey={g.id}
                    name={g.id}
                    stroke={TREND_COLORS[idx % TREND_COLORS.length]}
                    strokeWidth={2.5}
                    dot={trendChartData.length <= 20}
                    activeDot={{ r: 5 }}
                    />
                  ) : null
                })()}
          </LineChart>
          </ResponsiveContainer>
          </>
          )}
      </div>
      )}
  </div>
    {/* Goals grid */}
    {visibleGoals.length === 0 ? (
        <Card className="p-12 text-center">
        <PiggyBank className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="font-display font-semibold text-lg mb-1">No savings goals yet</h3>
        <p className="text-muted-foreground text-sm mb-4">Set goals like Emergency Fund, New Car, Vacation, or House Deposit</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create your first goal</Button>
      </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {visibleGoals.map(g => {
              const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0
              const isComplete = g.status === 'completed' || Number(g.current_amount) >= Number(g.target_amount)
              const daysLeft = g.target_date ? differenceInDays(parseISO(g.target_date), new Date()) : null
              const statusCfg = STATUS_CONFIG[g.status ?? 'active'] ?? STATUS_CONFIG.active
              const linkedAcc = accountsWithBalance.find(a => a.id === g.account_id)
              return (
                <Card key={g.id} className={`p-5 space-y-4 ${isComplete ? 'border-success/40 bg-success/5' : g.status === 'archived' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl flex-shrink-0">{getGoalEmoji(g.goal_name)}</span>
                <div className="min-w-0">
                <p className="font-semibold truncate">{g.goal_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
                {g.target_date && (
                    <p className="text-xs text-muted-foreground">
                    {formatDate(g.target_date)}
                    {daysLeft !== null && daysLeft > 0 && ` · ${daysLeft}d`}
                    {daysLeft !== null && daysLeft <= 0 && ' · overdue'}
                  </p>
                  )}
              </div>
              </div>
              </div>
                <GoalActionsMenu goal={g} onAction={action => openAction(g, action)} />
              </div>
                <div className="space-y-2">
                <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold tabular-nums">{pct.toFixed(0)}%</span>
              </div>
                <Progress value={Math.min(pct, 100)} className={`h-2.5 ${isComplete ? '[&>div]:bg-success' : g.status === 'paused' ? '[&>div]:bg-amber-400' : ''}`} />
                <div className="flex justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">{formatCurrency(Number(g.current_amount))} saved</span>
                <span className="tabular-nums">{formatCurrency(Number(g.target_amount))} goal</span>
              </div>
              </div>
                {/* Linked account */}
                {linkedAcc && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Banknote className="w-3 h-3" />
                    <span className="truncate">{linkedAcc.name}</span>
                    <span className="font-semibold text-emerald-700 ml-auto tabular-nums">{formatCurrency(linkedAcc.balance ?? 0, linkedAcc.currency || 'GHS')}</span>
                  </div>
                  )}
                {/* Auto contribution */}
                {g.auto_contribution_amount > 0 && g.auto_contribution_freq && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3" />
                    <span>Auto: {formatCurrency(g.auto_contribution_amount)} {FREQ_LABELS[g.auto_contribution_freq] ?? g.auto_contribution_freq}</span>
                  </div>
                  )}
                {isComplete ? (
                    <Badge variant="success" className="w-full justify-center py-1">🎉 Goal Achieved!</Badge>
                  ) : g.status === 'paused' ? (
                    <p className="text-xs text-amber-600 font-medium">⏸ Contributions paused</p>
                  ) : (
                    <p className="text-xs text-muted-foreground tabular-nums">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {formatCurrency(Math.max(0, Number(g.target_amount) - Number(g.current_amount)))} remaining
                  </p>
                  )}
                {g.notes && <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{g.notes}</p>}
              </Card>
              )
            })}
      </div>
      )}
    {/* ══ DIALOGS ══════════════════════════════════════════════════ */}
    {/* Create / Edit Goal */}
    <Dialog open={actionType === 'create' || actionType === 'edit'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent>
    <DialogHeader><DialogTitle>{activeGoal ? 'Edit Goal' : 'Add Savings Goal'}</DialogTitle></DialogHeader>
    <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
    <div className="space-y-1.5">
    <Label>Goal Name</Label>
    <Input placeholder="e.g. Emergency Fund, New Car, Vacation..." {...goalForm.register('goal_name')} />
    {goalForm.formState.errors.goal_name && <p className="text-xs text-destructive">{goalForm.formState.errors.goal_name.message}</p>}
  </div>
    <div className="grid grid-cols-2 gap-4">
    <div className="space-y-1.5">
    <Label>Target Amount</Label>
    <Input type="number" step="0.01" placeholder="0.00" {...goalForm.register('target_amount')} />
    {goalForm.formState.errors.target_amount && <p className="text-xs text-destructive">{goalForm.formState.errors.target_amount.message}</p>}
  </div>
    <div className="space-y-1.5">
    <Label>Amount Saved So Far</Label>
    <Input type="number" step="0.01" placeholder="0.00" {...goalForm.register('current_amount')} />
  </div>
  </div>
    <div className="space-y-1.5">
    <Label>Target Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
    <Input type="date" {...goalForm.register('target_date')} />
  </div>
    <div className="space-y-1.5">
    <Label>Linked Account <span className="text-muted-foreground text-xs">(optional)</span></Label>
    <Select value={goalForm.watch('account_id') || 'none'} onValueChange={v => goalForm.setValue('account_id', v)}>
    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
    <SelectContent>
    <SelectItem value="none">No linked account</SelectItem>
    {accountsWithBalance.map(a => (
          <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>
        ))}
  </SelectContent>
  </Select>
    <p className="text-xs text-muted-foreground">Link to a Cash & Liquid account to track where this money is held.</p>
  </div>
    <div className="space-y-1.5">
    <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
    <Textarea placeholder="Why is this goal important to you?" {...goalForm.register('notes')} />
  </div>
    <div className="flex justify-end gap-3 pt-2">
    <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
    <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : activeGoal ? 'Save Changes' : 'Create Goal'}</Button>
  </div>
  </form>
  </DialogContent>
  </Dialog>
    {/* Add Savings */}
    <Dialog open={actionType === 'add'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-emerald-600" /> Add Savings</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={txForm.handleSubmit(d => onSubmitTransaction(d, 'add'))} className="space-y-4">
        <div className="bg-emerald-50 rounded-xl p-3 text-sm space-y-1">
        <p className="font-semibold">{activeGoal.goal_name}</p>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Current balance</span><span className="font-bold text-emerald-700">{formatCurrency(Number(activeGoal.current_amount))}</span></div>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining</span><span>{formatCurrency(Math.max(0, Number(activeGoal.target_amount) - Number(activeGoal.current_amount)))}</span></div>
      </div>
        <div className="space-y-1.5">
        <Label>Amount to Add *</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...txForm.register('amount')} autoFocus />
        {txForm.formState.errors.amount && <p className="text-xs text-destructive">{txForm.formState.errors.amount.message}</p>}
      </div>
        <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" {...txForm.register('date')} />
      </div>
        <div className="space-y-1.5">
        <Label>Deduct from account <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Select value={txForm.watch('account_id') || 'none'} onValueChange={v => txForm.setValue('account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>
        <SelectItem value="none">No account</SelectItem>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
        <p className="text-xs text-muted-foreground">If selected, records an expense in that account.</p>
      </div>
        <div className="space-y-1.5">
        <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="e.g. Monthly contribution…" {...txForm.register('note')} />
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-emerald-600 text-white hover:bg-emerald-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Savings'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* Withdraw Savings */}
    <Dialog open={actionType === 'withdraw'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowDownRight className="w-5 h-5 text-orange-500" /> Withdraw Savings</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={txForm.handleSubmit(d => onSubmitTransaction(d, 'withdraw'))} className="space-y-4">
        <div className="bg-orange-50 rounded-xl p-3 text-sm space-y-1">
        <p className="font-semibold">{activeGoal.goal_name}</p>
        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Available</span><span className="font-bold text-orange-600">{formatCurrency(Number(activeGoal.current_amount))}</span></div>
      </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">Withdrawing will reduce your progress toward this goal.</p>
      </div>
        <div className="space-y-1.5">
        <Label>Amount to Withdraw *</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...txForm.register('amount')} autoFocus />
        {txForm.formState.errors.amount && <p className="text-xs text-destructive">{txForm.formState.errors.amount.message}</p>}
      </div>
        <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" {...txForm.register('date')} />
      </div>
        <div className="space-y-1.5">
        <Label>Return to account <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Select value={txForm.watch('account_id') || 'none'} onValueChange={v => txForm.setValue('account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
        <SelectContent>
        <SelectItem value="none">No account</SelectItem>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
        <p className="text-xs text-muted-foreground">If selected, records an income in that account.</p>
      </div>
        <div className="space-y-1.5">
        <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="Reason for withdrawal…" {...txForm.register('note')} />
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* Transfer to Goal */}
    <Dialog open={actionType === 'transfer_in'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-blue-600" /> Transfer to Goal</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={transferForm.handleSubmit(d => onSubmitTransfer(d, 'in'))} className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-sm">
        <p className="font-semibold">{activeGoal.goal_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Move money from one of your accounts into this goal</p>
      </div>
        <div className="space-y-1.5">
        <Label>From Account *</Label>
        <Select onValueChange={v => transferForm.setValue('from_account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
        <SelectContent>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
        {transferForm.formState.errors.from_account_id && <p className="text-xs text-destructive">{transferForm.formState.errors.from_account_id.message}</p>}
      </div>
        <div className="space-y-1.5">
        <Label>To Account (Goal's Account) *</Label>
        <Select defaultValue={activeGoal.account_id || ''} onValueChange={v => transferForm.setValue('to_account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
        <SelectContent>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
        {transferForm.formState.errors.to_account_id && <p className="text-xs text-destructive">{transferForm.formState.errors.to_account_id.message}</p>}
      </div>
        <div className="space-y-1.5">
        <Label>Amount *</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...transferForm.register('amount')} autoFocus />
      </div>
        <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" {...transferForm.register('date')} />
      </div>
        <div className="space-y-1.5">
        <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="e.g. Monthly transfer to savings…" {...transferForm.register('note')} />
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transfer to Goal'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* Transfer from Goal */}
    <Dialog open={actionType === 'transfer_out'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-orange-500" /> Transfer from Goal</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={transferForm.handleSubmit(d => onSubmitTransfer(d, 'out'))} className="space-y-4">
        <div className="bg-orange-50 rounded-xl p-3 text-sm">
        <p className="font-semibold">{activeGoal.goal_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Move money from this goal back to one of your accounts</p>
      </div>
        <div className="space-y-1.5">
        <Label>From Account (Goal's Account) *</Label>
        <Select defaultValue={activeGoal.account_id || ''} onValueChange={v => transferForm.setValue('from_account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
        <SelectContent>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
      </div>
        <div className="space-y-1.5">
        <Label>To Account *</Label>
        <Select onValueChange={v => transferForm.setValue('to_account_id', v)}>
        <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
        <SelectContent>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
      </div>
        <div className="space-y-1.5">
        <Label>Amount *</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...transferForm.register('amount')} autoFocus />
      </div>
        <div className="space-y-1.5">
        <Label>Date</Label>
        <Input type="date" {...transferForm.register('date')} />
      </div>
        <div className="space-y-1.5">
        <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input placeholder="e.g. Using savings for…" {...transferForm.register('note')} />
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-orange-500 text-white hover:bg-orange-600">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Transfer from Goal'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* Change Linked Account */}
    <Dialog open={actionType === 'link_account'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="w-5 h-5 text-emerald-600" /> Change Linked Account</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={goalForm.handleSubmit(onSubmitLinkAccount)} className="space-y-4">
        <p className="text-sm text-muted-foreground">Choose which Cash & Liquid account this goal's savings are held in.</p>
        <div className="space-y-1.5">
        <Label>Account</Label>
        <Select value={goalForm.watch('account_id') || 'none'} onValueChange={v => goalForm.setValue('account_id', v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
        <SelectItem value="none">No linked account</SelectItem>
        {accountsWithBalance.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance ?? 0, a.currency || 'GHS')}</SelectItem>)}
      </SelectContent>
      </Select>
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* Auto Contribution */}
    <Dialog open={actionType === 'auto'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-sm">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-blue-600" /> Set Auto Contribution</DialogTitle></DialogHeader>
    {activeGoal && (
        <form onSubmit={autoForm.handleSubmit(onSubmitAuto)} className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
        Auto-contribution is a reminder shown on the goal card. Actual transfers must be made manually or via your bank.
      </div>
        <div className="space-y-1.5">
        <Label>Contribution Amount</Label>
        <Input type="number" step="0.01" placeholder="0.00" {...autoForm.register('amount')} autoFocus />
        {autoForm.formState.errors.amount && <p className="text-xs text-destructive">{autoForm.formState.errors.amount.message}</p>}
      </div>
        <div className="space-y-1.5">
        <Label>Frequency</Label>
        <Select value={autoForm.watch('frequency')} onValueChange={v => autoForm.setValue('frequency', v)}>
        <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
        <SelectContent>
        <SelectItem value="daily">Daily</SelectItem>
        <SelectItem value="weekly">Weekly</SelectItem>
        <SelectItem value="biweekly">Bi-weekly</SelectItem>
        <SelectItem value="monthly">Monthly</SelectItem>
      </SelectContent>
      </Select>
        {autoForm.formState.errors.frequency && <p className="text-xs text-destructive">{autoForm.formState.errors.frequency.message}</p>}
      </div>
        <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
      </div>
      </form>
      )}
  </DialogContent>
  </Dialog>
    {/* View Transactions */}
    <Dialog open={actionType === 'transactions'} onOpenChange={o => !o && setActionType(null)}>
    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><List className="w-5 h-5" /> Transactions — {activeGoal?.goal_name}</DialogTitle></DialogHeader>
    {txLoading ? (
        <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
        <p className="text-sm">No transactions yet</p>
      </div>
      ) : (
        <div className="space-y-2">
        {transactions.map(tx => {
              const Icon = TX_ICONS[tx.type] ?? ArrowUpRight
              const color = TX_COLORS[tx.type] ?? 'text-muted-foreground'
              const acc = accountsWithBalance.find(a => a.id === tx.account_id)
              const isPositive = tx.type === 'add' || tx.type === 'transfer_in'
              return (
                <div key={tx.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/10">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
                <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">{tx.type.replace('_', ' ')}</p>
                <div className="text-xs text-muted-foreground mt-0.5">
                <span>{new Date(tx.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {acc && <span> · {acc.name}</span>}
                {tx.note && <span> · {tx.note}</span>}
              </div>
              </div>
                <span className={`font-bold text-sm tabular-nums ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                {isPositive ? '+' : '-'}{formatCurrency(Number(tx.amount))}
              </span>
              </div>
              )
            })}
      </div>
      )}
    <div className="flex justify-end pt-2 border-t border-border">
    <Button variant="outline" onClick={() => setActionType(null)}>Close</Button>
  </div>
  </DialogContent>
  </Dialog>
  </div>
  )
}