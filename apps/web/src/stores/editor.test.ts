import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { serializeMindDocument, useEditorStore } from './editor'

function emptyDocument(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    ...createEmptyDocument({
      projectId: 'project-1',
      title: 'Project One',
      now: '2026-04-26T00:00:00.000Z'
    }),
    ...overrides
  }
}

function loadedStore(document = emptyDocument()) {
  const store = useEditorStore()
  store.load(document)
  return store
}

describe('editor store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads a document cleanly with empty selection and initialized history', () => {
    const document = emptyDocument({
      nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
    })
    const store = loadedStore(document)

    expect(store.document).toEqual(document)
    expect(store.selectedNodeIds).toEqual([])
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('adds a root topic to an empty document and then adds a selected child', () => {
    const store = loadedStore()

    const rootId = store.addRootTopic({ id: 'root', title: 'Root topic' })
    const childId = store.addChildTopic({ id: 'child', title: 'Child topic' })

    expect(rootId).toBe('root')
    expect(childId).toBe('child')
    expect(store.document?.nodes.map((node) => ({ id: node.id, title: node.data.title }))).toEqual([
      { id: 'root', title: 'Root topic' },
      { id: 'child', title: 'Child topic' }
    ])
    expect(store.document?.edges).toEqual([{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' }])
    expect(store.selectedNodeIds).toEqual(['child'])
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)
  })

  it('refuses to add another root when the document already has nodes', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })

    expect(store.addRootTopic({ id: 'second-root', title: 'Second root' })).toBeNull()
    expect(store.document?.nodes.map((node) => node.id)).toEqual(['root'])
  })

  it('edits the selected node title through the engine command', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })

    store.editNodeTitle('root', 'Renamed root')

    expect(store.document?.nodes[0].data.title).toBe('Renamed root')
    expect(store.dirty).toBe(true)
  })

  it('moves selected nodes by world-space delta', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })
    store.selectOnly('root')

    store.moveSelectedByWorldDelta({ x: 12, y: -8 })

    expect(store.document?.nodes[0].position).toEqual({ x: 12, y: -8 })
  })

  it('converts screen-space drag deltas through current viewport zoom before moving', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })
    store.selectOnly('root')
    store.setViewport({ x: 0, y: 0, zoom: 2 })

    store.moveSelectedByScreenDelta({ x: 30, y: -10 })

    expect(store.document?.nodes[0].position).toEqual({ x: 15, y: -5 })
  })

  it('previews repeated drag moves as one undoable history entry when the interaction ends', () => {
    const document = emptyDocument({
      nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
    })
    const store = loadedStore(document)
    store.selectOnly('root')

    store.previewMoveSelectedByScreenDelta({ x: 5, y: 0 })
    store.previewMoveSelectedByScreenDelta({ x: 10, y: -4 })
    store.previewMoveSelectedByScreenDelta({ x: -3, y: 6 })

    expect(store.document?.nodes[0].position).toEqual({ x: 22, y: 22 })
    expect(store.canUndo).toBe(false)

    store.finishInteraction()

    expect(store.canUndo).toBe(true)
    store.undo()
    expect(store.document?.nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(store.canRedo).toBe(true)
  })

  it('deletes selected nodes and clears stale selection without crashing on root deletion', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })
    store.addChildTopic({ id: 'child', title: 'Child topic' })
    store.selectOnly('root')

    store.deleteSelected()

    expect(store.document?.nodes.map((node) => node.id)).toEqual(['child'])
    expect(store.document?.edges).toEqual([])
    expect(store.selectedNodeIds).toEqual([])
  })

  it('undoes, redoes, and drops redo history after a new commit', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })
    store.editNodeTitle('root', 'First rename')

    store.undo()
    expect(store.document?.nodes[0].data.title).toBe('Root topic')
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.document?.nodes[0].data.title).toBe('First rename')
    expect(store.canRedo).toBe(false)

    store.undo()
    store.editNodeTitle('root', 'Second rename')

    expect(store.document?.nodes[0].data.title).toBe('Second rename')
    expect(store.canRedo).toBe(false)
  })

  it('keeps a freshly loaded clean document unchanged when undo and redo are unavailable', () => {
    const document = emptyDocument({
      nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
    })
    const store = loadedStore(document)
    store.selectOnly('root')
    const loadedDocument = store.document
    const loadedSelection = [...store.selectedNodeIds]

    store.undo()
    store.redo()

    expect(store.document).toBe(loadedDocument)
    expect(store.selectedNodeIds).toEqual(loadedSelection)
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('tracks dirty state against the loaded document and explicit clean marks', () => {
    const document = emptyDocument({
      nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
    })
    const store = loadedStore(document)

    store.undo()
    store.redo()
    expect(store.dirty).toBe(false)

    store.editNodeTitle('root', 'Renamed root')
    expect(store.dirty).toBe(true)

    store.undo()
    expect(store.document?.nodes[0].data.title).toBe('Root')
    expect(store.dirty).toBe(false)

    store.redo()
    expect(store.document?.nodes[0].data.title).toBe('Renamed root')
    expect(store.dirty).toBe(true)

    store.markClean()
    expect(store.dirty).toBe(false)

    store.editNodeTitle('root', 'Renamed again')
    expect(store.dirty).toBe(true)
  })

  it('compares the current document against a serialized save snapshot', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
      })
    )
    const saveSnapshot = serializeMindDocument(store.document)

    expect(saveSnapshot).toBeTypeOf('string')
    expect(store.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(true)

    store.editNodeTitle('root', 'Edited while save in flight')

    expect(store.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(false)
    expect(store.dirty).toBe(true)
  })

  it('updates the document title from an external project rename while preserving dirty semantics', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
      })
    )

    store.updateDocumentTitle('Renamed Project')

    expect(store.document?.meta.title).toBe('Renamed Project')
    expect(store.dirty).toBe(false)

    store.editNodeTitle('root', 'Unsaved root')
    store.updateDocumentTitle('Renamed Again')

    expect(store.document?.meta.title).toBe('Renamed Again')
    expect(store.document?.nodes[0].data.title).toBe('Unsaved root')
    expect(store.dirty).toBe(true)
  })

  it('keeps external project renames through undo and redo on a dirty document', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
      })
    )
    store.editNodeTitle('root', 'Unsaved root')

    store.updateDocumentTitle('Renamed Project')
    store.undo()

    expect(store.document?.meta.title).toBe('Renamed Project')
    expect(store.document?.nodes[0].data.title).toBe('Root')
    expect(store.dirty).toBe(false)

    store.redo()

    expect(store.document?.meta.title).toBe('Renamed Project')
    expect(store.document?.nodes[0].data.title).toBe('Unsaved root')
    expect(store.dirty).toBe(true)
  })

  it('does not mutate state when undo or redo is invoked at the history boundary', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })

    store.undo()
    expect(store.document?.nodes).toEqual([])
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
    const afterBoundaryUndoDocument = store.document
    const afterBoundaryUndoSelection = [...store.selectedNodeIds]
    const afterBoundaryUndoDirty = store.dirty

    store.undo()

    expect(store.document).toBe(afterBoundaryUndoDocument)
    expect(store.selectedNodeIds).toEqual(afterBoundaryUndoSelection)
    expect(store.dirty).toBe(afterBoundaryUndoDirty)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)

    store.redo()
    expect(store.document?.nodes.map((node) => node.id)).toEqual(['root'])
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)
    const afterBoundaryRedoDocument = store.document
    const afterBoundaryRedoSelection = [...store.selectedNodeIds]
    const afterBoundaryRedoDirty = store.dirty

    store.redo()

    expect(store.document).toBe(afterBoundaryRedoDocument)
    expect(store.selectedNodeIds).toEqual(afterBoundaryRedoSelection)
    expect(store.dirty).toBe(afterBoundaryRedoDirty)
    expect(store.canUndo).toBe(true)
    expect(store.canRedo).toBe(false)
  })

  it('updates viewport and marks dirty without adding undo history', () => {
    const store = loadedStore()

    store.setViewport({ x: 40, y: 50, zoom: 1.5 })

    expect(store.document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(false)
  })

  it('rejects invalid root topics without mutating the document', () => {
    const store = loadedStore()

    expect(() => store.addRootTopic({ id: '   ', title: 'Root topic' })).toThrow('Node id must be non-empty')
    expect(() => store.addRootTopic({ id: 'root', title: '<b>Root</b>' })).toThrow(
      'Node title must be non-empty plain text'
    )

    expect(store.document?.nodes).toEqual([])
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('rejects invalid title edits without mutating the document', () => {
    const store = loadedStore()
    store.addRootTopic({ id: 'root', title: 'Root topic' })
    store.markClean()

    expect(() => store.editNodeTitle('root', '<img src=x>')).toThrow('Node title must be non-empty plain text')

    expect(store.document?.nodes[0].data.title).toBe('Root topic')
    expect(store.dirty).toBe(false)
  })
})
