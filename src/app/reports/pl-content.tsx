'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { FileText, FileSpreadsheet, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { formatCurrency } from '@/lib/utils'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Props {
  incomes:  any[]
  expenses: any[]
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const YEARS  = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

const APP_NAME = 'Think-Shika PA'

const pdfFmt = (n: number) =>
  'GHS ' + new Intl.NumberFormat('en-GH', {
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

export function PLContent({ incomes, expenses }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const now = new Date()
  const [period,   setPeriod]   = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [selMonth, setSelMonth] = useState(String(now.getMonth()))
  const [selYear,  setSelYear]  = useState(String(now.getFullYear()))

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

  const incomeRows = useMemo(() =>
    INCOME_ACCOUNTS.map(acc => {
      const amount = filteredIncomes
        .filter(i => acc.cats.some(c => (i.category ?? '').toLowerCase() === c.toLowerCase()))
        .reduce((s, i) => s + Number(i.amount), 0)
      return { ...acc, amount }
    }).filter(r => r.amount > 0), [filteredIncomes])

  const expenseRows = useMemo(() =>
    EXPENSE_ACCOUNTS.map(acc => {
      const amount = filteredExpenses
        .filter(e => acc.cats.some(c => (e.category ?? '').toLowerCase() === c.toLowerCase()))
        .reduce((s, e) => s + Number(e.amount), 0)
      return { ...acc, amount }
    }).filter(r => r.amount > 0), [filteredExpenses])

  const matchedIncomeCats  = new Set(INCOME_ACCOUNTS.flatMap(a => a.cats.map(c => c.toLowerCase())))
  const matchedExpenseCats = new Set(EXPENSE_ACCOUNTS.flatMap(a => a.cats.map(c => c.toLowerCase())))

  const unmatchedIncome  = filteredIncomes
    .filter(i => !matchedIncomeCats.has((i.category ?? '').toLowerCase()))
    .reduce((s, i) => s + Number(i.amount), 0)
  const unmatchedExpense = filteredExpenses
    .filter(e => !matchedExpenseCats.has((e.category ?? '').toLowerCase()))
    .reduce((s, e) => s + Number(e.amount), 0)

  const totalIncome   = filteredIncomes.reduce((s, i)  => s + Number(i.amount), 0)
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const netSurplus    = totalIncome - totalExpenses
  const savingsRate   = totalIncome > 0 ? ((netSurplus / totalIncome) * 100).toFixed(1) : '0.0'
  const slug          = label.replace(/\s/g, '-').toLowerCase()

  // ── CSV Export ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const allIncomeRows = [
      ...incomeRows,
      ...(unmatchedIncome > 0 ? [{ code: '4099', name: 'Other Income', amount: unmatchedIncome }] : []),
    ]
    const allExpenseRows = [
      ...expenseRows,
      ...(unmatchedExpense > 0 ? [{ code: '5099', name: 'Other Expenses', amount: unmatchedExpense }] : []),
    ]
    const rows = [
      [`${APP_NAME} — Personal Income Statement`],
      [`Period: ${label}`],
      [`Generated: ${format(new Date(), 'PPP')}`],
      [],
      ['INCOME', '', ''],
      ['Code', 'Account', 'Amount (GHS)'],
      ...allIncomeRows.map(r => [r.code, r.name, pdfFmt(r.amount)]),
      ['', 'TOTAL INCOME', pdfFmt(totalIncome)],
      [],
      ['EXPENSES', '', ''],
      ['Code', 'Account', 'Amount (GHS)'],
      ...allExpenseRows.map(r => [r.code, r.name, pdfFmt(r.amount)]),
      ['', 'TOTAL EXPENSES', pdfFmt(totalExpenses)],
      [],
      ['', 'NET SURPLUS / (DEFICIT)', pdfFmt(netSurplus)],
      ['', 'SAVINGS RATE', `${savingsRate}%`],
    ]
    const csv  = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `think-shika-pl-${slug}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'P&L exported as CSV', variant: 'success' })
  }

  // ── Excel Export ─────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb   = XLSX.utils.book_new()

      const allIncomeRows = [
        ...incomeRows,
        ...(unmatchedIncome > 0 ? [{ code: '4099', name: 'Other Income', amount: unmatchedIncome }] : []),
      ]
      const allExpenseRows = [
        ...expenseRows,
        ...(unmatchedExpense > 0 ? [{ code: '5099', name: 'Other Expenses', amount: unmatchedExpense }] : []),
      ]

      const data = [
        [`${APP_NAME} — Personal Income Statement`],
        [`Period: ${label}`],
        [`Generated: ${format(new Date(), 'PPP')}`],
        [],
        ['INCOME'],
        ['Code', 'Account', 'Amount (GHS)'],
        ...allIncomeRows.map(r => [r.code, r.name, r.amount]),
        ['', 'TOTAL INCOME', totalIncome],
        [],
        ['EXPENSES'],
        ['Code', 'Account', 'Amount (GHS)'],
        ...allExpenseRows.map(r => [r.code, r.name, r.amount]),
        ['', 'TOTAL EXPENSES', totalExpenses],
        [],
        ['', 'NET SURPLUS / (DEFICIT)', netSurplus],
        ['', 'SAVINGS RATE', `${savingsRate}%`],
      ]

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'P&L Statement')
      XLSX.writeFile(wb, `think-shika-pl-${slug}.xlsx`)
      toast({ title: 'P&L exported as Excel', variant: 'success' })
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
      doc.text(`${APP_NAME}`, 14, 18)

      doc.setFontSize(13)
      doc.setTextColor(40, 40, 40)
      doc.text('Personal Income Statement (P&L)', 14, 27)

      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Period: ${label}`, 14, 35)
      doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 41)

      const allIncomeRows = [
        ...incomeRows,
        ...(unmatchedIncome > 0 ? [{ code: '4099', name: 'Other Income', amount: unmatchedIncome }] : []),
      ]
      const allExpenseRows = [
        ...expenseRows,
        ...(unmatchedExpense > 0 ? [{ code: '5099', name: 'Other Expenses', amount: unmatchedExpense }] : []),
      ]

      // Income table
      doc.setFontSize(12)
      doc.setTextColor(22, 163, 74)
      doc.text('INCOME', 14, 52)
      autoTable(doc, {
        startY: 56,
        head: [['Code', 'Account', 'Amount']],
        body: [
          ...allIncomeRows.map(r => [r.code, r.name, pdfFmt(r.amount)]),
          ['', 'TOTAL INCOME', pdfFmt(totalIncome)],
        ],
        theme: 'striped',
        headStyles:   { fillColor: [22, 163, 74] },
        columnStyles: { 2: { halign: 'right' } },
        bodyStyles:   { fontSize: 10 },
        didParseCell: (data) => {
          if (data.row.index === allIncomeRows.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Expense table
      const y1 = (doc as any).lastAutoTable.finalY + 12
      doc.setFontSize(12)
      doc.setTextColor(220, 38, 38)
      doc.text('EXPENSES', 14, y1)
      autoTable(doc, {
        startY: y1 + 4,
        head: [['Code', 'Account', 'Amount']],
        body: [
          ...allExpenseRows.map(r => [r.code, r.name, pdfFmt(r.amount)]),
          ['', 'TOTAL EXPENSES', pdfFmt(totalExpenses)],
        ],
        theme: 'striped',
        headStyles:   { fillColor: [220, 38, 38] },
        columnStyles: { 2: { halign: 'right' } },
        bodyStyles:   { fontSize: 10 },
        didParseCell: (data) => {
          if (data.row.index === allExpenseRows.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Net surplus
      const y2 = (doc as any).lastAutoTable.finalY + 12
      autoTable(doc, {
        startY: y2,
        head: [],
        body: [
          ['NET SURPLUS / (DEFICIT)', netSurplus >= 0 ? pdfFmt(netSurplus) : `(${pdfFmt(Math.abs(netSurplus))})`],
          ['SAVINGS RATE', `${savingsRate}%`],
        ],
        theme: 'plain',
        columnStyles: {
          0: { fontStyle: 'bold', fontSize: 11 },
          1: { halign: 'right', fontStyle: 'bold', fontSize: 11,
               textColor: netSurplus >= 0 ? [22, 163, 74] : [220, 38, 38] },
        },
      })

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text(
          `${APP_NAME} — P&L Statement | Page ${i} of ${pageCount}`,
          14,
          doc.internal.pageSize.height - 10
        )
      }

      doc.save(`think-shika-pl-${slug}.pdf`)
      toast({ title: 'P&L exported as PDF', variant: 'success' })
    } catch (err) {
      console.error(err)
      toast({ title: 'PDF export failed', variant: 'destructive' })
    }
  }

  const Row = ({ code, name, amount }: { code: string; name: string; amount: number }) => (
    <div className="flex items-center py-2.5 border-b border-border/50 last:border-0">
      <span className="w-14 text-xs font-mono text-muted-foreground flex-shrink-0">{code}</span>
      <span className="flex-1 text-sm">{name}</span>
      <span className="text-sm font-semibold tabular-nums">
        {amount > 0 ? formatCurrency(amount) : <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Period selector + Export buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Card className="bg-white rounded-xl shadow-sm flex-1">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3 flex-wrap">
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

              {period === 'annual' && (
                <Select value={selYear} onValueChange={setSelYear}>
                  <SelectTrigger className="w-24 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <span className="ml-auto text-sm font-semibold" style={{ color: theme.colors.primary }}>
                {label}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Export buttons */}
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

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white kpi-green p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Total Income</p>
          </div>
          <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums break-all">{formatCurrency(totalIncome)}</p>
        </Card>
        <Card className="bg-white kpi-red p-3 sm:p-4 overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Total Expenses</p>
          </div>
          <p className="kpi-value text-sm sm:text-xl font-bold tabular-nums break-all">{formatCurrency(totalExpenses)}</p>
        </Card>
        <Card className={`bg-white p-3 sm:p-4 overflow-hidden ${netSurplus >= 0 ? 'kpi-blue' : 'kpi-red'}`}>
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
            <Minus className="w-3.5 h-3.5 flex-shrink-0" />
            <p className="text-[9px] sm:text-xs text-muted-foreground uppercase font-semibold tracking-wide truncate">Net Surplus</p>
          </div>
          <p className={`kpi-value text-sm sm:text-xl font-bold tabular-nums break-all ${netSurplus < 0 ? 'text-red-500' : ''}`}>
            {formatCurrency(netSurplus)}
          </p>
          <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 truncate">Savings rate: {savingsRate}%</p>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card className="bg-white rounded-xl shadow-sm">
        <CardHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold">Personal Income Statement</CardTitle>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <p className="text-xs text-muted-foreground">Think-Shika PA · All amounts in GHS</p>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">

          {/* INCOME */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 rounded-full bg-green-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-green-700">Income</p>
            </div>
            <div className="bg-green-50/50 rounded-xl px-4 py-1">
              {incomeRows.length === 0 && unmatchedIncome === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No income recorded</p>
              ) : (
                <>
                  {incomeRows.map(r => <Row key={r.code} {...r} />)}
                  {unmatchedIncome > 0 && <Row code="4099" name="Other Income" amount={unmatchedIncome} />}
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-4 pt-3 mt-1">
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.colors.primary }}>
                Total Income
              </span>
              <span className="text-sm font-bold tabular-nums text-green-600">
                {formatCurrency(totalIncome)}
              </span>
            </div>
          </div>

          {/* EXPENSES */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-4 rounded-full bg-red-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-red-700">Expenses</p>
            </div>
            <div className="bg-red-50/50 rounded-xl px-4 py-1">
              {expenseRows.length === 0 && unmatchedExpense === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">No expenses recorded</p>
              ) : (
                <>
                  {expenseRows.map(r => <Row key={r.code} {...r} />)}
                  {unmatchedExpense > 0 && <Row code="5099" name="Other Expenses" amount={unmatchedExpense} />}
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-4 pt-3 mt-1">
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: theme.colors.primary }}>
                Total Expenses
              </span>
              <span className="text-sm font-bold tabular-nums text-red-500">
                ({formatCurrency(totalExpenses)})
              </span>
            </div>
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
                </p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${netSurplus >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {netSurplus >= 0 ? '' : '('}{formatCurrency(Math.abs(netSurplus))}{netSurplus < 0 ? ')' : ''}
              </p>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
