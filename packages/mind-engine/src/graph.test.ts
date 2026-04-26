import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import { assertMindTree, getChildIds, getParentId } from './graph.js'

describe('graph rules', () => {
  it('accepts a document where each node has at most one parent', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'edge-1', source: 'root', target: 'child', type: 'mind-parent' })

    expect(() => assertMindTree(doc)).not.toThrow()
    expect(getParentId(doc, 'child')).toBe('root')
    expect(getChildIds(doc, 'root')).toEqual(['child'])
  })

  it('rejects a node with two parent edges', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'b', type: 'topic', position: { x: 0, y: 120 }, data: { title: 'B' } },
      { id: 'c', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'C' } }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent' },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent' }
    )

    expect(() => assertMindTree(doc)).toThrow('Node c has more than one parent')
  })
})
