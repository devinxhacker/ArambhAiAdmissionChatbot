import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Menu, X, Moon, Sun, Sparkles, ArrowRight, Globe } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useLanguageStore } from '@/store/languageStore'
import { Button } from '@/components/ui/button'
import { Outlet } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { useLenis } from '@/hooks/useLenis'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated, user } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { language, setLanguage, languages } = useLanguageStore()
  const navigate = useNavigate()
  useLenis()

  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.2 })

  const dashboardHref = user?.role === 'superadmin' ? '/superadmin' : user?.role === 'admin' ? '/admin' : '/chat'

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-white/70 dark:bg-gray-950/80 backdrop-blur-xl">
        <motion.div
          style={{ scaleX }}
          className="absolute bottom-0 left-0 right-0 h-[2px] origin-left bg-gradient-to-r from-indigo-500 via-blue-500 to-pink-500"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-glow">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight">AdmissionAI</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">
                <Sparkles className="h-3 w-3" /> Student OS
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {[
                { label: 'Home', href: '/' },
                { label: 'Colleges', href: '/colleges' },
                { label: 'Guidance', href: '/guidance' },
                { label: 'AI Chat', href: '/chat' },
              ].map((item) => (
                <Link key={item.href} to={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2">
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" title="Language">
                    <Globe className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <ScrollArea className="max-h-72">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={language === lang.code ? 'bg-accent font-medium' : ''}
                      >
                        <span className="notranslate">{lang.nativeLabel}</span>
                        <span className="text-xs text-muted-foreground ml-auto notranslate">{lang.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {isAuthenticated ? (
                <Button onClick={() => navigate(dashboardHref)} className="shadow-soft">Dashboard</Button>
              ) : (
                <>
                  <Button variant="ghost" asChild><Link to="/login">Sign In</Link></Button>
                  <Button variant="glow" asChild>
                    <Link to="/register">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(o => !o)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-white/80 dark:bg-gray-950/90 backdrop-blur-xl px-4 py-4 space-y-2">
            {[
              { label: 'Home', href: '/' },
              { label: 'Colleges', href: '/colleges' },
              { label: 'Guidance', href: '/guidance' },
              { label: 'AI Chat', href: '/chat' },
            ].map((item) => (
              <Link key={item.href} to={item.href} className="block py-2 text-sm" onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="pt-2 flex gap-2">
              {isAuthenticated ? (
                <Button className="w-full" onClick={() => { navigate(dashboardHref); setMobileOpen(false) }}>Dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1" asChild><Link to="/login">Sign In</Link></Button>
                  <Button className="flex-1" asChild><Link to="/register">Get Started</Link></Button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <div className="pt-16">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl mt-20">
        <div className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-glow">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-lg">AdmissionAI</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm">
              A student-first admission companion that blends AI guidance, verified college data, and decision-ready tools.
            </p>
          </div>
          <div>
            <p className="font-medium text-sm mb-3">Platform</p>
            <div className="space-y-2">
              <Link to="/colleges" className="block text-sm text-muted-foreground hover:text-foreground">Colleges</Link>
              <Link to="/chat" className="block text-sm text-muted-foreground hover:text-foreground">AI Chat</Link>
              <Link to="/compare" className="block text-sm text-muted-foreground hover:text-foreground">Compare</Link>
              <Link to="/guidance" className="block text-sm text-muted-foreground hover:text-foreground">Guidance</Link>
            </div>
          </div>
          <div>
            <p className="font-medium text-sm mb-3">Account</p>
            <div className="space-y-2">
              <Link to="/login" className="block text-sm text-muted-foreground hover:text-foreground">Sign In</Link>
              <Link to="/register" className="block text-sm text-muted-foreground hover:text-foreground">Register</Link>
              <span className="block text-sm text-muted-foreground">Privacy Policy</span>
              <span className="block text-sm text-muted-foreground">Terms of Service</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60 px-4 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AdmissionAI. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
