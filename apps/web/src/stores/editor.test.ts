import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor'

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

  it('updates viewport and marks dirty without adding undo history', () => {
    const store = loadedStore()

    store.setViewport({ x: 40, y: 50, zoom: 1.5 })

    expect(store.document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(false)
  })
})
