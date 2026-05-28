import { Moon, Sun, Monitor, LogOut, Globe, UserCircle, Shield, Settings, Home, MessageSquare, Check } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { useLanguageStore } from '@/store/languageStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export default function Header() {
  const { theme, setTheme } = useThemeStore()
  const { logout, user } = useAuthStore()
  const { language, setLanguage, languages } = useLanguageStore()
  const { toast } = useToast()
  const navigate = useNavigate()

  const themeIcons = { light: Sun, dark: Moon, system: Monitor }
  const ThemeIcon = themeIcons[theme] || Monitor

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const handleLogout = async () => {
    await logout()
    toast({ title: 'Signed out', description: 'See you next time!' })
    navigate('/login', { replace: true })
  }

  const handleLanguageChange = (code) => {
    setLanguage(code)
    const lang = languages.find(l => l.code === code)
    if (lang && code !== 'en') {
      toast({ title: `Language: ${lang.nativeLabel}`, description: 'Translating page...' })
    }
  }

  const currentLang = languages.find(l => l.code === language)

  return (
    <header className="h-16 border-b border-white/70 dark:border-gray-800/60 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
          <Home className="h-4 w-4" /> <span className="notranslate">Home</span>
        </Link>
        <Link to="/chat" className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
          <MessageSquare className="h-4 w-4" /> <span className="notranslate">Chat</span>
        </Link>
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <Link to={user?.role === 'superadmin' ? '/superadmin' : '/admin'} className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <Shield className="h-4 w-4" /> <span className="notranslate">Dashboard</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" title="Language" className="gap-1.5 px-2.5">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium hidden sm:inline notranslate">
                {currentLang?.nativeLabel || 'EN'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Select Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-72">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    'flex items-center justify-between cursor-pointer',
                    language === lang.code && 'bg-accent font-medium'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="notranslate text-sm">{lang.nativeLabel}</span>
                    <span className="text-xs text-muted-foreground notranslate">{lang.label}</span>
                  </div>
                  {language === lang.code && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" title="Theme">
              <ThemeIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImage} alt={user?.name} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none notranslate">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground notranslate">{user?.email}</p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs mt-1 w-fit px-1.5 py-0.5 rounded-full font-medium',
                    user?.role === 'admin'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Shield className="h-2.5 w-2.5" />
                  {user?.role === 'admin' ? 'Administrator' : user?.role === 'superadmin' ? 'Super Admin' : 'User'}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
              <DropdownMenuItem asChild>
                <Link to={user?.role === 'superadmin' ? '/superadmin' : '/admin'} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
