# Mind Engine Editor Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move editor session state, selection, dirty tracking, undo/redo coordination, and preview commit behavior into `packages/mind-engine`.

**Architecture:** Add a pure `EditorSession` coordinator above the existing graph, command, patch, and history modules. Convert the Pinia editor store into a shallow Vue adapter that owns no command coordination logic. Keep DOM events, server sync, local drafts, and export in `apps/web`.

**Tech Stack:** TypeScript, Vue 3, Pinia setup stores, Immer, Vitest, `@mind-x/shared`, `@mind-x/mind-engine`.

---

## Scope Check

This plan covers one tightly coupled refactor: the web editor store currently owns session behavior that belongs in `packages/mind-engine`. The tasks are staged so the engine behavior can be built and tested before the Vue adapter changes.

This plan does not change API persistence, routing, Docker, visual layout, or browser interaction rules. Keyboard handling, context menu placement, d3 viewport binding, and inspector DOM behavior stay in `apps/web`.

## File Structure

Create and modify these files:

```text
packages/mind-engine/src/editorSession.ts
  New pure session coordinator. Owns document state, selection, edge selection,
  history, dirty tracking, generated node ids, preview commit, and title sync.

packages/mind-engine/src/editorSession.test.ts
  New engine-level behavior tests moved out of the web store layer.

packages/mind-engine/src/index.ts
  Export the editor session API.

apps/web/src/stores/editor.ts
  Convert to a Pinia setup-store adapter around createEditorSession().

apps/web/src/stores/editor.test.ts
  Replace duplicated engine behavior checks with focused adapter checks.
```

Do not split `editorSession.ts` during this first pass. If the implementation becomes hard to read after it passes verification, split it in a follow-up change, not inside this migration.

## Task 1: Add Engine Session Behavior Tests

**Files:**
- Create: `packages/mind-engine/src/editorSession.test.ts`

- [ ] **Step 1: Write the failing engine session test file**

Create `packages/mind-engine/src/editorSession.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE, type MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from './documentFactory.js'
import { createEditorSession, serializeMindDocument } from './editorSession.js'

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

function documentWithRoot(): MindDocument {
  return emptyDocument({
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 10, y: 20 },
        data: { title: 'Root' },
        style: DEFAULT_TOPIC_STYLE
      }
    ]
  })
}

function documentWithEdge(): MindDocument {
  return emptyDocument({
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 0, y: 0 },
        data: { title: 'Root' },
        style: DEFAULT_TOPIC_STYLE
      },
      {
        id: 'child',
        type: 'topic',
        position: { x: 240, y: 0 },
        data: { title: 'Child' },
        style: DEFAULT_TOPIC_STYLE
      },
      {
        id: 'leaf',
        type: 'topic',
        position: { x: 480, y: 0 },
        data: { title: 'Leaf' },
        style: DEFAULT_TOPIC_STYLE
      }
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

  it('skips selected node style no-ops without dropping redo history', () => {
    const session = createEditorSession()
    session.load(documentWithRoot())
    session.selectOnly('root')

    session.setSelectedNodeStyle({ colorToken: 'purple' })
    session.undo()
    expect(session.getState().canRedo).toBe(true)

    session.setSelectedNodeStyle({ colorToken: DEFAULT_TOPIC_STYLE.colorToken })

    expect(session.getState().document?.nodes[0].style).toEqual(DEFAULT_TOPIC_STYLE)
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

  it('updates viewport and marks dirty without adding undo history', () => {
    const session = createEditorSession()
    session.load(emptyDocument())

    session.setViewport({ x: 40, y: 50, zoom: 1.5 })

    expect(session.getState().document?.viewport).toEqual({ x: 40, y: 50, zoom: 1.5 })
    expect(session.getState().dirty).toBe(true)
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

  it('generates child ids without colliding with loaded node ids', () => {
    const session = createEditorSession()
    session.load(
      emptyDocument({
        nodes: [
          {
            id: 'node-1',
            type: 'topic',
            position: { x: 0, y: 0 },
            size: { height: 56, width: 180 },
            data: { title: 'Root topic' },
            style: DEFAULT_TOPIC_STYLE
          },
          {
            id: 'node-2',
            type: 'topic',
            position: { x: 260, y: 0 },
            size: { height: 56, width: 180 },
            data: { title: 'Existing child' },
            style: DEFAULT_TOPIC_STYLE
          }
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
```

