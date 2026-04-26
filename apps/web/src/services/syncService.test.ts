import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'

const localForageMock = vi.hoisted(() => {
  const store = {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn()
  }

  return {
    createInstance: vi.fn(() => store),
    store
  }
})

vi.mock('localforage', () => ({
  default: {
    createInstance: localForageMock.createInstance
  }
}))

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn()
  }
}))

const mockedApiClient = vi.mocked(apiClient)

function document(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    ...createEmptyDocument({
      now: '2026-04-26T00:00:00.000Z',
      projectId: 'project/one',
      title: 'Project One'
    }),
    ...overrides
  }
}

describe('syncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads and validates a server document with an encoded project id', async () => {
    const serverDocument = document()
    mockedApiClient.get.mockResolvedValueOnce({ data: { document: serverDocument } })
    const { loadServerDocument } = await import('./syncService')

    await expect(loadServerDocument('project/one')).resolves.toEqual(serverDocument)

    expect(localForageMock.createInstance).toHaveBeenCalledWith({ name: 'mind-x', storeName: 'pending_drafts' })
    expect(mockedApiClient.get).toHaveBeenCalledWith('/projects/project%2Fone/document')
  })

  it('saves the document to the server, validates the response, and clears a local draft', async () => {
    const savedDocument = document({ meta: { ...document().meta, title: 'Saved' } })
    mockedApiClient.put.mockResolvedValueOnce({ data: { document: savedDocument } })
    const { saveServerDocument } = await import('./syncService')

    await expect(saveServerDocument('project/one', document())).resolves.toEqual(savedDocument)

    expect(mockedApiClient.put).toHaveBeenCalledWith('/projects/project%2Fone/document', { document: document() })
    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })

  it('stores and retrieves a validated local draft', async () => {
    const draftDocument = document()
    localForageMock.store.getItem.mockResolvedValueOnce({
      document: draftDocument,
      savedAt: '2026-04-26T01:02:03.000Z'
    })
    const { getLocalDraft, saveLocalDraft } = await import('./syncService')

    await saveLocalDraft('project/one', draftDocument)
    await expect(getLocalDraft('project/one')).resolves.toEqual({
      document: draftDocument,
      savedAt: '2026-04-26T01:02:03.000Z'
    })

    expect(localForageMock.store.setItem).toHaveBeenCalledWith('project/one', {
      document: draftDocument,
      savedAt: expect.any(String)
    })
  })

  it('removes corrupt local drafts and returns null', async () => {
    localForageMock.store.getItem.mockResolvedValueOnce({ document: { broken: true }, savedAt: 'not-a-date' })
    const { getLocalDraft } = await import('./syncService')

    await expect(getLocalDraft('project/one')).resolves.toBeNull()

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })

  it('explicitly clears a local draft', async () => {
    const { clearLocalDraft } = await import('./syncService')

    await clearLocalDraft('project/one')

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })
})
