import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import PasswordInput from '@/components/auth/PasswordInput'
import { Loader2, User, Shield, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Role badge ───────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
      role === 'admin'
        ? 'bg-primary/10 text-primary border border-primary/20'
        : 'bg-muted text-muted-foreground border border-border'
    )}
  >
    <Shield className="h-3 w-3" />
    {role === 'admin' ? 'Administrator' : 'User'}
  </span>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateProfile, changePassword, isLoading, clearError } = useAuthStore()
  const { toast } = useToast()

  // Profile form
  const [profileForm, setProfileForm] = useState({ name: '', profileImage: '' })
  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    clearError()
    if (user) {
      setProfileForm({ name: user.name || '', profileImage: user.profileImage || '' })
    }
  }, [user, clearError])

  // ── Profile submit ──────────────────────────────────────────────────────────
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    const result = await updateProfile(profileForm)
    if (result.success) {
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' })
    } else {
      toast({ title: 'Update failed', description: result.message, variant: 'destructive' })
    }
  }

  // ── Password submit ─────────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    const result = await changePassword({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    })
    if (result.success) {
      toast({ title: 'Password changed', description: 'Your password has been updated.' })
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      toast({ title: 'Change failed', description: result.message, variant: 'destructive' })
    }
  }

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings.</p>
      </div>

      {/* ── Identity card ── */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profileImage} alt={user?.name} />
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="font-semibold text-lg">{user?.name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="mt-1">
              <RoleBadge role={user?.role} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Update profile ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Personal information
          </CardTitle>
          <CardDescription>Update your display name and avatar URL.</CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileImage">
                <span className="flex items-center gap-1">
                  <Camera className="h-3.5 w-3.5" /> Avatar URL
                </span>
              </Label>
              <Input
                id="profileImage"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                value={profileForm.profileImage}
                onChange={(e) => setProfileForm((f) => ({ ...f, profileImage: e.target.value }))}
                autoComplete="off"
              />
            </div>
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Separator />

      {/* ── Change password ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Change password
          </CardTitle>
          <CardDescription>
            Use a strong password with at least 8 characters, one uppercase letter, and one number.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="space-y-4">
            {pwError && (
              <div
                role="alert"
                className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20"
              >
                {pwError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                autoComplete="new-password"
                showStrength
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                required
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <div className="px-6 pb-6">
            <Button type="submit" variant="outline" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
