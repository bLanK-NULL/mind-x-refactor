import axios, { AxiosError } from 'axios'

export const AUTH_TOKEN_STORAGE_KEY = 'mind-x-token'

export type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export const apiClient = axios.create({
  baseURL: '/api'
})

apiClient.interceptors.request.use((config) => {
  const token = readStoredToken()
  if (token !== null) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isUnauthorizedError(error) && !isLoginRequest(error)) {
      unauthorizedHandler?.()
    }

    return Promise.reject(error)
  }
)

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof AxiosError && (error.response?.status === 401 || error.response?.status === 403)
}

export function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredToken(token: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    return true
  } catch {
    return false
  }
}

export function clearStoredToken(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined
    return body?.error?.message ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function isLoginRequest(error: unknown): boolean {
  return error instanceof AxiosError && error.config?.url === '/auth/login'
}
