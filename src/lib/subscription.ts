export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'custom'
export type SubStatus = 'active' | 'expiring_soon' | 'expired' | 'suspended' | 'cancelled'

export function calcEndDate(startDate: string, cycle: BillingCycle, customDays?: number | null): string {
  const d = new Date(startDate)
  switch (cycle) {
    case 'weekly':      d.setDate(d.getDate() + 7);          break
    case 'monthly':     d.setMonth(d.getMonth() + 1);        break
    case 'quarterly':   d.setMonth(d.getMonth() + 3);        break
    case 'semi_annual': d.setMonth(d.getMonth() + 6);        break
    case 'annual':      d.setFullYear(d.getFullYear() + 1);  break
    case 'custom':      d.setDate(d.getDate() + (customDays ?? 30)); break
  }
  return d.toISOString().split('T')[0]
}

export function daysRemaining(endDate: string): number {
  const now  = new Date(); now.setHours(0,0,0,0)
  const end  = new Date(endDate); end.setHours(0,0,0,0)
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function computeStatus(endDate: string, gracePeriod = 0, manualStatus?: string): SubStatus {
  if (manualStatus === 'cancelled' || manualStatus === 'suspended') return manualStatus
  const days = daysRemaining(endDate)
  if (days < -gracePeriod) return 'expired'
  if (days <= 0)  return gracePeriod > 0 ? 'active' : 'expired'
  if (days <= 7)  return 'expiring_soon'
  return 'active'
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly:      'Weekly',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  semi_annual: 'Semi-Annual',
  annual:      'Annual',
  custom:      'Custom',
}

export const STATUS_COLORS: Record<SubStatus, { bg: string; text: string; border: string }> = {
  active:         { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  expiring_soon:  { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
  expired:        { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  suspended:      { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  cancelled:      { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}