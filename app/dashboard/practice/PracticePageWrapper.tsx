'use client'

import { useState, useEffect, useCallback } from 'react'
import PracticeClient from './PracticeClient'
import TraineePracticeSessionsTab, { type PracticeSessionRow } from './TraineePracticeSessionsTab'
import { useLanguage } from '@/lib/language-context'

interface Props {
  userId: string
  companyId: string
  userName: string
  role: string
  userEmail: string
  initialSessions: PracticeSessionRow[]
  scenarioLabels: Record<string, string>
}

type Tab = 'practice' | 'sessions'

export default function PracticePageWrapper({
  userId,
  companyId,
  userName,
  role,
  userEmail,
  initialSessions,
  scenarioLabels,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('practice')
  const [sessions, setSessions] = useState(initialSessions)
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

  useEffect(() => { setSessions(initialSessions) }, [initialSessions])

  const refetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/practice-sessions')
      if (!res.ok) return
      const { sessions: fresh } = await res.json()
      setSessions(fresh)
    } catch {}
  }, [])

  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'sessions') refetchSessions()
  }, [refetchSessions])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'practice', label: isAr ? 'التدريب' : 'Practice' },
    { key: 'sessions', label: isAr ? 'سجل جلساتي' : 'My Sessions' },
  ]

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 0,
          flexShrink: 0,
        }}
        dir="rtl"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            style={{
              padding: '11px 28px',
              borderRadius: '8px 8px 0 0',
              fontSize: 16,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === key ? 'rgba(215,255,0,0.08)' : 'transparent',
              color: activeTab === key ? '#D7FF00' : 'rgba(255,255,255,0.4)',
              borderBottom: activeTab === key ? '2px solid #D7FF00' : '2px solid transparent',
              transition: 'all 0.15s',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {label}
            {key === 'sessions' && sessions.length > 0 && (
              <span
                style={{
                  marginRight: 8,
                  background: 'rgba(215,255,0,0.15)',
                  color: '#D7FF00',
                  borderRadius: 10,
                  padding: '1px 7px',
                  fontSize: 10,
                  fontWeight: 800,
                }}
              >
                {sessions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'practice' && (
          <PracticeClient
            userId={userId}
            companyId={companyId}
            userName={userName}
            role={role}
            userEmail={userEmail}
            onSessionSaved={refetchSessions}
          />
        )}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto">
            <TraineePracticeSessionsTab
              sessions={sessions}
              scenarioLabels={scenarioLabels}
            />
          </div>
        )}
      </div>
    </div>
  )
}
