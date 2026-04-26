import axios, { AxiosError } from 'axios'

export const AUTH_TOKEN_STORAGE_KEY = 'mind-x-token'

export type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

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

export function readStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function writeStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
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
