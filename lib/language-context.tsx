'use client'

import { createContext, useContext, useState } from 'react'
import { translations, type TranslationKey } from './translations'

type Lang = 'ar' | 'en'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'ar'
    const stored = localStorage.getItem('sp_lang') as Lang | null
    return (stored === 'en' || stored === 'ar') ? stored : 'ar'
  })

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('sp_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useT() {
  const { lang } = useLanguage()
  return (key: TranslationKey): string => translations[lang][key]
}
