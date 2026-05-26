import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { useChatStore } from '@/store/chatStore'

/**
 * MainLayout — used for the user-facing app (chat, profile, upload).
 * No sidebar here — ChatPage has its own inline sidebar.
 * Chat page needs overflow-hidden (it manages its own scroll), other pages scroll normally.
 */
export default function MainLayout() {
  const { loadSessions } = useChatStore()
  const location = useLocation()

  useEffect(() => { loadSessions() }, [loadSessions])

  const isChatPage = location.pathname.startsWith('/chat')

  return (
    <div className="flex flex-col h-screen bg-white/60">
      <Header />
      <main className={`flex-1 ${isChatPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Outlet />
      </main>
    </div>
  )
}
