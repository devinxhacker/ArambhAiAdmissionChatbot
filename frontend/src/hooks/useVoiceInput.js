import { useState, useRef, useCallback } from 'react'
import { aiApi } from '@/lib/api'

/**
 * useVoiceInput — records audio via MediaRecorder and sends to Whisper endpoint.
 * @param {Object} options
 * @param {Function} options.onTranscript - called with the transcribed text
 */
export function useVoiceInput({ onTranscript }) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        formData.append('language', localStorage.getItem('i18nextLng') || 'en')

        try {
          const res = await aiApi.post('/speech/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          onTranscript(res.data.text)
        } catch (err) {
          console.error('Transcription failed', err)
        }

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone access denied', err)
    }
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  return { isRecording, startRecording, stopRecording }
}
