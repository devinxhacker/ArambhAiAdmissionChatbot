import axios from 'axios'

// ─── Single API instance pointing to the FastAPI backend ──────────────────────

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * AI service instance — points to the same backend since the FastAPI gateway
 * proxies to ai-services internally. If you need direct access to ai-services
 * (e.g. for speech/ingest), use this instance.
 */
export const aiApi = axios.create({
  baseURL: import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8100',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Token helper ─────────────────────────────────────────────────────────────

const getStoredToken = () => {
  try {
    const raw = localStorage.getItem('auth-storage')
    if (!raw) return null
    return JSON.parse(raw)?.state?.token ?? null
  } catch {
    return null
  }
}

const attachToken = (config) => {
  if (!config.headers.Authorization) {
    const token = api.defaults.headers.common['Authorization'] || getStoredToken()
    if (token) {
      config.headers.Authorization =
        typeof token === 'string' && token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`
    }
  }
  return config
}

api.interceptors.request.use(attachToken)
aiApi.interceptors.request.use(attachToken)

// ─── Response interceptors — silent refresh on 401 ───────────────────────────

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token))
  failedQueue = []
}

const handle401 = async (error) => {
  const originalRequest = error.config

  if (error.response?.status === 401 && !originalRequest._retry) {
    // Don't retry login/refresh endpoints
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('refreshToken')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) throw new Error('No refresh token')

      const res = await api.post('/api/auth/refresh', { refresh_token: refreshToken })
      const newToken = res.data.access_token
      const newRefresh = res.data.refresh_token

      // Persist updated tokens
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh)
      try {
        const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
        if (stored?.state) {
          stored.state.token = newToken
          localStorage.setItem('auth-storage', JSON.stringify(stored))
        }
      } catch { /* ignore */ }

      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      processQueue(null, newToken)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      localStorage.removeItem('auth-storage')
      localStorage.removeItem('refreshToken')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }

  return Promise.reject(error)
}

api.interceptors.response.use(r => r, handle401)
aiApi.interceptors.response.use(r => r, error => {
  if (error.response?.status === 401) window.location.href = '/login'
  return Promise.reject(error)
})
