'use client'

import { useT } from '@/lib/language-context'
import type { TranslationKey } from '@/lib/translations'

export default function AdminSectionTitle({
  titleKey,
  count,
  subtitleKey,
  subtitleColor,
  headingLevel = 'h1',
  headingClass = 'text-xl font-semibold text-white',
}: {
  titleKey: TranslationKey
  count?: number
  subtitleKey?: TranslationKey
  subtitleColor?: string
  headingLevel?: 'h1' | 'h2'
  headingClass?: string
}) {
  const t = useT()
  const Tag = headingLevel
  return (
    <div>
      <Tag className={headingClass}>{t(titleKey)}</Tag>
      {subtitleKey && (
        <p className="text-sm mt-0.5" style={{ color: subtitleColor ?? 'rgb(107,114,128)' }}>
          {count !== undefined ? `${count} ` : ''}{t(subtitleKey)}
        </p>
      )}
    </div>
  )
}
