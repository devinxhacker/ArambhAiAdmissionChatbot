import { useState, useRef, useCallback } from 'react'
import { Send, Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTranslation } from 'react-i18next'
import { useVoiceInput } from '@/hooks/useVoiceInput'
import { cn } from '@/lib/utils'

export default function ChatInput({ onSend, disabled, sessionId }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)
  const { t } = useTranslation()
  const { isRecording, startRecording, stopRecording } = useVoiceInput({
    onTranscript: (text) => setInput((prev) => prev + text),
  })

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend({ content: trimmed, sessionId })
    setInput('')
    textareaRef.current?.focus()
  }, [input, disabled, onSend, sessionId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-2xl border border-white/70 bg-white/70 backdrop-blur-xl p-2 flex items-end gap-2">
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

      {/* Voice Input */}
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        title={isRecording ? 'Stop recording' : 'Voice input'}
      >
        {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

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
  )
}
