import { Link, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  Upload,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Plus,
  UserCircle,
} from 'lucide-react'
import { useSidebarStore } from '@/store/sidebarStore'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Sidebar() {
  const { isOpen, toggle } = useSidebarStore()
  const { sessions, createSession } = useChatStore()
  const { user } = useAuthStore()
  const location = useLocation()

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  // Build nav items — admin link only visible to admins
  const navItems = [
    { icon: MessageSquare, label: 'Chat', href: '/chat' },
    { icon: Upload, label: 'Upload', href: '/upload' },
    ...(user?.role === 'admin'
      ? [{ icon: LayoutDashboard, label: 'Admin', href: '/admin' }]
      : []),
  ]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white/80 border-r border-white/70 backdrop-blur-xl flex flex-col transition-all duration-300 z-40',
        isOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo & Toggle */}
      <div className="flex items-center justify-between p-4 h-16 border-b border-white/70 shrink-0">
        {isOpen && (
          <span className="font-bold text-primary truncate">AdmissionAI</span>
        )}
        <Button variant="ghost" size="icon" onClick={toggle} className="ml-auto shrink-0">
          {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-2 shrink-0">
        <Button
          onClick={createSession}
          className={cn('w-full', !isOpen && 'px-0')}
          variant="outline"
          size={isOpen ? 'default' : 'icon'}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {isOpen && <span className="ml-2">New Chat</span>}
        </Button>
      </div>

      {/* Nav Items */}
      <nav className="p-2 space-y-1 shrink-0">
        {navItems.map(({ icon: Icon, label, href }) => (
          <Link key={href} to={href}>
            <Button
              variant={location.pathname.startsWith(href) ? 'secondary' : 'ghost'}
              className={cn('w-full justify-start', !isOpen && 'px-0 justify-center')}
              size={isOpen ? 'default' : 'icon'}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {isOpen && <span className="ml-2">{label}</span>}
            </Button>
          </Link>
        ))}
      </nav>

      <Separator className="bg-white/70" />

      {/* Chat History */}
      {isOpen && (
        <ScrollArea className="flex-1 p-2">
          <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">
            Recent Chats
          </p>
          <div className="space-y-1 mt-1">
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">No conversations yet.</p>
            )}
            {sessions.map((session) => (
              <Link key={session._id} to={`/chat/${session._id}`}>
                <Button
                  variant={location.pathname === `/chat/${session._id}` ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-left h-auto py-2"
                  size="sm"
                >
                  <span className="truncate text-xs">{session.title || 'New conversation'}</span>
                </Button>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* User Info + Profile Link */}
      <div
        className={cn(
          'p-3 border-t border-white/70 flex items-center gap-2 shrink-0',
          !isOpen && 'justify-center'
        )}
      >
        <Link to="/profile" className="flex items-center gap-2 min-w-0 flex-1 group">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user?.profileImage} alt={user?.name} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isOpen && (
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
        </Link>
        {isOpen && (
          <Link to="/profile" tabIndex={-1}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Profile">
              <UserCircle className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </aside>
  )
}
