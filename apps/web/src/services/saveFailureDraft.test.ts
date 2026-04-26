import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { describe, expect, it } from 'vitest'
import { selectFailedSaveDraftDocument } from './saveFailureDraft'

function document(projectId: string, title: string): MindDocument {
  return createEmptyDocument({
    now: '2026-04-26T00:00:00.000Z',
    projectId,
    title
  })
}

describe('saveFailureDraft', () => {
  it('uses the captured save snapshot after navigation changes the current project', () => {
    const capturedDocument = document('project-a', 'Project A')
    const currentDocument = document('project-b', 'Project B')

    const draftDocument = selectFailedSaveDraftDocument({
      capturedDocument,
      currentDocument,
      isCurrentProject: false,
      snapshotStillCurrent: false
    })

    expect(draftDocument).toBe(capturedDocument)
  })

  it('uses newer live edits when the failed save still belongs to the current project', () => {
    const capturedDocument = document('project-a', 'Project A')
    const currentDocument = document('project-a', 'Project A with newer edits')

    const draftDocument = selectFailedSaveDraftDocument({
      capturedDocument,
      currentDocument,
      isCurrentProject: true,
      snapshotStillCurrent: false
    })

    expect(draftDocument).toBe(currentDocument)
  })
})
