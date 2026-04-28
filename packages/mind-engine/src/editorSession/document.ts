import { mindDocumentSchema, type MindDocument } from '@mind-x/shared'
import { produce } from 'immer'

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(document) : null
}

export function cloneDocument(document: MindDocument): MindDocument {
  const parsed = mindDocumentSchema.parse(structuredClone(document))
  return produce(parsed, () => undefined)
}

export function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = produce(cloneDocument(document), (draft) => {
    draft.meta.title = title
  })
  mindDocumentSchema.parse(next)
  return next
}

export function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  if (!currentDocument?.viewport) {
    return cloneDocument(document)
  }

  return produce(cloneDocument(document), (draft) => {
    draft.viewport = { ...currentDocument.viewport }
  })
}
