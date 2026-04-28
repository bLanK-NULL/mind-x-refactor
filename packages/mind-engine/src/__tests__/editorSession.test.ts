import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_IMAGE_CONTENT_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type Point,
  type Size
} from '@mind-x/shared'
import { createEmptyDocument } from '../documentFactory.js'
import { createEditorSession, serializeMindDocument } from '../editorSession.js'

function emptyDocument(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    ...createEmptyDocument({
      projectId: 'project-1',
      title: 'Project One',
      now: '2026-04-28T00:00:00.000Z'
    }),
    ...overrides
  }
}

function topicNode(id: string, title: string, position: Point, size: Size = DEFAULT_NODE_SIZE_BY_TYPE.topic) {
  return {
    id,
    type: 'topic' as const,
    position,
    size,
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    data: { title },
    contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
}

function documentWithRoot(): MindDocument {
  return emptyDocument({
    nodes: [topicNode('root', 'Root', { x: 10, y: 20 })]
  })
}

function documentWithEdge(): MindDocument {
  return emptyDocument({
    nodes: [
      topicNode('root', 'Root', { x: 0, y: 0 }),
      topicNode('child', 'Child', { x: 240, y: 0 }),
      topicNode('leaf', 'Leaf', { x: 480, y: 0 })
    ],
    edges: [
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE },
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    ]
  })
}

