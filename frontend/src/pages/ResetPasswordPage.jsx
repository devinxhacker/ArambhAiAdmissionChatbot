import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
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
import { Loader2, KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [clientError, setClientError] = useState('')
  const { resetPassword, isLoading, clearError } = useAuthStore()
  const { toast } = useToast()
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
    const result = await resetPassword({ token, password: form.password })
    if (result.success) {
      toast({ title: 'Password reset!', description: 'You are now signed in.' })
      navigate('/chat', { replace: true })
    } else {
      toast({ title: 'Reset failed', description: result.message, variant: 'destructive' })
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">Set new password</CardTitle>
        </div>
        <CardDescription>Choose a strong password for your account.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {clientError && (
            <div
              role="alert"
              className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20"
            >
              {clientError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              autoFocus
              showStrength
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset password
          </Button>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
