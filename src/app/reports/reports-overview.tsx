'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO } from 'date-fns'
import { FileText, FileSpreadsheet, Download, BarChart3, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency, CATEGORY_COLORS } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes:  any[]
  expenses: any[]
  accounts: any[]
}

type ReportPeriod = 'monthly' | 'quarterly' | 'annual'

const APP_NAME = 'Think-Shika PA'

const exportFmt = (n: number, cur = 'GHS') =>
  `${cur} ` + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

export function ReportsOverview({ incomes, expenses, accounts }: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [period,        setPeriod]        = useState<ReportPeriod>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  // ── Resolve account currency for a transaction ──────────────────
  const getTxCurrency = (r: any): string =>
    accounts.find(a => a.id === r.account_id)?.currency || primaryCurrency

  // ── Period bounds ───────────────────────────────────────────────
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

  const filteredIncomes = useMemo(() =>
    incomes.filter(i => i.date >= dateRange.start && i.date <= dateRange.end),
    [incomes, dateRange])

  const filteredExpenses = useMemo(() =>
    expenses.filter(e => e.date >= dateRange.start && e.date <= dateRange.end),
    [expenses, dateRange])

  // ── Totals by currency ──────────────────────────────────────────
  const incomeByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => {
      const cur = getTxCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, primaryCurrency])

  const expenseByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(r => {
      const cur = getTxCurrency(r)
      map[cur] = (map[cur] || 0) + Number(r.amount)
    })
    return map
  }, [filteredExpenses, accounts, primaryCurrency])

  const incomeCurrencies  = Object.keys(incomeByCurrency).sort(c => c === primaryCurrency ? -1 : 1)
  const expenseCurrencies = Object.keys(expenseByCurrency).sort(c => c === primaryCurrency ? -1 : 1)
  const hasMixedCurrency  = incomeCurrencies.length > 1 || expenseCurrencies.length > 1

  // Primary-currency totals for Net/Savings
  const totalIncome   = incomeByCurrency[primaryCurrency]  ?? Object.values(incomeByCurrency)[0]  ?? 0
  const totalExpenses = expenseByCurrency[primaryCurrency] ?? Object.values(expenseByCurrency)[0] ?? 0
  const netSavings    = totalIncome - totalExpenses
  const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  // ── Category breakdowns ─────────────────────────────────────────
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(i => {
      const cat = i.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(i.amount)
    })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredIncomes])

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Other'
      map[cat] = (map[cat] || 0) + Number(e.amount)
    })
    return Object.entries(map).sort(([, a], [, b]) => b - a)
  }, [filteredExpenses])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  }), [])

  const slug = dateRange.label.replace(/\s/g, '-').toLowerCase()

  // ── CSV Export ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      [`${APP_NAME} Financial Report`],
      [`Period: ${dateRange.label}`],
      [`Generated: ${format(new Date(), 'PPP')}`],
      [],
      ['SUMMARY', ''],
      ...incomeCurrencies.map(cur  => [`Total Income (${cur})`,   exportFmt(incomeByCurrency[cur],  cur)]),
      ...expenseCurrencies.map(cur => [`Total Expenses (${cur})`, exportFmt(expenseByCurrency[cur], cur)]),
      [`Net Savings (${primaryCurrency})`, exportFmt(netSavings, primaryCurrency)],
      ['Savings Rate', `${savingsRate.toFixed(1)}%`],
      [],
      ['INCOME BY CATEGORY', ''],
      ['Category', 'Amount', '% of Total'],
      ...incomeByCategory.map(([cat, amt]) => [
        cat,
        amt.toFixed(2),
        `${totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : 0}%`,
      ]),
      [],
      ['EXPENSES BY CATEGORY', ''],
      ['Category', 'Amount', '% of Total'],
      ...expenseByCategory.map(([cat, amt]) => [
        cat,
        amt.toFixed(2),
        `${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0}%`,
      ]),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `think-shika-pa-report-${slug}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV report exported', variant: 'success' })
  }

  // ── Excel Export ────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()

      const summaryData = [
        [`${APP_NAME} Financial Report`],
        [`Period: ${dateRange.label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['Metric', 'Currency', 'Amount'],
        ...incomeCurrencies.map(cur  => [`Total Income`,   cur, incomeByCurrency[cur]]),
        ...expenseCurrencies.map(cur => [`Total Expenses`, cur, expenseByCurrency[cur]]),
        [`Net Savings`,  primaryCurrency, netSavings],
        ['Savings Rate', '', `${savingsRate.toFixed(1)}%`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')

      const incomeData = [
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Notes'],
        ...filteredIncomes.map(i => [
          i.title || i.description || '',
          i.category,
          i.amount,
          getTxCurrency(i),
          i.date,
          i.notes || '',
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), 'Income')

      const expData = [
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Payment Method', 'Notes'],
        ...filteredExpenses.map(e => [
          e.title || e.description || '',
          e.category,
          e.amount,
          getTxCurrency(e),
          e.date,
          e.payment_method || '',
          e.notes || '',
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expData), 'Expenses')

      XLSX.writeFile(wb, `think-shika-pa-report-${slug}.xlsx`)
      toast({ title: 'Excel report exported', variant: 'success' })
    } catch {
      toast({ title: 'Excel export failed', variant: 'destructive' })
    }
  }

  // ── PDF Export ──────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { default: jsPDF }     = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      doc.setFontSize(18); doc.setTextColor(0, 75, 35)
      doc.text(`${APP_NAME} — Financial Report`, 14, 20)
      doc.setFontSize(11); doc.setTextColor(80, 80, 80)
      doc.text(`Period: ${dateRange.label}`, 14, 30)
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 37)

      doc.setFontSize(13); doc.setTextColor(0, 75, 35)
      doc.text('Summary', 14, 50)
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Currency', 'Amount']],
        body: [
          ...incomeCurrencies.map(cur  => [`Total Income`,   cur, exportFmt(incomeByCurrency[cur],  cur)]),
          ...expenseCurrencies.map(cur => [`Total Expenses`, cur, exportFmt(expenseByCurrency[cur], cur)]),
          [`Net Savings`,  primaryCurrency, exportFmt(netSavings, primaryCurrency)],
          ['Savings Rate', '', `${savingsRate.toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles:   { fillColor: [0, 75, 35] },
        columnStyles: { 2: { halign: 'right' } },
      })

      const y1 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(0, 75, 35)
      doc.text('Income by Category', 14, y1)
      autoTable(doc, {
        startY: y1 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: incomeByCategory.map(([cat, amt]) => [
          cat,
          exportFmt(amt, primaryCurrency),
          `${totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : 0}%`,
        ]),
        theme: 'striped',
        headStyles:   { fillColor: [22, 163, 74] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })

      const y2 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(0, 75, 35)
      doc.text('Expenses by Category', 14, y2)
      autoTable(doc, {
        startY: y2 + 5,
        head: [['Category', 'Amount', '% of Total']],
        body: expenseByCategory.map(([cat, amt]) => [
          cat,
          exportFmt(amt, primaryCurrency),
          `${totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : 0}%`,
        ]),
        theme: 'striped',
        headStyles:   { fillColor: [220, 38, 38] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(9); doc.setTextColor(150, 150, 150)
        doc.text(
          `${APP_NAME} — Confidential | Page ${i} of ${pageCount}`,
          14, doc.internal.pageSize.height - 10
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

      {/* ── Period selector + Export buttons — single card row ── */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3 flex-wrap">

            {/* Period toggles */}
            <div className="flex gap-2">
              {(['monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={
                    period === p
                      ? { background: theme.colors.primary, color: '#fff' }
                      : { background: '#f1f5f9', color: '#64748b' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Month selector */}
            {period === 'monthly' && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Period label */}
            <span className="text-sm font-semibold ml-auto" style={{ color: theme.colors.primary }}>
              {dateRange.label}
            </span>

            {/* Export buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleExportCSV}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                <Download className="w-3.5 h-3.5" />CSV
              </button>
              <button onClick={handleExportExcel}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-border bg-white text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" />Excel
              </button>
              <button onClick={handleExportPDF}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: theme.colors.primary }}>
                <FileText className="w-3.5 h-3.5" />PDF
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">

        {/* Income — one card per currency */}
        {incomeCurrencies.length === 0 ? (
          <Card className="kpi-green bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Income</p>
            </div>
            <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums">—</p>
          </Card>
        ) : incomeCurrencies.map(cur => (
          <Card key={`inc-${cur}`} className="kpi-green bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
                Total Income{incomeCurrencies.length > 1 ? ` (${cur})` : ''}
              </p>
            </div>
            <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums break-all">
              {formatCurrency(incomeByCurrency[cur], cur)}
            </p>
          </Card>
        ))}

        {/* Expenses — one card per currency */}
        {expenseCurrencies.length === 0 ? (
          <Card className="kpi-red bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Expenses</p>
            </div>
            <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums">—</p>
          </Card>
        ) : expenseCurrencies.map(cur => (
          <Card key={`exp-${cur}`} className="kpi-red bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-2 min-w-0">
              <TrendingDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
                Total Expenses{expenseCurrencies.length > 1 ? ` (${cur})` : ''}
              </p>
            </div>
            <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums break-all">
              {formatCurrency(expenseByCurrency[cur], cur)}
            </p>
          </Card>
        ))}

        {/* Net Savings */}
        <Card className={`bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border ${netSavings >= 0 ? 'kpi-blue' : 'kpi-red'}`}>
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <PiggyBank className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
              Net {netSavings >= 0 ? 'Savings' : 'Deficit'}
            </p>
          </div>
          <p className={`kpi-value font-display text-sm sm:text-xl font-bold tabular-nums break-all ${netSavings < 0 ? 'text-red-500' : ''}`}>
            {formatCurrency(Math.abs(netSavings), primaryCurrency)}
          </p>
          {hasMixedCurrency && (
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{primaryCurrency} only</p>
          )}
        </Card>

        {/* Savings Rate */}
        <Card className="kpi-purple bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Savings Rate</p>
          </div>
          <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums">
            {savingsRate.toFixed(1)}%
          </p>
          {hasMixedCurrency && (
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{primaryCurrency} only</p>
          )}
        </Card>
      </div>

      {/* ── Category Breakdowns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Card className="bg-white rounded-xl shadow-sm">
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
                    style={{ background: (CATEGORY_COLORS as Record<string, string>)[cat] || '#94a3b8' }} />
                  <span className="text-sm truncate">{cat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(0) : 0}%
                  </span>
                  <span className="font-semibold text-sm tabular-nums text-green-600">
                    {formatCurrency(amt, primaryCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white rounded-xl shadow-sm">
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
                    style={{ background: (CATEGORY_COLORS as Record<string, string>)[cat] || '#94a3b8' }} />
                  <span className="text-sm truncate">{cat}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(0) : 0}%
                  </span>
                  <span className="font-semibold text-sm tabular-nums text-red-500">
                    {formatCurrency(amt, primaryCurrency)}
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