describe('editor session', () => {
  it('loads a clean document with empty selection and initialized history flags', () => {
    const session = createEditorSession()
    const document = documentWithRoot()

    session.load(document)

    const state = session.getState()
    expect(state.document).toEqual(document)
    expect(state.selectedNodeIds).toEqual([])
    expect(state.selectedEdgeId).toBeNull()
    expect(state.dirty).toBe(false)
    expect(state.canUndo).toBe(false)
    expect(state.canRedo).toBe(false)
    expect(state.revision).toBe(1)
  })

  it('adds a root topic and a selected child topic through command history', () => {
    const session = createEditorSession()
    session.load(emptyDocument())

    const rootId = session.addRootTopic({ id: 'root', title: 'Root topic' })
    const childId = session.addChildTopic({ id: 'child', title: 'Child topic' })

    const state = session.getState()
    expect(rootId).toBe('root')
    expect(childId).toBe('child')
    expect(state.document?.nodes.map((node) => ({ id: node.id, title: node.data.title }))).toEqual([
      { id: 'root', title: 'Root topic' },
      { id: 'child', title: 'Child topic' }
    ])
    expect(state.document?.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    ])
    expect(state.selectedNodeIds).toEqual(['child'])
    expect(state.selectedEdgeId).toBeNull()
    expect(state.dirty).toBe(true)
    expect(state.canUndo).toBe(true)
  })

  it('adds generic nodes and updates their data and content style through history', () => {
    const session = createEditorSession()
    session.load(emptyDocument())

    const rootId = session.addRootNode({ id: 'root-image', type: 'image', data: { url: 'https://example.com/root.png' } })
    const childId = session.addChildNode({ id: 'code-child', type: 'code', data: { code: 'let value = 1' } })

    session.updateNodeData('code-child', { code: 'const value = 2' })
    session.setSelectedNodeContentStyle({ wrap: false })

    const state = session.getState()
    expect(rootId).toBe('root-image')
    expect(childId).toBe('code-child')
    expect(state.document?.nodes.map((node) => node.type)).toEqual(['image', 'code'])
    expect(state.document?.nodes.map((node) => node.contentStyle)).toEqual([
      DEFAULT_IMAGE_CONTENT_STYLE,
      { ...DEFAULT_CODE_CONTENT_STYLE, wrap: false }
    ])
    expect(state.document?.nodes[1]).toMatchObject({ data: { code: 'const value = 2' } })
    expect(state.selectedNodeIds).toEqual(['code-child'])

    session.undo()
    expect(session.getState().document?.nodes[1].contentStyle).toEqual(DEFAULT_CODE_CONTENT_STYLE)
  })

  it('keeps node and edge selection mutually exclusive', () => {
    const session = createEditorSession()
    session.load(documentWithEdge())

    session.selectEdge('root->child')
    expect(session.getState().selectedEdgeId).toBe('root->child')
    expect(session.getState().selectedNodeIds).toEqual([])

    session.selectOnly('root')
    expect(session.getState().selectedEdgeId).toBeNull()
    expect(session.getState().selectedNodeIds).toEqual(['root'])

    session.selectEdge('root->child')
    session.setSelection(['root', 'child'])
    expect(session.getState().selectedEdgeId).toBeNull()
    expect(session.getState().selectedNodeIds).toEqual(['root', 'child'])
  })

  it('deletes a selected edge, clears edge selection, and keeps the child node as a root', () => {
    const session = createEditorSession()
    session.load(documentWithEdge())

    session.selectEdge('root->child')
    session.deleteSelected()

    expect(session.getState().document?.edges).toEqual([
      { id: 'child->leaf', source: 'child', target: 'leaf', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    ])
    expect(session.getState().selectedEdgeId).toBeNull()
    expect(session.getState().selectedNodeIds).toEqual([])
    expect(session.getState().canUndo).toBe(true)

    session.undo()
    expect(session.getState().document?.edges.map((edge) => edge.id)).toEqual(['root->child', 'child->leaf'])
  })

  it('deletes selected nodes and compacts stale selection', () => {
    const session = createEditorSession()
    session.load(emptyDocument())
    session.addRootTopic({ id: 'root', title: 'Root topic' })
    session.addChildTopic({ id: 'child', title: 'Child topic' })
    session.selectOnly('root')

    session.deleteSelected()

    expect(session.getState().document?.nodes.map((node) => node.id)).toEqual(['child'])
    expect(session.getState().document?.edges).toEqual([])
    expect(session.getState().selectedNodeIds).toEqual([])
    expect(session.getState().selectedEdgeId).toBeNull()
  })

  it('skips selected node shell style no-ops without dropping redo history', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.setSelectedNodeShellStyle({ colorToken: 'purple' })
    session.undo()
    expect(session.getState().canRedo).toBe(true)

    session.setSelectedNodeShellStyle({ colorToken: DEFAULT_NODE_SHELL_STYLE.colorToken })

    expect(session.getState().document?.nodes[0].shellStyle).toEqual(DEFAULT_NODE_SHELL_STYLE)
    expect(session.getState().dirty).toBe(false)
    expect(session.getState().canUndo).toBe(false)
    expect(session.getState().canRedo).toBe(true)
  })

  it('skips selected edge style no-ops without dropping redo history', () => {
    const session = createEditorSession()
    session.load(documentWithEdge())
    session.selectEdge('root->child')

    session.setSelectedEdgeStyle({ colorToken: 'warning' })
    session.undo()
    expect(session.getState().canRedo).toBe(true)

    session.setSelectedEdgeStyle({ colorToken: DEFAULT_EDGE_STYLE.colorToken })

    expect(session.getState().document?.edges[0].style).toEqual(DEFAULT_EDGE_STYLE)
    expect(session.getState().dirty).toBe(false)
    expect(session.getState().canUndo).toBe(false)
    expect(session.getState().canRedo).toBe(true)
  })

  it('previews repeated drag moves as one undoable history entry when the interaction ends', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.previewMoveSelectedByScreenDelta({ x: 5, y: 0 })
    session.previewMoveSelectedByScreenDelta({ x: 10, y: -4 })
    session.previewMoveSelectedByScreenDelta({ x: -3, y: 6 })

    expect(session.getState().document?.nodes[0].position).toEqual({ x: 22, y: 22 })
    expect(session.getState().canUndo).toBe(false)

    session.finishInteraction()

    expect(session.getState().canUndo).toBe(true)
    session.undo()
    expect(session.getState().document?.nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(session.getState().canRedo).toBe(true)
  })

  it('previews repeated resize as one undoable history entry', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.previewResizeSelectedByDelta({ width: 20, height: 10 })
    session.previewResizeSelectedByDelta({ width: 20, height: 10 })

    expect(session.getState().document?.nodes[0].size).toEqual({ width: 220, height: 76 })
    expect(session.getState().canUndo).toBe(false)

    session.finishInteraction()

    expect(session.getState().canUndo).toBe(true)
    session.undo()
    expect(session.getState().document?.nodes[0].size).toEqual({ width: 180, height: 56 })
  })

  it('allows screen-delta methods to be called without a session this binding', () => {
    const previewSession = createEditorSession()
    previewSession.load(documentWithRoot())
    previewSession.selectOnly('root')
    const { previewMoveSelectedByScreenDelta } = previewSession

    previewMoveSelectedByScreenDelta({ x: 5, y: 0 })

    expect(previewSession.getState().document?.nodes[0].position).toEqual({ x: 15, y: 20 })
    expect(previewSession.getState().canUndo).toBe(false)

    const moveSession = createEditorSession()
    moveSession.load(documentWithRoot())
    moveSession.selectOnly('root')
    const { moveSelectedByScreenDelta } = moveSession

    moveSelectedByScreenDelta({ x: 5, y: 0 })

    expect(moveSession.getState().document?.nodes[0].position).toEqual({ x: 15, y: 20 })
    expect(moveSession.getState().canUndo).toBe(true)
  })

  it('finalizes a pending preview before editing a node title', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.previewMoveSelectedByScreenDelta({ x: 5, y: 0 })
    session.editNodeTitle('root', 'Edited after preview')

    expect(session.getState().document?.nodes[0].position).toEqual({ x: 15, y: 20 })
    expect(session.getState().document?.nodes[0].data.title).toBe('Edited after preview')

    session.undo()
    expect(session.getState().document?.nodes[0].position).toEqual({ x: 15, y: 20 })
    expect(session.getState().document?.nodes[0].data.title).toBe('Root')

    session.undo()
    expect(session.getState().document?.nodes[0].position).toEqual({ x: 10, y: 20 })
  })

  it('finalizes a pending preview before external title updates', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.previewMoveSelectedByScreenDelta({ x: 5, y: 0 })
    session.updateDocumentTitle('Renamed During Preview')
    session.finishInteraction()

    expect(session.getState().document?.meta.title).toBe('Renamed During Preview')
    expect(session.getState().document?.nodes[0].position).toEqual({ x: 15, y: 20 })

    session.undo()
    expect(session.getState().document?.meta.title).toBe('Renamed During Preview')
    expect(session.getState().document?.nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(session.getState().canUndo).toBe(false)
  })

  it('updates viewport and marks dirty without adding undo history', () => {
    const session = createEditorSession()
    session.load(emptyDocument())

    session.setViewport({ x: 40, y: 50, zoom: 1.5 })

    expect(session.getState().document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
    expect(session.getState().dirty).toBe(true)
    expect(session.getState().canUndo).toBe(false)
  })

  it('does not add viewport-only changes to history when an interaction finishes', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())

    session.setViewport({ x: 40, y: 50, zoom: 1.5 })
    session.finishInteraction()

    expect(session.getState().document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
    expect(session.getState().canUndo).toBe(false)
  })

  it('keeps the current viewport when undoing and redoing content changes', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.editNodeTitle('root', 'Renamed root')
    session.setViewport({ x: 40, y: 50, zoom: 1.5 })

    session.undo()

    expect(session.getState().document?.nodes[0].data.title).toBe('Root')
    expect(session.getState().document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })

    session.redo()

    expect(session.getState().document?.nodes[0].data.title).toBe('Renamed root')
    expect(session.getState().document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
  })

  it('tracks dirty state against loaded documents and explicit clean marks', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())

    expect(session.getState().dirty).toBe(false)

    session.editNodeTitle('root', 'Renamed root')
    expect(session.getState().dirty).toBe(true)

    session.undo()
    expect(session.getState().dirty).toBe(false)

    session.redo()
    expect(session.getState().dirty).toBe(true)

    session.markClean()
    expect(session.getState().dirty).toBe(false)
  })

  it('compares current document against a serialized save snapshot', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    const saveSnapshot = serializeMindDocument(session.getState().document)

    expect(saveSnapshot).toBeTypeOf('string')
    expect(session.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(true)

    session.editNodeTitle('root', 'Edited while save in flight')

    expect(session.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(false)
    expect(session.getState().dirty).toBe(true)
  })

  it('updates title from external project rename while preserving dirty semantics and redo history', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.editNodeTitle('root', 'First edit')
    session.editNodeTitle('root', 'Second edit')
    session.undo()

    session.updateDocumentTitle('Renamed While Redo Exists')

    expect(session.getState().document?.meta.title).toBe('Renamed While Redo Exists')
    expect(session.getState().document?.nodes[0].data.title).toBe('First edit')
    expect(session.getState().canRedo).toBe(true)

    session.undo()
    expect(session.getState().document?.meta.title).toBe('Renamed While Redo Exists')
    expect(session.getState().document?.nodes[0].data.title).toBe('Root')
    expect(session.getState().dirty).toBe(false)

    session.redo()
    expect(session.getState().document?.nodes[0].data.title).toBe('First edit')
    session.redo()
    expect(session.getState().document?.nodes[0].data.title).toBe('Second edit')
  })

  it('preserves redo history when an external title update happens at a clean undo point', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.editNodeTitle('root', 'First edit')
    session.undo()

    session.updateDocumentTitle('Renamed At Clean Point')

    expect(session.getState().document?.meta.title).toBe('Renamed At Clean Point')
    expect(session.getState().document?.nodes[0].data.title).toBe('Root')
    expect(session.getState().dirty).toBe(false)
    expect(session.getState().canRedo).toBe(true)

    session.redo()
    expect(session.getState().document?.meta.title).toBe('Renamed At Clean Point')
    expect(session.getState().document?.nodes[0].data.title).toBe('First edit')
  })

  it('generates child ids without colliding with loaded node ids', () => {
    const session = createEditorSession()
    session.load(
      emptyDocument({
        nodes: [
          topicNode('node-1', 'Root topic', { x: 0, y: 0 }),
          topicNode('node-2', 'Existing child', { x: 260, y: 0 })
        ],
        edges: [{ id: 'node-1->node-2', source: 'node-1', target: 'node-2', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }]
      })
    )
    session.selectOnly('node-1')

    const childId = session.addChildTopic({ title: 'New child' })

    expect(childId).toBe('node-3')
    expect(session.getState().document?.nodes.map((node) => node.id)).toEqual(['node-1', 'node-2', 'node-3'])
  })

  it('does not mutate state when undo or redo is invoked at a history boundary', () => {
    const session = createEditorSession()
    session.load(emptyDocument())
    session.addRootTopic({ id: 'root', title: 'Root topic' })

    session.undo()
    const afterUndo = session.getState()
    session.undo()

    expect(session.getState().document).toBe(afterUndo.document)
    expect(session.getState().selectedNodeIds).toEqual(afterUndo.selectedNodeIds)
    expect(session.getState().dirty).toBe(afterUndo.dirty)
    expect(session.getState().canUndo).toBe(false)
    expect(session.getState().canRedo).toBe(true)

    session.redo()
    const afterRedo = session.getState()
    session.redo()

    expect(session.getState().document).toBe(afterRedo.document)
    expect(session.getState().selectedNodeIds).toEqual(afterRedo.selectedNodeIds)
    expect(session.getState().dirty).toBe(afterRedo.dirty)
    expect(session.getState().canUndo).toBe(true)
    expect(session.getState().canRedo).toBe(false)
  })

  it('returns shallow immutable session state and copied selection arrays', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    const first = session.getState()
    const mutableSelection = first.selectedNodeIds as string[]
    mutableSelection.push('outside')

    const second = session.getState()
    expect(second.selectedNodeIds).toEqual(['root'])
    expect(second.document).toBe(first.document)
    expect(Object.isFrozen(second.document as MindDocument)).toBe(true)

    session.editNodeTitle('root', 'Changed')
    const third = session.getState()

    expect(third.document).not.toBe(second.document)
    expect(third.revision).toBeGreaterThan(second.revision)
  })
})
