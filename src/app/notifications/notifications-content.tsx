'use client'

import { useState } from 'react'
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Target, FileText, RefreshCcw, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/misc'
import { toast } from '@/components/ui/toaster'
import { formatDate } from '@/lib/utils'
import type { Notification } from '@/types'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<string, React.ElementType> = {
  budget: AlertTriangle,
  goal: Target,
  report: FileText,
  recurring: RefreshCcw,
  system: Info,
  bill: Bell,
}

const TYPE_COLOR: Record<string, string> = {
  budget: 'text-warning bg-warning/10',
  goal: 'text-success bg-success/10',
  report: 'text-primary bg-primary/10',
  recurring: 'text-accent bg-accent/10',
  system: 'text-muted-foreground bg-muted',
  bill: 'text-destructive bg-destructive/10',
}

interface Props { initialNotifications: Notification[]; userId: string }

export function NotificationsContent({ initialNotifications, userId }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications)

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAllRead = async () => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    toast({ title: 'All marked as read' })
  }

  const markRead = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const deleteNotification = async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = async () => {
    if (!confirm('Delete all notifications?')) return
    const supabase = createClient()
    await supabase.from('notifications').delete().eq('user_id', userId)
    setNotifications([])
    toast({ title: 'All notifications cleared' })
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground text-sm">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={clearAll}>
              <Trash2 className="w-4 h-4" /> Clear all
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="font-display font-semibold text-lg mb-1">No notifications</h3>
          <p className="text-muted-foreground text-sm">You're all caught up! Notifications about budgets, goals, and bills will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = TYPE_ICON[n.type] || Bell
            return (
              <Card
                key={n.id}
                className={cn('p-4 flex items-start gap-4 hover:shadow-sm transition-all', !n.is_read && 'border-primary/30 bg-primary/5')}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', TYPE_COLOR[n.type] || 'text-muted-foreground bg-muted')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={cn('font-medium text-sm', !n.is_read && 'font-semibold')}>{n.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary" />}
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground" onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at, 'MMM d, yyyy · h:mm a')}</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
