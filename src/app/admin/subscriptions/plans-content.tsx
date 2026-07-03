'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, Loader2, ToggleLeft, ToggleRight, BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/subscription'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

const schema = z.object({
  name:         z.string().min(1, 'Plan name required'),
  description:  z.string().optional(),
  billing_cycle:z.string().min(1, 'Billing cycle required'),
  custom_days:  z.coerce.number().optional(),
  amount:       z.coerce.number().min(0),
  currency:     z.string().default('GHS'),
  grace_period: z.coerce.number().min(0).default(0),
  status:       z.string().default('active'),
})
type FormData = z.infer<typeof schema>

const CYCLES = Object.entries(BILLING_CYCLE_LABELS).map(([v, l]) => ({ value: v, label: l }))
const CURRENCIES = ['GHS','USD','EUR','GBP','NGN','KES','AED']

export function PlansContent({ initialPlans }: { initialPlans: any[] }) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']
  const [plans,   setPlans]   = useState(initialPlans)
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'GHS', grace_period: 0, status: 'active' },
  })

  const openCreate = () => { setEditing(null); reset({ currency: 'GHS', grace_period: 0, status: 'active', billing_cycle: 'monthly' }); setOpen(true) }
  const openEdit   = (p: any) => { setEditing(p); reset(p); setOpen(true) }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    if (editing) {
      const { data: updated, error } = await supabase.from('subscription_plans')
        .update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else { setPlans(p => p.map(x => x.id === editing.id ? updated : x)); toast({ title: 'Plan updated', variant: 'success' }); setOpen(false) }
    } else {
      const { data: created, error } = await supabase.from('subscription_plans').insert(data).select().single()
      if (error) toast({ title: 'Create failed', description: error.message, variant: 'destructive' })
      else { setPlans(p => [created, ...p]); toast({ title: 'Plan created', variant: 'success' }); setOpen(false) }
    }
    setLoading(false)
  }

  const toggleStatus = async (plan: any) => {
    const supabase = createClient()
    const newStatus = plan.status === 'active' ? 'inactive' : 'active'
    const { data: updated, error } = await supabase.from('subscription_plans').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', plan.id).select().single()
    if (error) toast({ title: 'Failed', description: error.message, variant: 'destructive' })
    else { setPlans(p => p.map(x => x.id === plan.id ? updated : x)); toast({ title: `Plan ${newStatus}`, variant: 'success' }) }
  }

  const deletePlan = async (id: string) => {
    if (!confirm('Delete this plan? Users on this plan will be unaffected but the plan cannot be reassigned.')) return
    const supabase = createClient()
    const { error } = await supabase.from('subscription_plans').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setPlans(p => p.filter(x => x.id !== id)); toast({ title: 'Plan deleted' }) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>Subscription Plans</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{plans.length} plan(s) configured</p>
        </div>
        <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>
          <Plus className="w-4 h-4 mr-1" /> New Plan
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card className="bg-white p-12 text-center rounded-xl">
          <BadgeCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
          <h3 className="font-semibold text-lg mb-1">No plans yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Create your first subscription plan to start assigning to users.</p>
          <Button onClick={openCreate} style={{ background: theme.colors.primary, color: '#fff' }}>Create Plan</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="h-1.5" style={{ background: plan.status === 'active' ? theme.colors.primary : '#94a3b8' }} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{plan.name}</p>
                    {plan.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plan.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-bold text-sm">{plan.currency} {Number(plan.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Billing Cycle</p>
                    <p className="font-medium">{BILLING_CYCLE_LABELS[plan.billing_cycle as BillingCycle]}{plan.billing_cycle === 'custom' ? ` (${plan.custom_days}d)` : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Grace Period</p>
                    <p className="font-medium">{plan.grace_period} day(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(plan)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toggleStatus(plan)}>
                    {plan.status === 'active' ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                    {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive ml-auto" onClick={() => deletePlan(plan.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Plan' : 'Create Plan'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5"><Label>Plan Name *</Label><Input placeholder="e.g. Basic, Pro, Premium" {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
            <div className="space-y-1.5"><Label>Description</Label><Input placeholder="Brief description…" {...register('description')} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Billing Cycle *</Label>
                <Select onValueChange={v => setValue('billing_cycle', v, { shouldValidate: true })} defaultValue={editing?.billing_cycle || 'monthly'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {watch('billing_cycle') === 'custom' && (
                <div className="space-y-1.5"><Label>Custom Days</Label><Input type="number" placeholder="30" {...register('custom_days')} /></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" placeholder="0.00" {...register('amount')} /></div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select onValueChange={v => setValue('currency', v)} defaultValue={editing?.currency || 'GHS'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Grace Period (Days)</Label><Input type="number" placeholder="0" {...register('grace_period')} /><p className="text-xs text-muted-foreground">Days after expiry the user still retains access.</p></div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: theme.colors.primary, color: '#fff' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Plan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}