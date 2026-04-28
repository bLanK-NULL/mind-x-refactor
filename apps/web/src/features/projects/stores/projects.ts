import type { ProjectSummaryDto } from '@mind-x/shared'
import { defineStore } from 'pinia'
import { apiClient, getApiErrorMessage } from '@/shared/api/client'

type ProjectsResponse = {
  projects: ProjectSummaryDto[]
}

type ProjectResponse = {
  project: ProjectSummaryDto
}

type ProjectsState = {
  actionError: string | null
  creating: boolean
  deletingIds: Record<string, boolean>
  loadError: string | null
  loading: boolean
  projects: ProjectSummaryDto[]
  renamingIds: Record<string, boolean>
}

let fetchSequence = 0

function getUpdatedAtTime(project: ProjectSummaryDto): number {
  const time = Date.parse(project.updatedAt)
  return Number.isNaN(time) ? 0 : time
}

function sortProjectsByUpdatedAt(projects: ProjectSummaryDto[]): ProjectSummaryDto[] {
  return projects
    .map((project, index) => ({ index, project }))
    .sort((left, right) => {
      const updatedAtDifference = getUpdatedAtTime(right.project) - getUpdatedAtTime(left.project)
      return updatedAtDifference === 0 ? left.index - right.index : updatedAtDifference
    })
    .map(({ project }) => project)
}

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    actionError: null,
    creating: false,
    deletingIds: {},
    loadError: null,
    loading: false,
    projects: [],
    renamingIds: {}
  }),
  actions: {
    upsertProjectSummary(project: ProjectSummaryDto): void {
      const nextProjects = [...this.projects]
      const index = nextProjects.findIndex((existingProject) => existingProject.id === project.id)
      if (index >= 0) {
        nextProjects.splice(index, 1, project)
      } else {
        nextProjects.unshift(project)
      }

      this.projects = sortProjectsByUpdatedAt(nextProjects)
    },
    async fetchProjects(): Promise<void> {
      const requestId = ++fetchSequence
      this.loading = true
      this.loadError = null

      try {
        const { data } = await apiClient.get<ProjectsResponse>('/projects')
        if (requestId === fetchSequence) {
          this.projects = data.projects
          this.loadError = null
        }
      } catch (error) {
        if (requestId === fetchSequence) {
          this.loadError = getApiErrorMessage(error)
        }
      } finally {
        if (requestId === fetchSequence) {
          this.loading = false
        }
      }
    },
    async createProject(name: string): Promise<ProjectSummaryDto> {
      this.creating = true
      this.actionError = null

      try {
        const { data } = await apiClient.post<ProjectResponse>('/projects', { name })
        this.upsertProjectSummary(data.project)
        this.actionError = null
        return data.project
      } catch (error) {
        this.actionError = getApiErrorMessage(error)
        throw error
      } finally {
        this.creating = false
      }
    },
    async renameProject(id: string, name: string): Promise<ProjectSummaryDto> {
      this.renamingIds[id] = true
      this.actionError = null

      try {
        const { data } = await apiClient.patch<ProjectResponse>(`/projects/${encodeURIComponent(id)}`, { name })
        this.upsertProjectSummary(data.project)
        this.actionError = null
        return data.project
      } catch (error) {
        this.actionError = getApiErrorMessage(error)
        throw error
      } finally {
        delete this.renamingIds[id]
      }
    },
    async deleteProject(id: string): Promise<void> {
      this.deletingIds[id] = true
      this.actionError = null

      try {
        await apiClient.delete(`/projects/${encodeURIComponent(id)}`)
        this.projects = this.projects.filter((project) => project.id !== id)
        this.actionError = null
      } catch (error) {
        this.actionError = getApiErrorMessage(error)
        throw error
      } finally {
        delete this.deletingIds[id]
      }
    }
  }
})
