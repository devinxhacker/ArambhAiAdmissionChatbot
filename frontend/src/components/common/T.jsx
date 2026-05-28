import { useEffect, useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { translateText } from '@/lib/translate'

/**
 * <T> — Translation component.
 *
 * Wraps any text and automatically translates it to the selected language.
 * Uses Google Translate API with caching.
 *
 * Usage:
 *   <T>Hello World</T>
 *   <T text="Welcome to our platform" />
 *   <h1><T>Admission Chat</T></h1>
 *
 * For attributes (placeholder, title, etc.), use the useT() hook instead.
 */
export default function T({ children, text }) {
  const { language } = useLanguageStore()
  const originalText = text || (typeof children === 'string' ? children : null)
  const [translated, setTranslated] = useState(originalText)

  useEffect(() => {
    if (!originalText || language === 'en') {
      setTranslated(originalText)
      return
    }

    let cancelled = false
    translateText(originalText, language).then((result) => {
      if (!cancelled) setTranslated(result)
    })

    return () => { cancelled = true }
  }, [originalText, language])

  // If children is not a simple string, render as-is
  if (!originalText) return children || null

  return translated || originalText
}

/**
 * useT() hook — for translating strings in attributes, variables, etc.
 *
 * Usage:
 *   const t = useT()
 *   <input placeholder={t('Search colleges...')} />
 *   <Button>{t('Submit')}</Button>
 */
export function useT() {
  const { language } = useLanguageStore()
  const [cache, setCache] = useState({})

  const t = (text) => {
    if (!text || language === 'en') return text
    if (cache[text]) return cache[text]

    // Trigger translation async
    translateText(text, language).then((result) => {
      if (result !== text) {
        setCache((prev) => ({ ...prev, [text]: result }))
      }
    })

    return text // Return original until translation arrives
  }

  // Reset cache when language changes
  useEffect(() => {
    setCache({})
  }, [language])

  return t
}
