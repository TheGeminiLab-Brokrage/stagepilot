'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { ChatRole, TaskListSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

type Candidate = { id: string; full_name: string }

export default function TaskListCreateModal({
  currentUserId,
  companyId,
  role,
  onClose,
  onCreated,
}: {
  currentUserId: string
  companyId: string
  role: ChatRole
  onClose: () => void
  onCreated: (list: TaskListSummary) => void
}) {
  const t = useT()
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<string[]>([''])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const supabase = createClient()

    async function loadCandidates() {
      if (role === 'super_admin') {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .in('role', ['agent', 'team_leader'])
          .neq('id', currentUserId)
          .order('full_name', { ascending: true })
        setCandidates((data ?? []) as Candidate[])
      } else if (role === 'team_leader') {
        const { data: me } = await supabase.from('profiles').select('team_name').eq('id', currentUserId).single()
        if (!me?.team_name) return
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'agent')
          .eq('team_name', me.team_name)
          .order('full_name', { ascending: true })
        setCandidates((data ?? []) as Candidate[])
      }
    }

    loadCandidates()
  }, [companyId, currentUserId, role])

  function updateItem(index: number, value: string) {
    setItems(prev => prev.map((v, i) => (i === index ? value : v)))
  }

  function addItem() {
    setItems(prev => [...prev, ''])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function toggleRecipient(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredCandidates = candidates.filter(c => c.full_name.toLowerCase().includes(recipientSearch.toLowerCase()))
  const trimmedItems = items.map(i => i.trim()).filter(Boolean)
  const canSubmit = title.trim().length > 0 && trimmedItems.length > 0 && selectedIds.size > 0 && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/admin/task-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), items: trimmedItems, recipientIds: Array.from(selectedIds) }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('taskListCreateError'))
      setSubmitting(false)
      return
    }

    onCreated({
      id: data.taskList.id,
      title: data.taskList.title,
      createdAt: data.taskList.createdAt,
      itemsTotal: data.taskList.itemsTotal,
      itemsRemaining: data.taskList.itemsTotal,
      mode: 'owner',
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="flex flex-col"
        style={{
          width: 380,
          maxHeight: '80vh',
          background: 'rgba(10,10,10,0.98)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <span className="text-sm font-semibold" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('taskListModalTitle')}
          </span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('taskListTitlePlaceholder')}
            className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('taskListItemsLabel')}
            </span>
            {items.map((value, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={value}
                  onChange={e => updateItem(i, e.target.value)}
                  placeholder={t('taskListItemPlaceholder')}
                  className="flex-1 text-sm px-3 py-1.5 rounded-md outline-none"
                  style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
                />
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(i)}
                    aria-label={t('taskListRemoveItemAria')}
                    className="text-sm px-1.5"
                    style={{ color: MUTED }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addItem}
              className="text-xs font-semibold self-start px-2 py-1 rounded"
              style={{ background: 'rgba(215,255,0,0.1)', color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('taskListAddItemButton')}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('taskListRecipientsLabel')}
            </span>
            <input
              value={recipientSearch}
              onChange={e => setRecipientSearch(e.target.value)}
              placeholder={t('taskListRecipientsSearchPlaceholder')}
              className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
            />
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {filteredCandidates.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded-md text-sm" style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleRecipient(c.id)} />
                  <span className="truncate">{c.full_name}</span>
                </label>
              ))}
            </div>
            {selectedIds.size === 0 && (
              <span className="text-xs" style={{ color: MUTED }}>{t('taskListNoRecipientsSelected')}</span>
            )}
          </div>

          {error && <span className="text-xs" style={{ color: '#FF3B30' }}>{error}</span>}
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded-md" style={{ color: MUTED, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('adminCancel')}
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="text-xs font-semibold uppercase px-3 py-1.5 rounded-md"
            style={{
              background: 'rgba(215,255,0,0.12)',
              color: NEON,
              border: '1px solid rgba(215,255,0,0.25)',
              opacity: canSubmit ? 1 : 0.5,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {submitting ? t('taskListSubmitting') : t('taskListSubmitButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
