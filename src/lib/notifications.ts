import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationType = 'budget' | 'goal' | 'report' | 'recurring' | 'system' | 'bill' | 'custody'

interface NotifyOptions {
  userId: string
  type: NotificationType
  title: string
  message: string
}

/**
 * Inserts a notification row, but first checks whether a notification with the
 * exact same `type` + `title` already exists for this user within the last
 * `dedupeWindowHours` hours. The `notifications` table (as currently defined)
 * has no dedicated "event key" column, so title-matching within a recent
 * window is the safest available way to avoid re-inserting the same alert
 * every time a budget/goal/recurring check happens to re-run — e.g. on every
 * page load, every expense edit, or every dashboard refresh.
 *
 * If your `notifications` table later gets a `dedupe_key` (or similar) column,
 * swap the `.eq('title', title)` check below for an exact key match — it'll
 * be more robust than title text, which could coincidentally collide or
 * change wording over time.
 */
async function notify(
  supabase: SupabaseClient,
  { userId, type, title, message }: NotifyOptions,
  dedupeWindowHours = 20,
) {
  const since = new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000).toISOString()

  const { data: existing, error: checkError } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('title', title)
    .gte('created_at', since)
    .limit(1)

  if (checkError) {
    console.error('notify() dedup check failed:', checkError.message)
    // Fall through and attempt the insert anyway — better to risk a rare
    // duplicate than to silently drop a real notification because the
    // dedup check itself failed (e.g. transient network error).
  } else if (existing && existing.length > 0) {
    return null // already notified recently — skip
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, type, title, message, is_read: false })
    .select()
    .single()

  if (error) {
    console.error('notify() insert failed:', error.message)
    return null
  }
  return data
}

const fmtAmount = (n: number, currency?: string) =>
  currency ? `${currency} ${Math.round(n).toLocaleString()}` : Math.round(n).toLocaleString()

// ── Budget exceeded / approaching ──────────────────────────────────────
// Call this any time an expense is created or edited, after recomputing
// that category's spend for the relevant budget period. It no-ops below 80%.
export async function notifyBudgetThreshold(
  supabase: SupabaseClient,
  userId: string,
  opts: { budgetName: string; category: string; spent: number; limit: number; currency?: string },
) {
  const { budgetName, category, spent, limit, currency } = opts
  if (limit <= 0) return null
  const pct = Math.round((spent / limit) * 100)

  if (pct >= 100) {
    return notify(supabase, {
      userId,
      type: 'budget',
      title: `Budget exceeded: ${budgetName}`,
      message: `You've spent ${fmtAmount(spent, currency)} of your ${fmtAmount(limit, currency)} ${category} budget (${pct}%).`,
    })
  }
  if (pct >= 80) {
    return notify(supabase, {
      userId,
      type: 'budget',
      title: `Approaching budget limit: ${budgetName}`,
      message: `You've used ${pct}% of your ${fmtAmount(limit, currency)} ${category} budget (${fmtAmount(spent, currency)} spent).`,
    })
  }
  return null
}

// ── Savings goal reached ────────────────────────────────────────────────
// Call this any time a goal's current_amount changes, after the update.
// No-ops if the goal hasn't actually hit its target.
export async function notifyGoalReached(
  supabase: SupabaseClient,
  userId: string,
  opts: { goalName: string; targetAmount: number; currentAmount: number; currency?: string },
) {
  const { goalName, targetAmount, currentAmount, currency } = opts
  if (targetAmount <= 0 || currentAmount < targetAmount) return null
  return notify(supabase, {
    userId,
    type: 'goal',
    title: `Goal reached: ${goalName}`,
    message: `You've hit your ${fmtAmount(targetAmount, currency)} target for "${goalName}". 🎉`,
  })
}

// ── Recurring transaction due soon ──────────────────────────────────────
// Call this for any recurring transaction whose next_date falls within your
// lead-time window (e.g. 1–3 days out). Since this isn't tied to a user
// action like the other three, it needs to run on some kind of page load —
// see the note in the conversation about where that check should live.
export async function notifyRecurringDueSoon(
  supabase: SupabaseClient,
  userId: string,
  opts: { title: string; amount: number; dueDate: string; daysUntil: number; currency?: string },
) {
  const { title, amount, dueDate, daysUntil, currency } = opts
  const when = daysUntil <= 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
  return notify(supabase, {
    userId,
    type: 'recurring',
    title: `Upcoming: ${title}`,
    message: `${fmtAmount(amount, currency)} is due ${when} (${dueDate}).`,
  })
}

// ── Custody balance reminder ────────────────────────────────────────────
// Call this for any outstanding custody balance you want to surface as a
// nudge — also not tied to a single user action, so it needs a page-load
// check similar to the recurring trigger.
export async function notifyCustodyReminder(
  supabase: SupabaseClient,
  userId: string,
  opts: { personName: string; amount: number; currency?: string; direction: 'holding' | 'owed' },
) {
  const { personName, amount, currency, direction } = opts
  const message = direction === 'holding'
    ? `You're still holding ${fmtAmount(amount, currency)} for ${personName} — consider settling up.`
    : `${personName} is still holding ${fmtAmount(amount, currency)} of yours — consider following up.`
  return notify(supabase, {
    userId,
    type: 'custody',
    title: `Custody reminder: ${personName}`,
    message,
  })
}