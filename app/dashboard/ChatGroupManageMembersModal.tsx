'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/language-context'
import type { ChatGroupMember, ChatGroupSummary } from './chatTypes'

const NEON = '#D7FF00'
const CARD = 'rgba(255,255,255,0.03)'
const BORDER = 'rgba(255,255,255,0.08)'
const MUTED = 'rgba(255,255,255,0.4)'

export default function ChatGroupManageMembersModal({
  currentUserId,
  companyId,
  group,
  onClose,
  onMembersChanged,
}: {
  currentUserId: string
  companyId: string
  group: ChatGroupSummary
  onClose: () => void
  onMembersChanged: (groupId: string, memberCount: number) => void
}) {
  const t = useT()
  const [candidates, setCandidates] = useState<ChatGroupMember[]>([])
  const [initialIds, setInitialIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
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

    async function load() {
      const [{ data: allProfiles }, { data: memberRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('company_id', companyId)
          .in('role', ['agent', 'team_leader', 'super_admin'])
          .neq('id', currentUserId)
          .order('full_name', { ascending: true }),
        supabase.from('chat_group_members').select('member_id').eq('group_id', group.id),
      ])

      const current = new Set((memberRows ?? []).map(r => r.member_id).filter(id => id !== currentUserId))
      setCandidates((allProfiles ?? []) as ChatGroupMember[])
      setInitialIds(current)
      setSelectedIds(new Set(current))
      setLoading(false)
    }

    load()
  }, [companyId, currentUserId, group.id])

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredCandidates = candidates.filter(c => c.full_name.toLowerCase().includes(memberSearch.toLowerCase()))
  const canSubmit = selectedIds.size > 0 && !submitting

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    const toAdd = Array.from(selectedIds).filter(id => !initialIds.has(id))
    const toRemove = Array.from(initialIds).filter(id => !selectedIds.has(id))

    if (toAdd.length > 0) {
      const res = await fetch(`/api/admin/chat-groups/${group.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: toAdd }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? t('chatGroupManageError'))
        setSubmitting(false)
        return
      }
    }

    if (toRemove.length > 0) {
      const res = await fetch(`/api/admin/chat-groups/${group.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: toRemove }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? t('chatGroupManageError'))
        setSubmitting(false)
        return
      }
    }

    onMembersChanged(group.id, selectedIds.size + 1)
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
          <span className="text-sm font-semibold truncate" style={{ color: NEON, fontFamily: "'Space Grotesk', sans-serif" }}>
            {t('chatManageMembersButton')} — {group.name}
          </span>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: MUTED }}>
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {loading ? (
            <div className="text-xs" style={{ color: MUTED }}>…</div>
          ) : (
            <div className="flex flex-col gap-1.5">
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
          )}

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
            {submitting ? t('chatGroupSubmitting') : t('chatGroupSaveMembersButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
