'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, PiggyBank, Target, Loader2, TrendingUp } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/misc'
import { Badge } from '@/components/ui/misc'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, formatDate } from '@/lib/utils'
import { notify } from '@/lib/notify'
import type { SavingsGoal } from '@/types'

const schema = z.object({
  goal_name: z.string().min(1, 'Goal name is required'),
  target_amount: z.coerce.number().positive('Target must be positive'),
  current_amount: z.coerce.number().min(0, 'Cannot be negative'),
  target_date: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

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

interface Props {
  initialGoals: SavingsGoal[]
  userId: string
}

export function SavingsContent({ initialGoals, userId }: Props) {
  const [goals, setGoals] = useState(initialGoals)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const totalSaved = useMemo(() => goals.reduce((s, g) => s + g.current_amount, 0), [goals])
  const totalTarget = useMemo(() => goals.reduce((s, g) => s + g.target_amount, 0), [goals])
  const completed = useMemo(() => goals.filter(g => g.current_amount >= g.target_amount).length, [goals])

  const openCreate = () => { setEditing(null); reset({ current_amount: 0 }); setOpen(true) }
  const openEdit = (g: SavingsGoal) => {
    setEditing(g)
    reset({ goal_name: g.goal_name, target_amount: g.target_amount, current_amount: g.current_amount, target_date: g.target_date || '', notes: g.notes || '' })
    setOpen(true)
  }

  // Fires a "goal reached" notification once the saved goal's current_amount
  // meets or exceeds its target. Deduped for 30 days so repeat edits to an
  // already-completed goal (e.g. updating notes) don't re-spam the alert.
  const checkGoalNotification = async (savedGoal: SavingsGoal) => {
    if (savedGoal.target_amount > 0 && savedGoal.current_amount >= savedGoal.target_amount) {
      await notify({
        userId,
        type: 'goal',
        title: `Goal reached: ${savedGoal.goal_name}`,
        message: `Congratulations! You've reached your savings goal of ${formatCurrency(savedGoal.target_amount)} for "${savedGoal.goal_name}".`,
        dedupeWindowHours: 24 * 30,
      })
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    const supabase = createClient()
    const payload = { ...data, target_date: data.target_date || null, notes: data.notes || null }
    if (editing) {
      const { data: updated, error } = await supabase.from('savings_goals').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id).select().single()
      if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' })
      else {
        setGoals(prev => prev.map(g => g.id === editing.id ? updated : g))
        toast({ title: 'Goal updated', variant: 'success' })
        setOpen(false)
        checkGoalNotification(updated)
      }
    } else {
      const { data: created, error } = await supabase.from('savings_goals').insert({ ...payload, user_id: userId }).select().single()
      if (error) toast({ title: 'Failed to create', description: error.message, variant: 'destructive' })
      else {
        setGoals(prev => [created, ...prev])
        toast({ title: 'Goal created!', variant: 'success' })
        setOpen(false)
        checkGoalNotification(created)
      }
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal?')) return
    const supabase = createClient()
    const { error } = await supabase.from('savings_goals').delete().eq('id', id)
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
    else { setGoals(prev => prev.filter(g => g.id !== id)); toast({ title: 'Goal deleted' }) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground text-sm">Track progress toward your financial targets</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Goal</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Saved</p><p className="font-display text-xl font-bold text-success tabular-nums mt-1">{formatCurrency(totalSaved)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total Target</p><p className="font-display text-xl font-bold tabular-nums mt-1">{formatCurrency(totalTarget)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Overall Progress</p><p className="font-display text-xl font-bold tabular-nums mt-1">{totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(0) : 0}%</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Completed</p><p className="font-display text-xl font-bold text-primary tabular-nums mt-1">{completed} / {goals.length}</p></Card>
      </div>

      {/* Goals grid */}
      {goals.length === 0 ? (
        <Card className="p-12 text-center">
          <PiggyBank className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display font-semibold text-lg mb-1">No savings goals yet</h3>
          <p className="text-muted-foreground text-sm mb-4">Set goals like Emergency Fund, New Car, Vacation, or House Deposit</p>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create your first goal</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map(g => {
            const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0
            const completed = g.current_amount >= g.target_amount
            const daysLeft = g.target_date ? differenceInDays(parseISO(g.target_date), new Date()) : null

            return (
              <Card key={g.id} className={`p-5 space-y-4 ${completed ? 'border-success/40 bg-success/5' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getGoalEmoji(g.goal_name)}</span>
                    <div>
                      <p className="font-semibold">{g.goal_name}</p>
                      {g.target_date && (
                        <p className="text-xs text-muted-foreground">
                          Target: {formatDate(g.target_date)}
                          {daysLeft !== null && daysLeft > 0 && ` (${daysLeft}d left)`}
                          {daysLeft !== null && daysLeft <= 0 && ' (overdue)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(g)}><Edit2 className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(g.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className={`h-2.5 ${completed ? '[&>div]:bg-success' : ''}`} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">{formatCurrency(g.current_amount)} saved</span>
                    <span className="tabular-nums">{formatCurrency(g.target_amount)} goal</span>
                  </div>
                </div>

                {completed ? (
                  <Badge variant="success" className="w-full justify-center py-1">🎉 Goal Achieved!</Badge>
                ) : (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {formatCurrency(g.target_amount - g.current_amount)} remaining
                  </p>
                )}
                {g.notes && <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{g.notes}</p>}
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Goal' : 'Add Savings Goal'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Goal Name</Label>
              <Input placeholder="e.g. Emergency Fund, New Car, Vacation..." {...register('goal_name')} />
              {errors.goal_name && <p className="text-xs text-destructive">{errors.goal_name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Target Amount (GHS)</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('target_amount')} />
                {errors.target_amount && <p className="text-xs text-destructive">{errors.target_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Amount Saved So Far</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register('current_amount')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Target Date (optional)</Label>
              <Input type="date" {...register('target_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Why is this goal important to you?" {...register('notes')} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Save Changes' : 'Create Goal'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}