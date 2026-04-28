import {
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type Point
} from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { serializeMindDocument, useEditorStore } from '@/features/editor/stores/editor'

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

function topicNode(id: string, title: string, position: Point) {
  return {
    id,
    type: 'topic' as const,
    position,
    size: DEFAULT_NODE_SIZE_BY_TYPE.topic,
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

describe('editor store adapter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads session state into shallow store fields', () => {
    const store = useEditorStore()
    const document = documentWithRoot()

    store.load(document)

    expect(store.document).toEqual(document)
    expect(store.document).not.toBe(document)
    expect(store.selectedNodeIds).toEqual([])
    expect(store.selectedEdgeId).toBeNull()
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.revision).toBeGreaterThan(0)
  })

  it('delegates editing actions to the engine session and syncs fields after each action', () => {
    const store = useEditorStore()
    store.load(emptyDocument())

    const rootId = store.addRootTopic({ id: 'root', title: 'Root topic' })
    const childId = store.addChildTopic({ id: 'child', title: 'Child topic' })

    expect(rootId).toBe('root')
    expect(childId).toBe('child')
    expect(store.document?.nodes.map((node) => node.id)).toEqual(['root', 'child'])
    expect(store.document?.edges).toEqual([
      { id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }
    ])
    expect(store.selectedNodeIds).toEqual(['child'])
    expect(store.selectedEdgeId).toBeNull()
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)
  })

  it('delegates generic node actions to the engine session and syncs fields after each action', () => {
    const store = useEditorStore()
    store.load(emptyDocument())

    const rootId = store.addRootNode({ id: 'root', type: 'topic', data: { title: 'Root topic' } })
    const codeId = store.addChildNode({ id: 'code', type: 'code', data: { code: 'let a = 1' } })
    store.updateNodeData('code', { code: 'const a = 2' })
    store.setSelectedNodeContentStyle({ wrap: false })

    expect(rootId).toBe('root')
    expect(codeId).toBe('code')
    expect(store.document?.nodes.map((node) => node.type)).toEqual(['topic', 'code'])
    expect(store.document?.nodes[1]).toMatchObject({
      data: { code: 'const a = 2' },
      contentStyle: { ...DEFAULT_CODE_CONTENT_STYLE, wrap: false }
    })
    expect(store.selectedNodeIds).toEqual(['code'])
    expect(store.canUndo).toBe(true)
  })

  it('keeps selection actions as thin session delegates', () => {
    const store = useEditorStore()
    store.load(
      emptyDocument({
        nodes: [
          topicNode('root', 'Root', { x: 0, y: 0 }),
          topicNode('child', 'Child', { x: 240, y: 0 })
        ],
        edges: [{ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent', style: DEFAULT_EDGE_STYLE }]
      })
    )

    store.selectEdge('root->child')
    expect(store.selectedEdgeId).toBe('root->child')
    expect(store.selectedNodeIds).toEqual([])

    store.selectOnly('root')
    expect(store.selectedEdgeId).toBeNull()
    expect(store.selectedNodeIds).toEqual(['root'])

    store.clearSelection()
    expect(store.selectedEdgeId).toBeNull()
    expect(store.selectedNodeIds).toEqual([])
  })

  it('preserves current EditorView save snapshot helpers', () => {
    const store = useEditorStore()
    store.load(documentWithRoot())
    const saveSnapshot = serializeMindDocument(store.document)

    expect(saveSnapshot).toBeTypeOf('string')
    expect(store.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(true)

    store.editNodeTitle('root', 'Edited while save in flight')

    expect(store.hasDocumentSnapshot(saveSnapshot ?? '')).toBe(false)
    expect(store.dirty).toBe(true)
  })

  it('supports local draft restore through commit without exposing history details', () => {
    const store = useEditorStore()
    store.load(documentWithRoot())
    const draft = {
      ...documentWithRoot(),
      nodes: [
        {
          ...topicNode('root', 'Root', { x: 10, y: 20 }),
          data: { title: 'Draft root' }
        }
      ]
    }

    store.commit(draft)
    if (draft.nodes[0]?.type === 'topic') {
      draft.nodes[0].data.title = 'Mutated after commit'
    }

    expect(store.document?.nodes[0]).toMatchObject({ data: { title: 'Draft root' } })
    expect(store.dirty).toBe(true)
    expect(store.canUndo).toBe(true)
  })

  it('resets to a fresh session when the view requests $reset', () => {
    const store = useEditorStore()
    store.load(documentWithRoot())
    store.editNodeTitle('root', 'Dirty')

    store.$reset()

    expect(store.document).toBeNull()
    expect(store.selectedNodeIds).toEqual([])
    expect(store.selectedEdgeId).toBeNull()
    expect(store.dirty).toBe(false)
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
    expect(store.revision).toBe(0)
  })
})
