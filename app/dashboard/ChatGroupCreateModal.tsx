'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { ChatGroupMember, ChatGroupSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

export default function ChatGroupCreateModal({
  currentUserId,
  companyId,
  onClose,
  onCreated,
}: {
  currentUserId: string
  companyId: string
  onClose: () => void
  onCreated: (group: ChatGroupSummary) => void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [candidates, setCandidates] = useState<ChatGroupMember[]>([])
  const [memberSearch, setMemberSearch] = useState('')
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

    // Candidate pool matches whoever is already RLS-scoped as a 1:1 chat
    // contact (is_chat_partner_of) — same query ChatPanel.tsx runs.
    async function loadCandidates() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('company_id', companyId)
        .in('role', ['agent', 'team_leader', 'super_admin'])
        .neq('id', currentUserId)
        .order('full_name', { ascending: true })
      setCandidates((data ?? []) as ChatGroupMember[])
    }

    loadCandidates()
  }, [companyId, currentUserId])

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredCandidates = candidates.filter(c => c.full_name.toLowerCase().includes(memberSearch.toLowerCase()))
  const canSubmit = name.trim().length > 0 && selectedIds.size > 0 && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/admin/chat-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), memberIds: Array.from(selectedIds) }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? t('chatGroupCreateError'))
      setSubmitting(false)
      return
    }

    onCreated({
      id: data.group.id,
      name: data.group.name,
      createdBy: data.group.createdBy,
      createdAt: data.group.createdAt,
      memberCount: data.group.memberCount,
    })
  }

  if (typeof document === 'undefined') return null

  return createPortal(
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
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
          background: 'rgba(10,10,10,0.98)',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <span className="text-sm font-semibold" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('chatGroupModalTitle')}
          </span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('chatGroupNamePlaceholder')}
            className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase" style={{ color: MUTED, letterSpacing: '0.06em', fontFamily: "'Space Grotesk', sans-serif" }}>
              {t('chatGroupMembersLabel')}
            </span>
            <input
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              placeholder={t('chatGroupMembersSearchPlaceholder')}
              className="w-full text-sm px-3 py-1.5 rounded-md outline-none"
              style={{ background: CARD, border: `1px solid ${BORDER}`, color: 'white', fontFamily: "'Montserrat', sans-serif" }}
            />
            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
              {filteredCandidates.map(c => (
                <label key={c.id} className="flex items-center gap-2 px-2 py-1 rounded-md text-sm" style={{ color: 'white', fontFamily: "'Montserrat', sans-serif" }}>
                  <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleMember(c.id)} />
                  <span className="truncate">{c.full_name}</span>
                </label>
              ))}
            </div>
            {selectedIds.size === 0 && (
              <span className="text-xs" style={{ color: MUTED }}>{t('chatGroupNoMembersSelected')}</span>
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
            {submitting ? t('chatGroupSubmitting') : t('chatGroupSubmitButton')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
