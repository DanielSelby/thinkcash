'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, TrendingUp, TrendingDown, Wallet, Target, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface Props {
  incomes: any[]
  expenses: any[]
  budgets: any[]
  goals: any[]
  recurring: any[]
  profile: any
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 })
    .format(n).replace('GHS', 'GH₵')

const QUICK_PROMPTS = [
  'How is my spending this month?',
  'Am I saving enough?',
  'Which category am I overspending on?',
  'How can I reach my savings goals faster?',
  'Give me a monthly budget plan',
  'What are my biggest financial risks?',
  'How do I improve my financial health score?',
  'Suggest ways to increase my income',
]

export function AIAdvisorContent({ incomes, expenses, budgets, goals, recurring, profile }: Props) {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Build financial context summary for the AI
  const buildContext = () => {
    const now        = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const monthIncomes  = incomes.filter(i  => i.date >= monthStart && i.date <= monthEnd)
    const monthExpenses = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd)

    const totalIncome   = monthIncomes.reduce((s, i)  => s + Number(i.amount), 0)
    const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
    const netSavings    = totalIncome - totalExpenses
    const savingsRate   = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : '0'

    // Expense breakdown by category
    const expByCategory: Record<string, number> = {}
    monthExpenses.forEach(e => {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount)
    })
    const topExpenses = Object.entries(expByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: GH₵${amt.toFixed(0)}`)
      .join(', ')

    // Budget status
    const budgetStatus = budgets.map(b => {
      const spent = monthExpenses.filter(e => e.category === b.category).reduce((s, e) => s + Number(e.amount), 0)
      const pct   = b.monthly_limit > 0 ? ((spent / b.monthly_limit) * 100).toFixed(0) : '0'
      return `${b.budget_name} (${b.category}): spent GH₵${spent.toFixed(0)} of GH₵${b.monthly_limit} (${pct}%)`
    }).join('\n')

    // Goals
    const goalsStatus = goals.map(g => {
      const pct = g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(0) : '0'
      return `${g.goal_name}: GH₵${g.current_amount} / GH₵${g.target_amount} (${pct}%)`
    }).join('\n')

    // Recurring
    const recurringList = recurring
      .map(r => `${r.title} (${r.type}, ${r.frequency}): GH₵${r.amount}`)
      .join('\n')

    return `
You are a personal financial advisor for ${profile?.full_name || 'the user'} in Ghana.
You have access to their complete financial data. Be specific, actionable, and encouraging.
Use Ghana cedis (GH₵) for all amounts. Keep responses concise but insightful.

CURRENT MONTH (${now.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })}):
- Total Income: GH₵${totalIncome.toFixed(0)}
- Total Expenses: GH₵${totalExpenses.toFixed(0)}
- Net Savings: GH₵${netSavings.toFixed(0)}
- Savings Rate: ${savingsRate}%

TOP EXPENSE CATEGORIES:
${topExpenses || 'No expenses recorded'}

BUDGET STATUS:
${budgetStatus || 'No budgets set'}

SAVINGS GOALS:
${goalsStatus || 'No goals set'}

RECURRING TRANSACTIONS:
${recurringList || 'None'}

