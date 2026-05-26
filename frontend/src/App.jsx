import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'

// ── Layouts ───────────────────────────────────────────────────────────────────
import PublicLayout   from '@/layouts/PublicLayout'
import AuthLayout     from '@/layouts/AuthLayout'
import MainLayout     from '@/layouts/MainLayout'
import DashboardLayout from '@/layouts/DashboardLayout'

// ── Guards ────────────────────────────────────────────────────────────────────
import ProtectedRoute  from '@/components/auth/ProtectedRoute'
import AdminRoute      from '@/components/auth/AdminRoute'
import SuperAdminRoute from '@/components/auth/SuperAdminRoute'

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginPage          from '@/pages/LoginPage'
import RegisterPage       from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage  from '@/pages/ResetPasswordPage'

// ── Public pages ──────────────────────────────────────────────────────────────
import LandingPage       from '@/pages/LandingPage'
import CollegesPage      from '@/pages/CollegesPage'
import CollegeDetailPage from '@/pages/CollegeDetailPage'

// ── User pages (protected) ────────────────────────────────────────────────────
import ChatPage          from '@/pages/ChatPage'
import CollegeComparePage from '@/pages/CollegeComparePage'
import GuidancePage      from '@/pages/GuidancePage'
import ProfilePage       from '@/pages/ProfilePage'
import UploadPage        from '@/pages/UploadPage'
import NotFoundPage      from '@/pages/NotFoundPage'

// ── Admin pages ───────────────────────────────────────────────────────────────
import AdminDashboard    from '@/pages/admin/AdminDashboard'
import CollegeFormPage   from '@/pages/admin/CollegeFormPage'
import AdminUploadPage   from '@/pages/admin/AdminUploadPage'
import FaqsPage          from '@/pages/admin/FaqsPage'
import WebsiteUrlsPage   from '@/pages/admin/WebsiteUrlsPage'
import AdminAnalyticsPage from '@/pages/admin/AdminAnalyticsPage'

// ── SuperAdmin pages ──────────────────────────────────────────────────────────
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard'
import AdminsPage          from '@/pages/superadmin/AdminsPage'
import CollegesManagePage  from '@/pages/superadmin/CollegesManagePage'
import UsersPage           from '@/pages/superadmin/UsersPage'
import AnalyticsPage       from '@/pages/superadmin/AnalyticsPage'

import { Toaster } from '@/components/ui/toaster'

// ─── Smart redirect based on role ────────────────────────────────────────────
function RoleRedirect() {
  const { user } = useAuthStore()
  if (user?.role === 'superadmin') return <Navigate to="/superadmin" replace />
  if (user?.role === 'admin')      return <Navigate to="/admin"      replace />
  return <Navigate to="/chat" replace />
}

export default function App() {
  const { theme } = useThemeStore()
  const { initAuth, isInitialising } = useAuthStore()

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
      root.classList.add(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => { initAuth() }, [initAuth])

  if (isInitialising) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <>
      <Routes>

        {/* ── Public routes (with navbar + footer) ── */}
        <Route element={<PublicLayout />}>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/colleges"  element={<CollegesPage />} />
          <Route path="/colleges/:slug" element={<CollegeDetailPage />} />
          <Route path="/compare"   element={<CollegeComparePage />} />
          <Route path="/guidance"  element={<GuidancePage />} />
        </Route>

        {/* ── Auth routes ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        </Route>

        {/* ── Protected user routes ── */}
        <Route element={<ProtectedRoute />}>
          {/* Smart redirect from /dashboard */}
          <Route path="/dashboard" element={<RoleRedirect />} />

          {/* User app (chat layout) */}
          <Route element={<MainLayout />}>
            <Route path="/chat"            element={<ChatPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/upload"          element={<UploadPage />} />
            <Route path="/profile"         element={<ProfilePage />} />
          </Route>

          {/* ── Admin routes ── */}
          <Route element={<AdminRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin"           element={<AdminDashboard />} />
              <Route path="/admin/college"   element={<CollegeFormPage />} />
              <Route path="/admin/uploads"   element={<AdminUploadPage />} />
              <Route path="/admin/faqs"      element={<FaqsPage />} />
              <Route path="/admin/urls"      element={<WebsiteUrlsPage />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
            </Route>
          </Route>

          {/* ── SuperAdmin routes ── */}
          <Route element={<SuperAdminRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/superadmin"            element={<SuperAdminDashboard />} />
              <Route path="/superadmin/colleges"   element={<CollegesManagePage />} />
              <Route path="/superadmin/admins"     element={<AdminsPage />} />
              <Route path="/superadmin/users"      element={<UsersPage />} />
              <Route path="/superadmin/analytics"  element={<AnalyticsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </>
  )
}
