// ============================================================
// THINK-SHIKA PA — Central registry of gateable pages
// `key` must exactly match the route's leading path segment.
// Dashboard and Settings are always accessible and intentionally
// excluded from this list (Settings is the user's own account, not
// something an admin would restrict; Dashboard is the landing page).
//
// This was last reconciled against the actual sidebar nav (16 items
// excluding Dashboard/Settings). Two entries are best-guesses since
// I haven't seen the actual route folders for them — flagged below.
// If either is wrong, just fix the `key`/`href` pair; nothing else
// in the app needs to change since everything reads from this array.
//
// To stop this drifting out of sync again: import GATEABLE_PAGES from
// here in your sidebar nav component too, instead of keeping a second
// hand-written list there. One array, two consumers — add a page once
// and it shows up in both the sidebar and the access dialog.
// ============================================================

export const GATEABLE_PAGES = [
  { key: 'transactions',      label: 'Transactions',      href: '/transactions' },
  { key: 'income',            label: 'Income',            href: '/income' },
  { key: 'expenses',          label: 'Expenses',          href: '/expenses' },
  { key: 'accounts',          label: 'My Accounts',       href: '/accounts' },
  { key: 'chart-of-accounts', label: 'Chart of Accounts', href: '/chart-of-accounts' }, // ⚠ guessed route — verify
  { key: 'net-worth',         label: 'Net Worth',         href: '/net-worth' },         // ⚠ guessed route — verify
  { key: 'budgets',           label: 'Budgets',           href: '/budgets' },
  { key: 'savings',           label: 'Savings Goals',     href: '/savings' },
  { key: 'recurring',         label: 'Recurring',         href: '/recurring' },
  { key: 'liabilities',       label: 'Custody Account',   href: '/liabilities' },       // ⚠ same feature as "Custody Account"? confirm route
  { key: 'categories',        label: 'Categories',        href: '/categories' },
  { key: 'reports',           label: 'Reports',           href: '/reports' },
  { key: 'analytics',         label: 'Analytics',         href: '/analytics' },
  { key: 'forecast',          label: 'Cash Flow Forecast', href: '/forecast' },
  { key: 'health-score',      label: 'Health Score',      href: '/health-score' },
  { key: 'ai-advisor',        label: 'AI Advisor',        href: '/ai-advisor' },
  { key: 'notifications',     label: 'Notifications',     href: '/notifications' },
] as const

export type PageKey = typeof GATEABLE_PAGES[number]['key']

/**
 * Returns true if the user can access the given page key.
 * `allowed_pages === null` means unrestricted (full access).
 */
export function canAccessPage(
  allowedPages: string[] | null | undefined,
  pageKey: string
): boolean {
  if (allowedPages === null || allowedPages === undefined) return true
  return allowedPages.includes(pageKey)
}