ALL-TIME:
- Total income records: ${incomes.length}
- Total expense records: ${expenses.length}
- Total income (all time): GH₵${incomes.reduce((s, i) => s + Number(i.amount), 0).toFixed(0)}
- Total expenses (all time): GH₵${expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(0)}
    `.trim()
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = buildContext()
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
          system: systemPrompt,
        }),
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please try again.'

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
        timestamp: new Date(),
      }])
    }
    setLoading(false)
  }

  const clearChat = () => setMessages([])

  // Quick stats for the sidebar
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const mInc  = incomes.filter(i  => i.date >= monthStart && i.date <= monthEnd).reduce((s, i) => s + Number(i.amount), 0)
  const mExp  = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd).reduce((s, e) => s + Number(e.amount), 0)
  const mNet  = mInc - mExp
  const mRate = mInc > 0 ? Math.round((mNet / mInc) * 100) : 0

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-bold flex items-center gap-2"
          style={{ color: theme.colors.primary }}>
          <Sparkles className="w-5 h-5" style={{ color: theme.colors.accent }} />
          AI Financial Advisor
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Powered by Claude · Analyzes your real financial data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Chat Panel ── */}
        <div className="lg:col-span-2 flex flex-col gap-3">

          {/* Message area */}
          <Card className="bg-white rounded-xl shadow-sm flex flex-col"
            style={{ height: '520px' }}>
            <CardHeader className="pb-2 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4" style={{ color: theme.colors.primary }} />
                  Financial Advisor Chat
                </CardTitle>
                {messages.length > 0 && (
                  <button onClick={clearChat}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </CardHeader>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: theme.colors.primary + '15' }}>
                    <Bot className="w-8 h-8" style={{ color: theme.colors.primary }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Hello, {profile?.full_name?.split(' ')[0] || 'there'}!</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                      I've analyzed your financial data. Ask me anything about your spending,
                      savings, budgets, or how to improve your finances.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' : ''
                    }`}
                      style={msg.role === 'assistant' ? { background: theme.colors.primary + '15' } : {}}>
                      {msg.role === 'user'
                        ? <User className="w-3.5 h-3.5" />
                        : <Bot  className="w-3.5 h-3.5" style={{ color: theme.colors.primary }} />}
                    </div>
                    {/* Bubble */}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'bg-muted/50 text-foreground rounded-tl-sm'
                    }`}
                      style={msg.role === 'user' ? { background: theme.colors.primary } : {}}>
                      {msg.content.split('\n').map((line, j) => (
                        <p key={j} className={j > 0 ? 'mt-1' : ''}>{line}</p>
                      ))}
                      <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-muted-foreground'}`}>
                        {msg.timestamp.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: theme.colors.primary + '15' }}>
                    <Bot className="w-3.5 h-3.5" style={{ color: theme.colors.primary }} />
                  </div>
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Analyzing your finances…</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border flex-shrink-0">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                  placeholder="Ask about your finances…"
                  disabled={loading}
                  className="flex-1 h-9 px-3 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  style={{ background: theme.colors.primary }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>

          {/* Quick prompts */}
          <Card className="bg-white rounded-xl shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Quick Questions
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map(prompt => (
                  <button key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={loading}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors bg-white disabled:opacity-40"
                    style={{ color: theme.colors.primary }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Sidebar Stats ── */}
        <div className="space-y-3">
          <Card className="bg-white rounded-xl shadow-sm kpi-green">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Month Income</p>
              </div>
              <p className="kpi-value text-xl font-bold tabular-nums">{fmt(mInc)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-xl shadow-sm kpi-red">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Month Expenses</p>
              </div>
              <p className="kpi-value text-xl font-bold tabular-nums">{fmt(mExp)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-xl shadow-sm kpi-blue">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net Balance</p>
              </div>
              <p className="kpi-value text-xl font-bold tabular-nums">{fmt(mNet)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-xl shadow-sm kpi-purple">
            <CardContent className="pt-4 pb-4 px-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-purple-600" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Savings Rate</p>
              </div>
              <p className="kpi-value text-xl font-bold tabular-nums">{mRate}%</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(mRate, 100)}%`, background: theme.colors.primary }} />
              </div>
            </CardContent>
          </Card>

          {/* Goals progress */}
          {goals.length > 0 && (
            <Card className="bg-white rounded-xl shadow-sm">
              <CardContent className="pt-4 pb-4 px-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Savings Goals
                </p>
                <div className="space-y-3">
                  {goals.slice(0, 3).map((g, i) => {
                    const pct = g.target_amount > 0
                      ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
                      : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium truncate max-w-[120px]">{g.goal_name}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: theme.colors.accent }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-xl border-0"
            style={{ background: theme.colors.primary }}>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-white text-xs font-semibold mb-1">💡 Pro Tip</p>
              <p className="text-white/80 text-xs leading-relaxed">
                The more transactions you record, the more accurate and personalized my advice becomes.
                Try to log every income and expense!
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}