import type { LoginResponse, UserDto } from '@mind-x/shared'
import { defineStore } from 'pinia'
import { apiClient, clearStoredToken, getApiErrorMessage, readStoredToken, writeStoredToken } from '@/api/client'

type AuthState = {
  error: string | null
  loading: boolean
  token: string | null
  user: UserDto | null
}

type MeResponse = {
  user: UserDto
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    error: null,
    loading: false,
    token: readStoredToken(),
    user: null
  }),
  getters: {
    isAuthenticated: (state) => state.token !== null
  },
  actions: {
    async hydrate(): Promise<void> {
      if (this.token === null || this.user !== null) {
        return
      }

      await this.fetchMe()
    },
    async fetchMe(): Promise<void> {
      if (this.token === null) {
        return
      }

      this.loading = true
      this.error = null

      try {
        const { data } = await apiClient.get<MeResponse>('/auth/me')
        this.user = data.user
      } catch (error) {
        this.error = getApiErrorMessage(error)
        this.logout()
      } finally {
        this.loading = false
      }
    },
    async login(username: string, password: string): Promise<void> {
      this.loading = true
      this.error = null

      try {
        const { data } = await apiClient.post<LoginResponse>('/auth/login', { password, username })
        this.token = data.token
        this.user = data.user
        writeStoredToken(data.token)
      } catch (error) {
        this.error = getApiErrorMessage(error)
        throw error
      } finally {
        this.loading = false
      }
    },
    logout(): void {
      this.token = null
      this.user = null
      clearStoredToken()
    }
  }
})