- [ ] **Step 2: Run the new test and verify it fails for the right reason**

Run:

```bash
npm run test -w packages/mind-engine -- src/editorSession.test.ts
```

Expected: FAIL because `packages/mind-engine/src/editorSession.ts` does not exist and `createEditorSession` cannot be imported.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add packages/mind-engine/src/editorSession.test.ts
git commit -m "test(engine): specify editor session behavior"
```

Expected: commit succeeds with only `packages/mind-engine/src/editorSession.test.ts` staged.

## Task 2: Implement EditorSession In Mind Engine

**Files:**
- Create: `packages/mind-engine/src/editorSession.ts`
- Modify: `packages/mind-engine/src/index.ts`
- Test: `packages/mind-engine/src/editorSession.test.ts`

- [ ] **Step 1: Create the editor session implementation**

Create `packages/mind-engine/src/editorSession.ts`:

```ts
import { produce } from 'immer'
import {
  mindDocumentSchema,
  type EdgeStyle,
  type MindDocument,
  type Point,
  type TopicNodeStyle,
  type Viewport
} from '@mind-x/shared'
import {
  addChildNodeCommand,
  addRootNodeCommand,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  setEdgeStyleCommand,
  setNodeStyleCommand,
  type CommandResult
} from './commands.js'
import { createHistory, type History } from './history.js'
import { replaceWithPatchResult } from './patches.js'

export type AddTopicInput = {
  id?: string
  title?: string
}

export type AddChildTopicInput = AddTopicInput & {
  parentId?: string
}

export type EditorSessionState = Readonly<{
  canRedo: boolean
  canUndo: boolean
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: readonly string[]
}>

export type EditorSession = {
  addChildTopic(input?: AddChildTopicInput): string | null
  addRootTopic(input?: AddTopicInput): string | null
  clearSelection(): void
  commit(document: MindDocument): void
  deleteSelected(): void
  editNodeTitle(nodeId: string, title: string): void
  finishInteraction(): void
  getState(): EditorSessionState
  hasDocumentSnapshot(snapshotJson: string): boolean
  load(document: MindDocument): void
  markClean(): void
  moveSelectedByScreenDelta(delta: Point): void
  moveSelectedByWorldDelta(delta: Point): void
  previewMoveSelectedByScreenDelta(delta: Point): void
  previewMoveSelectedByWorldDelta(delta: Point): void
  redo(): void
  selectEdge(edgeId: string): void
  selectOnly(nodeId: string): void
  setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void
  setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void
  setSelection(nodeIds: string[]): void
  setViewport(viewport: Viewport): void
  undo(): void
  updateDocumentTitle(title: string): void
}

type EditorSessionInternalState = {
  cleanDocumentJson: string | null
  document: MindDocument | null
  history: History<MindDocument> | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

type CommitSelection = {
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

const INITIAL_STATE: EditorSessionInternalState = {
  cleanDocumentJson: null,
  document: null,
  history: null,
  revision: 0,
  selectedEdgeId: null,
  selectedNodeIds: []
}

function cloneDocument(document: MindDocument): MindDocument {
  return structuredClone(document)
}

function validateDocument(document: MindDocument): MindDocument {
  return mindDocumentSchema.parse(cloneDocument(document))
}

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(document) : null
}

function createNodeId(document: MindDocument, currentSequence: () => number, setSequence: (value: number) => void): string {
  const existingNodeIds = new Set(document.nodes.map((node) => node.id))
  let nextSequence = currentSequence()

  do {
    nextSequence += 1
  } while (existingNodeIds.has(`node-${nextSequence}`))

  setSequence(nextSequence)
  return `node-${nextSequence}`
}

function styleValueEquals(currentValue: unknown, nextValue: unknown): boolean {
  if (Object.is(currentValue, nextValue)) {
    return true
  }

  if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
    return (
      Array.isArray(currentValue) &&
      Array.isArray(nextValue) &&
      currentValue.length === nextValue.length &&
      currentValue.every((value, index) => styleValueEquals(value, nextValue[index]))
    )
  }

  if (
    typeof currentValue !== 'object' ||
    currentValue === null ||
    typeof nextValue !== 'object' ||
    nextValue === null
  ) {
    return false
  }

  const currentRecord = currentValue as Record<string, unknown>
  const nextRecord = nextValue as Record<string, unknown>
  const currentKeys = Object.keys(currentRecord)
  const nextKeys = Object.keys(nextRecord)

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(nextRecord, key) && styleValueEquals(currentRecord[key], nextRecord[key])
    )
  )
}

