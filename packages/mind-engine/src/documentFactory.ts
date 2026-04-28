import type { MindDocument } from '@mind-x/shared'

export type CreateDocumentInput = {
  projectId: string
  title: string
  now: string
}

export function createEmptyDocument(input: CreateDocumentInput): MindDocument {
  return {
    version: 3,
    meta: {
      projectId: input.projectId,
      title: input.title,
      updatedAt: input.now
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: []
  }
}
