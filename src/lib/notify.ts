import { createClient } from '@/lib/supabase/client'

type NotificationType = 'budget' | 'goal' | 'bill' | 'recurring' | 'report' | 'system'

interface NotifyParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  /** Optional dedupe key — if a notification with this exact title+type was created
   *  in the last `dedupeWindowHours`, skip inserting a duplicate. Prevents spamming
   *  the same "Budget exceeded" alert on every single expense within the same day. */
  dedupeWindowHours?: number
}

export async function notify({ userId, type, title, message, dedupeWindowHours }: NotifyParams) {
  const supabase = createClient()

  if (dedupeWindowHours) {
    const since = new Date(Date.now() - dedupeWindowHours * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('title', title)
      .gte('created_at', since)
      .limit(1)
    if (existing && existing.length > 0) return // already notified recently, skip
  }

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    is_read: false,
  })
}