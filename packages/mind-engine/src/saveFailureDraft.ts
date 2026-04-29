import type { MindDocument } from '@mind-x/shared'

type SelectFailedSaveDraftInput = {
  capturedDocument: MindDocument
  currentDocument: MindDocument | null
  isCurrentProject: boolean
  saveSessionStillCurrent: boolean
  snapshotStillCurrent: boolean
}

export function selectFailedSaveDraftDocument({
  capturedDocument,
  currentDocument,
  isCurrentProject,
  saveSessionStillCurrent,
  snapshotStillCurrent
}: SelectFailedSaveDraftInput): MindDocument {
  if (!isCurrentProject || !saveSessionStillCurrent || snapshotStillCurrent || currentDocument === null) {
    return capturedDocument
  }

  return currentDocument
}
