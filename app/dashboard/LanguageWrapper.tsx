'use client'

import { LanguageProvider, useLanguage } from '@/lib/language-context'

function Inner({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage()
  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="flex flex-col"
      style={{ height: '100vh', background: '#000', fontFamily: "'Montserrat', sans-serif" }}
    >
      {children}
    </div>
  )
}

export default function LanguageWrapper({ children, initialLang }: { children: React.ReactNode; initialLang?: 'ar' | 'en' }) {
  return (
    <LanguageProvider initialLang={initialLang}>
      <Inner>{children}</Inner>
    </LanguageProvider>
  )
}
