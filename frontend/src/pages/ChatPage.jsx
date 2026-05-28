import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus, MessageSquare, BarChart3, GraduationCap, ChevronLeft, ChevronRight,
  Sparkles, Trash2, MoreHorizontal, Pencil,
} from 'lucide-react'
import ChatWindow from '@/components/chat/ChatWindow'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTED = [
  'What are the top engineering colleges in India?',
  'Compare IIT Delhi vs IIT Bombay',
  'What is the admission process for MBA?',
  'Which colleges accept JEE Main scores?',
  'Tell me about scholarship opportunities',
]

// ─── Chat sidebar ─────────────────────────────────────────────────────────────
function ChatSidebar({ collapsed, onToggle }) {
  const { sessions, createSession, loadSessions, deleteSession } = useChatStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => { loadSessions() }, [])

  const handleNew = async () => {
    const id = await createSession()
    if (id) navigate(`/chat/${id}`)
  }

  const handleDelete = async (e, sid) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    await deleteSession(sid)
    if (sessionId === sid) {
      navigate('/chat', { replace: true })
    }
  }

  const handleRename = async (e, sid) => {
    if (e) { e.preventDefault(); e.stopPropagation() }
    const currentTitle = sessions.find(s => s._id === sid)?.title || ''
    const newTitle = prompt('Rename chat:', currentTitle)
    if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
      try {
        await api.patch(`/api/conversations/${sid}/title`, { title: newTitle.trim() })
        loadSessions()
      } catch { /* ignore */ }
    }
  }

  const sidebarLinks = [
    { icon: BarChart3,     label: 'College Comparison',  href: '/compare'  },
    { icon: Sparkles,      label: 'Admission Guidance',  href: '/guidance' },
    { icon: GraduationCap, label: 'Browse Colleges',     href: '/colleges' },
  ]

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 260 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="flex flex-col h-full bg-white/80 dark:bg-gray-950/80 border-r border-white/70 dark:border-gray-800/60 backdrop-blur-xl shrink-0 overflow-visible"
    >
      {/* Header */}
      <div className="flex items-center h-14 px-3 border-b border-white/70 dark:border-gray-800/60 shrink-0">
        {!collapsed && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-sm text-primary flex-1">
            AdmissionAI
          </motion.span>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="shrink-0 ml-auto h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat */}
      <div className="p-2 shrink-0">
        <Button
          onClick={handleNew}
          variant="glow"
          className={cn('w-full', collapsed && 'px-0 justify-center')}
          size={collapsed ? 'icon' : 'default'}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">New Chat</span>}
        </Button>
      </div>

      {/* Nav links */}
      <nav className="px-2 space-y-1 shrink-0">
        {sidebarLinks.map(({ icon: Icon, label, href }) => (
          <Link key={href} to={href}>
            <motion.div
              whileHover={{ x: 2 }}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/70 transition-colors cursor-pointer',
                collapsed && 'justify-center px-0'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </motion.div>
          </Link>
        ))}
      </nav>

      <Separator className="my-2 bg-white/60" />

      {/* Chat history */}
      {!collapsed && (
        <ScrollArea className="flex-1 px-2">
          <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">
            Recent Chats
          </p>
          <div className="space-y-0.5 mt-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-3">No conversations yet.</p>
            )}
            {sessions.map(session => (
              <div
                key={session._id}
                className={cn(
                  'flex items-center gap-2 px-2 py-2 rounded-xl text-xs cursor-pointer transition-colors',
                  sessionId === session._id
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium'
                    : 'text-muted-foreground hover:bg-white/10 hover:text-foreground'
                )}
                onClick={() => navigate(`/chat/${session._id}`)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({ x: e.clientX, y: e.clientY, sessionId: session._id })
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{session.title || 'New chat'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setContextMenu({ x: e.clientX, y: e.clientY, sessionId: session._id })
                  }}
                  className="p-0.5 rounded hover:bg-white/20 shrink-0"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Context menu (portal-rendered) */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-[9999]"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="absolute bg-popover border border-border rounded-lg shadow-lg py-1 w-40 z-[9999]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
              onClick={() => {
                const sid = contextMenu.sessionId
                setContextMenu(null)
                const currentTitle = sessions.find(s => s._id === sid)?.title || ''
                const newTitle = prompt('Rename chat:', currentTitle)
                if (newTitle && newTitle.trim() && newTitle !== currentTitle) {
                  api.patch(`/api/conversations/${sid}/title`, { title: newTitle.trim() }).then(() => loadSessions())
                }
              }}
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-950 text-red-600 transition-colors text-left"
              onClick={() => {
                const sid = contextMenu.sessionId
                setContextMenu(null)
                handleDelete(null, sid)
              }}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* User */}
      <div className={cn('p-3 border-t border-white/70 dark:border-gray-800/60 shrink-0 flex items-center gap-2', collapsed && 'justify-center')}>
        <Link to="/profile">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        )}
      </div>
    </motion.aside>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ onPrompt }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="h-16 w-16 rounded-2xl bg-indigo-500/15 flex items-center justify-center mb-5"
      >
        <GraduationCap className="h-8 w-8 text-indigo-500" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-2xl font-semibold mb-2"
      >
        Your admission assistant is ready
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-muted-foreground mb-8 max-w-sm"
      >
        Ask about courses, fees, deadlines, or get a personalized shortlist tailored to you.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid sm:grid-cols-2 gap-2 w-full max-w-lg"
      >
        {SUGGESTED.map((prompt, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onPrompt(prompt)}
            className="text-left p-3 rounded-xl border border-white/70 dark:border-gray-700/60 bg-white/80 dark:bg-gray-800/60 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-white dark:hover:bg-gray-800 text-sm transition-colors"
          >
            {prompt}
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { loadSession, currentSessionId, messages, sendMessage, createSession, deleteSession } = useChatStore()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      loadSession(sessionId)
    }
  }, [sessionId, currentSessionId, loadSession])

  const handleSuggestedPrompt = async (prompt) => {
    let sid = sessionId || currentSessionId
    if (!sid) {
      sid = await createSession()
      if (sid) navigate(`/chat/${sid}`, { replace: true })
    }
    sendMessage({ content: prompt, sessionId: sid })
  }

  const showWelcome = !sessionId && messages.length === 0

  return (
    <div className="flex h-full overflow-hidden bg-white/60 dark:bg-gray-950/60">
      <ChatSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showWelcome ? (
          <WelcomeScreen onPrompt={handleSuggestedPrompt} />
        ) : (
          <ChatWindow sessionId={sessionId || currentSessionId} />
        )}
      </div>
    </div>
  )
}
