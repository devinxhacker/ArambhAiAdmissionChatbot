import { useEffect, useRef } from 'react'
import { useLanguageStore } from '@/store/languageStore'

/**
 * GoogleTranslateProvider
 *
 * Injects the Google Translate script and auto-translates the entire page
 * when the user selects a language from the language store.
 *
 * This translates ALL text on ALL pages — headings, paragraphs, buttons,
 * labels, placeholders, tooltips — everything visible to the user.
 *
 * Place this component once at the root of your app (e.g., in App.jsx).
 */
export default function GoogleTranslateProvider() {
  const { language } = useLanguageStore()
  const initialized = useRef(false)

  useEffect(() => {
    // Inject the Google Translate script once
    if (!initialized.current) {
      // Create the hidden google translate element
      const div = document.createElement('div')
      div.id = 'google_translate_element'
      div.style.display = 'none'
      document.body.appendChild(div)

      // Define the callback
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi,mr,ur,ta,te,kn,ml,bn,gu,pa,or,as',
            autoDisplay: false,
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          },
          'google_translate_element'
        )
      }

      // Load the script
      const script = document.createElement('script')
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
      script.async = true
      document.body.appendChild(script)

      initialized.current = true
    }
  }, [])

  // When language changes, trigger Google Translate
  useEffect(() => {
    if (!initialized.current) return

    const triggerTranslation = () => {
      const select = document.querySelector('.goog-te-combo')
      if (select) {
        if (language === 'en') {
          // Reset to original
          select.value = ''
          select.dispatchEvent(new Event('change'))
          // Also try the restore function
          const frame = document.querySelector('.goog-te-banner-frame')
          if (frame) {
            const closeBtn = frame.contentDocument?.querySelector('.goog-close-link')
            if (closeBtn) closeBtn.click()
          }
          // Cookie-based restore
          document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
          document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.' + window.location.hostname
          window.location.reload()
        } else {
          select.value = language
          select.dispatchEvent(new Event('change'))
        }
      } else {
        // Script not ready yet, retry
        setTimeout(triggerTranslation, 500)
      }
    }

    // Small delay to ensure Google Translate widget is ready
    setTimeout(triggerTranslation, 300)
  }, [language])

  return null
}
