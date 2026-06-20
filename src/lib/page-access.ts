// ============================================================
// THINK-SHIKA PA — Central registry of gateable pages
// `key` must exactly match the route's leading path segment.
// Dashboard, Profile, and Admin are always accessible / role-gated
// separately, and are intentionally excluded from this list.
//
// IMPORTANT: I expanded this from 9 to 14 pages based on the folder
// structure visible in this conversation (accounts, categories,
// health-score, ai-advisor, liabilities were missing entirely — which
// is why "Full Access" templates and the restrict dialog looked
// incomplete). I haven't seen your actual sidebar nav component, so
// please sanity-check this list against it.
//
// To stop this drifting out of sync again: import GATEABLE_PAGES from
// here in your sidebar nav component too, instead of keeping a second
// hand-written list there. One array, two consumers — add a page once
// and it shows up in both the sidebar and the access dialog.
// ============================================================

export const GATEABLE_PAGES = [
  { key: 'transactions',  label: 'Transactions',    href: '/transactions' },
  { key: 'income',        label: 'Income',          href: '/income' },
  { key: 'expenses',      label: 'Expenses',        href: '/expenses' },
  { key: 'accounts',      label: 'Accounts',        href: '/accounts' },
  { key: 'budgets',       label: 'Budgets',         href: '/budgets' },
  { key: 'savings',       label: 'Savings Goals',   href: '/savings' },
  { key: 'recurring',     label: 'Recurring',       href: '/recurring' },
  { key: 'liabilities',   label: 'Liabilities',     href: '/liabilities' },
  { key: 'categories',    label: 'Categories',      href: '/categories' },
  { key: 'reports',       label: 'Reports',         href: '/reports' },
  { key: 'analytics',     label: 'Analytics',       href: '/analytics' },
  { key: 'health-score',  label: 'Health Score',    href: '/health-score' },
  { key: 'ai-advisor',    label: 'AI Advisor',      href: '/ai-advisor' },
  { key: 'notifications', label: 'Notifications',   href: '/notifications' },
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