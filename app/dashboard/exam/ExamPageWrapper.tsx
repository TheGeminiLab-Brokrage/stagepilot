'use client'

import { useState, useCallback } from 'react'
import ExamClient from './ExamClient'
import UserExamResultsTab, { type ExamResult } from './UserExamResultsTab'
import { useT } from '@/lib/language-context'

interface Props {
  userId: string
  companyId: string
  userName: string
  userEmail: string
  initialResults: ExamResult[]
}

type Tab = 'exam' | 'results'

export default function ExamPageWrapper({ userId, companyId, userName, userEmail, initialResults }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('exam')
  const [results, setResults] = useState<ExamResult[]>(initialResults)
  const t = useT()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'exam', label: t('examTabExam') },
    { key: 'results', label: t('examTabResults') },
  ]

  const refreshResults = useCallback(async () => {
    try {
      const res = await fetch('/api/exam/user-results')
      if (!res.ok) return
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      // Non-blocking — stale results stay visible
    }
  }, [])

  const handleExamComplete = useCallback(async () => {
    await refreshResults()
    setActiveTab('results')
  }, [refreshResults])

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
            {key === 'results' && results.length > 0 && (
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
                {results.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col">
        {activeTab === 'exam' && (
          <ExamClient
            userId={userId}
            companyId={companyId}
            userName={userName}
            userEmail={userEmail}
            onExamComplete={handleExamComplete}
          />
        )}
        {activeTab === 'results' && (
          <div className="flex-1 overflow-y-auto">
            <UserExamResultsTab results={results} userName={userName} />
          </div>
        )}
      </div>
    </div>
  )
}
