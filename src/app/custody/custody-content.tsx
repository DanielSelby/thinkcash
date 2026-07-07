'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Edit2, Trash2, Loader2, ArrowDownToLine, ArrowUpFromLine,
  Users, ChevronDown, ChevronUp, Wallet, HandCoins,
} from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import type { CustodyTransaction } from '@/types'
import { KPICard } from '@/components/ui/kpi-card'

const schema = z.object({
  person_name: z.string().min(1, 'Name required'),
  direction:   z.enum(['received', 'given']),
  amount:      z.coerce.number().positive('Amount must be positive'),
  currency:    z.string().min(1, 'Currency required'),
  account_id:  z.string().optional(),
  date:        z.string().min(1, 'Date required'),
  notes:       z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface AccountLite { id: string; name: string; currency: string }

interface Props {
  initialTransactions: CustodyTransaction[]
  accounts: AccountLite[]
  userId: string
}

// Custody balances don't "trigger" the way budgets/goals do — they go stale.
// Anything held (or owed) for this many days without fresh activity gets a nudge.
const CUSTODY_STALE_DAYS = 14

export function CustodyContent({ initialTransactions, accounts, userId }: Props) {
  const { activeTheme, currency: appCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [transactions, setTransactions] = useState(initialTransactions)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<CustodyTransaction | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)
  const [prefillPerson, setPrefillPerson] = useState<string | null>(null)

  // ── Filter slicers ──────────────────────────────────────────────
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')
  const [filterMonth,  setFilterMonth]  = useState('')
  const [filterYear,   setFilterYear]   = useState('')
  const [filterPerson, setFilterPerson] = useState('All')

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: 'received',
      currency:  appCurrency || 'GHS',
      date:      new Date().toISOString().split('T')[0],
    },
  })

  // ── Custody balance reminder ────────────────────────────────────
  // Given a person's full transaction history (unfiltered), computes their
  // balance per currency + most recent activity date, then fires a reminder
  // if a non-zero balance has gone CUSTODY_STALE_DAYS without any movement.
  // Dedupe window means each person gets nagged at most once a week.
  const checkCustodyReminder = async (
    personName: string,
    balanceByCurrency: Record<string, number>,
    lastDate: string
  ) => {
    const daysSinceActivity = differenceInDays(new Date(), parseISO(lastDate))
    if (daysSinceActivity < CUSTODY_STALE_DAYS) return

    for (const [cur, bal] of Object.entries(balanceByCurrency)) {
      if (Math.abs(bal) < 0.01) continue
      const isHolding = bal > 0
      await notify({
        userId,
        type: 'system',
        title: `Custody reminder: ${personName}`,
        message: isHolding
          ? `You're still holding ${formatCurrency(bal, cur)} for ${personName} — last activity ${daysSinceActivity} days ago. Consider settling up.`
          : `${personName} still owes you ${formatCurrency(Math.abs(bal), cur)} — last activity ${daysSinceActivity} days ago.`,
        dedupeWindowHours: 24 * 7,
      })
    }
  }

  // Recomputes one person's balance + last activity date from a given
  // transaction list (defaults to live state) and runs the reminder check.
  // Accepts an override list so post-save checks can include a not-yet-committed
  // create/update without waiting on setState to flush.
  const checkCustodyReminderForPerson = async (
    personName: string,
    txnsOverride?: CustodyTransaction[]
  ) => {
    const source = txnsOverride ?? transactions
    const personTxns = source.filter(t => t.person_name === personName)
    if (personTxns.length === 0) return

    const sorted = [...personTxns].sort((a, b) => a.date.localeCompare(b.date))
    const lastDate = sorted[sorted.length - 1].date
    const balanceByCurrency: Record<string, number> = {}
    sorted.forEach(t => {
      const delta = t.direction === 'received' ? Number(t.amount) : -Number(t.amount)
      balanceByCurrency[t.currency] = (balanceByCurrency[t.currency] || 0) + delta
    })

    await checkCustodyReminder(personName, balanceByCurrency, lastDate)
  }

  // Date-based sweep, not action-based — runs once on page load against the
  // server-fetched snapshot, so stale balances surface even if the user
  // never opens the create/edit form that day.
  useEffect(() => {
    const people = Array.from(new Set(initialTransactions.map(t => t.person_name)))
    people.forEach(p => checkCustodyReminderForPerson(p, initialTransactions))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Available people for the Person slicer (derived from ALL transactions, not filtered ones) ──
  const allPeople = useMemo(() =>
    Array.from(new Set(transactions.map(t => t.person_name))).sort(),
    [transactions])

  const allYears = useMemo(() =>
    Array.from(new Set(transactions.map(t => t.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a)),
    [transactions])

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const clearFilters = () => {
    setFilterFrom(''); setFilterTo('')
    setFilterMonth(''); setFilterYear('')
    setFilterPerson('All')
  }
  const hasActiveFilters = !!filterFrom || !!filterTo || !!filterMonth || !!filterYear || filterPerson !== 'All'

  // ── Apply slicers ────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterFrom && t.date < filterFrom) return false
      if (filterTo && t.date > filterTo) return false
      if (filterMonth && t.date.slice(5, 7) !== filterMonth) return false
      if (filterYear && t.date.slice(0, 4) !== filterYear) return false
      if (filterPerson !== 'All' && t.person_name !== filterPerson) return false
      return true
    })
  }, [transactions, filterFrom, filterTo, filterMonth, filterYear, filterPerson])

  // ── Group by person, compute running balance per currency ──────────
  // NOTE: running balances are computed from the FULL transaction history per person
  // (not the filtered set) so balances stay accurate even when a date/person filter is active.
  const groupedByPerson = useMemo(() => {
    const map: Record<string, {
      name: string
      transactions: CustodyTransaction[]
      balanceByCurrency: Record<string, number>
    }> = {}

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

    sorted.forEach(t => {
      if (!map[t.person_name]) {
        map[t.person_name] = { name: t.person_name, transactions: [], balanceByCurrency: {} }
      }
      const delta = t.direction === 'received' ? Number(t.amount) : -Number(t.amount)
      map[t.person_name].balanceByCurrency[t.currency] = (map[t.person_name].balanceByCurrency[t.currency] || 0) + delta
      map[t.person_name].transactions.push(t)
    })

    // Now swap in the FILTERED transaction list for display purposes only (balances above already final)
    Object.values(map).forEach(p => {
      p.transactions = filteredTransactions.filter(t => t.person_name === p.name).sort((a, b) => b.date.localeCompare(a.date))
    })

    return Object.values(map)
      .filter(p => p.transactions.length > 0 || !hasActiveFilters)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [transactions, filteredTransactions, hasActiveFilters])

  // ── Overall totals by currency (sum of what you're currently holding) ──
  const totalsByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    groupedByPerson.forEach(p => {
      Object.entries(p.balanceByCurrency).forEach(([cur, bal]) => {
        map[cur] = (map[cur] || 0) + bal
      })
    })
    return map
  }, [groupedByPerson])

  const peopleCount = groupedByPerson.length
  const totalTxnCount = transactions.length

  const openCreate = (personName?: string) => {
    setEditing(null)
    setPrefillPerson(personName || null)
    reset({
      direction: 'received',
      currency:  appCurrency || 'GHS',
      date:      new Date().toISOString().split('T')[0],
      person_name: personName || '',
      amount: undefined as any,
      account_id: '',
      notes: '',
    })
    setOpen(true)
  }

  const openEdit = (t: CustodyTransaction) => {
    setEditing(t)
    setPrefillPerson(null)
    reset({
      person_name: t.person_name,
      direction:   t.direction,
      amount:      t.amount,
      currency:    t.currency,
      account_id:  t.account_id || '',
      date:        t.date,
      notes:       t.notes || '',
    })
    setOpen(true)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload = { ...data, account_id: data.account_id || null }
    if (editing) {
      const { data: updated, error } = await supabase
        .from('custody_transactions')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setTransactions(prev => prev.map(t => t.id === editing.id ? updated : t))
        toast({ title: 'Transaction updated', variant: 'success' })
        setOpen(false)
        checkCustodyReminderForPerson(
          updated.person_name,
          [...transactions.filter(t => t.id !== editing.id), updated]
        )
      }
    } else {
      const { data: created, error } = await supabase
        .from('custody_transactions')
        .insert({ ...payload, user_id: userId })
        .select().single()
      if (error) toast({ title: 'Failed to add', description: error.message, variant: 'destructive' })
      else {
        setTransactions(prev => [created, ...prev])
        toast({ title: 'Transaction recorded', variant: 'success' })
        setOpen(false)
        checkCustodyReminderForPerson(
          created.person_name,
          [...transactions, created]
        )
      }
    }
    setLoading(false)
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as any
    toast({ title: 'Fix form errors', description: first?.message, variant: 'destructive' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('custody_transactions').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else {
      setTransactions(prev => prev.filter(t => t.id !== id))
      toast({ title: 'Deleted' })
    }
  }

  const getAccountName = (id: string | null) => accounts.find(a => a.id === id)?.name ?? '—'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
            Custody Account
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Money you're holding for others — not your income, tracked separately
          </p>
        </div>
        <Button onClick={() => openCreate()} style={{ background: theme.colors.primary, color: '#fff' }}>
          <Plus className="w-4 h-4 mr-1" /> Record Transaction
        </Button>
      </div>

      {/* Filter Slicers */}
      <Card className="bg-white rounded-xl shadow-sm border border-border">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Transactions</p>
            {hasActiveFilters && (
              <button onClick={clearFilters}
                className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Clear filters
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Month</label>
              <Select value={filterMonth || 'all'} onValueChange={v => setFilterMonth(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Year</label>
              <Select value={filterYear || 'all'} onValueChange={v => setFilterYear(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-28 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {allYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Person</label>
              <Select value={filterPerson} onValueChange={setFilterPerson}>
                <SelectTrigger className="w-40 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All People</SelectItem>
                  {allPeople.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard label="People" value={String(peopleCount)} sub={`${totalTxnCount} total transactions`} colorClass="" icon={Users} accentColor={theme.colors.primary} tooltip="Number of people with custody transactions" />
        <KPICard label="Transactions" value={String(totalTxnCount)} sub="All time" colorClass="" icon={HandCoins} accentColor="#2563eb" tooltip="Total number of custody transactions recorded" />
        {Object.entries(totalsByCurrency).map(([cur, bal]) => (
          <Card key={cur} className={`bg-white rounded-xl shadow-sm border border-border overflow-hidden`}>
            <div className={`h-1 ${bal >= 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
            <CardContent className="p-4">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
                Currently Holding ({cur})
              </p>
              <p className={`text-lg sm:text-2xl font-bold tabular-nums mt-1 ${bal >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(bal), cur)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {bal >= 0 ? 'You owe this out' : 'You are owed this'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grouped by person */}
      {groupedByPerson.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-semibold text-lg mb-1">No custody transactions yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Record money you receive from or give back to others here
          </p>
          <Button onClick={() => openCreate()} style={{ background: theme.colors.primary, color: '#fff' }}>
            <Plus className="w-4 h-4 mr-1" /> Record First Transaction
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedByPerson.map(person => {
            const isExpanded = expandedPerson === person.name
            const currencies = Object.keys(person.balanceByCurrency)
            return (
              <Card key={person.name} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
                <button
                  onClick={() => setExpandedPerson(isExpanded ? null : person.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm"
                      style={{ background: theme.colors.primaryPale, color: theme.colors.primary }}>
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{person.name}</p>
                      <p className="text-xs text-muted-foreground">{person.transactions.length} transaction(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      {currencies.map(cur => {
                        const bal = person.balanceByCurrency[cur]
                        return (
                          <p key={cur} className={`text-sm font-bold tabular-nums ${bal >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(bal), cur)} {bal >= 0 ? 'held' : 'overpaid'}
                          </p>
                        )
                      })}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="px-4 py-2 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => openCreate(person.name)} className="h-7 text-xs gap-1">
                        <Plus className="w-3 h-3" /> Add for {person.name}
                      </Button>
                    </div>
                    <div className="divide-y divide-border">
                      {(() => {
                        // Running balance walks the person's FULL chronological history (not just the filtered view),
                        // so the balance shown next to each row stays mathematically accurate even when filters are active.
                        const fullChrono = transactions
                          .filter(t => t.person_name === person.name)
                          .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
                        const runningMap: Record<string, number> = {}
                        const runningByTxnId: Record<string, number> = {}
                        fullChrono.forEach(t => {
                          const delta = t.direction === 'received' ? Number(t.amount) : -Number(t.amount)
                          runningMap[t.currency] = (runningMap[t.currency] || 0) + delta
                          runningByTxnId[t.id] = runningMap[t.currency]
                        })
                        const withRunning = person.transactions.map(t => ({ ...t, runningBalance: runningByTxnId[t.id] ?? 0 }))
                        return withRunning.map(t => (
                          <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3 group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                t.direction === 'received' ? 'bg-amber-50' : 'bg-green-50'
                              }`}>
                                {t.direction === 'received'
                                  ? <ArrowDownToLine className="w-4 h-4 text-amber-600" />
                                  : <ArrowUpFromLine className="w-4 h-4 text-green-600" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Badge variant={t.direction === 'received' ? 'secondary' : 'success'}>
                                    {t.direction === 'received' ? 'Received From Person' : 'Released To Person'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {getAccountName(t.account_id)}{t.notes ? ` · ${t.notes}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className={`text-sm font-semibold tabular-nums ${t.direction === 'received' ? 'text-amber-600' : 'text-green-600'}`}>
                                  {t.direction === 'received' ? '+' : '−'}{formatCurrency(Number(t.amount), t.currency)}
                                </p>
                                <p className="text-[10px] text-muted-foreground tabular-nums">
                                  Bal: {formatCurrency(Math.abs(t.runningBalance), t.currency)}
                                </p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(t)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(t.id)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Transaction' : 'Record Custody Transaction'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Person's Name</Label>
              <Input placeholder="e.g. Kwame, Auntie Akosua" {...register('person_name')} />
              {errors.person_name && <p className="text-xs text-destructive">{errors.person_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select
                onValueChange={v => setValue('direction', v as 'received' | 'given', { shouldValidate: true })}
                value={watch('direction')}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Receive From The Person (Money Receive To Custody)</SelectItem>
                  <SelectItem value="given">Release To The Person (Money Release From Custody)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select
                  onValueChange={v => setValue('currency', v, { shouldValidate: true })}
                  value={watch('currency')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([appCurrency, ...accounts.map(a => a.currency)])).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Linked Account <span className="text-muted-foreground text-xs">(optional — where the cash sits)</span></Label>
              <Select
                onValueChange={v => setValue('account_id', v === 'none' ? '' : v)}
                value={watch('account_id') || 'none'}
              >
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No account</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" {...register('date')} />
              {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input placeholder="e.g. School fees, market money" {...register('notes')} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Record Transaction'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}