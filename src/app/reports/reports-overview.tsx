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
  incomes:      any[]
  expenses:     any[]
  accounts:     any[]
  assets?:      any[]
  investments?: any[]
  debts?:       any[]
  loans?:       any[]
  goals?:       any[]
}

type ReportPeriod = 'monthly' | 'quarterly' | 'annual'

const APP_NAME = 'Think-Shika PA'

const exportFmt = (n: number, cur = 'GHS') =>
  `${cur} ` + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)

function sortCurrencies(currencies: string[], primary: string): string[] {
  return [...currencies].sort((a, b) => {
    if (a === primary) return -1
    if (b === primary) return 1
    return a.localeCompare(b)
  })
}

export function ReportsOverview({
  incomes, expenses, accounts,
  assets = [], investments = [], debts = [], loans = [], goals = [],
}: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [period,         setPeriod]         = useState<ReportPeriod>('monthly')
  const [selectedMonth,  setSelectedMonth]  = useState(format(new Date(), 'yyyy-MM'))
  const [customFrom,     setCustomFrom]     = useState('')
  const [customTo,       setCustomTo]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [currencyFilter, setCurrencyFilter] = useState('All')

  const getTxCurrency = (r: any): string =>
    accounts.find((a: any) => a.id === r.account_id)?.currency || primaryCurrency

  const allCategories = useMemo(() =>
    Array.from(new Set([...incomes.map(i => i.category), ...expenses.map(e => e.category)].filter(Boolean))).sort(),
    [incomes, expenses])

  const allCurrenciesAvailable = useMemo(() =>
    Array.from(new Set([
      ...incomes.map(i => getTxCurrency(i)),
      ...expenses.map(e => getTxCurrency(e)),
    ])).sort((a, b) => a === primaryCurrency ? -1 : b === primaryCurrency ? 1 : a.localeCompare(b)),
    [incomes, expenses, accounts, primaryCurrency])

  const clearAllFilters = () => {
    setCustomFrom(''); setCustomTo('')
    setCategoryFilter('All'); setCurrencyFilter('All')
  }
  const hasActiveFilters = !!customFrom || !!customTo || categoryFilter !== 'All' || currencyFilter !== 'All'

  const dateRange = useMemo(() => {
    if (customFrom || customTo) {
      return {
        start: customFrom || '0001-01-01',
        end:   customTo   || '9999-12-31',
        label: customFrom && customTo
          ? `${format(parseISO(customFrom), 'MMM d, yyyy')} – ${format(parseISO(customTo), 'MMM d, yyyy')}`
          : customFrom ? `From ${format(parseISO(customFrom), 'MMM d, yyyy')}`
          : `Until ${format(parseISO(customTo), 'MMM d, yyyy')}`,
      }
    }
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
  }, [period, selectedMonth, customFrom, customTo])

  const filteredIncomes = useMemo(() =>
    incomes.filter(i =>
      i.date >= dateRange.start && i.date <= dateRange.end &&
      (categoryFilter === 'All' || i.category === categoryFilter) &&
      (currencyFilter === 'All' || getTxCurrency(i) === currencyFilter)
    ), [incomes, dateRange, categoryFilter, currencyFilter, accounts, primaryCurrency])

  const filteredExpenses = useMemo(() =>
    expenses.filter(e =>
      e.date >= dateRange.start && e.date <= dateRange.end &&
      (categoryFilter === 'All' || e.category === categoryFilter) &&
      (currencyFilter === 'All' || getTxCurrency(e) === currencyFilter)
    ), [expenses, dateRange, categoryFilter, currencyFilter, accounts, primaryCurrency])

  const incomeByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredIncomes.forEach(r => { const cur = getTxCurrency(r); map[cur] = (map[cur] || 0) + Number(r.amount) })
    return map
  }, [filteredIncomes, accounts, primaryCurrency])

  const expenseByCurrency = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(r => { const cur = getTxCurrency(r); map[cur] = (map[cur] || 0) + Number(r.amount) })
    return map
  }, [filteredExpenses, accounts, primaryCurrency])

  const incomeCurrencies  = sortCurrencies(Object.keys(incomeByCurrency),  primaryCurrency)
  const expenseCurrencies = sortCurrencies(Object.keys(expenseByCurrency), primaryCurrency)
  const hasMixedCurrency  = incomeCurrencies.length > 1 || expenseCurrencies.length > 1

  const totalIncomePrimary   = incomeByCurrency[primaryCurrency]  ?? 0
  const totalExpensesPrimary = expenseByCurrency[primaryCurrency] ?? 0
  const netSavings           = totalIncomePrimary - totalExpensesPrimary
  const savingsRate          = totalIncomePrimary > 0 ? (netSavings / totalIncomePrimary) * 100 : 0

  const incomeCatByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredIncomes.forEach(r => {
      const cur = getTxCurrency(r); const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    return map
  }, [filteredIncomes, accounts, primaryCurrency])

  const expenseCatByCurrency = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    filteredExpenses.forEach(r => {
      const cur = getTxCurrency(r); const cat = r.category || 'Other'
      if (!map[cur]) map[cur] = {}
      map[cur][cat] = (map[cur][cat] || 0) + Number(r.amount)
    })
    return map
  }, [filteredExpenses, accounts, primaryCurrency])

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

  // ── Net Worth calculations ───────────────────────────────────────
  const totalAssets = useMemo(() =>
    assets.reduce((s, a) => s + Number(a.current_value ?? 0), 0) +
    investments.reduce((s, i) => s + Number(i.current_value ?? 0), 0),
    [assets, investments])

  const totalLiabilities = useMemo(() =>
    debts.reduce((s, d) => s + Number(d.remaining ?? d.total_amount ?? 0), 0) +
    loans.reduce((s, l) => s + Number(l.remaining ?? l.principal ?? 0), 0),
    [debts, loans])

  const netWorth    = totalAssets - totalLiabilities
  const hasNetWorth = assets.length > 0 || investments.length > 0 || debts.length > 0 || loans.length > 0

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), i, 1)
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') }
  }), [])

  const slug = dateRange.label.replace(/\s/g, '-').toLowerCase()

  // ── CSV Export ───────────────────────────────────────────────────
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
        rows.map(([cat, amt]) => [currency, cat, exportFmt(amt, currency), `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`])
      ),
      [],
      ['EXPENSE TOTALS BY CURRENCY'],
      ['Currency', 'Amount'],
      ...expenseCurrencies.map(cur => [cur, exportFmt(expenseByCurrency[cur], cur)]),
      [],
      ['EXPENSES BY CATEGORY'],
      ['Currency', 'Category', 'Amount', '% of Currency Total'],
      ...expenseCatEntries.flatMap(({ currency, rows, total }) =>
        rows.map(([cat, amt]) => [currency, cat, exportFmt(amt, currency), `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`])
      ),
      [],
      [`NET SAVINGS (${primaryCurrency} only)`, exportFmt(netSavings, primaryCurrency)],
      ['SAVINGS RATE', `${savingsRate.toFixed(1)}%`],
      ...(hasNetWorth ? [
        [],
        ['NET WORTH STATEMENT'],
        ['Type', 'Name', 'Category', 'Amount'],
        ...assets.map(a => ['Asset', a.name, a.asset_type, exportFmt(Number(a.current_value ?? 0), primaryCurrency)]),
        ...investments.map(i => ['Investment', i.name, i.investment_type, exportFmt(Number(i.current_value ?? 0), primaryCurrency)]),
        ['', 'TOTAL ASSETS', '', exportFmt(totalAssets, primaryCurrency)],
        ...debts.map(d => ['Debt', d.name, d.debt_type, exportFmt(Number(d.remaining ?? d.total_amount ?? 0), primaryCurrency)]),
        ...loans.map(l => ['Loan', l.name, l.loan_type, exportFmt(Number(l.remaining ?? l.principal ?? 0), primaryCurrency)]),
        ['', 'TOTAL LIABILITIES', '', exportFmt(totalLiabilities, primaryCurrency)],
        ['', 'NET WORTH', '', exportFmt(netWorth, primaryCurrency)],
      ] : []),
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `think-shika-pa-report-${slug}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'CSV report exported', variant: 'success' })
  }

  // ── Excel Export ─────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()
      const summaryData = [
        [`${APP_NAME} Financial Report`], [`Period: ${dateRange.label}`], [`Generated: ${format(new Date(), 'PPP')}`], [],
        ['INCOME BY CURRENCY'], ['Currency', 'Amount'],
        ...incomeCurrencies.map(cur => [cur, incomeByCurrency[cur]]),
        [],
        ['INCOME BY CATEGORY'], ['Currency', 'Category', 'Amount', '%'],
        ...incomeCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [currency, cat, amt, total > 0 ? +((amt / total) * 100).toFixed(1) : 0])
        ),
        [],
        ['EXPENSE BY CURRENCY'], ['Currency', 'Amount'],
        ...expenseCurrencies.map(cur => [cur, expenseByCurrency[cur]]),
        [],
        ['EXPENSES BY CATEGORY'], ['Currency', 'Category', 'Amount', '%'],
        ...expenseCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [currency, cat, amt, total > 0 ? +((amt / total) * 100).toFixed(1) : 0])
        ),
        [],
        [`Net Savings (${primaryCurrency})`, netSavings],
        ['Savings Rate', `${savingsRate.toFixed(1)}%`],
        ...(hasNetWorth ? [
          [],
          ['NET WORTH STATEMENT'], ['Type', 'Name', 'Category', 'Amount'],
          ...assets.map(a => ['Asset', a.name, a.asset_type, Number(a.current_value ?? 0)]),
          ...investments.map(i => ['Investment', i.name, i.investment_type, Number(i.current_value ?? 0)]),
          ['', 'TOTAL ASSETS', '', totalAssets],
          ...debts.map(d => ['Debt', d.name, d.debt_type, Number(d.remaining ?? d.total_amount ?? 0)]),
          ...loans.map(l => ['Loan', l.name, l.loan_type, Number(l.remaining ?? l.principal ?? 0)]),
          ['', 'TOTAL LIABILITIES', '', totalLiabilities],
          ['', 'NET WORTH', '', netWorth],
        ] : []),
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Notes'],
        ...filteredIncomes.map(i => [i.title || '', i.category || 'Other', Number(i.amount), getTxCurrency(i), i.date, i.notes || '']),
      ]), 'Income')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Title', 'Category', 'Amount', 'Currency', 'Date', 'Payment Method', 'Notes'],
        ...filteredExpenses.map(e => [e.title || '', e.category || 'Other', Number(e.amount), getTxCurrency(e), e.date, e.payment_method || '', e.notes || '']),
      ]), 'Expenses')
      if (hasNetWorth) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
          ['Type', 'Name', 'Category', 'Current Value'],
          ...assets.map(a => ['Asset', a.name, a.asset_type, Number(a.current_value ?? 0)]),
          ...investments.map(i => ['Investment', i.name, i.investment_type, Number(i.current_value ?? 0)]),
          [], ['', 'TOTAL ASSETS', '', totalAssets],
          ...debts.map(d => ['Debt', d.name, d.debt_type, Number(d.remaining ?? d.total_amount ?? 0)]),
          ...loans.map(l => ['Loan', l.name, l.loan_type, Number(l.remaining ?? l.principal ?? 0)]),
          [], ['', 'TOTAL LIABILITIES', '', totalLiabilities],
          [], ['', 'NET WORTH', '', netWorth],
        ]), 'Net Worth')
      }
      XLSX.writeFile(wb, `think-shika-pa-report-${slug}.xlsx`)
      toast({ title: 'Excel report exported', variant: 'success' })
    } catch { toast({ title: 'Excel export failed', variant: 'destructive' }) }
  }

  // ── PDF Export ───────────────────────────────────────────────────
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
          ...incomeCurrencies.map(cur  => ['Total Income',   cur, exportFmt(incomeByCurrency[cur],  cur)]),
          ...expenseCurrencies.map(cur => ['Total Expenses', cur, exportFmt(expenseByCurrency[cur], cur)]),
          ['Net Savings', primaryCurrency, exportFmt(netSavings, primaryCurrency)],
          ['Savings Rate', '', `${savingsRate.toFixed(1)}%`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 75, 35] },
        columnStyles: { 2: { halign: 'right' } },
      })

      const y1 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(22, 163, 74)
      doc.text('Income by Category', 14, y1)
      autoTable(doc, {
        startY: y1 + 5,
        head: [['Currency', 'Category', 'Amount', '%']],
        body: incomeCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [currency, cat, exportFmt(amt, currency), `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`])
        ),
        theme: 'striped',
        headStyles: { fillColor: [22, 163, 74] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      })

      const y2 = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(13); doc.setTextColor(220, 38, 38)
      doc.text('Expenses by Category', 14, y2)
      autoTable(doc, {
        startY: y2 + 5,
        head: [['Currency', 'Category', 'Amount', '%']],
        body: expenseCatEntries.flatMap(({ currency, rows, total }) =>
          rows.map(([cat, amt]) => [currency, cat, exportFmt(amt, currency), `${total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%`])
        ),
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      })

      if (hasNetWorth) {
        const y3 = (doc as any).lastAutoTable.finalY + 15
        doc.setFontSize(13); doc.setTextColor(37, 99, 235)
        doc.text('Net Worth Statement', 14, y3)
        autoTable(doc, {
          startY: y3 + 5,
          head: [['Type', 'Name', 'Category', 'Amount']],
          body: [
            ...assets.map(a => ['Asset', a.name, a.asset_type, exportFmt(Number(a.current_value ?? 0), primaryCurrency)]),
            ...investments.map(i => ['Investment', i.name, i.investment_type, exportFmt(Number(i.current_value ?? 0), primaryCurrency)]),
            ['', 'TOTAL ASSETS', '', exportFmt(totalAssets, primaryCurrency)],
            ...debts.map(d => ['Debt', d.name, d.debt_type, `(${exportFmt(Number(d.remaining ?? d.total_amount ?? 0), primaryCurrency)})`]),
            ...loans.map(l => ['Loan', l.name, l.loan_type, `(${exportFmt(Number(l.remaining ?? l.principal ?? 0), primaryCurrency)})`]),
            ['', 'TOTAL LIABILITIES', '', `(${exportFmt(totalLiabilities, primaryCurrency)})`],
            ['', 'NET WORTH', '', netWorth >= 0 ? exportFmt(netWorth, primaryCurrency) : `(${exportFmt(Math.abs(netWorth), primaryCurrency)})`],
          ],
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235] },
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: (data) => {
            const label = data.row.raw[1]
            if (label === 'TOTAL ASSETS' || label === 'TOTAL LIABILITIES' || label === 'NET WORTH') {
              data.cell.styles.fontStyle = 'bold'
            }
          },
        })
      }

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

      {/* ── Period selector + Export ── */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2">
              {(['monthly', 'quarterly', 'annual'] as ReportPeriod[]).map(p => (
                <button key={p} onClick={() => { setPeriod(p); setCustomFrom(''); setCustomTo('') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
                  style={period === p && !customFrom && !customTo
                    ? { background: theme.colors.primary, color: '#fff' }
                    : { background: '#f1f5f9', color: '#64748b' }}>
                  {p}
                </button>
              ))}
            </div>
            {period === 'monthly' && !customFrom && !customTo && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
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

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filter Transactions</p>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">From</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">To</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="h-8 px-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Currency</label>
                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Currencies</SelectItem>
                    {allCurrenciesAvailable.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
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
          {hasMixedCurrency && <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{primaryCurrency} only</p>}
        </Card>

        <Card className="kpi-purple bg-white p-3 sm:p-5 overflow-hidden rounded-xl shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <BarChart3 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Savings Rate</p>
          </div>
          <p className="kpi-value font-display text-sm sm:text-xl font-bold tabular-nums">{savingsRate.toFixed(1)}%</p>
          {hasMixedCurrency && <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{primaryCurrency} only</p>}
        </Card>
      </div>

      {/* ── Category Breakdowns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    {hasMixedCurrency && incomeCatEntries.indexOf(incomeCatEntries.find(e => e.currency === currency)!) < incomeCatEntries.length - 1 && (
                      <div className="border-t border-border/50 mt-3" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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

      {/* ── Net Worth Summary ── */}
      {hasNetWorth && (
        <Card className="bg-white rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />Net Worth Summary
            </CardTitle>
            <p className="text-xs text-muted-foreground">{primaryCurrency} only · as of today</p>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Total Assets</p>
                <p className="text-base sm:text-lg font-bold tabular-nums text-blue-700">
                  {formatCurrency(totalAssets, primaryCurrency)}
                </p>
                <p className="text-xs text-blue-500 mt-0.5">{assets.length + investments.length} items</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-1">Total Liabilities</p>
                <p className="text-base sm:text-lg font-bold tabular-nums text-red-600">
                  {formatCurrency(totalLiabilities, primaryCurrency)}
                </p>
                <p className="text-xs text-red-400 mt-0.5">{debts.length + loans.length} items</p>
              </div>
              <div className={`rounded-xl p-3 text-center ${netWorth >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Net Worth
                </p>
                <p className={`text-base sm:text-lg font-bold tabular-nums ${netWorth >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {netWorth < 0 ? '-' : ''}{formatCurrency(Math.abs(netWorth), primaryCurrency)}
                </p>
                <p className={`text-xs mt-0.5 ${netWorth >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {netWorth >= 0 ? 'Positive' : 'Negative'}
                </p>
              </div>
            </div>

            {/* Assets & Investments */}
            {(assets.length > 0 || investments.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Assets & Investments</p>
                <div className="space-y-1.5">
                  {[
                    ...assets.map(a => ({ name: a.name, type: a.asset_type, value: Number(a.current_value ?? 0) })),
                    ...investments.map(i => ({ name: i.name, type: i.investment_type, value: Number(i.current_value ?? 0) })),
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="capitalize font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">({item.type})</span>
                      </div>
                      <span className="font-semibold tabular-nums text-blue-600">{formatCurrency(item.value, primaryCurrency)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                  <span className="text-sm font-bold text-blue-700">Total Assets</span>
                  <span className="font-bold tabular-nums text-blue-600">{formatCurrency(totalAssets, primaryCurrency)}</span>
                </div>
              </div>
            )}

            {/* Debts & Loans */}
            {(debts.length > 0 || loans.length > 0) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Debts & Loans</p>
                <div className="space-y-1.5">
                  {[
                    ...debts.map(d => ({ name: d.name, type: d.debt_type, value: Number(d.remaining ?? d.total_amount ?? 0) })),
                    ...loans.map(l => ({ name: l.name, type: l.loan_type, value: Number(l.remaining ?? l.principal ?? 0) })),
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                        <span className="capitalize font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">({item.type})</span>
                      </div>
                      <span className="font-semibold tabular-nums text-red-500">({formatCurrency(item.value, primaryCurrency)})</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                  <span className="text-sm font-bold text-red-700">Total Liabilities</span>
                  <span className="font-bold tabular-nums text-red-500">({formatCurrency(totalLiabilities, primaryCurrency)})</span>
                </div>
              </div>
            )}

            {/* Savings Goals */}
            {goals.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Savings Goals Progress</p>
                <div className="space-y-3">
                  {goals.map((g: any) => {
                    const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0
                    return (
                      <div key={g.id}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="font-medium">{g.goal_name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatCurrency(g.current_amount, primaryCurrency)} / {formatCurrency(g.target_amount, primaryCurrency)} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: theme.colors.primary }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Net Worth final line */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl border-t-2 border-border"
              style={{ background: netWorth >= 0 ? '#dbeafe' : '#fee2e2' }}>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-800">Net Worth</p>
                <p className="text-xs text-blue-600 mt-0.5">Assets − Liabilities · {primaryCurrency} only</p>
              </div>
              <p className={`text-xl sm:text-2xl font-bold tabular-nums ${netWorth >= 0 ? 'text-blue-700' : 'text-red-500'}`}>
                {netWorth < 0 ? '(' : ''}{formatCurrency(Math.abs(netWorth), primaryCurrency)}{netWorth < 0 ? ')' : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}