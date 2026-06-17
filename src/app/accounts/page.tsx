export const dynamic = 'force-dynamic'
'use client'

import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  Home, Car, Smartphone, Briefcase, Heart,
  ShoppingBag, BookOpen, Plane, Shield, CreditCard,
  DollarSign, Building, BarChart3,
} from 'lucide-react'

const ACCOUNTS = [
  {
    group: 'Income Accounts',
    color: 'kpi-green',
    textColor: '#16a34a',
    icon: TrendingUp,
    accounts: [
      { code: '4001', name: 'Employment Income',    sub: 'Salary, wages, bonuses',         icon: Briefcase   },
      { code: '4002', name: 'Business Income',      sub: 'Self-employment, freelance',      icon: Building    },
      { code: '4003', name: 'Investment Income',    sub: 'Dividends, interest, capital gains', icon: BarChart3 },
      { code: '4004', name: 'Rental Income',        sub: 'Property rental proceeds',        icon: Home        },
      { code: '4005', name: 'Gift & Grants',        sub: 'Gifts received, grants, awards',  icon: Heart       },
      { code: '4006', name: 'Other Income',         sub: 'Miscellaneous income sources',    icon: DollarSign  },
    ],
  },
  {
    group: 'Living Expenses',
    color: 'kpi-red',
    textColor: '#dc2626',
    icon: Home,
    accounts: [
      { code: '5001', name: 'Housing',              sub: 'Rent, mortgage, maintenance',     icon: Home        },
      { code: '5002', name: 'Utilities',            sub: 'Electricity, water, internet',    icon: Smartphone  },
      { code: '5003', name: 'Food & Dining',        sub: 'Groceries, restaurants, snacks',  icon: ShoppingBag },
      { code: '5004', name: 'Transport',            sub: 'Fuel, tuber, public transit',     icon: Car         },
      { code: '5005', name: 'Clothing',             sub: 'Clothes, shoes, accessories',     icon: ShoppingBag },
      { code: '5006', name: 'Personal Care',        sub: 'Hair, grooming, toiletries',      icon: Heart       },
    ],
  },
  {
    group: 'Health & Education',
    color: 'kpi-teal',
    textColor: '#0d9488',
    icon: Heart,
    accounts: [
      { code: '5101', name: 'Healthcare',           sub: 'Doctor, medicine, insurance',     icon: Heart       },
      { code: '5102', name: 'Education',            sub: 'School fees, books, courses',     icon: BookOpen    },
      { code: '5103', name: 'Health Insurance',     sub: 'NHIS, private health cover',      icon: Shield      },
      { code: '5104', name: 'Life Insurance',       sub: 'Life & disability insurance',     icon: Shield      },
    ],
  },
  {
    group: 'Lifestyle & Entertainment',
    color: 'kpi-purple',
    textColor: '#7c3aed',
    icon: Plane,
    accounts: [
      { code: '5201', name: 'Entertainment',        sub: 'Movies, events, subscriptions',   icon: Smartphone  },
      { code: '5202', name: 'Travel & Holidays',    sub: 'Flights, hotels, trips',           icon: Plane       },
      { code: '5203', name: 'Shopping',             sub: 'Electronics, home goods',         icon: ShoppingBag },
      { code: '5204', name: 'Gifts & Donations',    sub: 'Gifts given, tithes, charity',    icon: Heart       },
    ],
  },
  {
    group: 'Financial Obligations',
    color: 'kpi-orange',
    textColor: '#ea580c',
    icon: CreditCard,
    accounts: [
      { code: '5301', name: 'Debt Repayment',       sub: 'Loans, credit cards, overdrafts', icon: CreditCard  },
      { code: '5302', name: 'Bank Charges',         sub: 'Fees, transaction charges',       icon: Building    },
      { code: '5303', name: 'Tax Payments',         sub: 'Income tax, GRA obligations',     icon: DollarSign  },
    ],
  },
  {
    group: 'Savings & Investments',
    color: 'kpi-blue',
    textColor: '#2563eb',
    icon: PiggyBank,
    accounts: [
      { code: '6001', name: 'Emergency Fund',       sub: 'Short-term safety net savings',   icon: Shield      },
      { code: '6002', name: 'Retirement Savings',   sub: 'Pension, provident fund, SSNIT',  icon: Building    },
      { code: '6003', name: 'Investment Portfolio', sub: 'Stocks, bonds, mutual funds',     icon: BarChart3   },
      { code: '6004', name: 'Goal-based Savings',   sub: 'House, car, education fund',      icon: PiggyBank   },
      { code: '6005', name: 'Fixed Deposits',       sub: 'Bank fixed deposits, T-Bills',    icon: Wallet      },
    ],
  },
]

export default function AccountsPage() {
  const { activeTheme } = useAppStore()
  const theme = THEMES[activeTheme] ?? THEMES['green']

  const totalAccounts = ACCOUNTS.reduce((s, g) => s + g.accounts.length, 0)

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-xl font-bold" style={{ color: theme.colors.primary }}>
              Chart of Accounts
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Personal finance account structure · {totalAccounts} accounts across {ACCOUNTS.length} groups
            </p>
          </div>
        </div>

        {/* Account structure note */}
        <Card className="bg-white border-l-4 rounded-xl" style={{ borderLeftColor: theme.colors.primary }}>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">
              This chart of accounts follows a standard personal finance structure.
              Account codes <strong>4xxx</strong> represent income,{' '}
              <strong>5xxx</strong> represent expenses, and{' '}
              <strong>6xxx</strong> represent savings & investments.
              Use these categories when recording transactions for consistent reporting.
            </p>
          </CardContent>
        </Card>

        {/* Account Groups */}
        {ACCOUNTS.map(group => {
          const GroupIcon = group.icon
          return (
            <Card key={group.group} className={`bg-white rounded-xl shadow-sm ${group.color}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GroupIcon className="w-4 h-4" style={{ color: group.textColor }} />
                  <span style={{ color: group.textColor }}>{group.group}</span>
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {group.accounts.length} accounts
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {group.accounts.map(acc => {
                    const AccIcon = acc.icon
                    return (
                      <div key={acc.code}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        {/* Account code badge */}
                        <div
                          className="flex-shrink-0 w-14 text-center px-1.5 py-1 rounded-lg text-xs font-bold tabular-nums"
                          style={{
                            background: group.textColor + '15',
                            color: group.textColor,
                          }}
                        >
                          {acc.code}
                        </div>

                        {/* Icon */}
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: group.textColor + '12' }}
                        >
                          <AccIcon className="w-4 h-4" style={{ color: group.textColor }} />
                        </div>

                        {/* Name + sub */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{acc.name}</p>
                          <p className="text-xs text-muted-foreground">{acc.sub}</p>
                        </div>

                        {/* Type tag */}
                        <div
                          className="flex-shrink-0 hidden sm:block text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: group.textColor + '12',
                            color: group.textColor,
                          }}
                        >
                          {acc.code.startsWith('4') ? 'Income'
                            : acc.code.startsWith('6') ? 'Savings'
                            : 'Expense'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Footer note */}
        <Card className="bg-amber-50 border border-amber-200 rounded-xl">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-800">
              <strong>Ghana-specific note:</strong> Tax accounts reflect GRA obligations.
              Savings accounts include SSNIT and local investment vehicles like T-Bills and mutual funds.
              Categories map directly to your Income and Expense entry forms.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
