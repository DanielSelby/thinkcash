// ============================================================
// Central registry of gate-able pages for per-user access control.
// `key` must exactly match the route's leading path segment.
// Dashboard is always accessible and intentionally excluded.
// ============================================================

export const GATEABLE_PAGES = [
  { key: 'transactions', label: 'Transactions',      href: '/transactions' },
  { key: 'income',       label: 'Income',             href: '/income' },
  { key: 'expenses',     label: 'Expenses',           href: '/expenses' },
  { key: 'categories',   label: 'Categories',         href: '/categories' },
  { key: 'budgets',      label: 'Budgets',            href: '/budgets' },
  { key: 'savings',      label: 'Savings Goals',      href: '/savings' },
  { key: 'recurring',    label: 'Recurring',          href: '/recurring' },
  { key: 'reports',      label: 'Reports',            href: '/reports' },
  { key: 'analytics',    label: 'Analytics',          href: '/analytics' },
  { key: 'accounts',     label: 'Chart of Accounts',  href: '/accounts' },
  { key: 'user-accounts',label: 'My Accounts',        href: '/user-accounts' },
  { key: 'wealth',       label: 'Net Worth',          href: '/wealth' },
  { key: 'custody',      label: 'Custody Account',    href: '/custody' },
  { key: 'health-score', label: 'Health Score',       href: '/health-score' },
  { key: 'ai-advisor',   label: 'AI Advisor',         href: '/ai-advisor' },
] as const

export type PageKey = typeof GATEABLE_PAGES[number]['key']

/**
 * Returns true if the user can access the given page key.
 * `allowed_pages === null` means unrestricted (full access).
 */
export function canAccessPage(allowedPages: string[] | null | undefined, pageKey: string): boolean {
  if (allowedPages === null || allowedPages === undefined) return true
  return allowedPages.includes(pageKey)
}