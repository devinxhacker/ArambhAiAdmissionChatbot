import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

/**
 * SessionTimeoutAlert
 *
 * Monitors the JWT token expiry and shows:
 * 1. A warning dialog 5 minutes before expiry asking to extend the session
 * 2. An expired dialog when the token has expired, redirecting to login
 *
 * Also tracks user activity — if the user is idle for too long, shows the warning.
 */
export default function SessionTimeoutAlert() {
  const { token, isAuthenticated, silentRefresh, clearSession } = useAuthStore()
  const navigate = useNavigate()

  const [showWarning, setShowWarning] = useState(false)
  const [showExpired, setShowExpired] = useState(false)
  const [countdown, setCountdown] = useState(300) // 5 min in seconds
  const warningTimerRef = useRef(null)
  const expiryTimerRef = useRef(null)
  const countdownRef = useRef(null)

  // Decode JWT to get expiry time
  const getTokenExpiry = useCallback(() => {
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp ? payload.exp * 1000 : null // convert to ms
    } catch {
      return null
    }
  }, [token])

  // Set up timers when token changes
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const expiry = getTokenExpiry()
    if (!expiry) return

    const now = Date.now()
    const timeUntilExpiry = expiry - now
    const WARNING_BEFORE = 5 * 60 * 1000 // 5 minutes before expiry

    // Clear existing timers
    clearTimers()

    if (timeUntilExpiry <= 0) {
      // Already expired
      handleExpired()
      return
    }

    if (timeUntilExpiry <= WARNING_BEFORE) {
      // Less than 5 min left — show warning immediately
      setCountdown(Math.floor(timeUntilExpiry / 1000))
      setShowWarning(true)
      startCountdown(Math.floor(timeUntilExpiry / 1000))
    } else {
      // Set timer to show warning 5 min before expiry
      warningTimerRef.current = setTimeout(() => {
        setCountdown(300)
        setShowWarning(true)
        startCountdown(300)
      }, timeUntilExpiry - WARNING_BEFORE)
    }

    // Set timer for actual expiry
    expiryTimerRef.current = setTimeout(() => {
      handleExpired()
    }, timeUntilExpiry)

    return () => clearTimers()
  }, [token, isAuthenticated])

  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const startCountdown = (seconds) => {
    let remaining = seconds
    countdownRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(countdownRef.current)
      }
    }, 1000)
  }

  const handleExpired = () => {
    clearTimers()
    setShowWarning(false)
    setShowExpired(true)
  }

  const handleExtendSession = async () => {
    clearTimers()
    setShowWarning(false)
    const success = await silentRefresh()
    if (!success) {
      handleExpired()
    }
  }

  const handleLogout = () => {
    clearTimers()
    setShowWarning(false)
    setShowExpired(false)
    clearSession()
    navigate('/login', { replace: true })
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isAuthenticated) return null

  return (
    <>
      {/* Warning Dialog — session about to expire */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
              Session Expiring Soon
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your session will expire in{' '}
              <span className="font-bold text-foreground text-lg">{formatTime(countdown)}</span>.
              Would you like to stay signed in?
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(countdown / 300) * 100}%` }}
            />
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
            <Button onClick={handleExtendSession} className="gap-1.5">
              <LogIn className="h-4 w-4" />
              Stay Signed In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expired Dialog — session has expired */}
      <Dialog open={showExpired} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Session Expired
            </DialogTitle>
            <DialogDescription className="pt-2">
              Your session has expired due to inactivity. Please sign in again to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleLogout} className="w-full gap-1.5">
              <LogIn className="h-4 w-4" />
              Sign In Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
