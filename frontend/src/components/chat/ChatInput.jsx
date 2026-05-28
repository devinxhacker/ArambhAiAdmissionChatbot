import { useState, useRef, useCallback } from 'react'
import { Send, Mic, MicOff, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { useLanguageStore } from '@/store/languageStore'
import { cn } from '@/lib/utils'

export default function ChatInput({ onSend, disabled, sessionId }) {
  const [input, setInput] = useState('')
  const [interimText, setInterimText] = useState('')
  const textareaRef = useRef(null)
  const { t } = useTranslation()
  const { language, languages } = useLanguageStore()

  const { isRecording, isSupported, startRecording, stopRecording } = useVoiceInput({
    onTranscript: (text) => {
      setInput((prev) => prev + text)
      setInterimText('')
    },
    onInterim: (text) => setInterimText(text),
  })

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend({ content: trimmed, sessionId })
    setInput('')
    setInterimText('')
    textareaRef.current?.focus()
  }, [input, disabled, onSend, sessionId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const currentLang = languages.find(l => l.code === language)

  return (
    <div className="space-y-2">
      {/* Interim speech text indicator */}
      {isRecording && interimText && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground italic bg-muted/50 dark:bg-gray-800/50 rounded-lg animate-pulse">
          🎤 {interimText}...
        </div>
      )}

      <div className="rounded-2xl border border-white/70 dark:border-gray-800/60 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl p-2 flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.inputPlaceholder')}
            disabled={disabled}
            rows={1}
            className="resize-none min-h-[44px] max-h-32 pr-10 py-3 bg-transparent border-0 focus-visible:ring-0"
          />
        </div>

        {/* Voice Input (Speech-to-Text) */}
        {isSupported && (
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            title={isRecording ? `Stop recording (${currentLang?.nativeLabel || 'English'})` : `Voice input (${currentLang?.nativeLabel || 'English'})`}
            className={cn(isRecording && 'animate-pulse')}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}

        {/* Send */}
        <Button
          type="button"
          size="icon"
          variant="glow"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 text-xs text-red-500 dark:text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>Listening in {currentLang?.nativeLabel || 'English'}... Speak now</span>
        </div>
      )}
    </div>
  )
}
