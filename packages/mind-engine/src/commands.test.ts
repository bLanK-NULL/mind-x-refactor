import { applyPatches } from 'immer'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import {
  addChildNode,
  addChildNodeCommand,
  addRootNode,
  addRootNodeCommand,
  deleteEdgeDetachChild,
  deleteNodePromoteChildren,
  deleteNodePromoteChildrenCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitle,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  setDocumentThemeCommand,
  setEdgeComponent,
  setEdgeComponentCommand
} from './commands.js'
import { getParentId } from './graph.js'

describe('commands', () => {
  it('executes command recipes with forward and inverse patches', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    const result = executeCommand(doc, addRootNodeCommand, {
      id: 'root',
      title: 'Root'
    })

    expect(result.document.nodes.map((node) => node.id)).toEqual(['root'])
    expect(result.patches.length).toBeGreaterThan(0)
    expect(result.inversePatches.length).toBeGreaterThan(0)
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
    expect(applyPatches(doc, result.patches)).toEqual(result.document)
  })

  it('keeps compatibility command wrappers returning documents', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    const withRoot = addRootNode(doc, { id: 'root', title: 'Root' })
    const result = addChildNode(withRoot, {
      parentId: 'root',
      id: 'child',
      title: 'Child'
    })

    expect(result.nodes.map((node) => node.id)).toEqual(['root', 'child'])
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('generates inverse patches for title, movement, edge, theme, and delete commands', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' })

    const edited = executeCommand(doc, editNodeTitleCommand, { nodeId: 'root', title: 'Edited Root' })
    const moved = executeCommand(edited.document, moveNodesCommand, {
      nodeIds: ['root', 'child'],
      delta: { x: 5, y: -2 }
    })
    const styled = executeCommand(moved.document, setEdgeComponentCommand, {
      edgeId: 'root->child',
      component: 'dashed-arrow'
    })
    const themed = executeCommand(styled.document, setDocumentThemeCommand, { theme: 'dark' })
    const deleted = executeCommand(themed.document, deleteNodePromoteChildrenCommand, { nodeId: 'root' })

    let reverted = applyPatches(deleted.document, deleted.inversePatches)
    reverted = applyPatches(reverted, themed.inversePatches)
    reverted = applyPatches(reverted, styled.inversePatches)
    reverted = applyPatches(reverted, moved.inversePatches)
    reverted = applyPatches(reverted, edited.inversePatches)

    expect(reverted).toEqual(doc)
  })

  it('deletes multiple selected nodes as one command result', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'left', type: 'topic', position: { x: 240, y: -72 }, data: { title: 'Left' } },
      { id: 'right', type: 'topic', position: { x: 240, y: 72 }, data: { title: 'Right' } }
    )
    doc.edges.push(
      { id: 'root->left', source: 'root', target: 'left', type: 'mind-parent' },
      { id: 'root->right', source: 'root', target: 'right', type: 'mind-parent' }
    )

    const result = executeCommand(doc, deleteNodesPromoteChildrenCommand, { nodeIds: ['left', 'right'] })

    expect(result.document.nodes.map((node) => node.id)).toEqual(['root'])
    expect(result.document.edges).toEqual([])
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
  })

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

  it('rejects an HTML child node title', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } })

    expect(() => addChildNode(doc, { parentId: 'root', id: 'child', title: '<b>Child</b>' })).toThrow(
      'Node title must be non-empty plain text'
    )
  })

  it('rejects an empty child node id', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } })

    expect(() => addChildNode(doc, { parentId: 'root', id: '   ', title: 'Child' })).toThrow(
      'Node id must be non-empty'
    )
  })

  it('rejects a duplicate child node id', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 250, y: 20 }, data: { title: 'Existing' } }
    )

    expect(() => addChildNode(doc, { parentId: 'root', id: 'child', title: 'Child' })).toThrow(
      'Node child already exists'
    )
  })

  it('edits a node title as plain text', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    const result = editNodeTitle(doc, { nodeId: 'root', title: 'Updated' })

    expect(result.nodes[0].data.title).toBe('Updated')
  })

  it('rejects a whitespace-only node title edit', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    expect(() => editNodeTitle(doc, { nodeId: 'root', title: '   ' })).toThrow(
      'Node title must be non-empty plain text'
    )
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

  it('rejects moving nodes in a document with two parent edges', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' } },
      { id: 'b', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'B' } },
      { id: 'c', type: 'topic', position: { x: 20, y: 40 }, data: { title: 'C' } }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent' },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent' }
    )

    expect(() => moveNodes(doc, { nodeIds: ['a'], delta: { x: 5, y: -3 } })).toThrow(
      'Node c has more than one parent'
    )
  })

  it('sets an edge component without changing structure', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' })

    const result = setEdgeComponent(doc, { edgeId: 'root->child', component: 'dashed-arrow' })

    expect(result.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'dashed-arrow' }
    ])
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('rejects setting a missing edge component target', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    expect(() => setEdgeComponent(doc, { edgeId: 'missing', component: 'arrow' })).toThrow(
      'Edge missing does not exist'
    )
  })

  it('deletes an edge and leaves the child as a root with its subtree intact', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 12 }, data: { title: 'Child' } },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 24 }, data: { title: 'Leaf' } }
    )
    doc.edges.push(
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'arrow' },
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
    )

    const result = deleteEdgeDetachChild(doc, { edgeId: 'root->child' })

    expect(result.nodes.find((node) => node.id === 'child')?.position).toEqual({ x: 240, y: 12 })
    expect(getParentId(result, 'child')).toBeNull()
    expect(getParentId(result, 'leaf')).toBe('child')
    expect(result.edges).toEqual([
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', component: 'dashed' }
    ])
  })

  it('rejects deleting a missing edge', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    expect(() => deleteEdgeDetachChild(doc, { edgeId: 'missing' })).toThrow('Edge missing does not exist')
  })

  it('creates child edges with the most recent child edge component from the same parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'first', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'First' } },
      { id: 'other-parent', type: 'topic', position: { x: 0, y: 160 }, data: { title: 'Other' } },
      { id: 'other-child', type: 'topic', position: { x: 240, y: 160 }, data: { title: 'Other Child' } }
    )
    doc.edges.push(
      { id: 'root->first', source: 'root', target: 'first', type: 'mind-parent', component: 'dashed-arrow' },
      {
        id: 'other-parent->other-child',
        source: 'other-parent',
        target: 'other-child',
        type: 'mind-parent',
        component: 'plain'
      }
    )

    const result = addChildNode(doc, { parentId: 'root', id: 'second', title: 'Second' })

    expect(result.edges.find((edge) => edge.id === 'root->second')?.component).toBe('dashed-arrow')
  })

  it('creates child edges with the plain component when the latest child edge omits component', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'first', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'First' } }
    )
    doc.edges.push({ id: 'root->first', source: 'root', target: 'first', type: 'mind-parent' })

    const result = addChildNode(doc, { parentId: 'root', id: 'second', title: 'Second' })

    expect(result.edges.find((edge) => edge.id === 'root->second')?.component).toBe('plain')
  })

  it('creates first child edges with the plain component', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } })

    const result = addChildNode(doc, { parentId: 'root', id: 'child', title: 'Child' })

    expect(result.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', component: 'plain' }
    ])
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
    expect(result.edges).toEqual([
      { id: 'root->leaf', source: 'root', target: 'leaf', type: 'mind-parent', component: 'plain' }
    ])
  })

  it('preserves child edge components when promoting children after deleting a node', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'middle', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Middle' } },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 0 }, data: { title: 'Leaf' } }
    )
    doc.edges.push(
      { id: 'root->middle', source: 'root', target: 'middle', type: 'mind-parent', component: 'plain' },
      { id: 'middle->leaf', source: 'middle', target: 'leaf', type: 'mind-parent', component: 'dashed-arrow' }
    )

    const result = deleteNodePromoteChildren(doc, { nodeId: 'middle' })

    expect(result.edges).toEqual([
      { id: 'root->leaf', source: 'root', target: 'leaf', type: 'mind-parent', component: 'dashed-arrow' }
    ])
  })

  it('deletes a root and promotes children to roots without moving them', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'left', type: 'topic', position: { x: 240, y: -72 }, data: { title: 'Left' } },
      { id: 'right', type: 'topic', position: { x: 240, y: 72 }, data: { title: 'Right' } }
    )
    doc.edges.push(
      { id: 'root->left', source: 'root', target: 'left', type: 'mind-parent' },
      { id: 'root->right', source: 'root', target: 'right', type: 'mind-parent' }
    )

    const result = deleteNodePromoteChildren(doc, { nodeId: 'root' })

    expect(result.nodes.map((node) => ({ id: node.id, position: node.position }))).toEqual([
      { id: 'left', position: { x: 240, y: -72 } },
      { id: 'right', position: { x: 240, y: 72 } }
    ])
    expect(getParentId(result, 'left')).toBeNull()
    expect(getParentId(result, 'right')).toBeNull()
  })
})
