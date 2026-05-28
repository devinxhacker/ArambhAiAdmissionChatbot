import { useState, useRef, useCallback, useEffect } from 'react'
import { useLanguageStore } from '@/store/languageStore'

/**
 * useTextToSpeech — Text-to-Speech using Piper TTS (self-hosted, free, unlimited).
 *
 * Primary: Piper TTS service (Docker container) — high quality Indian language voices
 * Fallback: Browser SpeechSynthesis — if Piper service is unavailable
 *
 * Piper supports: en, hi, bn, gu, kn, ml, mr, ta, te, ne, pa
 * Fallback handles: ur, as, or (via Hindi/Bengali voices)
 */

const TTS_BASE_URL = import.meta.env.VITE_TTS_BASE_URL || 'http://localhost:8200'

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [piperAvailable, setPiperAvailable] = useState(null) // null = unknown, true/false
  const audioRef = useRef(null)
  const abortRef = useRef(false)
  const { language } = useLanguageStore()

  // Check if Piper TTS service is available
  useEffect(() => {
    fetch(`${TTS_BASE_URL}/health`)
      .then(r => r.ok ? setPiperAvailable(true) : setPiperAvailable(false))
      .catch(() => setPiperAvailable(false))
  }, [])

  /**
   * Speak using Piper TTS service (primary — high quality).
   */
  const speakPiper = useCallback(async (text) => {
    abortRef.current = false
    setIsSpeaking(true)

    try {
      // Split long text into chunks for smoother playback
      const chunks = splitText(text, 500)

      for (const chunk of chunks) {
        if (abortRef.current) break
        if (!chunk.trim()) continue

        const response = await fetch(`${TTS_BASE_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk, language: language || 'en' }),
          signal: AbortSignal.timeout(180000), // 3 min timeout for first-time model download
        })

        if (!response.ok) throw new Error(`TTS failed: ${response.status}`)

        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)

        await new Promise((resolve, reject) => {
          const audio = new Audio(audioUrl)
          audioRef.current = audio
          audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject() }
          audio.play().catch(reject)
        })
      }
    } catch (err) {
      console.warn('Piper TTS failed:', err)
    }

    if (!abortRef.current) setIsSpeaking(false)
    audioRef.current = null
  }, [language])

  /**
   * Speak using browser SpeechSynthesis (fallback).
   */
  const speakBrowser = useCallback((text) => {
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    abortRef.current = false
    setIsSpeaking(true)

    const langMap = {
      en: 'en-IN', hi: 'hi-IN', mr: 'hi-IN', ur: 'hi-IN',
      ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN',
      bn: 'bn-IN', gu: 'gu-IN', pa: 'hi-IN', or: 'hi-IN', as: 'bn-IN',
    }

    const chunks = splitText(text, 280)
    let index = 0

    const speakNext = () => {
      if (abortRef.current || index >= chunks.length) {
        setIsSpeaking(false)
        return
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index])
      utterance.lang = langMap[language] || 'en-IN'
      utterance.rate = 1.0
      utterance.onend = () => { index++; speakNext() }
      utterance.onerror = () => { index++; speakNext() }
      window.speechSynthesis.speak(utterance)
    }

    speakNext()
  }, [language])

  /**
   * Main speak function — uses Piper if available, else browser fallback.
   */
  const speak = useCallback((text) => {
    if (!text) return

    if (piperAvailable) {
      speakPiper(text)
    } else {
      speakBrowser(text)
    }
  }, [piperAvailable, speakPiper, speakBrowser])

  const stop = useCallback(() => {
    abortRef.current = true
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  const toggle = useCallback((text) => {
    if (isSpeaking) {
      stop()
    } else {
      speak(text)
    }
  }, [isSpeaking, speak, stop])

  return { isSpeaking, isSupported: true, speak, stop, toggle }
}

/**
 * Split text into chunks at sentence boundaries.
 */
function splitText(text, maxLen = 500) {
  if (!text) return []
  if (text.length <= maxLen) return [text]

  const chunks = []
  const sentences = text.split(/(?<=[.!?।॥\n])\s+/)
  let current = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxLen) {
      if (current) chunks.push(current.trim())
      if (sentence.length > maxLen) {
        const parts = sentence.split(/(?<=[,;،])\s+/)
        let sub = ''
        for (const part of parts) {
          if ((sub + ' ' + part).length > maxLen) {
            if (sub) chunks.push(sub.trim())
            sub = part
          } else {
            sub = sub ? sub + ' ' + part : part
          }
        }
        current = sub || ''
      } else {
        current = sentence
      }
    } else {
      current = current ? current + ' ' + sentence : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