function isStylePatchNoop<TStyle extends object>(style: TStyle, stylePatch: Partial<TStyle>): boolean {
  return (Object.entries(stylePatch) as Array<[keyof TStyle, TStyle[keyof TStyle]]>).every(([key, value]) =>
    styleValueEquals(style[key], value)
  )
}

function compactSelection(document: MindDocument | null, selectedNodeIds: string[]): string[] {
  if (!document) {
    return []
  }

  const nodeIds = new Set(document.nodes.map((node) => node.id))
  return selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId))
}

function compactSelectedEdge(document: MindDocument | null, selectedEdgeId: string | null): string | null {
  if (!document || !selectedEdgeId) {
    return null
  }

  return document.edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null
}

function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = cloneDocument(document)
  next.meta = {
    ...next.meta,
    title
  }
  return mindDocumentSchema.parse(next)
}

function retitleHistory(history: History<MindDocument>, title: string): History<MindDocument> {
  return history.replaceAll((document) => retitleDocument(document, title))
}

function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  return currentDocument?.viewport ? { ...document, viewport: { ...currentDocument.viewport } } : document
}

function stateIsDirty(state: EditorSessionInternalState): boolean {
  return serializeMindDocument(state.document) !== state.cleanDocumentJson
}

function sameSelection(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function createEditorSession(): EditorSession {
  let state: EditorSessionInternalState = structuredClone(INITIAL_STATE)
  let generatedNodeSequence = 0

  function updateState(recipe: (draft: EditorSessionInternalState) => void): void {
    state = produce(state, (draft) => {
      recipe(draft)
      draft.revision += 1
    })
  }

  function getSequence(): number {
    return generatedNodeSequence
  }

  function setSequence(value: number): void {
    generatedNodeSequence = value
  }

  function commitCommandResult(result: CommandResult, nextSelection?: CommitSelection): void {
    const nextDocument = cloneDocument(result.document)
    state.history?.push({
      document: nextDocument,
      patches: result.patches,
      inversePatches: result.inversePatches
    })

    updateState((draft) => {
      draft.document = nextDocument
      draft.selectedNodeIds = compactSelection(nextDocument, nextSelection?.selectedNodeIds ?? draft.selectedNodeIds)
      draft.selectedEdgeId = compactSelectedEdge(nextDocument, nextSelection?.selectedEdgeId ?? draft.selectedEdgeId)
      if (draft.selectedEdgeId) {
        draft.selectedNodeIds = []
      }
    })
  }

  function commitCurrentDocument(): void {
    if (!state.document || !state.history) {
      return
    }

    const current = state.history.current()
    const currentJson = serializeMindDocument(current)
    const nextJson = serializeMindDocument(state.document)
    if (currentJson === nextJson) {
      return
    }

    commitCommandResult(replaceWithPatchResult(current, cloneDocument(state.document)))
  }

  return {
    addChildTopic(input: AddChildTopicInput = {}) {
      if (!state.document) {
        return null
      }

      const parentId = input.parentId ?? state.selectedNodeIds[0]
      if (!parentId) {
        return null
      }

      const id = input.id ?? createNodeId(state.document, getSequence, setSequence)
      const result = executeCommand(cloneDocument(state.document), addChildNodeCommand, {
        parentId,
        id,
        title: input.title ?? 'New topic'
      })
      commitCommandResult(result, { selectedEdgeId: null, selectedNodeIds: [id] })
      return id
    },

    addRootTopic(input: AddTopicInput = {}) {
      if (!state.document || state.document.nodes.length > 0) {
        return null
      }

      const id = input.id ?? createNodeId(state.document, getSequence, setSequence)
      const result = executeCommand(cloneDocument(state.document), addRootNodeCommand, {
        id,
        title: input.title ?? 'New topic'
      })
      commitCommandResult(result, { selectedEdgeId: null, selectedNodeIds: [id] })
      return id
    },

    clearSelection() {
      if (state.selectedEdgeId === null && state.selectedNodeIds.length === 0) {
        return
      }

      updateState((draft) => {
        draft.selectedEdgeId = null
        draft.selectedNodeIds = []
      })
    },

    commit(document) {
      const next = validateDocument(document)
      const current = state.history?.current() ?? state.document ?? next
      commitCommandResult(replaceWithPatchResult(current, next))
    },

    deleteSelected() {
      if (!state.document) {
        return
      }

      if (state.selectedEdgeId) {
        const edgeId = state.selectedEdgeId
        if (!state.document.edges.some((edge) => edge.id === edgeId)) {
          updateState((draft) => {
            draft.selectedEdgeId = null
          })
          return
        }

        const result = executeCommand(cloneDocument(state.document), deleteEdgeDetachChildCommand, { edgeId })
        commitCommandResult(result, { selectedEdgeId: null, selectedNodeIds: [] })
        return
      }

      if (state.selectedNodeIds.length === 0) {
        return
      }

      const result = executeCommand(cloneDocument(state.document), deleteNodesPromoteChildrenCommand, {
        nodeIds: state.selectedNodeIds
      })
      commitCommandResult(result)
    },

    editNodeTitle(nodeId, title) {
      if (!state.document) {
        return
      }

      commitCommandResult(executeCommand(cloneDocument(state.document), editNodeTitleCommand, { nodeId, title }))
    },

    finishInteraction() {
      commitCurrentDocument()
    },

    getState() {
      return {
        canRedo: state.history?.canRedo() ?? false,
        canUndo: state.history?.canUndo() ?? false,
        dirty: stateIsDirty(state),
        document: state.document,
        revision: state.revision,
        selectedEdgeId: state.selectedEdgeId,
        selectedNodeIds: [...state.selectedNodeIds]
      }
    },

    hasDocumentSnapshot(snapshotJson) {
      return serializeMindDocument(state.document) === snapshotJson
    },

    load(document) {
      const next = validateDocument(document)
      updateState((draft) => {
        draft.cleanDocumentJson = serializeMindDocument(next)
        draft.document = next
        draft.history = createHistory(next)
        draft.selectedEdgeId = null
        draft.selectedNodeIds = []
      })
    },

    markClean() {
      updateState((draft) => {
        draft.cleanDocumentJson = serializeMindDocument(draft.document)
      })
    },

    moveSelectedByScreenDelta(delta) {
      if (!state.document) {
        return
      }

      const zoom = state.document.viewport.zoom || 1
      const worldDelta = { x: delta.x / zoom, y: delta.y / zoom }
      if (state.selectedNodeIds.length === 0 || (worldDelta.x === 0 && worldDelta.y === 0)) {
        return
      }

      commitCommandResult(
        executeCommand(cloneDocument(state.document), moveNodesCommand, { nodeIds: state.selectedNodeIds, delta: worldDelta })
      )
    },

    moveSelectedByWorldDelta(delta) {
      if (!state.document || state.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      commitCommandResult(
        executeCommand(cloneDocument(state.document), moveNodesCommand, { nodeIds: state.selectedNodeIds, delta })
      )
    },

    previewMoveSelectedByScreenDelta(delta) {
      if (!state.document) {
        return
      }

      const zoom = state.document.viewport.zoom || 1
      const worldDelta = { x: delta.x / zoom, y: delta.y / zoom }
      if (state.selectedNodeIds.length === 0 || (worldDelta.x === 0 && worldDelta.y === 0)) {
        return
      }

      const nextDocument = moveNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta: worldDelta })
      updateState((draft) => {
        draft.document = nextDocument
        draft.selectedNodeIds = compactSelection(nextDocument, draft.selectedNodeIds)
        draft.selectedEdgeId = compactSelectedEdge(nextDocument, draft.selectedEdgeId)
      })
    },

    previewMoveSelectedByWorldDelta(delta) {
      if (!state.document || state.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      const nextDocument = moveNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta })
      updateState((draft) => {
        draft.document = nextDocument
        draft.selectedNodeIds = compactSelection(nextDocument, draft.selectedNodeIds)
        draft.selectedEdgeId = compactSelectedEdge(nextDocument, draft.selectedEdgeId)
      })
    },

    redo() {
      if (!state.history?.canRedo()) {
        return
      }

      const currentDocument = state.document
      const nextDocument = preserveUntrackedDocumentState(state.history.redo(), currentDocument)
      updateState((draft) => {
        draft.document = nextDocument
        draft.selectedNodeIds = compactSelection(nextDocument, draft.selectedNodeIds)
        draft.selectedEdgeId = compactSelectedEdge(nextDocument, draft.selectedEdgeId)
      })
    },

    selectEdge(edgeId) {
      const selectedEdgeId = compactSelectedEdge(state.document, edgeId)
      if (state.selectedEdgeId === selectedEdgeId && state.selectedNodeIds.length === 0) {
        return
      }

      updateState((draft) => {
        draft.selectedEdgeId = selectedEdgeId
        if (selectedEdgeId) {
          draft.selectedNodeIds = []
        }
      })
    },

    selectOnly(nodeId) {
      const selectedNodeIds = compactSelection(state.document, [nodeId])
      if (state.selectedEdgeId === null && sameSelection(state.selectedNodeIds, selectedNodeIds)) {
        return
      }

      updateState((draft) => {
        draft.selectedEdgeId = null
        draft.selectedNodeIds = selectedNodeIds
      })
    },

    setSelectedEdgeStyle(stylePatch) {
      if (!state.document || !state.selectedEdgeId) {
        return
      }

      const edgeId = state.selectedEdgeId
      const selectedEdge = state.document.edges.find((edge) => edge.id === edgeId)
      if (!selectedEdge) {
        updateState((draft) => {
          draft.selectedEdgeId = null
        })
        return
      }

      if (isStylePatchNoop(selectedEdge.style, stylePatch)) {
        return
      }

      commitCommandResult(executeCommand(cloneDocument(state.document), setEdgeStyleCommand, { edgeId, stylePatch }))
    },

    setSelectedNodeStyle(stylePatch) {
      if (!state.document || state.selectedNodeIds.length !== 1) {
        return
      }

      const nodeId = state.selectedNodeIds[0]
      const selectedNode = state.document.nodes.find((node) => node.id === nodeId)
      if (!selectedNode) {
        updateState((draft) => {
          draft.selectedNodeIds = []
        })
        return
      }

      if (isStylePatchNoop(selectedNode.style, stylePatch)) {
        return
      }

      commitCommandResult(executeCommand(cloneDocument(state.document), setNodeStyleCommand, { nodeId, stylePatch }))
    },

    setSelection(nodeIds) {
      const selectedNodeIds = compactSelection(state.document, [...nodeIds])
      if (state.selectedEdgeId === null && sameSelection(state.selectedNodeIds, selectedNodeIds)) {
        return
      }

      updateState((draft) => {
        draft.selectedEdgeId = null
        draft.selectedNodeIds = selectedNodeIds
      })
    },

    setViewport(viewport) {
      if (!state.document) {
        return
      }

      const nextDocument = mindDocumentSchema.parse({
        ...state.document,
        viewport: { ...viewport }
      })
      updateState((draft) => {
        draft.document = nextDocument
      })
    },

    undo() {
      if (!state.history?.canUndo()) {
        return
      }

      const currentDocument = state.document
      const nextDocument = preserveUntrackedDocumentState(state.history.undo(), currentDocument)
      updateState((draft) => {
        draft.document = nextDocument
        draft.selectedNodeIds = compactSelection(nextDocument, draft.selectedNodeIds)
        draft.selectedEdgeId = compactSelectedEdge(nextDocument, draft.selectedEdgeId)
      })
    },

    updateDocumentTitle(title) {
      if (!state.document) {
        return
      }

      const wasDirty = stateIsDirty(state)
      const nextDocument = retitleDocument(state.document, title)
      const nextCleanDocumentJson =
        state.cleanDocumentJson === null
          ? null
          : serializeMindDocument(retitleDocument(JSON.parse(state.cleanDocumentJson) as MindDocument, title))
      const nextHistory = wasDirty && state.history ? retitleHistory(state.history, title) : createHistory(nextDocument)

      updateState((draft) => {
        draft.cleanDocumentJson = wasDirty ? nextCleanDocumentJson : serializeMindDocument(nextDocument)
        draft.document = nextDocument
        draft.history = nextHistory
      })
    }
  }
}
```

- [ ] **Step 2: Export the session API**

Modify `packages/mind-engine/src/index.ts` to include the new export:

```ts
export * from './commands.js'
export * from './documentFactory.js'
export * from './editorSession.js'
export * from './graph.js'
export * from './patches.js'
export * from './history.js'
export * from './selection.js'
export * from './viewport.js'
```

- [ ] **Step 3: Run the engine session test**

Run:

```bash
npm run test -w packages/mind-engine -- src/editorSession.test.ts
```

Expected: PASS for `packages/mind-engine/src/editorSession.test.ts`.

- [ ] **Step 4: Run all engine tests**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: PASS for command, graph, history, patch, and editor session tests.

- [ ] **Step 5: Commit the engine session implementation**

Run:

```bash
git add packages/mind-engine/src/editorSession.ts packages/mind-engine/src/editorSession.test.ts packages/mind-engine/src/index.ts
git commit -m "feat(engine): add editor session core"
```

Expected: commit succeeds with only engine files staged.

## Task 3: Convert The Web Editor Store To A Thin Adapter

**Files:**
- Modify: `apps/web/src/stores/editor.ts`
- Modify: `apps/web/src/stores/editor.test.ts`
- Test: `apps/web/src/stores/editor.test.ts`

- [ ] **Step 1: Replace the editor store with a setup-store adapter**

Replace `apps/web/src/stores/editor.ts` with:

```ts
import type { EdgeStyle, MindDocument, Point, TopicNodeStyle, Viewport } from '@mind-x/shared'
import { createEditorSession, type AddChildTopicInput, type AddTopicInput, type EditorSession } from '@mind-x/mind-engine'
import { defineStore } from 'pinia'
import { markRaw, ref, shallowRef, toRaw } from 'vue'

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(toRaw(document)) : null
}

