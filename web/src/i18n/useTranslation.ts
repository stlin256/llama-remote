import { useStore } from '../store'
import { zh, en, TranslationKey } from './index'

const translations = { zh, en }

export function useTranslation() {
  const language = useStore((state) => (state as any).language || 'zh')
  const setLanguage = useStore((state) => (state as any).setLanguage)

  const t = (key: TranslationKey): string => {
    return translations[language as keyof typeof translations]?.[key] || translations.zh[key] || key
  }

  return { t, language, setLanguage }
}

// Get browser language
export function getBrowserLanguage(): 'zh' | 'en' {
  const browserLang = navigator.language || (navigator as any).userLanguage || 'en'

  // Check for Chinese
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }

  return 'en'
}
