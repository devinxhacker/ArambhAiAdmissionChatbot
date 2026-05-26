import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

// ─── Token helpers ────────────────────────────────────────────────────────────

const setAxiosToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialising: true,
      error: null,

      // ── Bootstrap ──────────────────────────────────────────────────────────

      initAuth: async () => {
        const { token } = get()
        if (!token) {
          set({ isInitialising: false })
          return
        }
        setAxiosToken(token)
        try {
          const res = await api.get('/api/auth/me')
          set({ user: res.data, isAuthenticated: true, isInitialising: false })
        } catch (err) {
          if (err.response?.status === 401) {
            const refreshed = await get().silentRefresh()
            if (!refreshed) get().clearSession()
          } else {
            get().clearSession()
          }
          set({ isInitialising: false })
        }
      },

      silentRefresh: async () => {
        try {
          const refreshToken = localStorage.getItem('refreshToken')
          if (!refreshToken) return false
          const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken })
          const { access_token, refresh_token } = res.data
          setAxiosToken(access_token)
          if (refresh_token) localStorage.setItem('refreshToken', refresh_token)

          // Re-fetch user
          const meRes = await api.get('/api/auth/me')
          set({ token: access_token, user: meRes.data, isAuthenticated: true })
          return true
        } catch {
          get().clearSession()
          return false
        }
      },

      // ── Auth actions ───────────────────────────────────────────────────────

      login: async ({ email, password }) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.post('/api/auth/login', { email, password })
          const { access_token, refresh_token } = res.data
          setAxiosToken(access_token)
          if (refresh_token) localStorage.setItem('refreshToken', refresh_token)

          // Fetch user profile
          const meRes = await api.get('/api/auth/me')
          set({
            token: access_token,
            user: meRes.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || err.response?.data?.message || 'Login failed. Please try again.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      register: async ({ name, email, password }) => {
        set({ isLoading: true, error: null })
        try {
          // Register the user
          await api.post('/api/auth/register', { name, email, password })

          // Auto-login after registration
          const loginRes = await api.post('/api/auth/login', { email, password })
          const { access_token, refresh_token } = loginRes.data
          setAxiosToken(access_token)
          if (refresh_token) localStorage.setItem('refreshToken', refresh_token)

          const meRes = await api.get('/api/auth/me')
          set({
            token: access_token,
            user: meRes.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || err.response?.data?.message || 'Registration failed. Please try again.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      logout: async () => {
        get().clearSession()
      },

      // ── Profile ────────────────────────────────────────────────────────────

      updateProfile: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.patch('/api/auth/me', data)
          set({ user: res.data, isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || 'Profile update failed.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      changePassword: async ({ currentPassword, newPassword }) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/api/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
          })
          set({ isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || 'Password change failed.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      forgotPassword: async (email) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/api/auth/forgot-password', { email })
          set({ isLoading: false })
          return { success: true, message: 'Reset link sent if email exists.' }
        } catch (err) {
          const message = err.response?.data?.detail || 'Request failed.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      resetPassword: async ({ token, password }) => {
        set({ isLoading: true, error: null })
        try {
          const res = await api.post(`/api/auth/reset-password/${token}`, { password })
          const { access_token, refresh_token } = res.data
          setAxiosToken(access_token)
          if (refresh_token) localStorage.setItem('refreshToken', refresh_token)

          const meRes = await api.get('/api/auth/me')
          set({
            token: access_token,
            user: meRes.data,
            isAuthenticated: true,
            isLoading: false,
          })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.detail || 'Password reset failed.'
          set({ error: message, isLoading: false })
          return { success: false, message }
        }
      },

      // ── Helpers ────────────────────────────────────────────────────────────

      clearError: () => set({ error: null }),

      clearSession: () => {
        localStorage.removeItem('refreshToken')
        setAxiosToken(null)
        set({ user: null, token: null, isAuthenticated: false, error: null })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
)
