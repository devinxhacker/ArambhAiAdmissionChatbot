import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import PasswordInput from '@/components/auth/PasswordInput'
import { Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const { login, isLoading, clearError } = useAuthStore()
  const { toast } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Where to go after login — default /chat
  const from = location.state?.from?.pathname || '/chat'

  // Clear any stale errors when the page mounts
  useEffect(() => {
    clearError()
  }, [clearError])

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(form)
    if (result.success) {
      toast({ title: 'Welcome back!', description: 'You have been signed in.' })
      navigate(from, { replace: true })
    } else {
      toast({ title: 'Sign in failed', description: result.message, variant: 'destructive' })
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <LogIn className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">{t('auth.login')}</CardTitle>
        </div>
        <CardDescription>{t('auth.loginDescription')}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-primary hover:underline"
                tabIndex={-1}
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <LogIn className="mr-2 h-4 w-4" />
            }
            {t('auth.login')}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              {t('auth.register')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
