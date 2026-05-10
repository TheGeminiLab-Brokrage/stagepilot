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
          className="tgl-btn-glow font-bold text-sm px-5 py-2 rounded-lg transition-all"
          style={{ background: '#D7FF00', color: '#000', letterSpacing: '0.04em', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {t('btnUploadCall')}
        </a>
      )}
    </div>
  )
}
