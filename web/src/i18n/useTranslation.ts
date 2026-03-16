import { useStore } from '../store'
import { zh, en } from './index'

const translations: Record<string, Record<string, string>> = { zh, en }

export function useTranslation() {
  const language = useStore((state) => state.language)
  const setLanguage = useStore((state) => state.setLanguage)

  const t = (key: string): string => {
    const langTranslations = translations[language]
    if (!langTranslations) {
      console.warn('[i18n] No translations found for language:', language)
      return key
    }
    const result = langTranslations[key]
    if (!result) {
      console.warn('[i18n] No translation found for key:', key, 'in language:', language)
    }
    return result || translations.zh[key] || key
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
