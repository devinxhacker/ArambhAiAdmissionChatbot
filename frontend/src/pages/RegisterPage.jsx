import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { Loader2, UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [clientError, setClientError] = useState('')
  const { register, isLoading, clearError } = useAuthStore()
  const { toast } = useToast()
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleChange = (e) => {
    setClientError('')
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (form.password !== form.confirmPassword) {
      setClientError('Passwords do not match.')
      return
    }

    const result = await register({
      name: form.name,
      email: form.email,
      password: form.password,
    })

    if (result.success) {
      toast({
        title: 'Account created!',
        description: `Welcome, ${form.name}. You are now signed in.`,
      })
      navigate('/chat', { replace: true })
    } else {
      toast({ title: 'Registration failed', description: result.message, variant: 'destructive' })
    }
  }

  const error = clientError

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">{t('auth.register')}</CardTitle>
        </div>
        <CardDescription>{t('auth.registerDescription')}</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {error && (
            <div
              role="alert"
              className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.name')}</Label>
            <Input
              id="name"
              name="name"
              placeholder="Jane Smith"
              value={form.name}
              onChange={handleChange}
              required
              autoComplete="name"
              autoFocus
            />
          </div>

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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              showStrength
            />
            <p className="text-xs text-muted-foreground">
              Min 8 characters, one uppercase letter, one number.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <UserPlus className="mr-2 h-4 w-4" />
            }
            {t('auth.register')}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
