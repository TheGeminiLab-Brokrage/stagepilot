'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { TaskListSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

type Item = { id: string; body: string }
type RecipientProgress = { recipientId: string; fullName: string; completed: number; total: number }

export default function TaskListView({
  currentUserId,
  taskList,
  onBack,
  onListCompleted,
}: {
  currentUserId: string
  taskList: TaskListSummary
  onBack: () => void
  onListCompleted: (taskListId: string) => void
}) {
  const t = useT()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [remainingItems, setRemainingItems] = useState<Item[]>([])
  const [progress, setProgress] = useState<RecipientProgress[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadRecipientView() {
      const { data: items } = await supabase
        .from('task_list_items')
        .select('id, body')
        .eq('task_list_id', taskList.id)
        .order('position', { ascending: true })

      const itemIds = (items ?? []).map(i => i.id)
      const { data: completions } = await supabase
        .from('task_list_item_completions')
        .select('task_list_item_id')
        .eq('recipient_id', currentUserId)
        .in('task_list_item_id', itemIds)

      if (cancelled) return
      const completedSet = new Set((completions ?? []).map(c => c.task_list_item_id))
      const remaining = (items ?? []).filter(i => !completedSet.has(i.id))
      setRemainingItems(remaining)
      setLoading(false)
      if (remaining.length === 0) onListCompleted(taskList.id)
    }

    async function loadOwnerView() {
      const { data: recipients } = await supabase
        .from('task_list_recipients')
        .select('recipient_id, profiles(full_name)')
        .eq('task_list_id', taskList.id)

      const { data: items } = await supabase
        .from('task_list_items')
        .select('id')
        .eq('task_list_id', taskList.id)

      const itemIds = (items ?? []).map(i => i.id)
      const { data: completions } = await supabase
        .from('task_list_item_completions')
        .select('task_list_item_id, recipient_id')
        .in('task_list_item_id', itemIds)

      if (cancelled) return
      const completedByRecipient: Record<string, number> = {}
      for (const c of completions ?? []) {
        completedByRecipient[c.recipient_id] = (completedByRecipient[c.recipient_id] ?? 0) + 1
      }

      const rows: RecipientProgress[] = (recipients ?? []).map((r: { recipient_id: string; profiles: { full_name: string } | { full_name: string }[] | null }) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return {
          recipientId: r.recipient_id,
          fullName: profile?.full_name ?? '',
          completed: completedByRecipient[r.recipient_id] ?? 0,
          total: itemIds.length,
        }
      })
      setProgress(rows)
      setLoading(false)
    }

    if (taskList.mode === 'recipient') loadRecipientView()
    else loadOwnerView()

    return () => {
      cancelled = true
    }
  }, [taskList.id, taskList.mode, currentUserId])

  async function completeItem(itemId: string) {
    setRemainingItems(prev => prev.filter(i => i.id !== itemId))
    const { error } = await supabase
      .from('task_list_item_completions')
      .insert({ task_list_item_id: itemId, recipient_id: currentUserId })

    if (!error) {
      const stillRemaining = remainingItems.filter(i => i.id !== itemId)
      if (stillRemaining.length === 0) onListCompleted(taskList.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <button onClick={onBack} className="text-sm px-1.5 py-0.5 rounded" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
          {t('chatBackToContacts')}
        </button>
        <span className="text-sm font-semibold truncate" style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}>
          {taskList.title}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {loading ? (
          <div className="text-xs" style={{ color: MUTED }}>…</div>
        ) : taskList.mode === 'recipient' ? (
          remainingItems.length === 0 ? (
            <div className="text-xs" style={{ color: MUTED }}>{t('taskListEmptyChecklist')}</div>
          ) : (
            remainingItems.map(item => (
              <button
                key={item.id}
                onClick={() => completeItem(item.id)}
                aria-label={t('taskListItemCompleteAria')}
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-sm text-left"
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'rgba(255,255,255,0.85)', fontFamily: "'Montserrat', sans-serif" }}
              >
                <span
                  style={{
                    marginTop: 2,
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    border: `1.5px solid ${NEON}`,
                    flexShrink: 0,
                  }}
                />
                <span>{item.body}</span>
              </button>
            ))
          )
        ) : progress.length === 0 ? (
          <div className="text-xs" style={{ color: MUTED }}>{t('taskListOwnerEmptyRecipients')}</div>
        ) : (
          progress.map(p => (
            <div
              key={p.recipientId}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
            >
              <span className="truncate">{p.fullName}</span>
              <span className="text-xs" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
                {p.completed} {t('taskListProgressOf')} {p.total} {t('taskListProgressCompletedSuffix')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
