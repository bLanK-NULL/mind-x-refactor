import type { ProjectSummaryDto } from '@mind-x/shared'
import { defineStore } from 'pinia'
import { apiClient, getApiErrorMessage } from '@/api/client'

type ProjectsResponse = {
  projects: ProjectSummaryDto[]
}

type ProjectResponse = {
  project: ProjectSummaryDto
}

type ProjectsState = {
  creating: boolean
  deletingIds: Record<string, boolean>
  error: string | null
  loading: boolean
  projects: ProjectSummaryDto[]
  renamingIds: Record<string, boolean>
}

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    creating: false,
    deletingIds: {},
    error: null,
    loading: false,
    projects: [],
    renamingIds: {}
  }),
  actions: {
    async fetchProjects(): Promise<void> {
      this.loading = true
      this.error = null

      try {
        const { data } = await apiClient.get<ProjectsResponse>('/projects')
        this.projects = data.projects
      } catch (error) {
        this.error = getApiErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async createProject(name: string): Promise<ProjectSummaryDto> {
      this.creating = true
      this.error = null

      try {
        const { data } = await apiClient.post<ProjectResponse>('/projects', { name })
        this.projects.unshift(data.project)
        return data.project
      } catch (error) {
        this.error = getApiErrorMessage(error)
        throw error
      } finally {
        this.creating = false
      }
    },
    async renameProject(id: string, name: string): Promise<ProjectSummaryDto> {
      this.renamingIds[id] = true
      this.error = null

      try {
        const { data } = await apiClient.patch<ProjectResponse>(`/projects/${encodeURIComponent(id)}`, { name })
        const index = this.projects.findIndex((project) => project.id === id)
        if (index >= 0) {
          this.projects.splice(index, 1, data.project)
        }
        return data.project
      } catch (error) {
        this.error = getApiErrorMessage(error)
        throw error
      } finally {
        delete this.renamingIds[id]
      }
    },
    async deleteProject(id: string): Promise<void> {
      this.deletingIds[id] = true
      this.error = null

      try {
        await apiClient.delete(`/projects/${encodeURIComponent(id)}`)
        this.projects = this.projects.filter((project) => project.id !== id)
      } catch (error) {
        this.error = getApiErrorMessage(error)
        throw error
      } finally {
        delete this.deletingIds[id]
      }
    }
  }
})
