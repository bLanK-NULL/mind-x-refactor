import type { MindDocument } from '@mind-x/shared'
import { serializeMindDocument } from './document.js'

export type InternalState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

export const DEFAULT_TOPIC_TITLE = 'New topic'

export function updateDirty(state: InternalState): void {
  state.dirty = serializeMindDocument(state.document) !== state.cleanDocumentJson
}
