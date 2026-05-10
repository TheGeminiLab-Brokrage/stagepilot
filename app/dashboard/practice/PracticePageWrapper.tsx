'use client'

import { useState } from 'react'
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
  const { lang } = useLanguage()
  const isAr = lang === 'ar'

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
            onClick={() => setActiveTab(key)}
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
            {key === 'sessions' && initialSessions.length > 0 && (
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
                {initialSessions.length}
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
          />
        )}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto">
            <TraineePracticeSessionsTab
              sessions={initialSessions}
              scenarioLabels={scenarioLabels}
            />
          </div>
        )}
      </div>
    </div>
  )
}
