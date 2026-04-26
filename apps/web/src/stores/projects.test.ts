import type { ProjectSummaryDto } from '@mind-x/shared'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { useProjectsStore } from './projects'

vi.mock('@/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn()
  },
  getApiErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Request failed')
}))

const mockedApiClient = vi.mocked(apiClient)

function project(overrides: Partial<ProjectSummaryDto> = {}): ProjectSummaryDto {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    id: 'project-1',
    name: 'Project One',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  }
}

describe('projects store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetches projects and resets loading after success', async () => {
    const projects = [project(), project({ id: 'project-2', name: 'Project Two' })]
    mockedApiClient.get.mockResolvedValueOnce({ data: { projects } })

    const store = useProjectsStore()
    await store.fetchProjects()

    expect(mockedApiClient.get).toHaveBeenCalledWith('/projects')
    expect(store.projects).toEqual(projects)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('keeps loading sane and records an error when fetch fails', async () => {
    mockedApiClient.get.mockRejectedValueOnce(new Error('Network down'))

    const store = useProjectsStore()
    await expect(store.fetchProjects()).resolves.toBeUndefined()

    expect(store.projects).toEqual([])
    expect(store.error).toBe('Network down')
    expect(store.loading).toBe(false)
  })

  it('creates a project, unshifts it into local state, and returns it', async () => {
    const existingProject = project()
    const createdProject = project({ id: 'project-2', name: 'New Project' })
    mockedApiClient.post.mockResolvedValueOnce({ data: { project: createdProject } })

    const store = useProjectsStore()
    store.projects = [existingProject]

    await expect(store.createProject('New Project')).resolves.toEqual(createdProject)
    expect(mockedApiClient.post).toHaveBeenCalledWith('/projects', { name: 'New Project' })
    expect(store.projects).toEqual([createdProject, existingProject])
    expect(store.error).toBeNull()
  })

  it('renames a project by replacing the matching summary and returning it', async () => {
    const renamedProject = project({ name: 'Renamed Project', updatedAt: '2026-01-03T00:00:00.000Z' })
    const otherProject = project({ id: 'project-2', name: 'Other Project' })
    mockedApiClient.patch.mockResolvedValueOnce({ data: { project: renamedProject } })

    const store = useProjectsStore()
    store.projects = [project(), otherProject]

    await expect(store.renameProject('project-1', 'Renamed Project')).resolves.toEqual(renamedProject)
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/projects/project-1', { name: 'Renamed Project' })
    expect(store.projects).toEqual([renamedProject, otherProject])
  })

  it('deletes a project and removes it from local state', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({})

    const store = useProjectsStore()
    store.projects = [project(), project({ id: 'project-2', name: 'Other Project' })]

    await store.deleteProject('project-1')

    expect(mockedApiClient.delete).toHaveBeenCalledWith('/projects/project-1')
    expect(store.projects).toEqual([project({ id: 'project-2', name: 'Other Project' })])
  })
})
