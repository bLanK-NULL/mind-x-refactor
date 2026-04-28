import { createEmptyDocument } from '@mind-x/mind-engine'
import { DEFAULT_TOPIC_STYLE, type MindDocument, type MindDocumentV1 } from '@mind-x/shared'
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

function legacyDocument(projectId = 'project-1'): MindDocumentV1 {
  return {
    version: 1,
    meta: {
      projectId,
      title: 'Legacy',
      theme: 'dark',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } }],
    edges: []
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

  it('migrates legacy server documents when loading', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { document: legacyDocument() } })
    const { loadServerDocument } = await import('./syncService')

    await expect(loadServerDocument('project/one')).resolves.toMatchObject({
      version: 2,
      nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
    })
  })

  it('saves the document to the server, validates the response, and clears a local draft', async () => {
    const savedDocument = document({ meta: { ...document().meta, title: 'Saved' } })
    mockedApiClient.put.mockResolvedValueOnce({ data: { document: savedDocument } })
    const { saveServerDocument } = await import('./syncService')

    await expect(saveServerDocument('project/one', document())).resolves.toEqual(savedDocument)

    expect(mockedApiClient.put).toHaveBeenCalledWith('/projects/project%2Fone/document', { document: document() })
    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })

  it('migrates legacy documents before saving to the server', async () => {
    const legacy = legacyDocument('project/one')
    mockedApiClient.put.mockResolvedValueOnce({ data: { document: legacy } })
    const { saveServerDocument } = await import('./syncService')

    const saved = await saveServerDocument('project/one', legacy as any)
    const payload = mockedApiClient.put.mock.calls[0]?.[1] as { document: MindDocument }

    expect(payload.document.version).toBe(2)
    expect(payload.document.nodes).toEqual([expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })])
    expect(payload.document.meta).not.toHaveProperty('theme')
    expect(saved).toMatchObject({
      version: 2,
      nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
    })
    expect(saved.meta).not.toHaveProperty('theme')
  })

  it('returns the saved server document when post-save draft cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const savedDocument = document({ meta: { ...document().meta, title: 'Saved' } })
    localForageMock.store.removeItem.mockRejectedValueOnce(new Error('storage unavailable'))
    mockedApiClient.put.mockResolvedValueOnce({ data: { document: savedDocument } })
    const { saveServerDocument } = await import('./syncService')

    await expect(saveServerDocument('project/one', document())).resolves.toEqual(savedDocument)

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
    expect(warn).toHaveBeenCalledWith('Unable to clear local draft after server save', expect.any(Error))
    warn.mockRestore()
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

  it('migrates legacy documents before saving local drafts', async () => {
    const legacy = legacyDocument('project/one')
    const { saveLocalDraft } = await import('./syncService')

    const draft = await saveLocalDraft('project/one', legacy as any)
    const storedDraft = localForageMock.store.setItem.mock.calls[0]?.[1] as { document: MindDocument }

    expect(storedDraft.document.version).toBe(2)
    expect(storedDraft.document.nodes).toEqual([expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })])
    expect(storedDraft.document.meta).not.toHaveProperty('theme')
    expect(draft.document).toMatchObject({
      version: 2,
      nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
    })
    expect(draft.document.meta).not.toHaveProperty('theme')
  })

  it('migrates legacy local drafts when reading', async () => {
    localForageMock.store.getItem.mockResolvedValueOnce({
      document: legacyDocument(),
      savedAt: '2026-04-26T00:00:00.000Z'
    })
    const { getLocalDraft } = await import('./syncService')

    await expect(getLocalDraft('project-1')).resolves.toMatchObject({
      document: {
        version: 2,
        nodes: [expect.objectContaining({ style: DEFAULT_TOPIC_STYLE })]
      },
      savedAt: '2026-04-26T00:00:00.000Z'
    })
  })

  it('removes corrupt local drafts and returns null', async () => {
    localForageMock.store.getItem.mockResolvedValueOnce({ document: { broken: true }, savedAt: 'not-a-date' })
    const { getLocalDraft } = await import('./syncService')

    await expect(getLocalDraft('project/one')).resolves.toBeNull()

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })

  it('returns null when reading a local draft fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localForageMock.store.getItem.mockRejectedValueOnce(new Error('read failed'))
    const { getLocalDraft } = await import('./syncService')

    await expect(getLocalDraft('project/one')).resolves.toBeNull()

    expect(warn).toHaveBeenCalledWith('Unable to read local draft', expect.any(Error))
    warn.mockRestore()
  })

  it('returns null when corrupt local draft cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localForageMock.store.getItem.mockResolvedValueOnce({ document: { broken: true }, savedAt: 'not-a-date' })
    localForageMock.store.removeItem.mockRejectedValueOnce(new Error('remove failed'))
    const { getLocalDraft } = await import('./syncService')

    await expect(getLocalDraft('project/one')).resolves.toBeNull()

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
    expect(warn).toHaveBeenCalledWith('Unable to clear corrupt local draft', expect.any(Error))
    warn.mockRestore()
  })

  it('explicitly clears a local draft', async () => {
    const { clearLocalDraft } = await import('./syncService')

    await clearLocalDraft('project/one')

    expect(localForageMock.store.removeItem).toHaveBeenCalledWith('project/one')
  })
})
