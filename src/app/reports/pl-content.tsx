'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { FileText, FileSpreadsheet, Download, TrendingUp, TrendingDown, Wallet, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes:  any[]
  expenses: any[]
  accounts?: any[]
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

const APP_NAME = 'Think-Shika PA'

// ── Currency-aware formatter for exports (no forced GHS) ──────────────
const exportFmt = (n: number, cur = 'GHS') =>
  `${cur} ` + new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)

const INCOME_ACCOUNTS = [
  { code: '4001', name: 'Employment Income',  cats: ['Salary', 'salary', 'Bonus', 'bonus'] },
  { code: '4002', name: 'Business Income',    cats: ['Business', 'business', 'Freelance', 'freelance'] },
  { code: '4003', name: 'Investment Income',  cats: ['Investment', 'investment'] },
  { code: '4004', name: 'Rental Income',      cats: ['Rental', 'rental'] },
  { code: '4005', name: 'Gifts & Grants',     cats: ['Gift', 'gift', 'Other', 'other'] },
]

const EXPENSE_ACCOUNTS = [
  { code: '5001', name: 'Housing',            cats: ['Housing', 'housing'] },
  { code: '5002', name: 'Utilities',          cats: ['Utilities', 'utilities'] },
  { code: '5003', name: 'Food & Dining',      cats: ['Food & Dining', 'food', 'Food'] },
  { code: '5004', name: 'Transport',          cats: ['Transport', 'transportation', 'Transport & Fuel'] },
  { code: '5005', name: 'Healthcare',         cats: ['Healthcare', 'healthcare'] },
  { code: '5006', name: 'Education',          cats: ['Education', 'education'] },
  { code: '5007', name: 'Entertainment',      cats: ['Entertainment', 'entertainment'] },
  { code: '5008', name: 'Shopping',           cats: ['Shopping', 'shopping', 'Clothing', 'clothing', 'Personal Care'] },
  { code: '5009', name: 'Insurance',          cats: ['Insurance', 'insurance'] },
  { code: '5010', name: 'Debt & Savings',     cats: ['Debt Payment', 'Savings', 'savings', 'investments'] },
  { code: '5011', name: 'Travel',             cats: ['Travel', 'travel'] },
  { code: '5099', name: 'Other Expenses',     cats: ['Other', 'other'] },
]

