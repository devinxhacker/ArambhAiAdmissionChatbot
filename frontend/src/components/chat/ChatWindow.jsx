import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import TypingIndicator from './TypingIndicator'
import { useChatStore } from '@/store/chatStore'
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'

export default function ChatWindow({ sessionId }) {
  const { messages, isTyping, sendMessage } = useChatStore()
  const bottomRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">AdmissionAI Chat</p>
              <p className="text-xs text-muted-foreground">Ask anything about admissions</p>
            </div>
          </div>
          <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Online</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">{t('chat.welcome')}</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {t('chat.welcomeSubtitle')}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg._id || msg.tempId} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-white/70 bg-white/70 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSend={sendMessage} disabled={isTyping} sessionId={sessionId} />
        </div>
      </div>
    </div>
  )
}
