import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiErrorResponse, ApiResponse, SessionUser } from '../types/api'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
let accessToken: string | null = null
let refreshPromise: Promise<string> | null = null

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean
}

export const api = axios.create({ baseURL, withCredentials: true })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const request = error.config as RetryableRequest | undefined
    const isAuthenticationRoute = request?.url?.includes('/auth/')
    if (error.response?.status !== 401 || !request || request._retried || isAuthenticationRoute) {
      throw error
    }

    request._retried = true
    try {
      const token = await refreshAccessToken()
      request.headers.Authorization = `Bearer ${token}`
      return api(request)
    } catch (refreshError) {
      clearAccessToken()
      window.dispatchEvent(new Event('auth:expired'))
      throw refreshError
    }
  },
)

export function setAccessToken(token: string): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiResponse<{ accessToken: string; user: SessionUser }>>(
        `${baseURL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: { 'X-CSRF-Token': readCookie('csrf_token') ?? '' },
        },
      )
      .then((response) => {
        const token = response.data.data.accessToken
        setAccessToken(token)
        return token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

export function csrfHeader(): Record<string, string> {
  return { 'X-CSRF-Token': readCookie('csrf_token') ?? '' }
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.error?.message ?? 'The request failed'
  }
  return error instanceof Error ? error.message : 'The request failed'
}

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length)
  return value ? decodeURIComponent(value) : null
}
