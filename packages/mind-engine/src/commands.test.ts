import { applyPatches } from 'immer'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDGE_STYLE,
  DEFAULT_TOPIC_STYLE,
  type EdgeStyle,
  type TopicNodeStyle
} from '@mind-x/shared'
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
  setEdgeStyleCommand,
  setNodeStyleCommand
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

  it('creates root and child objects with explicit v2 default styles', () => {
    const doc = createEmptyDocument({
      now: '2026-04-26T00:00:00.000Z',
      projectId: 'project-1',
      title: 'Project One'
    })

    const withRoot = addRootNode(doc, { id: 'root', title: 'Root' })
    const withChild = addChildNode(withRoot, { parentId: 'root', id: 'child', title: 'Child' })

    expect(withRoot).toMatchObject({
      version: 2,
      meta: {
        projectId: 'project-1',
        title: 'Project One',
        updatedAt: '2026-04-26T00:00:00.000Z'
      }
    })
    expect(withChild.nodes.map((node) => node.style)).toEqual([DEFAULT_TOPIC_STYLE, DEFAULT_TOPIC_STYLE])
    expect(withChild.nodes[0].style).not.toBe(withChild.nodes[1].style)
    expect(withChild.nodes[0].style).not.toBe(DEFAULT_TOPIC_STYLE)
    expect(withChild.edges).toEqual([
      {
        id: 'root->child',
        source: 'root',
        target: 'child',
        type: 'mind-parent',
        style: DEFAULT_EDGE_STYLE
      }
    ])
    expect(withChild.edges[0].style).not.toBe(DEFAULT_EDGE_STYLE)
  })

  it('updates node style as an undoable patch command', () => {
    const doc = addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
      id: 'root',
      title: 'Root'
    })
    const stylePatch: Partial<TopicNodeStyle> = { colorToken: 'purple', shape: 'pill', textWeight: 'bold' }

    const result = executeCommand(doc, setNodeStyleCommand, { nodeId: 'root', stylePatch })

    expect(result.document.nodes[0].style).toEqual({ ...DEFAULT_TOPIC_STYLE, ...stylePatch })
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
  })

  it('updates edge style as an undoable patch command', () => {
    const doc = addChildNode(
      addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
        id: 'root',
        title: 'Root'
      }),
      { parentId: 'root', id: 'child', title: 'Child' }
    )
    const stylePatch: Partial<EdgeStyle> = { arrow: 'end', colorToken: 'warning', linePattern: 'dotted', width: 'thick' }

    const result = executeCommand(doc, setEdgeStyleCommand, { edgeId: 'root->child', stylePatch })

    expect(result.document.edges[0].style).toEqual({ ...DEFAULT_EDGE_STYLE, ...stylePatch })
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
  })

  it('rejects style updates for missing objects', () => {
    const doc = createEmptyDocument({
      now: '2026-04-26T00:00:00.000Z',
      projectId: 'project-1',
      title: 'Project One'
    })

    expect(() => executeCommand(doc, setNodeStyleCommand, { nodeId: 'missing', stylePatch: { colorToken: 'danger' } })).toThrow(
      'Node missing does not exist'
    )
    expect(() => executeCommand(doc, setEdgeStyleCommand, { edgeId: 'missing', stylePatch: { colorToken: 'danger' } })).toThrow(
      'Edge missing does not exist'
    )
  })

  it('rejects unknown node style patch keys without mutating the document', () => {
    const doc = addRootNode(
      createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }),
      {
        id: 'root',
        title: 'Root'
      }
    )
    const original = structuredClone(doc)

    expect(() =>
      executeCommand(doc, setNodeStyleCommand, {
        nodeId: 'root',
        stylePatch: { colorToken: 'purple', rogue: 'x' } as any
      })
    ).toThrow()
    expect(doc).toEqual(original)
  })

  it('rejects unknown edge style patch keys without mutating the document', () => {
    const doc = addChildNode(
      addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
        id: 'root',
        title: 'Root'
      }),
      { parentId: 'root', id: 'child', title: 'Child' }
    )
    const original = structuredClone(doc)

    expect(() =>
      executeCommand(doc, setEdgeStyleCommand, {
        edgeId: 'root->child',
        stylePatch: { colorToken: 'warning', rogue: 'x' } as any
      })
    ).toThrow()
    expect(doc).toEqual(original)
  })

  it('rejects malformed nested edge style patches without mutating the document', () => {
    const doc = addChildNode(
      addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
        id: 'root',
        title: 'Root'
      }),
      { parentId: 'root', id: 'child', title: 'Child' }
    )
    const original = structuredClone(doc)

    expect(() =>
      executeCommand(doc, setEdgeStyleCommand, {
        edgeId: 'root->child',
        stylePatch: { labelStyle: { visible: false, rogue: true } } as any
      })
    ).toThrow()
    expect(doc).toEqual(original)
  })

  it('rejects commands against v2 documents with legacy edge component fields', () => {
    const doc = addChildNode(
      addRootNode(createEmptyDocument({ projectId: 'project-1', title: 'Project One', now: '2026-04-26T00:00:00.000Z' }), {
        id: 'root',
        title: 'Root'
      }),
      { parentId: 'root', id: 'child', title: 'Child' }
    )
    const invalidDoc = {
      ...doc,
      edges: [{ ...doc.edges[0], component: 'dashed-arrow' }]
    }

    expect(() => executeCommand(invalidDoc as any, moveNodesCommand, { nodeIds: ['root'], delta: { x: 1, y: 1 } })).toThrow()
  })

  it('generates inverse patches for title, movement, edge, and delete commands', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push({ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE })

    const edited = executeCommand(doc, editNodeTitleCommand, { nodeId: 'root', title: 'Edited Root' })
    const moved = executeCommand(edited.document, moveNodesCommand, {
      nodeIds: ['root', 'child'],
      delta: { x: 5, y: -2 }
    })
    const styled = executeCommand(moved.document, setEdgeStyleCommand, {
      edgeId: 'root->child',
      stylePatch: { arrow: 'end', linePattern: 'dashed' }
    })
    const deleted = executeCommand(styled.document, deleteNodePromoteChildrenCommand, { nodeId: 'root' })

    let reverted = applyPatches(deleted.document, deleted.inversePatches)
    reverted = applyPatches(reverted, styled.inversePatches)
    reverted = applyPatches(reverted, moved.inversePatches)
    reverted = applyPatches(reverted, edited.inversePatches)

    expect(reverted).toEqual(doc)
  })

  it('deletes multiple selected nodes as one command result', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'left', type: 'topic', position: { x: 240, y: -72 }, data: { title: 'Left' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'right', type: 'topic', position: { x: 240, y: 72 }, data: { title: 'Right' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'root->left', source: 'root', target: 'left', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'root->right', source: 'root', target: 'right', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    )

    const result = executeCommand(doc, deleteNodesPromoteChildrenCommand, { nodeIds: ['left', 'right'] })

    expect(result.document.nodes.map((node) => node.id)).toEqual(['root'])
    expect(result.document.edges).toEqual([])
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
  })

  it('adds a child node to the right of its parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, size: { width: 160, height: 48 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })

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
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })

    expect(() => addChildNode(doc, { parentId: 'root', id: 'child', title: '<b>Child</b>' })).toThrow(
      'Node title must be non-empty plain text'
    )
  })

  it('rejects an empty child node id', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })

    expect(() => addChildNode(doc, { parentId: 'root', id: '   ', title: 'Child' })).toThrow(
      'Node id must be non-empty'
    )
  })

  it('rejects a duplicate child node id', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'child', type: 'topic', position: { x: 250, y: 20 }, data: { title: 'Existing' }, style: DEFAULT_TOPIC_STYLE }
    )

    expect(() => addChildNode(doc, { parentId: 'root', id: 'child', title: 'Child' })).toThrow(
      'Node child already exists'
    )
  })

  it('edits a node title as plain text', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })

    const result = editNodeTitle(doc, { nodeId: 'root', title: 'Updated' })

    expect(result.nodes[0].data.title).toBe('Updated')
  })

  it('rejects a whitespace-only node title edit', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push({ id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE })

    expect(() => editNodeTitle(doc, { nodeId: 'root', title: '   ' })).toThrow(
      'Node title must be non-empty plain text'
    )
  })

  it('moves selected nodes by delta', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'b', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'B' }, style: DEFAULT_TOPIC_STYLE }
    )

    const result = moveNodes(doc, { nodeIds: ['a', 'b'], delta: { x: 5, y: -3 } })

    expect(result.nodes.map((node) => node.position)).toEqual([{ x: 5, y: -3 }, { x: 15, y: 17 }])
  })

  it('rejects moving nodes in a document with two parent edges', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'a', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'A' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'b', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'B' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'c', type: 'topic', position: { x: 20, y: 40 }, data: { title: 'C' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'edge-1', source: 'a', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'edge-2', source: 'b', target: 'c', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    )

    expect(() => moveNodes(doc, { nodeIds: ['a'], delta: { x: 5, y: -3 } })).toThrow(
      'Node c has more than one parent'
    )
  })

  it('deletes an edge and leaves the child as a root with its subtree intact', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'child', type: 'topic', position: { x: 240, y: 12 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 24 }, data: { title: 'Leaf' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', style: { ...DEFAULT_EDGE_STYLE, linePattern: 'dashed' } }
    )

    const result = deleteEdgeDetachChild(doc, { edgeId: 'root->child' })

    expect(result.nodes.find((node) => node.id === 'child')?.position).toEqual({ x: 240, y: 12 })
    expect(getParentId(result, 'child')).toBeNull()
    expect(getParentId(result, 'leaf')).toBe('child')
    expect(result.edges).toEqual([
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', style: { ...DEFAULT_EDGE_STYLE, linePattern: 'dashed' } }
    ])
  })

  it('rejects deleting a missing edge', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    expect(() => deleteEdgeDetachChild(doc, { edgeId: 'missing' })).toThrow('Edge missing does not exist')
  })

  it('deletes a node and promotes children to the deleted node parent', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'middle', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Middle' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'leaf', type: 'topic', position: { x: 480, y: 0 }, data: { title: 'Leaf' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'root->middle', source: 'root', target: 'middle', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      {
        id: 'middle->leaf',
        source: 'middle',
        target: 'leaf',
        type: 'mind-parent',
        style: { ...DEFAULT_EDGE_STYLE, arrow: 'end', colorToken: 'warning', linePattern: 'dotted', width: 'thick' }
      }
    )

    const result = deleteNodePromoteChildren(doc, { nodeId: 'middle' })

    expect(result.nodes.map((node) => node.id)).toEqual(['root', 'leaf'])
    expect(getParentId(result, 'leaf')).toBe('root')
    expect(result.edges).toEqual([
      { id: 'root->leaf', source: 'root', target: 'leaf', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    ])
  })

  it('deletes a root and promotes children to roots without moving them', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'left', type: 'topic', position: { x: 240, y: -72 }, data: { title: 'Left' }, style: DEFAULT_TOPIC_STYLE },
      { id: 'right', type: 'topic', position: { x: 240, y: 72 }, data: { title: 'Right' }, style: DEFAULT_TOPIC_STYLE }
    )
    doc.edges.push(
      { id: 'root->left', source: 'root', target: 'left', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'root->right', source: 'root', target: 'right', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
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
