import { useState, useRef, useCallback, useEffect } from 'react'
import { useLanguageStore } from '@/store/languageStore'

/**
 * useVoiceInput — Speech-to-Text using the Web Speech API (SpeechRecognition).
 *
 * Completely free, unlimited, works offline in Chrome/Edge.
 * Supports all Indian languages via BCP-47 language codes.
 *
 * @param {Object} options
 * @param {Function} options.onTranscript - called with the transcribed text
 * @param {Function} [options.onInterim] - called with interim (partial) results
 */

// Language code mapping for Web Speech API (BCP-47 format)
const SPEECH_LANG_MAP = {
  en: 'en-IN',    // English (India)
  hi: 'hi-IN',    // Hindi
  mr: 'mr-IN',    // Marathi
  ur: 'ur-PK',    // Urdu
  ta: 'ta-IN',    // Tamil
  te: 'te-IN',    // Telugu
  kn: 'kn-IN',    // Kannada
  ml: 'ml-IN',    // Malayalam
  bn: 'bn-IN',    // Bengali
  gu: 'gu-IN',    // Gujarati
  pa: 'pa-IN',    // Punjabi
  or: 'or-IN',    // Odia
  as: 'as-IN',    // Assamese (fallback to bn-IN if not supported)
}

export function useVoiceInput({ onTranscript, onInterim }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef(null)
  const { language } = useLanguageStore()

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognition)
  }, [])

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    // Configure
    recognition.lang = SPEECH_LANG_MAP[language] || 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
          onTranscript(transcript + ' ')
        } else {
          interim += transcript
        }
      }
      if (onInterim && interim) {
        onInterim(interim)
      }
    }

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      if (event.error !== 'no-speech') {
        setIsRecording(false)
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    try {
      recognition.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start speech recognition:', err)
    }
  }, [language, onTranscript, onInterim])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
  }, [])

  return { isRecording, isSupported, startRecording, stopRecording }
}
