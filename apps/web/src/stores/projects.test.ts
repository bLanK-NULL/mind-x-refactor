import type { ProjectSummaryDto } from '@mind-x/shared'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/shared/api/client'
import { useProjectsStore } from './projects'

vi.mock('@/shared/api/client', () => ({
  apiClient: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn()
  },
  getApiErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Request failed')
}))

const mockedApiClient = vi.mocked(apiClient)

function deferred<T>(): {
  promise: Promise<T>
  reject: (error: unknown) => void
  resolve: (value: T) => void
} {
  let reject!: (error: unknown) => void
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

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
    expect(store.loadError).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('keeps loading sane and records a load error when fetch fails', async () => {
    mockedApiClient.get.mockRejectedValueOnce(new Error('Network down'))

    const store = useProjectsStore()
    await expect(store.fetchProjects()).resolves.toBeUndefined()

    expect(store.projects).toEqual([])
    expect(store.loadError).toBe('Network down')
    expect(store.actionError).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('does not let action failures become page load failures', async () => {
    mockedApiClient.post.mockRejectedValueOnce(new Error('Create failed'))

    const store = useProjectsStore()
    await expect(store.createProject('New Project')).rejects.toThrow('Create failed')

    expect(store.projects).toEqual([])
    expect(store.loadError).toBeNull()
    expect(store.actionError).toBe('Create failed')
    expect(store.loading).toBe(false)
  })

  it('only lets the latest concurrent fetch update projects, load error, and loading', async () => {
    const firstFetch = deferred<{ data: { projects: ProjectSummaryDto[] } }>()
    const secondFetch = deferred<{ data: { projects: ProjectSummaryDto[] } }>()
    const secondProjects = [project({ id: 'project-2', name: 'Second Result' })]

    mockedApiClient.get.mockReturnValueOnce(firstFetch.promise).mockReturnValueOnce(secondFetch.promise)

    const store = useProjectsStore()
    const firstRequest = store.fetchProjects()
    const secondRequest = store.fetchProjects()

    secondFetch.resolve({ data: { projects: secondProjects } })
    await secondRequest

    expect(store.projects).toEqual(secondProjects)
    expect(store.loadError).toBeNull()
    expect(store.loading).toBe(false)

    firstFetch.resolve({ data: { projects: [project({ id: 'project-1', name: 'Stale Result' })] } })
    await firstRequest

    expect(store.projects).toEqual(secondProjects)
    expect(store.loadError).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('ignores stale fetch failures after a newer fetch has completed', async () => {
    const firstFetch = deferred<{ data: { projects: ProjectSummaryDto[] } }>()
    const secondFetch = deferred<{ data: { projects: ProjectSummaryDto[] } }>()
    const secondProjects = [project({ id: 'project-2', name: 'Second Result' })]

    mockedApiClient.get.mockReturnValueOnce(firstFetch.promise).mockReturnValueOnce(secondFetch.promise)

    const store = useProjectsStore()
    const firstRequest = store.fetchProjects()
    const secondRequest = store.fetchProjects()

    secondFetch.resolve({ data: { projects: secondProjects } })
    await secondRequest

    firstFetch.reject(new Error('Stale network down'))
    await firstRequest

    expect(store.projects).toEqual(secondProjects)
    expect(store.loadError).toBeNull()
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
    expect(store.actionError).toBeNull()
  })

  it('renames a project by replacing, sorting, and returning the fresh summary', async () => {
    const olderProject = project({ updatedAt: '2026-01-01T00:00:00.000Z' })
    const otherProject = project({ id: 'project-2', name: 'Other Project', updatedAt: '2026-01-02T00:00:00.000Z' })
    const renamedProject = project({ name: 'Renamed Project', updatedAt: '2026-01-03T00:00:00.000Z' })
    mockedApiClient.patch.mockResolvedValueOnce({ data: { project: renamedProject } })

    const store = useProjectsStore()
    store.projects = [otherProject, olderProject]

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
