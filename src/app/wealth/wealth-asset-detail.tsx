'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  X, Edit2, Trash2, Loader2, Plus, Calendar, MapPin,
  DollarSign, Tag, ShieldCheck, Wrench, TrendingUp,
  TrendingDown, AlertTriangle, Clock, CheckCircle2,
  ArrowUpRight, ArrowDownRight, BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'

const fmt = (n: number) => formatCurrency(n, 'GHS')

function calcDepreciation(asset: any) {
  const purchaseVal  = Number(asset.purchase_value ?? 0)
  const rate         = Number(asset.annual_depreciation_rate ?? 0)
  const method       = asset.depreciation_method ?? 'none'
  const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null
  if (!purchaseDate || !rate || method === 'none' || !purchaseVal) {
    return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0, totalDepreciation: 0 }
  }
  const yearsElapsed = Math.max(0, (Date.now() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  if (method === 'straight_line') {
    const annualAmount        = purchaseVal * (rate / 100)
    const totalDepreciation   = annualAmount * yearsElapsed
    const currentDepreciatedValue = Math.max(0, purchaseVal - totalDepreciation)
    return { currentDepreciatedValue, annualAmount, yearsElapsed, totalDepreciation }
  }
  if (method === 'declining_balance') {
    const currentDepreciatedValue = purchaseVal * Math.pow(1 - rate / 100, yearsElapsed)
    const totalDepreciation       = purchaseVal - currentDepreciatedValue
    return { currentDepreciatedValue: Math.max(0, currentDepreciatedValue), annualAmount: purchaseVal * (rate / 100), yearsElapsed, totalDepreciation }
  }
  return { currentDepreciatedValue: Number(asset.current_value ?? 0), annualAmount: 0, yearsElapsed: 0, totalDepreciation: 0 }
}

function warrantyStatus(asset: any): { label: string; color: string; daysLeft: number } {
  if (!asset.warranty_end) return { label: 'No warranty', color: '#94a3b8', daysLeft: 0 }
  const end      = new Date(asset.warranty_end)
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (daysLeft < 0)  return { label: 'Expired',          color: '#dc2626', daysLeft }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: '#f59e0b', daysLeft }
  if (daysLeft <= 30)return { label: `${daysLeft}d left`, color: '#f59e0b', daysLeft }
  return { label: `${Math.ceil(daysLeft / 30)}m left`, color: '#16a34a', daysLeft }
}

const maintenanceSchema = z.object({
  date:        z.string().min(1, 'Date required'),
  description: z.string().min(1, 'Description required'),
  cost:        z.coerce.number().min(0),
  vendor:      z.string().optional(),
  next_date:   z.string().optional(),
})
type MaintenanceFormData = z.infer<typeof maintenanceSchema>

interface Props {
  asset:    any
  onClose:  () => void
  onUpdate: (updated: any) => void
}

