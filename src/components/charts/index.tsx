'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { CATEGORY_COLORS, formatCurrency } from '@/lib/utils'
import type { MonthlyTrend, CategorySpending } from '@/types'

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card rounded-xl p-3 shadow-lg text-sm">
      {label && <p className="font-medium mb-2">{label}</p>}
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface TrendChartProps {
  data: MonthlyTrend[]
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(4 84% 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(4 84% 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="income" stroke="hsl(142 76% 36%)" strokeWidth={2} fill="url(#incomeGrad)" name="Income" dot={false} />
        <Area type="monotone" dataKey="expenses" stroke="hsl(4 84% 60%)" strokeWidth={2} fill="url(#expenseGrad)" name="Expenses" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface SavingsChartProps {
  data: MonthlyTrend[]
}

export function SavingsChart({ data }: SavingsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₵${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="savings" name="Savings" fill="hsl(252 87% 60%)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

interface SpendingPieProps {
  data: CategorySpending[]
}

export function SpendingPieChart({ data }: SpendingPieProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="amount"
          nameKey="category"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color || CATEGORY_COLORS[entry.category] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
