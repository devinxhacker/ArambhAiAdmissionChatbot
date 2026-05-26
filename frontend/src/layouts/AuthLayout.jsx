import { Outlet, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export default function AuthLayout() {
  const { isAuthenticated, clearError } = useAuthStore()

  // Clear stale errors whenever the user navigates between auth pages
  useEffect(() => {
    clearError()
  }, [clearError])

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Admission Chat</h1>
          <p className="text-muted-foreground mt-2">AI-powered admission assistant</p>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