export function PLContent({ incomes, expenses, accounts = [] }: Props) {
  const { activeTheme, currency: primaryCurrency } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const now = new Date()
  const [period,   setPeriod]   = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [selMonth, setSelMonth] = useState(String(now.getMonth()))
  const [selYear,  setSelYear]  = useState(String(now.getFullYear()))

  // ── Resolve account currency for a transaction ────────────────────
  const getTxCurrency = (r: any): string =>
    accounts.find(a => a.id === r.account_id)?.currency || primaryCurrency

  const { from, to, label } = useMemo(() => {
    const yr = Number(selYear)
    if (period === 'monthly') {
      const mo = Number(selMonth)
      return {
        from:  `${yr}-${String(mo + 1).padStart(2, '0')}-01`,
        to:    new Date(yr, mo + 1, 0).toISOString().split('T')[0],
        label: `${MONTHS[mo]} ${yr}`,
      }
    }
    if (period === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3)
      return {
        from:  `${yr}-${String(q * 3 + 1).padStart(2, '0')}-01`,
        to:    new Date(yr, q * 3 + 3, 0).toISOString().split('T')[0],
        label: `Q${q + 1} ${yr}`,
      }
    }
    return { from: `${yr}-01-01`, to: `${yr}-12-31`, label: `Year ${yr}` }
  }, [period, selMonth, selYear])

  const filteredIncomes  = useMemo(() =>
    incomes.filter(i  => i.date >= from && i.date <= to), [incomes, from, to])
  const filteredExpenses = useMemo(() =>
    expenses.filter(e => e.date >= from && e.date <= to), [expenses, from, to])

  // ── Group totals by currency ──────────────────────────────────────
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

  // Primary-currency totals for Net/Savings
  const totalIncome   = incomeByCurrency[primaryCurrency]  ?? Object.values(incomeByCurrency)[0]  ?? 0
  const totalExpenses = expenseByCurrency[primaryCurrency] ?? Object.values(expenseByCurrency)[0] ?? 0
  const netSurplus    = totalIncome - totalExpenses
  const savingsRate   = totalIncome > 0 ? ((netSurplus / totalIncome) * 100).toFixed(1) : '0.0'

  // ── P&L rows — per-currency aware ────────────────────────────────
  // We build rows per currency so each row shows its actual currency
  const incomeRowsByCurrency = useMemo(() => {
    const result: Record<string, Array<{ code: string; name: string; amount: number; currency: string }>> = {}
    filteredIncomes.forEach(r => {
      const cur = getTxCurrency(r)
      if (!result[cur]) result[cur] = []
      const cat = r.category ?? ''
      const account = INCOME_ACCOUNTS.find(a =>
        a.cats.some(c => c.toLowerCase() === cat.toLowerCase())
      ) ?? { code: '4099', name: 'Other Income' }
      const existing = result[cur].find(x => x.code === account.code)
      if (existing) {
        existing.amount += Number(r.amount)
      } else {
        result[cur].push({ code: account.code, name: account.name, amount: Number(r.amount), currency: cur })
      }
    })
    // Sort each currency's rows by code
    Object.values(result).forEach(rows => rows.sort((a, b) => a.code.localeCompare(b.code)))
    return result
  }, [filteredIncomes, accounts, primaryCurrency])

  const expenseRowsByCurrency = useMemo(() => {
    const result: Record<string, Array<{ code: string; name: string; amount: number; currency: string }>> = {}
    filteredExpenses.forEach(r => {
      const cur = getTxCurrency(r)
      if (!result[cur]) result[cur] = []
      const cat = r.category ?? ''
      const account = EXPENSE_ACCOUNTS.find(a =>
        a.cats.some(c => c.toLowerCase() === cat.toLowerCase())
      ) ?? { code: '5099', name: 'Other Expenses' }
      const existing = result[cur].find(x => x.code === account.code)
      if (existing) {
        existing.amount += Number(r.amount)
      } else {
        result[cur].push({ code: account.code, name: account.name, amount: Number(r.amount), currency: cur })
      }
    })
    Object.values(result).forEach(rows => rows.sort((a, b) => a.code.localeCompare(b.code)))
    return result
  }, [filteredExpenses, accounts, primaryCurrency])

  // ── Flat rows for exports (legacy format, single-currency) ────────
  const allIncomeRowsFlat = useMemo(() =>
    Object.entries(incomeRowsByCurrency).flatMap(([cur, rows]) =>
      rows.map(r => ({ ...r, currency: cur }))
    ), [incomeRowsByCurrency])

  const allExpenseRowsFlat = useMemo(() =>
    Object.entries(expenseRowsByCurrency).flatMap(([cur, rows]) =>
      rows.map(r => ({ ...r, currency: cur }))
    ), [expenseRowsByCurrency])

  const slug = label.replace(/\s/g, '-').toLowerCase()

  // Currencies present
  const incomeCurrencies  = Object.keys(incomeByCurrency).sort(c => c === primaryCurrency ? -1 : 1)
  const expenseCurrencies = Object.keys(expenseByCurrency).sort(c => c === primaryCurrency ? -1 : 1)
  const hasMixedCurrency  = incomeCurrencies.length > 1 || expenseCurrencies.length > 1

  // ── CSV Export ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const rows = [
      [`${APP_NAME} — Personal Income Statement`],
      [`Period: ${label}`],
      [`Generated: ${format(new Date(), 'PPP')}`],
      [],
      ['INCOME', '', ''],
      ['Code', 'Account', 'Currency', 'Amount'],
      ...allIncomeRowsFlat.map(r => [r.code, r.name, r.currency, exportFmt(r.amount, r.currency)]),
      [],
      ...incomeCurrencies.map(cur => ['', `TOTAL INCOME (${cur})`, cur, exportFmt(incomeByCurrency[cur], cur)]),
      [],
      ['EXPENSES', '', ''],
      ['Code', 'Account', 'Currency', 'Amount'],
      ...allExpenseRowsFlat.map(r => [r.code, r.name, r.currency, exportFmt(r.amount, r.currency)]),
      [],
      ...expenseCurrencies.map(cur => ['', `TOTAL EXPENSES (${cur})`, cur, exportFmt(expenseByCurrency[cur], cur)]),
      [],
      ['', `NET SURPLUS / (DEFICIT) (${primaryCurrency})`, primaryCurrency, exportFmt(netSurplus, primaryCurrency)],
      ['', 'SAVINGS RATE', '', `${savingsRate}%`],
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `think-shika-pl-${slug}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'P&L exported as CSV', variant: 'success' })
  }

  // ── Excel Export ──────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()
      const data = [
        [`${APP_NAME} — Personal Income Statement`],
        [`Period: ${label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['INCOME'],
        ['Code', 'Account', 'Currency', 'Amount'],
        ...allIncomeRowsFlat.map(r => [r.code, r.name, r.currency, r.amount]),
        [],
        ...incomeCurrencies.map(cur => ['', `TOTAL INCOME (${cur})`, cur, incomeByCurrency[cur]]),
        [],
        ['EXPENSES'],
        ['Code', 'Account', 'Currency', 'Amount'],
        ...allExpenseRowsFlat.map(r => [r.code, r.name, r.currency, r.amount]),
        [],
        ...expenseCurrencies.map(cur => ['', `TOTAL EXPENSES (${cur})`, cur, expenseByCurrency[cur]]),
        [],
        [`NET SURPLUS / (DEFICIT) (${primaryCurrency})`, '', primaryCurrency, netSurplus],
        ['SAVINGS RATE', '', '', `${savingsRate}%`],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'P&L Statement')
      XLSX.writeFile(wb, `think-shika-pl-${slug}.xlsx`)
      toast({ title: 'P&L exported as Excel', variant: 'success' })
    } catch {
      toast({ title: 'Excel export failed', variant: 'destructive' })
    }
  }

  // ── PDF Export ────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { default: jsPDF }     = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      doc.setFontSize(18); doc.setTextColor(0, 75, 35)
      doc.text(APP_NAME, 14, 18)
      doc.setFontSize(13); doc.setTextColor(40, 40, 40)
      doc.text('Personal Income Statement (P&L)', 14, 27)
      doc.setFontSize(10); doc.setTextColor(100, 100, 100)
      doc.text(`Period: ${label}`, 14, 35)
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 41)

      doc.setFontSize(12); doc.setTextColor(22, 163, 74)
      doc.text('INCOME', 14, 52)
      autoTable(doc, {
        startY: 56,
        head: [['Code', 'Account', 'Currency', 'Amount']],
        body: [
          ...allIncomeRowsFlat.map(r => [r.code, r.name, r.currency, exportFmt(r.amount, r.currency)]),
          ...incomeCurrencies.map(cur => ['', `TOTAL INCOME (${cur})`, cur, exportFmt(incomeByCurrency[cur], cur)]),
        ],
        theme: 'striped',
        headStyles:   { fillColor: [22, 163, 74] },
        columnStyles: { 3: { halign: 'right' } },
        bodyStyles:   { fontSize: 10 },
        didParseCell: (data) => {
          if (data.row.index >= allIncomeRowsFlat.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      const y1 = (doc as any).lastAutoTable.finalY + 12
      doc.setFontSize(12); doc.setTextColor(220, 38, 38)
      doc.text('EXPENSES', 14, y1)
      autoTable(doc, {
        startY: y1 + 4,
        head: [['Code', 'Account', 'Currency', 'Amount']],
        body: [
          ...allExpenseRowsFlat.map(r => [r.code, r.name, r.currency, exportFmt(r.amount, r.currency)]),
          ...expenseCurrencies.map(cur => ['', `TOTAL EXPENSES (${cur})`, cur, exportFmt(expenseByCurrency[cur], cur)]),
        ],
        theme: 'striped',
        headStyles:   { fillColor: [220, 38, 38] },
        columnStyles: { 3: { halign: 'right' } },
        bodyStyles:   { fontSize: 10 },
        didParseCell: (data) => {
          if (data.row.index >= allExpenseRowsFlat.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      const y2 = (doc as any).lastAutoTable.finalY + 12
      autoTable(doc, {
        startY: y2,
        head: [],
        body: [
          [`NET SURPLUS / (DEFICIT) (${primaryCurrency})`,
            netSurplus >= 0 ? exportFmt(netSurplus, primaryCurrency) : `(${exportFmt(Math.abs(netSurplus), primaryCurrency)})`],
          ['SAVINGS RATE', `${savingsRate}%`],
        ],
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', fontSize: 11 },
          1: { halign: 'right', fontStyle: 'bold', fontSize: 11,
               textColor: netSurplus >= 0 ? [22, 163, 74] : [220, 38, 38] },
        },
      })

      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9); doc.setTextColor(150, 150, 150)
        doc.text(`${APP_NAME} — P&L Statement | Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10)
      }
      doc.save(`think-shika-pl-${slug}.pdf`)
      toast({ title: 'P&L exported as PDF', variant: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  // ── Row component ─────────────────────────────────────────────────
  const Row = ({ code, name, amount, currency }: { code: string; name: string; amount: number; currency: string }) => (
    <div className="flex items-center py-2.5 border-b border-border/50 last:border-0">
      <span className="w-14 text-xs font-mono text-muted-foreground flex-shrink-0">{code}</span>
      <span className="flex-1 text-sm">{name}</span>
      <span className="text-sm font-semibold tabular-nums">
        {amount > 0
          ? formatCurrency(amount, currency)
          : <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Period selector + Export buttons — single row ── */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period toggle */}
            <div className="flex gap-2">
              {(['monthly', 'quarterly', 'annual'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    period === p ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  style={period === p ? { background: theme.colors.primary } : {}}>
                  {p}
                </button>
              ))}
            </div>

            {/* Month/year selectors */}
            {period === 'monthly' && (
              <>
                <Select value={selMonth} onValueChange={setSelMonth}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selYear} onValueChange={setSelYear}>
                  <SelectTrigger className="w-24 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}

            {(period === 'annual' || period === 'quarterly') && (
              <Select value={selYear} onValueChange={setSelYear}>
                <SelectTrigger className="w-24 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Period label */}
            <span className="text-sm font-semibold ml-auto" style={{ color: theme.colors.primary }}>
              {label}
            </span>

            {/* Export buttons — inline in the same row */}
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

      {/* ── KPI Cards — 4 cards matching Overview layout ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">

        {/* Total Income — one card per currency */}
        {incomeCurrencies.length === 0 ? (
          <Card className="kpi-green rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Income</p>
            </div>
            <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums">—</p>
          </Card>
        ) : incomeCurrencies.map(cur => (
          <Card key={`inc-${cur}`} className="kpi-green rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
                Total Income{incomeCurrencies.length > 1 ? ` (${cur})` : ''}
              </p>
            </div>
            <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums break-all">
              {formatCurrency(incomeByCurrency[cur], cur)}
            </p>
          </Card>
        ))}

        {/* Total Expenses — one card per currency */}
        {expenseCurrencies.length === 0 ? (
          <Card className="kpi-red rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Total Expenses</p>
            </div>
            <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums">—</p>
          </Card>
        ) : expenseCurrencies.map(cur => (
          <Card key={`exp-${cur}`} className="kpi-red rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
                Total Expenses{expenseCurrencies.length > 1 ? ` (${cur})` : ''}
              </p>
            </div>
            <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums break-all">
              {formatCurrency(expenseByCurrency[cur], cur)}
            </p>
          </Card>
        ))}

        {/* Net Surplus — primary currency */}
        <Card className={`rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden ${netSurplus >= 0 ? 'kpi-blue' : 'kpi-red'}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">
              Net {netSurplus >= 0 ? 'Savings' : 'Deficit'}
            </p>
          </div>
          <p className={`kpi-value text-sm sm:text-xl font-bold tabular-nums break-all ${netSurplus < 0 ? 'text-red-500' : ''}`}>
            {formatCurrency(Math.abs(netSurplus), primaryCurrency)}
          </p>
          {hasMixedCurrency && (
            <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{primaryCurrency} only</p>
          )}
        </Card>

        {/* Savings Rate */}
        <Card className="kpi-purple rounded-xl shadow-sm border border-border bg-white p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart2 className="w-3.5 h-3.5 flex-shrink-0 text-purple-500" />
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide">Savings Rate</p>
          </div>
          <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums">{savingsRate}%</p>
          <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 truncate">Of income saved</p>
        </Card>
      </div>

      {/* ── P&L Statement ── */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">Personal Income Statement</CardTitle>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Think-Shika PA{hasMixedCurrency ? ' · Multi-currency — amounts shown per currency' : ' · All amounts in ' + primaryCurrency}
          </p>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">

          {/* INCOME */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 rounded-full bg-green-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">Income</p>
            </div>

            {incomeCurrencies.length === 0 ? (
              <div className="bg-green-50/50 rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
                No income recorded
              </div>
            ) : (
              incomeCurrencies.map(cur => (
                <div key={cur} className="mb-4 last:mb-0">
                  {incomeCurrencies.length > 1 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-1">{cur}</p>
                  )}
                  <div className="bg-green-50/50 rounded-xl px-4 py-1">
                    {(incomeRowsByCurrency[cur] ?? []).map(r => (
                      <Row key={r.code} code={r.code} name={r.name} amount={r.amount} currency={cur} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 pt-3 mt-1">
                    <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.colors.primary }}>
                      Total Income{incomeCurrencies.length > 1 ? ` (${cur})` : ''}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-green-600">
                      {formatCurrency(incomeByCurrency[cur], cur)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* EXPENSES */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 rounded-full bg-red-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-red-700">Expenses</p>
            </div>

            {expenseCurrencies.length === 0 ? (
              <div className="bg-red-50/50 rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
                No expenses recorded
              </div>
            ) : (
              expenseCurrencies.map(cur => (
                <div key={cur} className="mb-4 last:mb-0">
                  {expenseCurrencies.length > 1 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-1">{cur}</p>
                  )}
                  <div className="bg-red-50/50 rounded-xl px-4 py-1">
                    {(expenseRowsByCurrency[cur] ?? []).map(r => (
                      <Row key={r.code} code={r.code} name={r.name} amount={r.amount} currency={cur} />
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 pt-3 mt-1">
                    <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.colors.primary }}>
                      Total Expenses{expenseCurrencies.length > 1 ? ` (${cur})` : ''}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-red-500">
                      ({formatCurrency(expenseByCurrency[cur], cur)})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* NET SURPLUS */}
          <div className="border-t-2 border-border pt-4">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: theme.colors.primaryPale }}>
              <div>
                <p className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.colors.primary }}>
                  Net Surplus / (Deficit)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Savings rate: {savingsRate}% of income
                  {hasMixedCurrency && ` · ${primaryCurrency} only`}
                </p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${netSurplus >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {netSurplus >= 0 ? '' : '('}
                {formatCurrency(Math.abs(netSurplus), primaryCurrency)}
                {netSurplus < 0 ? ')' : ''}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
