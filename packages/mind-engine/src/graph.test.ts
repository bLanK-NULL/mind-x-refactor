import { describe, expect, it } from 'vitest'
import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE } from '@mind-x/shared'
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
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push({ id: 'edge-1', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE })

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
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'b', type: 'topic', position: { x: 0, y: 120 }, data: { title: 'B' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'c', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'C' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    )

    expect(() => assertMindTree(doc)).toThrow('Node c has more than one parent')
  })

  it('rejects an edge with a dangling source', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push({ id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE })
    doc.edges.push({ id: 'edge-1', source: 'missing', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE })

    expect(() => assertMindTree(doc)).toThrow('Edge edge-1 source missing does not exist')
  })

  it('rejects an edge with a dangling target', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })
    doc.edges.push({ id: 'edge-1', source: 'root', target: 'missing', type: 'mind-parent', style: DEFAULT_EDGE_STYLE })

    expect(() => assertMindTree(doc)).toThrow('Edge edge-1 target missing does not exist')
  })

  it('throws when getting the parent for a node with two parent edges', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'b', type: 'topic', position: { x: 0, y: 120 }, data: { title: 'B' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'c', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'C' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    )

    expect(() => getParentId(doc, 'c')).toThrow('Node c has more than one parent')
  })

  it('rejects a node as its own parent', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push({ id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE })
    doc.edges.push({ id: 'edge-1', source: 'a', target: 'a', type: 'mind-parent', style: DEFAULT_EDGE_STYLE })

    expect(() => assertMindTree(doc)).toThrow('Node a cannot be its own parent')
  })

  it('rejects cycles', () => {
    const doc = createEmptyDocument({
      projectId: 'project-1',
      title: 'Planning',
      now: '2026-04-26T00:00:00.000Z'
    })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'b', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'B' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'b', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'edge-2', source: 'b', target: 'a', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    )

    expect(() => assertMindTree(doc)).toThrow('Cycle detected')
  })
})
