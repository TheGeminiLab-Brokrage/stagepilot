'use client'

import { useT } from '@/lib/language-context'
import { STAGE_KEY_MAP } from '@/lib/translations'

const STAGE_ORDER = [
  'done deal',
  'potential to close',
  'meeting scheduled',
  'meeting done',
  'interested / follow up',
  'not interested',
  'low budget',
]

const STAGE_COLORS: Record<string, string> = {
  'done deal': 'bg-green-500',
  'potential to close': 'bg-purple-500',
  'meeting scheduled': 'bg-yellow-500',
  'meeting done': 'bg-orange-500',
  'interested / follow up': 'bg-blue-500',
  'not interested': 'bg-red-500',
  'low budget': 'bg-gray-500',
}

type Call = {
  status: string
  stage: string | null
  stage_corrected: string | null
  uploaded_at: string
}

export default function StatsCards({ calls }: { calls: Call[] }) {
  const t = useT()

  const done = calls.filter(c => c.status === 'done')
  const total = done.length
  const errors = calls.filter(c => c.status === 'error').length

  const classifiedCalls = done.filter(c => c.stage)
  const notCorrected = classifiedCalls.filter(c => !c.stage_corrected)
  const accuracy = classifiedCalls.length > 0
    ? Math.round((notCorrected.length / classifiedCalls.length) * 100)
    : null

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = calls.filter(c => new Date(c.uploaded_at) >= weekAgo).length

  const stageCounts: Record<string, number> = {}
  for (const c of done) {
    const s = c.stage_corrected ?? c.stage ?? 'unknown'
    stageCounts[s] = (stageCounts[s] ?? 0) + 1
  }

  const stageBreakdown = STAGE_ORDER
    .filter(s => stageCounts[s] > 0)
    .map(s => ({ stage: s, count: stageCounts[s], pct: Math.round((stageCounts[s] / total) * 100) }))

  return (
    <div className="mb-6 space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">{t('statTotalProcessed')}</p>
          <p className="text-2xl font-bold text-white">{total}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">{t('statAiAccuracy')}</p>
          {accuracy !== null ? (
            <>
              <p className="text-2xl font-bold text-blue-400">{accuracy}%</p>
              <p className="text-xs text-gray-600 mt-0.5">{notCorrected.length} {t('statOfCalls')} {classifiedCalls.length} {t('statCalls')}</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-gray-600">—</p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">{t('statThisWeek')}</p>
          <p className="text-2xl font-bold text-purple-400">{thisWeek}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('statLast7Days')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">{t('statErrors')}</p>
          <p className="text-2xl font-bold text-red-400">{errors}</p>
        </div>
      </div>

      {/* Stage breakdown */}
      {stageBreakdown.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-3">{t('statStageBreakdown')}</p>
          <div className="space-y-2">
            {stageBreakdown.map(({ stage, count, pct }) => {
              const stageKey = STAGE_KEY_MAP[stage]
              const stageLabel = stageKey ? t(stageKey) : stage
              return (
                <div key={stage} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-gray-400 truncate capitalize">{stageLabel}</div>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 w-16 text-right">{count} ({pct}%)</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
