import type { MindDocument } from '@mind-x/shared'

type SelectFailedSaveDraftInput = {
  capturedDocument: MindDocument
  currentDocument: MindDocument | null
  isCurrentProject: boolean
  snapshotStillCurrent: boolean
}

export function selectFailedSaveDraftDocument({
  capturedDocument,
  currentDocument,
  isCurrentProject,
  snapshotStillCurrent
}: SelectFailedSaveDraftInput): MindDocument {
  if (!isCurrentProject || snapshotStillCurrent || currentDocument === null) {
    return capturedDocument
  }

  return currentDocument
}
