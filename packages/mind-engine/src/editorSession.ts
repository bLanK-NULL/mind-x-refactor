import {
  mindDocumentSchema,
  type EdgeStyle,
  type MindDocument,
  type Point,
  type TopicNodeStyle,
  type Viewport
} from '@mind-x/shared'
import { produce } from 'immer'
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

export type AddTopicInput = { id?: string; title?: string }
export type AddChildTopicInput = AddTopicInput & { parentId?: string }

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

type InternalState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

const DEFAULT_TOPIC_TITLE = 'New topic'

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(document) : null
}

function cloneDocument(document: MindDocument): MindDocument {
  const parsed = mindDocumentSchema.parse(structuredClone(document))
  return produce(parsed, () => undefined)
}

function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = produce(cloneDocument(document), (draft) => {
    draft.meta.title = title
  })
  mindDocumentSchema.parse(next)
  return next
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

function assertTopicInput(id: string, title: string): void {
  if (id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (/[<>]/.test(title) || title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
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

function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  if (!currentDocument?.viewport) {
    return cloneDocument(document)
  }

  return produce(cloneDocument(document), (draft) => {
    draft.viewport = { ...currentDocument.viewport }
  })
}

function retitleHistory(history: History<MindDocument>, title: string): History<MindDocument> {
  return history.replaceAll((document) => retitleDocument(document, title))
}

function updateDirty(state: InternalState): void {
  state.dirty = serializeMindDocument(state.document) !== state.cleanDocumentJson
}

export function createEditorSession(): EditorSession {
  let history: History<MindDocument> | null = null
  let generatedNodeSequence = 0
  let pendingPreviewBaseline: MindDocument | null = null
  let state: InternalState = {
    cleanDocumentJson: null,
    dirty: false,
    document: null,
    revision: 0,
    selectedEdgeId: null,
    selectedNodeIds: []
  }

  function setState(recipe: (draft: InternalState) => void): void {
    state = produce(state, recipe)
  }

  function createNodeId(document: MindDocument): string {
    const existingNodeIds = new Set(document.nodes.map((node) => node.id))

    do {
      generatedNodeSequence += 1
    } while (existingNodeIds.has(`node-${generatedNodeSequence}`))

    return `node-${generatedNodeSequence}`
  }

  function syncAfterDocumentChange(nextDocument: MindDocument): void {
    setState((draft) => {
      draft.document = nextDocument
      draft.selectedNodeIds = compactSelection(nextDocument, draft.selectedNodeIds)
      draft.selectedEdgeId = compactSelectedEdge(nextDocument, draft.selectedEdgeId)
      updateDirty(draft)
      draft.revision += 1
    })
  }

  function commitCommandResult(result: CommandResult): void {
    const next = cloneDocument(result.document)
    history?.push({
      document: next,
      patches: result.patches,
      inversePatches: result.inversePatches
    })
    pendingPreviewBaseline = null
    syncAfterDocumentChange(next)
  }

  function moveSelectedByWorldDelta(delta: Point): void {
    if (!state.document || state.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
      return
    }

    commitCommandResult(
      executeCommand(cloneDocument(state.document), moveNodesCommand, {
        nodeIds: state.selectedNodeIds,
        delta
      })
    )
  }

  function previewMoveSelectedByWorldDelta(delta: Point): void {
    if (!state.document || state.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
      return
    }

    if (!pendingPreviewBaseline) {
      pendingPreviewBaseline = preserveUntrackedDocumentState(history?.current() ?? state.document, state.document)
    }

    syncAfterDocumentChange(moveNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta }))
  }

  function finishInteraction(): void {
    if (!state.document || !pendingPreviewBaseline) {
      return
    }

    const baseline = pendingPreviewBaseline
    const trackedNext = produce(state.document, (draft) => {
      draft.viewport = { ...baseline.viewport }
    })
    const result = replaceWithPatchResult(baseline, trackedNext)
    const next = cloneDocument(state.document)
    history?.push({
      document: next,
      patches: result.patches,
      inversePatches: result.inversePatches
    })
    pendingPreviewBaseline = null
    syncAfterDocumentChange(next)
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

      const id = input.id ?? createNodeId(state.document)
      const title = input.title ?? DEFAULT_TOPIC_TITLE
      assertTopicInput(id, title)
      const result = executeCommand(cloneDocument(state.document), addChildNodeCommand, {
        parentId,
        id,
        title
      })
      setState((draft) => {
        draft.selectedNodeIds = [id]
        draft.selectedEdgeId = null
      })
      commitCommandResult(result)
      return id
    },
    addRootTopic(input: AddTopicInput = {}) {
      if (!state.document || state.document.nodes.length > 0) {
        return null
      }

      const id = input.id ?? createNodeId(state.document)
      const title = input.title ?? DEFAULT_TOPIC_TITLE
      assertTopicInput(id, title)
      const result = executeCommand(cloneDocument(state.document), addRootNodeCommand, { id, title })
      setState((draft) => {
        draft.selectedNodeIds = [id]
        draft.selectedEdgeId = null
      })
      commitCommandResult(result)
      return id
    },
    clearSelection() {
      if (state.selectedNodeIds.length === 0 && state.selectedEdgeId === null) {
        return
      }

      setState((draft) => {
        draft.selectedNodeIds = []
        draft.selectedEdgeId = null
        draft.revision += 1
      })
    },
    commit(document: MindDocument) {
      const next = cloneDocument(document)
      const current = history?.current() ?? state.document ?? next
      commitCommandResult(replaceWithPatchResult(current, next))
    },
    deleteSelected() {
      if (!state.document) {
        return
      }

      if (state.selectedEdgeId) {
        const edgeId = state.selectedEdgeId
        if (!state.document.edges.some((edge) => edge.id === edgeId)) {
          setState((draft) => {
            draft.selectedEdgeId = null
            draft.revision += 1
          })
          return
        }

        setState((draft) => {
          draft.selectedEdgeId = null
          draft.selectedNodeIds = []
        })
        commitCommandResult(executeCommand(cloneDocument(state.document), deleteEdgeDetachChildCommand, { edgeId }))
        return
      }

      if (state.selectedNodeIds.length === 0) {
        return
      }

      commitCommandResult(
        executeCommand(cloneDocument(state.document), deleteNodesPromoteChildrenCommand, {
          nodeIds: state.selectedNodeIds
        })
      )
    },
    editNodeTitle(nodeId: string, title: string) {
      if (!state.document) {
        return
      }

      commitCommandResult(executeCommand(cloneDocument(state.document), editNodeTitleCommand, { nodeId, title }))
    },
    finishInteraction,
    getState() {
      return Object.freeze({
        canRedo: history?.canRedo() ?? false,
        canUndo: history?.canUndo() ?? false,
        dirty: state.dirty,
        document: state.document,
        revision: state.revision,
        selectedEdgeId: state.selectedEdgeId,
        selectedNodeIds: [...state.selectedNodeIds]
      })
    },
    hasDocumentSnapshot(snapshotJson: string) {
      return serializeMindDocument(state.document) === snapshotJson
    },
    load(document: MindDocument) {
      const next = cloneDocument(document)
      history = createHistory(next)
      pendingPreviewBaseline = null
      setState((draft) => {
        draft.document = next
        draft.selectedNodeIds = []
        draft.selectedEdgeId = null
        draft.cleanDocumentJson = serializeMindDocument(next)
        updateDirty(draft)
        draft.revision += 1
      })
    },
    markClean() {
      setState((draft) => {
        draft.cleanDocumentJson = serializeMindDocument(draft.document)
        updateDirty(draft)
        draft.revision += 1
      })
    },
    moveSelectedByScreenDelta(delta: Point) {
      if (!state.document) {
        return
      }

      const zoom = state.document.viewport.zoom || 1
      moveSelectedByWorldDelta({ x: delta.x / zoom, y: delta.y / zoom })
    },
    moveSelectedByWorldDelta,
    previewMoveSelectedByScreenDelta(delta: Point) {
      if (!state.document) {
        return
      }

      const zoom = state.document.viewport.zoom || 1
      previewMoveSelectedByWorldDelta({ x: delta.x / zoom, y: delta.y / zoom })
    },
    previewMoveSelectedByWorldDelta,
    redo() {
      if (!history?.canRedo()) {
        return
      }

      const currentDocument = state.document
      syncAfterDocumentChange(preserveUntrackedDocumentState(history.redo(), currentDocument))
    },
    selectEdge(edgeId: string) {
      const selectedEdgeId = compactSelectedEdge(state.document, edgeId)
      setState((draft) => {
        draft.selectedEdgeId = selectedEdgeId
        if (selectedEdgeId) {
          draft.selectedNodeIds = []
        }
        draft.revision += 1
      })
    },
    selectOnly(nodeId: string) {
      setState((draft) => {
        draft.selectedNodeIds = compactSelection(draft.document, [nodeId])
        draft.selectedEdgeId = null
        draft.revision += 1
      })
    },
    setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>) {
      if (!state.document || !state.selectedEdgeId) {
        return
      }

      const edgeId = state.selectedEdgeId
      const selectedEdge = state.document.edges.find((edge) => edge.id === edgeId)
      if (!selectedEdge) {
        setState((draft) => {
          draft.selectedEdgeId = null
          draft.revision += 1
        })
        return
      }

      if (isStylePatchNoop(selectedEdge.style, stylePatch)) {
        return
      }

      commitCommandResult(
        executeCommand(cloneDocument(state.document), setEdgeStyleCommand, {
          edgeId,
          stylePatch
        })
      )
    },
    setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>) {
      if (!state.document || state.selectedNodeIds.length !== 1) {
        return
      }

      const nodeId = state.selectedNodeIds[0]
      const selectedNode = state.document.nodes.find((node) => node.id === nodeId)
      if (!selectedNode) {
        setState((draft) => {
          draft.selectedNodeIds = []
          draft.revision += 1
        })
        return
      }

      if (isStylePatchNoop(selectedNode.style, stylePatch)) {
        return
      }

      commitCommandResult(
        executeCommand(cloneDocument(state.document), setNodeStyleCommand, {
          nodeId,
          stylePatch
        })
      )
    },
    setSelection(nodeIds: string[]) {
      setState((draft) => {
        draft.selectedNodeIds = compactSelection(draft.document, [...nodeIds])
        draft.selectedEdgeId = null
        draft.revision += 1
      })
    },
    setViewport(viewport: Viewport) {
      if (!state.document) {
        return
      }

      syncAfterDocumentChange(
        produce(state.document, (draft) => {
          draft.viewport = { ...viewport }
        })
      )
    },
    undo() {
      if (!history?.canUndo()) {
        return
      }

      const currentDocument = state.document
      syncAfterDocumentChange(preserveUntrackedDocumentState(history.undo(), currentDocument))
    },
    updateDocumentTitle(title: string) {
      if (!state.document) {
        return
      }

      const next = retitleDocument(state.document, title)
      if (state.cleanDocumentJson !== null) {
        const cleanDocument = JSON.parse(state.cleanDocumentJson) as MindDocument
        const cleanDocumentJson = serializeMindDocument(retitleDocument(cleanDocument, title))
        setState((draft) => {
          draft.cleanDocumentJson = cleanDocumentJson
        })
      }

      if (!history) {
        history = createHistory(next)
        setState((draft) => {
          draft.document = next
          draft.cleanDocumentJson = serializeMindDocument(next)
          updateDirty(draft)
          draft.revision += 1
        })
        return
      }

      history = retitleHistory(history, title)
      syncAfterDocumentChange(next)
    }
  }
}
