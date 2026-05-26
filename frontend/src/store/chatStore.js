import { create } from 'zustand'
import { api } from '@/lib/api'

/**
 * Chat store — uses the FastAPI backend's conversation endpoints with NDJSON streaming.
 * Endpoints:
 *   GET  /api/conversations          — list conversations
 *   POST /api/conversations          — create conversation
 *   GET  /api/conversations/:id      — get conversation with messages
 *   DELETE /api/conversations/:id    — delete conversation
 *   POST /api/conversations/:id/ask  — ask (streaming NDJSON)
 */
export const useChatStore = create((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isTyping: false,

  createSession: async () => {
    try {
      const res = await api.post('/api/conversations')
      const session = { _id: res.data.id, title: res.data.title }
      set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionId: session._id,
        messages: [],
      }))
      return session._id
    } catch (err) {
      console.error('Failed to create session', err)
      return null
    }
  },

  loadSessions: async () => {
    try {
      const res = await api.get('/api/conversations')
      // Map backend format to frontend format
      const sessions = res.data.map(c => ({
        _id: c.id,
        title: c.title,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))
      set({ sessions })
    } catch (err) {
      console.error('Failed to load sessions', err)
    }
  },

  loadSession: async (sessionId) => {
    try {
      const res = await api.get(`/api/conversations/${sessionId}`)
      const messages = (res.data.messages || []).map(m => ({
        _id: m.id,
        role: m.role,
        content: m.content,
        sources: m.citations || [],
        confidence: m.confidence,
        createdAt: m.created_at,
      }))
      set({ currentSessionId: sessionId, messages })
    } catch (err) {
      console.error('Failed to load session', err)
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await api.delete(`/api/conversations/${sessionId}`)
      set((state) => ({
        sessions: state.sessions.filter(s => s._id !== sessionId),
        ...(state.currentSessionId === sessionId ? { currentSessionId: null, messages: [] } : {}),
      }))
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  },

  sendMessage: async ({ content, sessionId }) => {
    let activeSid = sessionId || get().currentSessionId
    if (!activeSid) {
      activeSid = await get().createSession()
      if (!activeSid) return
    }

    // Optimistic user message
    const userMsg = {
      tempId: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, userMsg], isTyping: true }))

    // Use NDJSON streaming via fetch (not axios, since we need ReadableStream)
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const url = `${baseUrl}/api/conversations/${activeSid}/ask`

    // Get token from store
    const token = api.defaults.headers.common['Authorization']

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          ...(token ? { Authorization: token } : {}),
        },
        body: JSON.stringify({
          message: content,
          language: localStorage.getItem('i18nextLng') || 'en',
          stream: true,
        }),
      })

      if (!resp.ok) {
        throw new Error(`Backend ${resp.status} ${resp.statusText}`)
      }

      if (!resp.body) {
        throw new Error('Empty response')
      }

      // Add placeholder assistant message
      const assistantMsg = {
        tempId: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        sources: [],
        confidence: null,
        createdAt: new Date().toISOString(),
        pending: true,
      }
      set((state) => ({ messages: [...state.messages, assistantMsg] }))

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let accumulated = ''
      let citations = []
      let confidence = null

      const patchAssistant = (updater) => {
        set((state) => {
          const next = [...state.messages]
          const idx = next.length - 1
          if (idx >= 0 && next[idx].role === 'assistant') {
            next[idx] = updater(next[idx])
          }
          return { messages: next }
        })
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let nl = buf.indexOf('\n')
        while (nl >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (line) {
            try {
              const parsed = JSON.parse(line)
              switch (parsed.type) {
                case 'token':
                  accumulated += parsed.text || ''
                  patchAssistant((m) => ({
                    ...m,
                    content: accumulated,
                    pending: false,
                  }))
                  break
                case 'citations':
                  citations = parsed.citations || []
                  patchAssistant((m) => ({ ...m, sources: citations }))
                  break
                case 'meta':
                  confidence = parsed.confidence
                  patchAssistant((m) => ({
                    ...m,
                    confidence: parsed.confidence,
                    followUps: parsed.follow_ups,
                  }))
                  break
                case 'translation':
                  accumulated = parsed.text || accumulated
                  patchAssistant((m) => ({ ...m, content: accumulated }))
                  break
                case 'error':
                  patchAssistant((m) => ({
                    ...m,
                    content: m.content || 'Sorry, something went wrong.',
                    pending: false,
                  }))
                  break
                case 'done':
                  patchAssistant((m) => ({ ...m, pending: false }))
                  break
              }
            } catch { /* skip malformed lines */ }
          }
          nl = buf.indexOf('\n')
        }
      }

      // Finalize
      patchAssistant((m) => ({ ...m, pending: false }))
      set({ isTyping: false })

      // Refresh sessions list to get updated title
      get().loadSessions()
    } catch (err) {
      console.error('Chat error:', err)
      set((state) => ({
        messages: [
          ...state.messages,
          {
            tempId: `err-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
            createdAt: new Date().toISOString(),
          },
        ],
        isTyping: false,
      }))
    }
  },
}))
