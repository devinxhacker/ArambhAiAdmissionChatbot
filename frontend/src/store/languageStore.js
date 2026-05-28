import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { translateText, clearTranslationCache, SUPPORTED_LANGUAGES } from '@/lib/translate'

/**
 * Language store — manages the selected language and provides
 * a translation function that uses Google Translate API.
 *
 * Usage in components:
 *   const { language, t } = useLanguageStore()
 *   <span>{t('Hello World')}</span>  // auto-translates if language != 'en'
 */
export const useLanguageStore = create(
  persist(
    (set, get) => ({
      language: 'en',
      isTranslating: false,
      translations: {}, // { "en_text": "translated_text" }

      setLanguage: (lang) => {
        if (lang === get().language) return
        clearTranslationCache()
        set({ language: lang, translations: {} })
      },

      /**
       * Translate a text string. Returns the cached translation if available,
       * otherwise returns the original and triggers async translation.
       */
      t: (text) => {
        const { language, translations } = get()
        if (!text || language === 'en') return text
        if (translations[text]) return translations[text]
        // Trigger async translation (non-blocking)
        translateText(text, language).then((translated) => {
          if (translated !== text) {
            set((state) => ({
              translations: { ...state.translations, [text]: translated },
            }))
          }
        })
        return text // Return original until translation arrives
      },

      /**
       * Get all supported languages.
       */
      languages: SUPPORTED_LANGUAGES,
    }),
    {
      name: 'language-storage',
      partialize: (state) => ({ language: state.language }),
    }
  )
)
