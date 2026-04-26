import { describe, expect, it } from 'vitest'
import { mindDocumentSchema } from './document'

describe('mindDocumentSchema', () => {
  it('accepts a versioned mind document', () => {
    const parsed = mindDocumentSchema.parse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: 'Root' }
        }
      ],
      edges: []
    })

    expect(parsed.nodes[0].data.title).toBe('Root')
  })

  it('rejects HTML titles', () => {
    const result = mindDocumentSchema.safeParse({
      version: 1,
      meta: {
        projectId: 'project-1',
        title: 'Planning',
        theme: 'light',
        updatedAt: '2026-04-26T00:00:00.000Z'
      },
      viewport: { x: 0, y: 0, zoom: 1 },
      nodes: [
        {
          id: 'node-1',
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { title: '<img src=x onerror=alert(1)>' }
        }
      ],
      edges: []
    })

    expect(result.success).toBe(false)
  })
})
