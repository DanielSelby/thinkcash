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

const pdfFmt = (n: number) =>
  'GHS ' + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

const APP_NAME = 'Think-Shika PA'

export function ReportsOverview({ incomes, expenses }: Props) {
  const [period, setPeriod]               = useState<ReportPeriod>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  const dateRange = useMemo(() => {
    const now = new Date()
    if (period === 'monthly') {
      const d = parseISO(`${selectedMonth}-01`)
      return {
        start: format(startOfMonth(d), 'yyyy-MM-dd'),
        end:   format(endOfMonth(d),   'yyyy-MM-dd'),
        label: format(d, 'MMMM yyyy'),
      }
    }
    if (period === 'quarterly') {
      return {
        start: format(startOfQuarter(now), 'yyyy-MM-dd'),
        end:   format(endOfQuarter(now),   'yyyy-MM-dd'),
        label: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`,
      }
    }
    return {
      start: format(startOfYear(now), 'yyyy-MM-dd'),
      end:   format(endOfYear(now),   'yyyy-MM-dd'),
      label: `Year ${now.getFullYear()}`,
    }
  }, [period, selectedMonth])

  const filteredIncomes  = useMemo(() =>
    incomes.filter(i  => i.date >= dateRange.start && i.date <= dateRange.end),
    [incomes, dateRange])
  const filteredExpenses = useMemo(() =>
    expenses.filter(e => e.date >= dateRange.start && e.date <= dateRange.end),
    [expenses, dateRange])

  const totalIncome   = filteredIncomes.reduce((s, i)  => s + Number(i.amount), 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const netSavings    = totalIncome - totalExpenses
  const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(i => { map[i.category] = (map[i.category] || 0) + Number(i.amount) })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredIncomes])

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount) })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredExpenses])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  }), [])

  const slug = dateRange.label.replace(/\s/g, '-').toLowerCase()

  // ── CSV Export ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      [`${APP_NAME} Financial Report`],
      [`Period: ${dateRange.label}`],
      [`Generated: ${format(new Date(), 'PPP')}`],
      [],
      ['SUMMARY', ''],
      ['Total Income',   pdfFmt(totalIncome)],
      ['Total Expenses', pdfFmt(totalExpenses)],
      ['Net Savings',    pdfFmt(netSavings)],
      ['Savings Rate',   `${savingsRate.toFixed(1)}%`],
      [],
      ['INCOME BY CATEGORY', ''],
      ['Category', 'Amount', '% of Total'],
      ...incomeByCategory.map(([cat, amt]) => [
        cat,
        pdfFmt(amt),
        `${totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : 0}%`,
      ]),
      [],
      ['EXPENSES BY CATEGORY', ''],
      ['Category', 'Amount', '% of Total'],
      ...expenseByCategory.map(([cat, amt]) => [
        cat,
        pdfFmt(amt),
        `${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0}%`,
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `think-shika-pa-report-${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV report exported', variant: 'success' })
  }

  // ── Excel Export ─────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()

      const summaryData = [
        [`${APP_NAME} Financial Report`],
        [`Period: ${dateRange.label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['Metric', 'Amount'],
        ['Total Income',   totalIncome],
        ['Total Expenses', totalExpenses],
        ['Net Savings',    netSavings],
        ['Savings Rate',   `${savingsRate.toFixed(1)}%`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')

      const incomeData = [
        ['Title', 'Category', 'Amount (GHS)', 'Date', 'Notes'],
        ...filteredIncomes.map(i => [i.title, i.category, i.amount, i.date, i.notes || '']),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), 'Income')

      const expData = [
        ['Title', 'Category', 'Amount (GHS)', 'Date', 'Payment Method', 'Notes'],
        ...filteredExpenses.map(e => [e.title, e.category, e.amount, e.date, e.payment_method, e.notes || '']),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), 'Expenses')

      XLSX.writeFile(wb, `think-shika-pa-report-${slug}.xlsx`)
      toast({ title: 'Excel report exported', variant: 'success' })
    } catch {
      toast({ title: 'Excel export failed', variant: 'destructive' })
    }
  }

  // ── PDF Export ────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { default: jsPDF }     = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()

      doc.setFontSize(18)
      doc.setTextColor(0, 75, 35)
      doc.text(`${APP_NAME} — Financial Report`, 14, 20)

      doc.setFontSize(11)
      doc.setTextColor(80, 80, 80)
      doc.text(`Period: ${dateRange.label}`, 14, 30)
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 37)

      doc.setFontSize(13)
      doc.setTextColor(0, 75, 35)
      doc.text('Summary', 14, 50)
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Amount']],
        body: [
          ['Total Income',   pdfFmt(totalIncome)],
          ['Total Expenses', pdfFmt(totalExpenses)],
          ['Net Savings',    pdfFmt(netSavings)],
          ['Savings Rate',   `${savingsRate.toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles:   { fillColor: [0, 75, 35] },
        columnStyles: { 1: { halign: 'right' } },
      })

      const y1 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13)
      doc.setTextColor(0, 75, 35)
      doc.text('Income by Category', 14, y1)
      autoTable(doc, {
        startY: y1 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: incomeByCategory.map(([cat, amt]) => [
          cat,
          pdfFmt(amt),
          `${totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : 0}%`,
        ]),
        theme: 'striped',
        headStyles:   { fillColor: [22, 163, 74] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })

      const y2 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13)
      doc.setTextColor(0, 75, 35)
      doc.text('Expenses by Category', 14, y2)
      autoTable(doc, {
        startY: y2 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: expenseByCategory.map(([cat, amt]) => [
          cat,
          pdfFmt(amt),
          `${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0}%`,
        ]),
        theme: 'striped',
        headStyles:   { fillColor: [220, 38, 38] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `${APP_NAME} — Confidential | Page ${i} of ${pageCount}`,
          14,
          doc.internal.pageSize.height - 10
        )
      }

      doc.save(`think-shika-pa-report-${slug}.pdf`)
      toast({ title: 'PDF report exported', variant: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">

      {/* Period selector + Export buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Card className="bg-white p-4 flex-1">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              {(['monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    period === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {period === 'monthly' && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-sm font-semibold text-primary ml-auto">{dateRange.label}</span>
          </div>
        </Card>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1" />Excel
          </Button>
          <Button size="sm" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-1" />PDF
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Income',   value: totalIncome,   icon: TrendingUp,   colorClass: 'kpi-green',  custom: null },
          { label: 'Total Expenses', value: totalExpenses, icon: TrendingDown, colorClass: 'kpi-red',    custom: null },
          { label: 'Net Savings',    value: netSavings,    icon: PiggyBank,    colorClass: 'kpi-blue',   custom: null },
          { label: 'Savings Rate',   value: 0,             icon: BarChart3,    colorClass: 'kpi-purple', custom: `${savingsRate.toFixed(1)}%` },
        ].map(({ label, value, icon: Icon, colorClass, custom }) => (
          <Card key={label} className={`${colorClass} bg-white p-3 sm:p-5 overflow-hidden`}>
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">{label}</p>
            </div>
            <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums truncate">
              {custom || formatCurrency(value)}
            </p>
          </Card>
        ))}
      </div>

      {/* Category breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />Income by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomeByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No income for this period</p>
            ) : incomeByCategory.map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                  <span className="text-sm truncate">{cat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(0) : 0}%
                  </span>
                  <span className="font-semibold text-sm tabular-nums text-green-600">
                    {formatCurrency(amt)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenseByCategory.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No expenses for this period</p>
            ) : expenseByCategory.map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: CATEGORY_COLORS[cat] || '#94a3b8' }} />
                  <span className="text-sm truncate">{cat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(0) : 0}%
                  </span>
                  <span className="font-semibold text-sm tabular-nums text-red-500">
                    {formatCurrency(amt)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