function cloneForSession(document: MindDocument): MindDocument {
  return JSON.parse(JSON.stringify(toRaw(document))) as MindDocument
}

export const useEditorStore = defineStore('editor', () => {
  let session: EditorSession = markRaw(createEditorSession())
  const canRedo = ref(false)
  const canUndo = ref(false)
  const dirty = ref(false)
  const document = shallowRef<MindDocument | null>(null)
  const revision = ref(0)
  const selectedEdgeId = ref<string | null>(null)
  const selectedNodeIds = ref<string[]>([])

  function syncFromSession(): void {
    const state = session.getState()
    canRedo.value = state.canRedo
    canUndo.value = state.canUndo
    dirty.value = state.dirty
    document.value = state.document
    revision.value = state.revision
    selectedEdgeId.value = state.selectedEdgeId
    selectedNodeIds.value = [...state.selectedNodeIds]
  }

  function $reset(): void {
    session = markRaw(createEditorSession())
    syncFromSession()
  }

  function load(nextDocument: MindDocument): void {
    session.load(cloneForSession(nextDocument))
    syncFromSession()
  }

  function commit(nextDocument: MindDocument): void {
    session.commit(cloneForSession(nextDocument))
    syncFromSession()
  }

  function finishInteraction(): void {
    session.finishInteraction()
    syncFromSession()
  }

  function markClean(): void {
    session.markClean()
    syncFromSession()
  }

  function hasDocumentSnapshot(snapshotJson: string): boolean {
    return session.hasDocumentSnapshot(snapshotJson)
  }

  function updateDocumentTitle(title: string): void {
    session.updateDocumentTitle(title)
    syncFromSession()
  }

  function selectOnly(nodeId: string): void {
    session.selectOnly(nodeId)
    syncFromSession()
  }

  function setSelection(nodeIds: string[]): void {
    session.setSelection(nodeIds)
    syncFromSession()
  }

  function selectEdge(edgeId: string): void {
    session.selectEdge(edgeId)
    syncFromSession()
  }

  function clearSelection(): void {
    session.clearSelection()
    syncFromSession()
  }

  function addRootTopic(input: AddTopicInput = {}): string | null {
    const id = session.addRootTopic(input)
    syncFromSession()
    return id
  }

  function addChildTopic(input: AddChildTopicInput = {}): string | null {
    const id = session.addChildTopic(input)
    syncFromSession()
    return id
  }

  function editNodeTitle(nodeId: string, title: string): void {
    session.editNodeTitle(nodeId, title)
    syncFromSession()
  }

  function moveSelectedByWorldDelta(delta: Point): void {
    session.moveSelectedByWorldDelta(delta)
    syncFromSession()
  }

  function moveSelectedByScreenDelta(delta: Point): void {
    session.moveSelectedByScreenDelta(delta)
    syncFromSession()
  }

  function previewMoveSelectedByWorldDelta(delta: Point): void {
    session.previewMoveSelectedByWorldDelta(delta)
    syncFromSession()
  }

  function previewMoveSelectedByScreenDelta(delta: Point): void {
    session.previewMoveSelectedByScreenDelta(delta)
    syncFromSession()
  }

  function setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void {
    session.setSelectedNodeStyle(stylePatch)
    syncFromSession()
  }

  function setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
    session.setSelectedEdgeStyle(stylePatch)
    syncFromSession()
  }

  function deleteSelected(): void {
    session.deleteSelected()
    syncFromSession()
  }

  function undo(): void {
    session.undo()
    syncFromSession()
  }

  function redo(): void {
    session.redo()
    syncFromSession()
  }

  function setViewport(viewport: Viewport): void {
    session.setViewport(viewport)
    syncFromSession()
  }

  return {
    $reset,
    addChildTopic,
    addRootTopic,
    canRedo,
    canUndo,
    clearSelection,
    commit,
    deleteSelected,
    dirty,
    document,
    editNodeTitle,
    finishInteraction,
    hasDocumentSnapshot,
    load,
    markClean,
    moveSelectedByScreenDelta,
    moveSelectedByWorldDelta,
    previewMoveSelectedByScreenDelta,
    previewMoveSelectedByWorldDelta,
    redo,
    revision,
    selectEdge,
    selectedEdgeId,
    selectedNodeIds,
    selectOnly,
    setSelectedEdgeStyle,
    setSelectedNodeStyle,
    setSelection,
    setViewport,
    undo,
    updateDocumentTitle
  }
})
```

- [ ] **Step 2: Replace the web store tests with adapter-focused tests**

Replace `apps/web/src/stores/editor.test.ts` with:

```ts
import { DEFAULT_EDGE_STYLE, DEFAULT_TOPIC_STYLE, type MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { serializeMindDocument, useEditorStore } from './editor'

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

function documentWithRoot(): MindDocument {
  return emptyDocument({
    nodes: [
      {
        id: 'root',
        type: 'topic',
        position: { x: 10, y: 20 },
        data: { title: 'Root' },
        style: DEFAULT_TOPIC_STYLE
      }
    ]
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

  it('keeps selection actions as thin session delegates', () => {
    const store = useEditorStore()
    store.load(
      emptyDocument({
        nodes: [
          { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' }, style: DEFAULT_TOPIC_STYLE },
          { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' }, style: DEFAULT_TOPIC_STYLE }
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

    store.commit({
      ...documentWithRoot(),
      nodes: [
        {
          id: 'root',
          type: 'topic',
          position: { x: 10, y: 20 },
          data: { title: 'Draft root' },
          style: DEFAULT_TOPIC_STYLE
        }
      ]
    })

    expect(store.document?.nodes[0].data.title).toBe('Draft root')
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
```

- [ ] **Step 3: Run the web store test**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: PASS for `apps/web/src/stores/editor.test.ts`.

- [ ] **Step 4: Run related web editor tests**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts src/components/editor
```

Expected: PASS for editor store and editor component helper tests.

- [ ] **Step 5: Commit the web adapter refactor**

Run:

```bash
git add apps/web/src/stores/editor.ts apps/web/src/stores/editor.test.ts
git commit -m "refactor(web): adapt editor store to engine session"
```

Expected: commit succeeds with only web store files staged.

## Task 4: Full Verification And Cleanup

**Files:**
- Verify: root workspace

- [ ] **Step 1: Run TypeScript checks**

Run:

```bash
npm run typecheck
```

Expected: PASS for `packages/shared`, `packages/mind-engine`, `apps/api`, and `apps/web`.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS for package builds, API build, and Vite web build.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intentional implementation files are changed, and no generated `dist`, `coverage`, or `node_modules` files are listed.

- [ ] **Step 5: Confirm verification left no extra files**

Run:

```bash
git status --short
```

Expected: no unstaged generated files are listed. If this command shows generated output such as `dist`, `coverage`, or `node_modules`, remove only that generated output and rerun `git status --short`.
