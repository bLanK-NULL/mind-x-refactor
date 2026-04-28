import { migrateMindDocument, type MindDocument } from '@mind-x/shared'
import localforage from 'localforage'
import { apiClient } from '@/api/client'

export type LocalDraft = {
  document: MindDocument
  savedAt: string
}

type DocumentResponse = {
  document: unknown
}

const draftsStore = localforage.createInstance({
  name: 'mind-x',
  storeName: 'pending_drafts'
})

export async function loadServerDocument(projectId: string): Promise<MindDocument> {
  const { data } = await apiClient.get<DocumentResponse>(documentUrl(projectId))
  return migrateMindDocument(data.document)
}

export async function saveServerDocument(projectId: string, document: MindDocument): Promise<MindDocument> {
  const validDocument = migrateMindDocument(document)
  const { data } = await apiClient.put<DocumentResponse>(documentUrl(projectId), { document: validDocument })
  const savedDocument = migrateMindDocument(data.document)
  await clearLocalDraftBestEffort(projectId, 'Unable to clear local draft after server save')
  return savedDocument
}

export async function saveLocalDraft(projectId: string, document: MindDocument): Promise<LocalDraft> {
  const draft = {
    document: migrateMindDocument(document),
    savedAt: new Date().toISOString()
  }
  await draftsStore.setItem(projectId, draft)
  return draft
}

export async function getLocalDraft(projectId: string): Promise<LocalDraft | null> {
  let rawDraft: unknown
  try {
    rawDraft = await draftsStore.getItem<unknown>(projectId)
  } catch (error) {
    console.warn('Unable to read local draft', error)
    return null
  }

  if (rawDraft === null) {
    return null
  }

  const draft = parseLocalDraft(rawDraft)
  if (draft === null) {
    await clearLocalDraftBestEffort(projectId, 'Unable to clear corrupt local draft')
  }

  return draft
}

export async function clearLocalDraft(projectId: string): Promise<void> {
  await draftsStore.removeItem(projectId)
}

async function clearLocalDraftBestEffort(projectId: string, warning: string): Promise<void> {
  try {
    await clearLocalDraft(projectId)
  } catch (error) {
    console.warn(warning, error)
  }
}

function documentUrl(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/document`
}

function parseLocalDraft(value: unknown): LocalDraft | null {
  if (!isRecord(value) || typeof value.savedAt !== 'string') {
    return null
  }

  const savedAtMs = Date.parse(value.savedAt)
  if (Number.isNaN(savedAtMs)) {
    return null
  }

  try {
    return {
      document: migrateMindDocument(value.document),
      savedAt: value.savedAt
    }
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
