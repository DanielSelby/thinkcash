'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns'
import { FileText, FileSpreadsheet, Download, BarChart3, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_COLORS } from '@/lib/utils'
import type { Income, Expense } from '@/types'

interface Props { incomes: Income[]; expenses: Expense[] }

type ReportPeriod = 'monthly' | 'quarterly' | 'annual'

export function ReportsContent({ incomes, expenses }: Props) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  const dateRange = useMemo(() => {
    const now = new Date()
    if (period === 'monthly') {
      const d = parseISO(`${selectedMonth}-01`)
      return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMMM yyyy') }
    }
    if (period === 'quarterly') {
      return { start: format(startOfQuarter(now), 'yyyy-MM-dd'), end: format(endOfQuarter(now), 'yyyy-MM-dd'), label: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}` }
    }
    return { start: format(startOfYear(now), 'yyyy-MM-dd'), end: format(endOfYear(now), 'yyyy-MM-dd'), label: `Year ${now.getFullYear()}` }
  }, [period, selectedMonth])

  const filteredIncomes = useMemo(() => incomes.filter(i => i.date >= dateRange.start && i.date <= dateRange.end), [incomes, dateRange])
  const filteredExpenses = useMemo(() => expenses.filter(e => e.date >= dateRange.start && e.date <= dateRange.end), [expenses, dateRange])

  const totalIncome = filteredIncomes.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const netSavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(i => { map[i.category] = (map[i.category] || 0) + i.amount })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredIncomes])

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredExpenses])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  }), [])

  const handleExportCSV = () => {
    const rows = [
      [`Think-Shika PA — ${dateRange.label} Report`],
      [],
      ['INCOME SUMMARY'],
      ['Category', 'Amount'],
      ...incomeByCategory.map(([cat, amt]) => [cat, amt.toFixed(2)]),
      ['TOTAL INCOME', totalIncome.toFixed(2)],
      [],
      ['EXPENSE SUMMARY'],
      ['Category', 'Amount'],
      ...expenseByCategory.map(([cat, amt]) => [cat, amt.toFixed(2)]),
      ['TOTAL EXPENSES', totalExpenses.toFixed(2)],
      [],
      ['NET SAVINGS', netSavings.toFixed(2)],
      ['SAVINGS RATE', `${savingsRate.toFixed(1)}%`],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Think-Shika PA-report-${dateRange.label.replace(/\s/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV report exported', variant: 'success' })
  }

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['Think-Shika PA Financial Report'],
        [`Period: ${dateRange.label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['SUMMARY', ''],
        ['Total Income', totalIncome],
        ['Total Expenses', totalExpenses],
        ['Net Savings', netSavings],
        ['Savings Rate', `${savingsRate.toFixed(1)}%`],
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(wb, ws1, 'Summary')

      // Income sheet
      const incomeData = [['Title', 'Category', 'Amount', 'Date', 'Notes'], ...filteredIncomes.map(i => [i.title, i.category, i.amount, i.date, i.notes || ''])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), 'Income')

      // Expenses sheet
      const expData = [['Title', 'Category', 'Amount', 'Date', 'Payment Method', 'Notes'], ...filteredExpenses.map(e => [e.title, e.category, e.amount, e.date, e.payment_method, e.notes || ''])]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), 'Expenses')

      XLSX.writeFile(wb, `Think-Shika PA-report-${dateRange.label.replace(/\s/g, '-').toLowerCase()}.xlsx`)
      toast({ title: 'Excel report exported', variant: 'success' })
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' })
    }
  }

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('Think-Shika PA — Financial Report', 14, 20)
      doc.setFontSize(12)
      doc.text(`Period: ${dateRange.label}`, 14, 30)
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 37)

      doc.setFontSize(14)
      doc.text('Summary', 14, 50)
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Amount']],
        body: [
          ['Total Income', formatCurrency(totalIncome)],
          ['Total Expenses', formatCurrency(totalExpenses)],
          ['Net Savings', formatCurrency(netSavings)],
          ['Savings Rate', `${savingsRate.toFixed(1)}%`],
        ],
        theme: 'striped',
      })

      const y1 = (doc as any).lastAutoTable.finalY + 15
      doc.text('Income by Category', 14, y1)
      autoTable(doc, {
        startY: y1 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: incomeByCategory.map(([cat, amt]) => [cat, formatCurrency(amt), `${totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : 0}%`]),
        theme: 'striped',
      })

      const y2 = (doc as any).lastAutoTable.finalY + 15
      doc.text('Expenses by Category', 14, y2)
      autoTable(doc, {
        startY: y2 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: expenseByCategory.map(([cat, amt]) => [cat, formatCurrency(amt), `${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0}%`]),
        theme: 'striped',
      })

      doc.save(`Think-Shika PA-report-${dateRange.label.replace(/\s/g, '-').toLowerCase()}.pdf`)
      toast({ title: 'PDF report exported', variant: 'success' })
    } catch {
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground text-sm">Generate and export financial summaries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="w-4 h-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="w-4 h-4" />Excel</Button>
          <Button size="sm" onClick={handleExportPDF}><FileText className="w-4 h-4" />PDF</Button>
        </div>
      </div>

      {/* Period selector */}
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {(['monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${period === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                {p}
              </button>
            ))}
          </div>
          {period === 'monthly' && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <span className="text-sm font-semibold text-primary ml-auto">{dateRange.label}</span>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: totalIncome, icon: TrendingUp, color: 'text-success' },
          { label: 'Total Expenses', value: totalExpenses, icon: TrendingDown, color: 'text-destructive' },
          { label: 'Net Savings', value: netSavings, icon: PiggyBank, color: netSavings >= 0 ? 'text-success' : 'text-destructive' },
          { label: 'Savings Rate', value: null, icon: BarChart3, color: savingsRate >= 20 ? 'text-success' : 'text-warning', custom: `${savingsRate.toFixed(1)}%` },
        ].map(({ label, value, icon: Icon, color, custom }) => (
          <Card key={label} className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-sm text-muted-foreground">{label}</p>
            </div>
            <p className={`font-display text-xl font-bold tabular-nums ${color}`}>
              {custom || formatCurrency(value!)}
            </p>
          </Card>
        ))}
      </div>

      {/* Category breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-success" />Income by Category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {incomeByCategory.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No income data for this period</p> :
              incomeByCategory.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                    <span className="text-sm capitalize">{INCOME_CATEGORIES.find(c => c.value === cat)?.label || cat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(0) : 0}%</span>
                    <span className="font-semibold text-sm tabular-nums text-success">{formatCurrency(amt)}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" />Expenses by Category</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">No expense data for this period</p> :
              expenseByCategory.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                    <span className="text-sm capitalize">{EXPENSE_CATEGORIES.find(c => c.value === cat)?.label || cat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(0) : 0}%</span>
                    <span className="font-semibold text-sm tabular-nums text-destructive">{formatCurrency(amt)}</span>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
