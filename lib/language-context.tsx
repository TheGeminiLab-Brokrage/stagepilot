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

export function LanguageProvider({ children, initialLang }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? 'ar')

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('sp_lang', l)
    document.cookie = `sp_lang=${l}; path=/; max-age=31536000; samesite=lax`
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
