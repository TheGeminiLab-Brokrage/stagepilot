'use client'

import { useT } from '@/lib/language-context'

interface Props {
  isLeader: boolean
  teamName: string | null | undefined
  role: string
}

export default function DashboardPageHeader({ isLeader, teamName, role }: Props) {
  const t = useT()
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          {isLeader ? t('headingTeamCalls') : t('headingMyCalls')}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isLeader
            ? `${t('subtitleTeamCalls')} ${teamName ?? ''}`
            : t('subtitleMyCalls')}
        </p>
      </div>
      {role === 'agent' && (
        <a
          href="/dashboard/upload"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {t('btnUploadCall')}
        </a>
      )}
    </div>
  )
}
