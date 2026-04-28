import {
  type EdgeStyle,
  type MindDocument,
  type NodeShellStyle,
  type Point,
  type Viewport
} from '@mind-x/shared'
import { produce } from 'immer'
import {
  addChildMindNodeCommand,
  addRootMindNodeCommand,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  resizeNodes,
  resizeNodesCommand,
  setNodeContentStyleCommand,
  setNodeShellStyleCommand,
  setEdgeStyleCommand,
  updateNodeDataCommand,
  type CommandResult
} from '../commands.js'
import { createHistory, type History } from '../history.js'
import { replaceWithPatchResult } from '../patches.js'
import { cloneDocument, preserveUntrackedDocumentState, retitleDocument, serializeMindDocument } from './document.js'
import { compactSelectedEdge, compactSelection } from './selection.js'
import { DEFAULT_TOPIC_TITLE, type InternalState, updateDirty } from './state.js'
import { isStylePatchNoop } from './styles.js'
import type { AddChildMindNodeSessionInput, AddChildTopicInput, AddMindNodeInput, AddTopicInput, EditorSession } from './types.js'

function assertTopicInput(id: string, title: string): void {
  if (id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (/[<>]/.test(title) || title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
}

function retitleHistory(history: History<MindDocument>, title: string): History<MindDocument> {
  return history.replaceAll((document) => retitleDocument(document, title))
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

    finalizePendingPreview()
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

  function resizeSelectedByDelta(delta: { width: number; height: number }): void {
    if (!state.document || state.selectedNodeIds.length === 0 || (delta.width === 0 && delta.height === 0)) {
      return
    }

    finalizePendingPreview()
    commitCommandResult(
      executeCommand(cloneDocument(state.document), resizeNodesCommand, {
        nodeIds: state.selectedNodeIds,
        delta
      })
    )
  }

  function previewResizeSelectedByDelta(delta: { width: number; height: number }): void {
    if (!state.document || state.selectedNodeIds.length === 0 || (delta.width === 0 && delta.height === 0)) {
      return
    }

    if (!pendingPreviewBaseline) {
      pendingPreviewBaseline = preserveUntrackedDocumentState(history?.current() ?? state.document, state.document)
    }

    syncAfterDocumentChange(resizeNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta }))
  }

  function finalizePendingPreview(): void {
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

  function addRootNodeThroughSession(input: AddMindNodeInput, validate?: (id: string) => void): string | null {
    if (!state.document || state.document.nodes.length > 0) {
      return null
    }

    finalizePendingPreview()
    const id = input.id ?? createNodeId(state.document)
    validate?.(id)
    const result = executeCommand(cloneDocument(state.document), addRootMindNodeCommand, {
      id,
      type: input.type,
      data: input.data
    })
    setState((draft) => {
      draft.selectedNodeIds = [id]
      draft.selectedEdgeId = null
    })
    commitCommandResult(result)
    return id
  }

  function addChildNodeThroughSession(
    input: AddChildMindNodeSessionInput,
    validate?: (id: string) => void
  ): string | null {
    if (!state.document) {
      return null
    }

    finalizePendingPreview()
    const parentId = input.parentId ?? state.selectedNodeIds[0]
    if (!parentId) {
      return null
    }

    const id = input.id ?? createNodeId(state.document)
    validate?.(id)
    const result = executeCommand(cloneDocument(state.document), addChildMindNodeCommand, {
      parentId,
      id,
      type: input.type,
      data: input.data
    })
    setState((draft) => {
      draft.selectedNodeIds = [id]
      draft.selectedEdgeId = null
    })
    commitCommandResult(result)
    return id
  }

  return {
    addChildNode: addChildNodeThroughSession,
    addChildTopic(input: AddChildTopicInput = {}) {
      const title = input.title ?? DEFAULT_TOPIC_TITLE
      return addChildNodeThroughSession(
        {
          parentId: input.parentId,
          id: input.id,
          type: 'topic',
          data: { title }
        },
        (id) => assertTopicInput(id, title)
      )
    },
    addRootNode: addRootNodeThroughSession,
    addRootTopic(input: AddTopicInput = {}) {
      const title = input.title ?? DEFAULT_TOPIC_TITLE
      return addRootNodeThroughSession({ id: input.id, type: 'topic', data: { title } }, (id) =>
        assertTopicInput(id, title)
      )
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
      finalizePendingPreview()
      const next = cloneDocument(document)
      const current = history?.current() ?? state.document ?? next
      commitCommandResult(replaceWithPatchResult(current, next))
    },
    deleteSelected() {
      if (!state.document) {
        return
      }

      finalizePendingPreview()
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

      finalizePendingPreview()
      commitCommandResult(executeCommand(cloneDocument(state.document), editNodeTitleCommand, { nodeId, title }))
    },
    finishInteraction: finalizePendingPreview,
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
    previewResizeSelectedByDelta,
    redo() {
      finalizePendingPreview()
      if (!history?.canRedo()) {
        return
      }

      const currentDocument = state.document
      syncAfterDocumentChange(preserveUntrackedDocumentState(history.redo(), currentDocument))
    },
    resizeSelectedByDelta,
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

      finalizePendingPreview()
      commitCommandResult(
        executeCommand(cloneDocument(state.document), setEdgeStyleCommand, {
          edgeId,
          stylePatch
        })
      )
    },
    setSelectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>) {
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

      if (isStylePatchNoop(selectedNode.shellStyle, stylePatch)) {
        return
      }

      finalizePendingPreview()
      commitCommandResult(
        executeCommand(cloneDocument(state.document), setNodeShellStyleCommand, {
          nodeId,
          stylePatch
        })
      )
    },
    setSelectedNodeContentStyle(stylePatch: Record<string, unknown>) {
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

      if (isStylePatchNoop(selectedNode.contentStyle, stylePatch)) {
        return
      }

      finalizePendingPreview()
      commitCommandResult(
        executeCommand(cloneDocument(state.document), setNodeContentStyleCommand, {
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
      finalizePendingPreview()
      if (!history?.canUndo()) {
        return
      }

      const currentDocument = state.document
      syncAfterDocumentChange(preserveUntrackedDocumentState(history.undo(), currentDocument))
    },
    updateNodeData(nodeId: string, dataPatch: Record<string, unknown>) {
      if (!state.document) {
        return
      }

      finalizePendingPreview()
      commitCommandResult(executeCommand(cloneDocument(state.document), updateNodeDataCommand, { nodeId, dataPatch }))
    },
    updateDocumentTitle(title: string) {
      if (!state.document) {
        return
      }

      finalizePendingPreview()
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
