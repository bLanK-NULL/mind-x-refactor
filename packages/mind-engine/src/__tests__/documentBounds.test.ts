import {
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type Point,
  type Size
} from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import { calculateDocumentBounds } from '../documentBounds.js'

function document(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    version: 3,
    meta: {
      projectId: 'project-1',
      title: 'Project One',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    ...overrides
  }
}

function topicNode(id: string, title: string, position: Point, size: Size = DEFAULT_NODE_SIZE_BY_TYPE.topic) {
  return {
    data: { title },
    id,
    position,
    size,
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    type: 'topic' as const,
    contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
}

describe('documentBounds', () => {
  it('returns null for documents without nodes', () => {
    expect(calculateDocumentBounds(document())).toBeNull()
  })

  it('calculates bounds from explicit v3 node sizes and padding', () => {
    const bounds = calculateDocumentBounds(
      document({
        nodes: [
          topicNode('root', 'Root', { x: -20, y: 10 }, { height: 56, width: 180 }),
          topicNode('child', 'Child', { x: 220, y: -30 }, { height: 80, width: 200 })
        ]
      })
    )

    expect(bounds).toEqual({
      height: 144,
      maxX: 420,
      maxY: 66,
      minX: -20,
      minY: -30,
      width: 488
    })
  })

  it('keeps negative node origins in the returned bounds', () => {
    expect(
      calculateDocumentBounds(
        document({
          nodes: [
            topicNode('root', 'Root', { x: -40, y: -12 })
          ]
        })
      )
    ).toMatchObject({
      minX: -40,
      minY: -12
    })
  })
})
