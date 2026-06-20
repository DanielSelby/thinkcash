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

// Sort currencies: primary first, rest alphabetically
function sortCurrencies(currencies: string[], primary: string): string[] {
  return [...currencies].sort((a, b) => {
    if (a === primary) return -1
    if (b === primary) return 1
    return a.localeCompare(b)
  })
}

export function ReportsOverview({ incomes, expenses, accounts }: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [period,        setPeriod]        = useState<ReportPeriod>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  // ── Resolve account currency for a transaction ──────────────────
  const getTxCurrency = (r: any): string =>
    accounts.find((a: any) => a.id === r.account_id)?.currency || primaryCurrency

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

  const incomeCurrencies  = sortCurrencies(Object.keys(incomeByCurrency),  primaryCurrency)
  const expenseCurrencies = sortCurrencies(Object.keys(expenseByCurrency), primaryCurrency)
  const hasMixedCurrency  = incomeCurrencies.length > 1 || expenseCurrencies.length > 1

  // Primary-currency totals for Net/Savings
  const totalIncomePrimary   = incomeByCurrency[primaryCurrency]  ?? 0
  const totalExpensesPrimary = expenseByCurrency[primaryCurrency] ?? 0
  const netSavings           = totalIncomePrimary - totalExpensesPrimary
  const savingsRate          = totalIncomePrimary > 0 ? (netSavings / totalIncomePrimary) * 100 : 0

  // ── Category breakdown — per currency per category ──────────────
  // Structure: { currency: { category: amount } }
  const incomeCatByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredIncomes.forEach(r => {
      const cur = getTxCurrency(r)
      const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, primaryCurrency])

  const expenseCatByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredExpenses.forEach(r => {
      const cur = getTxCurrency(r)
      const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    return map
  }, [filteredExpenses, accounts, primaryCurrency])

  // Sorted category entries per currency: [currency, [cat, amt][]][]
  const incomeCatEntries = useMemo(() =>
    incomeCurrencies.map(cur => ({
      currency: cur,
      rows: Object.entries(incomeCatByCurrency[cur] || {}).sort(([, a], [, b]) => b - a),
      total: incomeByCurrency[cur] || 0,
    })), [incomeCatByCurrency, incomeCurrencies, incomeByCurrency])

  const expenseCatEntries = useMemo(() =>
    expenseCurrencies.map(cur => ({
      currency: cur,
      rows: Object.entries(expenseCatByCurrency[cur] || {}).sort(([, a], [, b]) => b - a),
      total: expenseByCurrency[cur] || 0,
    })), [expenseCatByCurrency, expenseCurrencies, expenseByCurrency])

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  }), [])

  const slug = dateRange.label.replace(/\s/g, '-').toLowerCase()

  // ── CSV Export ──────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows: any[][] = [
      [`${APP_NAME} Financial Report`],
      [`Period: ${dateRange.label}`],
      [`Generated: ${format(new Date(), 'PPP')}`],
      [],
      ['INCOME TOTALS BY CURRENCY'],
      ['Currency', 'Amount'],
      ...incomeCurrencies.map(cur => [cur, exportFmt(incomeByCurrency[cur], cur)]),
      [],
      ['INCOME BY CATEGORY'],
      ['Currency', 'Category', 'Amount', '% of Currency Total'],
      ...incomeCatEntries.flatMap(({ currency, rows, total }) =>
        rows.map(([cat, amt]) => [
          currency, cat, exportFmt(amt, currency),
          `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`,
        ])
      ),
      [],
      ['EXPENSE TOTALS BY CURRENCY'],
      ['Currency', 'Amount'],
      ...expenseCurrencies.map(cur => [cur, exportFmt(expenseByCurrency[cur], cur)]),
      [],
      ['EXPENSES BY CATEGORY'],
      ['Currency', 'Category', 'Amount', '% of Currency Total'],
      ...expenseCatEntries.flatMap(({ currency, rows, total }) =>
        rows.map(([cat, amt]) => [
          currency, cat, exportFmt(amt, currency),
          `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`,
        ])
      ),
      [],
      [`NET SAVINGS (${primaryCurrency} only)`, exportFmt(netSavings, primaryCurrency)],
      ['SAVINGS RATE', `${savingsRate.toFixed(1)}%`],
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

      // Summary sheet
      const summaryData = [
        [`${APP_NAME} Financial Report`],
        [`Period: ${dateRange.label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['INCOME BY CURRENCY'],
        ['Currency', 'Amount'],
        ...incomeCurrencies.map(cur => [cur, incomeByCurrency[cur]]),
        [],
        ['INCOME BY CATEGORY'],
        ['Currency', 'Category', 'Amount', '%'],
        ...incomeCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [
            currency, cat, amt,
            total > 0 ? +((amt / total) * 100).toFixed(1) : 0,
          ])
        ),
        [],
        ['EXPENSE BY CURRENCY'],
        ['Currency', 'Amount'],
        ...expenseCurrencies.map(cur => [cur, expenseByCurrency[cur]]),
        [],
        ['EXPENSES BY CATEGORY'],
        ['Currency', 'Category', 'Amount', '%'],
        ...expenseCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [
            currency, cat, amt,
            total > 0 ? +((amt / total) * 100).toFixed(1) : 0,
          ])
        ),
        [],
        [`Net Savings (${primaryCurrency})`, netSavings],
        ['Savings Rate', `${savingsRate.toFixed(1)}%`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')

      // Income detail sheet
      const incomeData = [
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Notes'],
        ...filteredIncomes.map(i => [
          i.title || i.description || '',
          i.category || 'Other',
          Number(i.amount),
          getTxCurrency(i),
          i.date,
          i.notes || '',
        ]),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), 'Income')

      // Expenses detail sheet
      const expData = [
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Payment Method', 'Notes'],
        ...filteredExpenses.map(e => [
          e.title || e.description || '',
          e.category || 'Other',
          Number(e.amount),
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

      // Summary
      doc.setFontSize(13); doc.setTextColor(0, 75, 35)
      doc.text('Summary', 14, 50)
      autoTable(doc, {
        startY: 55,
        head: [['Metric', 'Currency', 'Amount']],
        body: [
          ...incomeCurrencies.map(cur  => ['Total Income',   cur, exportFmt(incomeByCurrency[cur],  cur)]),
          ...expenseCurrencies.map(cur => ['Total Expenses', cur, exportFmt(expenseByCurrency[cur], cur)]),
          [`Net Savings`,  primaryCurrency, exportFmt(netSavings, primaryCurrency)],
          ['Savings Rate', '',              `${savingsRate.toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles:   { fillColor: [0, 75, 35] },
        columnStyles: { 2: { halign: 'right' } },
      })

      // Income by category
      const y1 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(22, 163, 74)
      doc.text('Income by Category', 14, y1)
      autoTable(doc, {
        startY: y1 + 5,
        head: [['Currency', 'Category', 'Amount', '%']],
        body: incomeCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [
            currency, cat,
            exportFmt(amt, currency),
            `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`,
          ])
        ),
        theme: 'striped',
        headStyles:   { fillColor: [22, 163, 74] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      })

      // Expenses by category
      const y2 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(220, 38, 38)
      doc.text('Expenses by Category', 14, y2)
      autoTable(doc, {
        startY: y2 + 5,
        head: [['Currency', 'Category', 'Amount', '%']],
        body: expenseCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [
            currency, cat,
            exportFmt(amt, currency),
            `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`,
          ])
        ),
        theme: 'striped',
        headStyles:   { fillColor: [220, 38, 38] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFontSize(9); doc.setTextColor(150, 150, 150)
        doc.text(`${APP_NAME} — Confidential | Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10)
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
            <div className="flex gap-2">
              {(['monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={period === p
                    ? { background: theme.colors.primary, color: '#fff' }
                    : { background: '#f1f5f9', color: '#64748b' }}>
                  {p}
                </button>
              ))}
            </div>

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

            <span className="text-sm font-semibold ml-auto" style={{ color: theme.colors.primary }}>
              {dateRange.label}
            </span>

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

      {/* ── KPI Cards — one per currency for income/expenses ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">

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

      {/* ── Category Breakdowns — grouped per currency ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Income by Category */}
        <Card className="bg-white rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />Income by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {incomeCatEntries.length === 0 || incomeCatEntries.every(e => e.rows.length === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-4">No income for this period</p>
            ) : (
              <div className="space-y-5">
                {incomeCatEntries.map(({ currency, rows, total }) => (
                  <div key={currency}>
                    {/* Currency header — only shown when multi-currency */}
                    {hasMixedCurrency && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{currency}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground">{formatCurrency(total, currency)}</p>
                      </div>
                    )}
                    <div className="space-y-2.5">
                      {rows.map(([cat, amt]) => {
                        const pct = total > 0 ? Math.round((amt / total) * 100) : 0
                        return (
                          <div key={cat} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: (CATEGORY_COLORS as Record<string, string>)[cat] || '#94a3b8' }} />
                              <span className="text-sm truncate">{cat}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                              <span className="font-semibold text-sm tabular-nums text-green-600 w-28 text-right">
                                {formatCurrency(amt, currency)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Divider between currency groups */}
                    {hasMixedCurrency && incomeCatEntries.indexOf(incomeCatEntries.find(e => e.currency === currency)!) < incomeCatEntries.length - 1 && (
                      <div className="border-t border-border/50 mt-3" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="bg-white rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCatEntries.length === 0 || expenseCatEntries.every(e => e.rows.length === 0) ? (
              <p className="text-muted-foreground text-sm text-center py-4">No expenses for this period</p>
            ) : (
              <div className="space-y-5">
                {expenseCatEntries.map(({ currency, rows, total }) => (
                  <div key={currency}>
                    {hasMixedCurrency && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{currency}</p>
                        <p className="text-[10px] font-semibold text-muted-foreground">{formatCurrency(total, currency)}</p>
                      </div>
                    )}
                    <div className="space-y-2.5">
                      {rows.map(([cat, amt]) => {
                        const pct = total > 0 ? Math.round((amt / total) * 100) : 0
                        return (
                          <div key={cat} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: (CATEGORY_COLORS as Record<string, string>)[cat] || '#94a3b8' }} />
                              <span className="text-sm truncate">{cat}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                              <span className="font-semibold text-sm tabular-nums text-red-500 w-28 text-right">
                                {formatCurrency(amt, currency)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {hasMixedCurrency && expenseCatEntries.indexOf(expenseCatEntries.find(e => e.currency === currency)!) < expenseCatEntries.length - 1 && (
                      <div className="border-t border-border/50 mt-3" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