export function AssetDetailPanel({ asset, onClose, onUpdate }: Props) {
  const [maintenance,    setMaintenance]    = useState<any[]>([])
  const [loadingMaint,   setLoadingMaint]   = useState(false)
  const [maintLoaded,    setMaintLoaded]    = useState(false)
  const [showAddMaint,   setShowAddMaint]   = useState(false)
  const [savingMaint,    setSavingMaint]    = useState(false)
  const [activeTab,      setActiveTab]      = useState<'overview' | 'maintenance' | 'warranty' | 'timeline'>('overview')

  const dep     = useMemo(() => calcDepreciation(asset), [asset])
  const gain    = Number(asset.current_value ?? 0) - Number(asset.purchase_value ?? 0)
  const wStatus = useMemo(() => warrantyStatus(asset), [asset])

  const maintForm = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { date: new Date().toISOString().split('T')[0], description: '', cost: 0, vendor: '', next_date: '' },
  })

  const loadMaintenance = async () => {
    if (maintLoaded) return
    setLoadingMaint(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('asset_maintenance')
      .select('*')
      .eq('asset_id', asset.id)
      .order('date', { ascending: false })
    setMaintenance(data || [])
    setMaintLoaded(true)
    setLoadingMaint(false)
  }

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab)
    if (tab === 'maintenance' || tab === 'timeline') loadMaintenance()
  }

  const onSubmitMaintenance = async (data: MaintenanceFormData) => {
    setSavingMaint(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: created, error } = await supabase
      .from('asset_maintenance')
      .insert({ ...data, asset_id: asset.id, user_id: user.id })
      .select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else {
      setMaintenance(p => [created, ...p])
      toast({ title: 'Maintenance logged', variant: 'success' })
      setShowAddMaint(false)
      maintForm.reset({ date: new Date().toISOString().split('T')[0], description: '', cost: 0, vendor: '', next_date: '' })
    }
    setSavingMaint(false)
  }

  const deleteMaintenance = async (id: string) => {
    if (!confirm('Delete this maintenance record?')) return
    const supabase = createClient()
    const { error } = await supabase.from('asset_maintenance').delete().eq('id', id)
    if (!error) setMaintenance(p => p.filter(m => m.id !== id))
  }

  const totalMaintenanceCost = useMemo(() =>
    maintenance.reduce((s, m) => s + Number(m.cost ?? 0), 0), [maintenance])

  const upcomingMaintenance = useMemo(() =>
    maintenance.filter(m => m.next_date && new Date(m.next_date) >= new Date())
      .sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime()),
    [maintenance])

  // Build timeline events
  const timelineEvents = useMemo(() => {
    const events: { date: string; label: string; sub?: string; color: string; icon: any }[] = []
    if (asset.purchase_date) events.push({ date: asset.purchase_date, label: 'Purchased', sub: fmt(Number(asset.purchase_value ?? 0)), color: '#16a34a', icon: DollarSign })
    maintenance.forEach(m => events.push({ date: m.date, label: `Maintenance: ${m.description}`, sub: m.cost > 0 ? `Cost: ${fmt(Number(m.cost))}${m.vendor ? ` · ${m.vendor}` : ''}` : m.vendor, color: '#2563eb', icon: Wrench }))
    if (asset.warranty_start) events.push({ date: asset.warranty_start, label: 'Warranty Started', sub: asset.warranty_provider, color: '#9333ea', icon: ShieldCheck })
    if (asset.status === 'sold' && asset.sold_date) events.push({ date: asset.sold_date, label: 'Sold', sub: asset.sold_price ? `${fmt(Number(asset.sold_price))}${asset.sold_to ? ` to ${asset.sold_to}` : ''}` : undefined, color: '#0891b2', icon: DollarSign })
    if (asset.status === 'disposed' && asset.disposal_date) events.push({ date: asset.disposal_date, label: 'Disposed', sub: asset.disposal_reason, color: '#dc2626', icon: AlertTriangle })
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [asset, maintenance])

  const TabBtn = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => handleTabChange(id)}
      className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
        activeTab === id ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg">{asset.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground capitalize">{asset.asset_type}</span>
                {asset.asset_tag && <span className="text-xs font-mono text-muted-foreground">· {asset.asset_tag}</span>}
                {asset.status && (
                  <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: '#16a34a20', color: '#16a34a' }}>
                    {asset.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          <TabBtn id="overview"    label="Overview"    />
          <TabBtn id="maintenance" label="Maintenance" />
          <TabBtn id="warranty"    label="Warranty"    />
          <TabBtn id="timeline"    label="Timeline"    />
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Value summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Current Value</p>
                <p className="text-xl font-bold tabular-nums text-green-700 mt-1">{fmt(Number(asset.current_value ?? 0))}</p>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Purchase Price</p>
                <p className="text-xl font-bold tabular-nums mt-1">{fmt(Number(asset.purchase_value ?? 0))}</p>
              </div>
            </div>

            {/* Gain/loss */}
            <div className={`rounded-xl p-3 flex items-center justify-between ${gain >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {gain >= 0
                  ? <ArrowUpRight className="w-5 h-5 text-green-600" />
                  : <ArrowDownRight className="w-5 h-5 text-red-500" />}
                <div>
                  <p className="text-sm font-semibold">{gain >= 0 ? 'Appreciation' : 'Depreciation'}</p>
                  <p className="text-xs text-muted-foreground">vs purchase price</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold tabular-nums ${gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {gain >= 0 ? '+' : ''}{fmt(gain)}
                </p>
                {Number(asset.purchase_value) > 0 && (
                  <p className={`text-xs ${gain >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                    {Math.round((gain / Number(asset.purchase_value)) * 100)}%
                  </p>
                )}
              </div>
            </div>

            {/* Depreciation details */}
            {dep.annualAmount > 0 && (
              <div className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Depreciation Engine</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Method</p>
                    <p className="font-medium capitalize">{(asset.depreciation_method ?? '').replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Rate</p>
                    <p className="font-medium">{asset.annual_depreciation_rate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Amount</p>
                    <p className="font-medium text-orange-600">-{fmt(dep.annualAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Depreciated</p>
                    <p className="font-medium text-orange-600">-{fmt(dep.totalDepreciation)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Depreciated Value</p>
                    <p className="font-bold">{fmt(dep.currentDepreciatedValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Years Elapsed</p>
                    <p className="font-medium">{dep.yearsElapsed.toFixed(1)}y</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-orange-400 transition-all"
                    style={{ width: `${Number(asset.purchase_value) > 0 ? Math.round((dep.currentDepreciatedValue / Number(asset.purchase_value)) * 100) : 0}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {Number(asset.purchase_value) > 0 ? Math.round((dep.currentDepreciatedValue / Number(asset.purchase_value)) * 100) : 0}% remaining value
                </p>
              </div>
            )}

            {/* Meta details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {asset.purchase_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Purchased</p>
                    <p className="font-medium">{new Date(asset.purchase_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
              {asset.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium">{asset.location}</p>
                  </div>
                </div>
              )}
              {asset.condition && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Condition</p>
                    <p className="font-medium capitalize">{asset.condition}</p>
                  </div>
                </div>
              )}
              {asset.useful_life_years && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Useful Life</p>
                    <p className="font-medium">{asset.useful_life_years} years</p>
                  </div>
                </div>
              )}
            </div>

            {asset.description && (
              <div className="bg-muted/30 rounded-xl p-3 text-sm text-muted-foreground">
                {asset.description}
              </div>
            )}

            {/* Sold info */}
            {asset.status === 'sold' && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-blue-700">Sale Details</p>
                <div className="flex justify-between"><span className="text-muted-foreground">Sale Price</span><span className="font-bold text-blue-600">{fmt(Number(asset.sold_price ?? 0))}</span></div>
                {asset.sold_date && <div className="flex justify-between"><span className="text-muted-foreground">Sale Date</span><span>{new Date(asset.sold_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                {asset.sold_to && <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{asset.sold_to}</span></div>}
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="text-muted-foreground">Gain / Loss</span>
                  <span className={`font-bold ${Number(asset.sold_price ?? 0) >= Number(asset.purchase_value ?? 0) ? 'text-green-600' : 'text-red-500'}`}>
                    {Number(asset.sold_price ?? 0) >= Number(asset.purchase_value ?? 0) ? '+' : ''}{fmt(Number(asset.sold_price ?? 0) - Number(asset.purchase_value ?? 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Maintenance Tab ── */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Maintenance Log</p>
                <p className="text-xs text-muted-foreground">Total cost: {fmt(totalMaintenanceCost)}</p>
              </div>
              <Button size="sm" onClick={() => setShowAddMaint(v => !v)} className="h-8 text-xs gap-1">
                <Plus className="w-3.5 h-3.5" /> Log Maintenance
              </Button>
            </div>

            {/* Upcoming reminders */}
            {upcomingMaintenance.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700">Upcoming Maintenance</p>
                {upcomingMaintenance.slice(0, 3).map(m => {
                  const days = Math.ceil((new Date(m.next_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                  return (
                    <div key={m.id} className="flex justify-between text-sm">
                      <span>{m.description}</span>
                      <span className={`text-xs font-semibold ${days <= 7 ? 'text-red-500' : days <= 30 ? 'text-orange-500' : 'text-blue-600'}`}>
                        in {days}d
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add maintenance form */}
            {showAddMaint && (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                <p className="text-sm font-semibold">Log New Maintenance</p>
                <form onSubmit={maintForm.handleSubmit(onSubmitMaintenance)} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description *</Label>
                    <Input placeholder="e.g. Oil change, Screen repair" {...maintForm.register('description')} />
                    {maintForm.formState.errors.description && <p className="text-xs text-destructive">{maintForm.formState.errors.description.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date *</Label>
                      <Input type="date" {...maintForm.register('date')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cost</Label>
                      <Input type="number" step="0.01" placeholder="0.00" {...maintForm.register('cost')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vendor</Label>
                      <Input placeholder="e.g. AutoFix Ghana" {...maintForm.register('vendor')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Next Due Date</Label>
                      <Input type="date" {...maintForm.register('next_date')} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddMaint(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={savingMaint}>
                      {savingMaint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Maintenance list */}
            {loadingMaint ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : maintenance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No maintenance records yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {maintenance.map(m => (
                  <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-white">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.description}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{new Date(m.date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {m.vendor && <span>· {m.vendor}</span>}
                        {m.next_date && <span className="text-blue-600">Next: {new Date(m.next_date).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.cost > 0 && <span className="text-sm font-semibold text-destructive">{fmt(Number(m.cost))}</span>}
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteMaintenance(m.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Warranty Tab ── */}
        {activeTab === 'warranty' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 ${wStatus.daysLeft < 0 ? 'bg-red-50' : wStatus.daysLeft <= 30 ? 'bg-orange-50' : 'bg-green-50'}`}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-5 h-5" style={{ color: wStatus.color }} />
                <p className="font-semibold" style={{ color: wStatus.color }}>Warranty Status: {wStatus.label}</p>
              </div>
              {asset.warranty_end && (
                <p className="text-sm text-muted-foreground">
                  Expiry: {new Date(asset.warranty_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            {(!asset.warranty_start && !asset.warranty_end) ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No warranty information</p>
                <p className="text-xs mt-1">Edit this asset to add warranty details</p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {asset.warranty_start && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Start Date</span>
                    <span className="font-medium">{new Date(asset.warranty_start).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                {asset.warranty_end && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">End Date</span>
                    <span className="font-medium">{new Date(asset.warranty_end).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                )}
                {asset.warranty_provider && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{asset.warranty_provider}</span>
                  </div>
                )}
                {asset.warranty_number && (
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Warranty No.</span>
                    <span className="font-mono font-medium">{asset.warranty_number}</span>
                  </div>
                )}
              </div>
            )}

            {/* Warranty alert banners */}
            {wStatus.daysLeft > 0 && wStatus.daysLeft <= 30 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-orange-700">Warranty expires in {wStatus.daysLeft} days. Consider renewing or arranging alternative coverage.</p>
              </div>
            )}
            {wStatus.daysLeft < 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">Warranty has expired. This asset is no longer under warranty coverage.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Timeline Tab ── */}
        {activeTab === 'timeline' && (
          <div className="space-y-1">
            {loadingMaint ? (
              <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : timelineEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No timeline events yet</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {timelineEvents.map((ev, i) => {
                    const Icon = ev.icon
                    return (
                      <div key={i} className="flex items-start gap-4 relative">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white"
                          style={{ background: ev.color + '20' }}>
                          <Icon className="w-4 h-4" style={{ color: ev.color }} />
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-sm font-semibold">{ev.label}</p>
                          {ev.sub && <p className="text-xs text-muted-foreground mt-0.5">{ev.sub}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(ev.date).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}