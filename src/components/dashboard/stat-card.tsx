import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: number
  icon: LucideIcon
  change?: number
  changeLabel?: string
  color?: 'default' | 'success' | 'destructive' | 'warning' | 'accent'
  prefix?: string
  suffix?: string
  isCurrency?: boolean
}

const colorMap = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  accent: 'bg-accent/10 text-accent',
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  color = 'default',
  prefix,
  suffix,
  isCurrency = true,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            isPositive && 'bg-success/10 text-success',
            isNegative && 'bg-destructive/10 text-destructive',
            !isPositive && !isNegative && 'bg-muted text-muted-foreground',
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="font-display text-2xl font-bold tabular-nums">
          {isCurrency
            ? formatCurrency(value)
            : `${prefix || ''}${value.toLocaleString()}${suffix || ''}`}
        </p>
        {changeLabel && (
          <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
        )}
      </div>
    </div>
  )
}
