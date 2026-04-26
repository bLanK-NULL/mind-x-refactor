import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import { addChildNode, deleteNodePromoteChildren, editNodeTitle, moveNodes } from './commands.js'
import { getParentId } from './graph.js'

describe('commands', () => {
  it('adds a child node to the right of its parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, size: { width: 160, height: 48 }, data: { title: 'Root' } })

    const result = addChildNode(doc, {
      parentId: 'root',
      id: 'child',
      title: 'Child'
    })

    expect(result.nodes.find((node) => node.id === 'child')?.position).toEqual({ x: 250, y: 20 })
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('edits a node title as plain text', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    const result = editNodeTitle(doc, { nodeId: 'root', title: 'Updated' })

    expect(result.nodes[0].data.title).toBe('Updated')
  })

  it('moves selected nodes by delta', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'b', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'B' } }
    )

    const result = moveNodes(doc, { nodeIds: ['a', 'b'], delta: { x: 5, y: -3 } })

    expect(result.nodes.map((node) => node.position)).toEqual([{ x: 5, y: -3 }, { x: 15, y: 17 }])
  })

  it('deletes a node and promotes children to the deleted node parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'middle', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Middle' } },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 0 }, data: { title: 'Leaf' } }
    )
    doc.edges.push(
      { id: 'root->middle', source: 'root', target: 'middle', type: 'mind-parent' },
      { id: 'middle->leaf', source: 'middle', target: 'leaf', type: 'mind-parent' }
    )

    const result = deleteNodePromoteChildren(doc, { nodeId: 'middle' })

    expect(result.nodes.map((node) => node.id)).toEqual(['root', 'leaf'])
    expect(getParentId(result, 'leaf')).toBe('root')
  })
})
