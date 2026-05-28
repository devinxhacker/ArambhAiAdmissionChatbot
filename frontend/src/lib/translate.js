/**
 * Google Translate API integration for full-page translation.
 * Uses the free translate.googleapis.com endpoint.
 *
 * Translates text from English to any target language.
 * Includes caching to avoid redundant API calls.
 */

const CACHE = new Map()
const BATCH_DELAY = 50 // ms to batch requests
let pendingTexts = []
let pendingResolvers = []
let batchTimer = null

/**
 * Translate a single text string using Google Translate API.
 * Results are cached in memory.
 */
export async function translateText(text, targetLang) {
  if (!text || !text.trim() || targetLang === 'en') return text

  const cacheKey = `${targetLang}:${text}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  return new Promise((resolve) => {
    pendingTexts.push(text)
    pendingResolvers.push({ text, targetLang, resolve, cacheKey })

    if (batchTimer) clearTimeout(batchTimer)
    batchTimer = setTimeout(() => flushBatch(targetLang), BATCH_DELAY)
  })
}

/**
 * Batch translate multiple texts at once for efficiency.
 */
async function flushBatch(targetLang) {
  const texts = [...pendingTexts]
  const resolvers = [...pendingResolvers]
  pendingTexts = []
  pendingResolvers = []
  batchTimer = null

  if (texts.length === 0) return

  try {
    const results = await batchTranslate(texts, targetLang)
    resolvers.forEach((r, i) => {
      const translated = results[i] || r.text
      CACHE.set(r.cacheKey, translated)
      r.resolve(translated)
    })
  } catch (err) {
    // On error, return original texts
    resolvers.forEach((r) => r.resolve(r.text))
  }
}

/**
 * Call Google Translate API with multiple texts.
 * Uses the free endpoint: translate.googleapis.com
 */
async function batchTranslate(texts, targetLang) {
  // Google Translate free API accepts multiple 'q' params
  const params = new URLSearchParams()
  params.append('client', 'gtx')
  params.append('sl', 'en')
  params.append('tl', targetLang)
  params.append('dt', 't')

  // For batch, we join with a separator and split after
  // The free API handles one text at a time best, so we chunk
  const CHUNK_SIZE = 10
  const results = []

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunk.map(text => translateSingle(text, targetLang))
    )
    results.push(...chunkResults)
  }

  return results
}

/**
 * Translate a single text via Google Translate free API.
 */
async function translateSingle(text, targetLang) {
  const cacheKey = `${targetLang}:${text}`
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey)

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`

    const response = await fetch(url)
    if (!response.ok) return text

    const data = await response.json()

    // Response format: [[["translated text","original text",null,null,X],...],...]
    let translated = ''
    if (data && data[0]) {
      for (const segment of data[0]) {
        if (segment[0]) translated += segment[0]
      }
    }

    if (translated) {
      CACHE.set(cacheKey, translated)
      return translated
    }
    return text
  } catch {
    return text
  }
}

/**
 * Translate multiple texts at once (convenience wrapper).
 */
export async function translateBatch(texts, targetLang) {
  if (targetLang === 'en') return texts
  return Promise.all(texts.map(t => translateText(t, targetLang)))
}

/**
 * Clear the translation cache (useful when switching languages).
 */
export function clearTranslationCache() {
  CACHE.clear()
}

/**
 * All supported Indian languages.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'Assamese', nativeLabel: 'অসমীয়া' },
]
