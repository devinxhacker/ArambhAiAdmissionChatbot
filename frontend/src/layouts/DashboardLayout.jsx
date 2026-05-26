import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Users, Building2, BarChart3, Upload,
  LogOut, ChevronLeft, ChevronRight, Bell,
  GraduationCap, HelpCircle, Globe, Shield,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/hooks/useToast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Nav config per role ──────────────────────────────────────────────────────
const superadminNav = [
  { icon: LayoutDashboard, label: 'Dashboard',  href: '/superadmin' },
  { icon: Building2,       label: 'Colleges',   href: '/superadmin/colleges' },
  { icon: Shield,          label: 'Admins',     href: '/superadmin/admins' },
  { icon: Users,           label: 'Users',      href: '/superadmin/users' },
  { icon: BarChart3,       label: 'Analytics',  href: '/superadmin/analytics' },
]

const adminNav = [
  { icon: LayoutDashboard, label: 'Dashboard',    href: '/admin' },
  { icon: Building2,       label: 'My College',   href: '/admin/college' },
  { icon: Upload,          label: 'Upload Files', href: '/admin/uploads' },
  { icon: HelpCircle,      label: 'FAQs',         href: '/admin/faqs' },
  { icon: Globe,           label: 'Website URLs', href: '/admin/urls' },
  { icon: BarChart3,       label: 'Analytics',    href: '/admin/analytics' },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function DashboardSidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuthStore()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const isSuperAdmin = user?.role === 'superadmin'
  const navItems = isSuperAdmin ? superadminNav : adminNav
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'A'

  const handleLogout = async () => {
    await logout()
    toast({ title: 'Signed out' })
    navigate('/login', { replace: true })
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-white/80 border-r border-white/70 backdrop-blur-xl flex flex-col z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/70 shrink-0">
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm truncate">AdmissionAI</span>
          </motion.div>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="shrink-0 ml-auto">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-b border-white/70">
          <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {isSuperAdmin ? 'Super Admin' : 'Admin'}
          </Badge>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, href }) => {
          const exact = href === '/admin' || href === '/superadmin'
          const active = exact ? location.pathname === href : location.pathname.startsWith(href)
          return (
            <Link key={href} to={href}>
              <motion.div
                whileHover={{ x: 2 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-soft'
                    : 'text-muted-foreground hover:bg-white/70 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </motion.div>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/70 shrink-0">
        <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
          <Link to="/profile">
            <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
              <AvatarImage src={user?.profileImage} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
function DashboardTopbar() {
  const { user } = useAuthStore()
  const location = useLocation()

  const allNav = [...superadminNav, ...adminNav]
  const current = allNav.find(n => {
    const exact = n.href === '/admin' || n.href === '/superadmin'
    return exact ? location.pathname === n.href : location.pathname.startsWith(n.href)
  })
  const title = current?.label || 'Dashboard'

  return (
    <header className="h-16 border-b border-white/70 bg-white/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <Link to="/profile">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarImage src={user?.profileImage} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {user?.name?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-white/60">
      <DashboardSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-all duration-300"
        style={{ marginLeft: collapsed ? 72 : 256 }}
      >
        <DashboardTopbar />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
