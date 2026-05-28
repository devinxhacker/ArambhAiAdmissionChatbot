import { useEffect, useRef, useCallback } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { translateText } from '@/lib/translate'

/**
 * TranslateProvider — Automatically translates ALL visible text on the page
 * when the language changes. Uses Google Translate API.
 *
 * How it works:
 * 1. Observes the DOM for text nodes using MutationObserver
 * 2. When language changes, walks the DOM tree and translates all text nodes
 * 3. Stores original text in a data attribute so it can be restored/re-translated
 * 4. Skips code blocks, scripts, styles, and input values
 *
 * Wrap your app with this component:
 *   <TranslateProvider><App /></TranslateProvider>
 */

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SVG',
  'MATH', 'NOSCRIPT', 'TEMPLATE',
])

const SKIP_CLASSES = ['no-translate', 'notranslate']

function shouldSkip(node) {
  if (!node) return true
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (SKIP_TAGS.has(node.tagName)) return true
    if (SKIP_CLASSES.some(c => node.classList?.contains(c))) return true
    if (node.getAttribute('translate') === 'no') return true
    if (node.isContentEditable) return true
  }
  return false
}

function getTextNodes(root) {
  const nodes = []
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // Skip empty/whitespace-only nodes
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT
        // Skip if parent should be skipped
        if (shouldSkip(node.parentElement)) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    }
  )
  while (walker.nextNode()) {
    nodes.push(walker.currentNode)
  }
  return nodes
}

// Store original text on the element
const ORIGINAL_ATTR = '__original_text__'

export default function TranslateProvider({ children }) {
  const { language } = useLanguageStore()
  const prevLangRef = useRef(language)
  const isTranslatingRef = useRef(false)
  const observerRef = useRef(null)

  const translatePage = useCallback(async (targetLang) => {
    if (isTranslatingRef.current) return
    if (targetLang === 'en') {
      // Restore all original texts
      restoreOriginals()
      return
    }

    isTranslatingRef.current = true

    try {
      const textNodes = getTextNodes(document.body)

      // Batch translate in chunks of 20 for performance
      const CHUNK = 20
      for (let i = 0; i < textNodes.length; i += CHUNK) {
        const chunk = textNodes.slice(i, i + CHUNK)
        const promises = chunk.map(async (node) => {
          const original = node[ORIGINAL_ATTR] || node.textContent
          // Store original
          if (!node[ORIGINAL_ATTR]) {
            node[ORIGINAL_ATTR] = original
          }

          const trimmed = original.trim()
          if (!trimmed || trimmed.length < 2) return // Skip single chars

          // Skip if it's just numbers, symbols, or very short
          if (/^[\d\s.,!?@#$%^&*()_+=\-/\\|<>{}[\]:;"'`~]+$/.test(trimmed)) return

          try {
            const translated = await translateText(trimmed, targetLang)
            if (translated && translated !== trimmed) {
              // Preserve leading/trailing whitespace from original
              const leading = original.match(/^\s*/)[0]
              const trailing = original.match(/\s*$/)[0]
              node.textContent = leading + translated + trailing
            }
          } catch {
            // Keep original on error
          }
        })
        await Promise.all(promises)
      }
    } finally {
      isTranslatingRef.current = false
    }
  }, [])

  const restoreOriginals = useCallback(() => {
    const textNodes = getTextNodes(document.body)
    textNodes.forEach((node) => {
      if (node[ORIGINAL_ATTR]) {
        node.textContent = node[ORIGINAL_ATTR]
      }
    })
  }, [])

  // Translate when language changes
  useEffect(() => {
    if (language === prevLangRef.current) return
    prevLangRef.current = language

    // Small delay to let React finish rendering
    const timer = setTimeout(() => {
      translatePage(language)
    }, 100)

    return () => clearTimeout(timer)
  }, [language, translatePage])

  // Observe DOM mutations to translate new content
  useEffect(() => {
    if (language === 'en') return

    const observer = new MutationObserver((mutations) => {
      if (isTranslatingRef.current) return

      let hasNewText = false
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasNewText = true
          break
        }
        if (mutation.type === 'characterData') {
          hasNewText = true
          break
        }
      }

      if (hasNewText) {
        // Debounce translation of new content
        clearTimeout(observer._timer)
        observer._timer = setTimeout(() => {
          translateNewNodes(language)
        }, 300)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    observerRef.current = observer
    return () => observer.disconnect()
  }, [language])

  // Translate only nodes that haven't been translated yet
  const translateNewNodes = useCallback(async (targetLang) => {
    if (isTranslatingRef.current || targetLang === 'en') return
    isTranslatingRef.current = true

    try {
      const textNodes = getTextNodes(document.body)
      const untranslated = textNodes.filter(node => !node[ORIGINAL_ATTR])

      const CHUNK = 15
      for (let i = 0; i < untranslated.length; i += CHUNK) {
        const chunk = untranslated.slice(i, i + CHUNK)
        await Promise.all(chunk.map(async (node) => {
          const original = node.textContent
          node[ORIGINAL_ATTR] = original

          const trimmed = original.trim()
          if (!trimmed || trimmed.length < 2) return
          if (/^[\d\s.,!?@#$%^&*()_+=\-/\\|<>{}[\]:;"'`~]+$/.test(trimmed)) return

          try {
            const translated = await translateText(trimmed, targetLang)
            if (translated && translated !== trimmed) {
              const leading = original.match(/^\s*/)[0]
              const trailing = original.match(/\s*$/)[0]
              node.textContent = leading + translated + trailing
            }
          } catch { /* keep original */ }
        }))
      }
    } finally {
      isTranslatingRef.current = false
    }
  }, [])

  // Re-translate on route changes (SPA navigation)
  useEffect(() => {
    if (language === 'en') return

    const handleRouteChange = () => {
      setTimeout(() => translatePage(language), 200)
    }

    // Listen for popstate (back/forward) and custom navigation events
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [language, translatePage])

  return children
}
