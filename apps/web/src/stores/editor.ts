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
  createHistory,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  replaceWithPatchResult,
  setEdgeStyleCommand,
  setNodeStyleCommand,
  type CommandResult,
  type History
} from '@mind-x/mind-engine'
import { defineStore } from 'pinia'
import { markRaw, toRaw } from 'vue'

type AddTopicInput = {
  id?: string
  title?: string
}

type AddChildTopicInput = AddTopicInput & {
  parentId?: string
}

type EditorState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  history: History<MindDocument> | null
  historyCanRedo: boolean
  historyCanUndo: boolean
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

let generatedNodeSequence = 0

function cloneDocument(document: MindDocument): MindDocument {
  return JSON.parse(JSON.stringify(toRaw(document))) as MindDocument
}

function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = cloneDocument(document)
  next.meta = {
    ...next.meta,
    title
  }
  mindDocumentSchema.parse(next)
  return next
}

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(toRaw(document)) : null
}

function createNodeId(document: MindDocument): string {
  const existingNodeIds = new Set(document.nodes.map((node) => node.id))

  do {
    generatedNodeSequence += 1
  } while (existingNodeIds.has(`node-${generatedNodeSequence}`))

  return `node-${generatedNodeSequence}`
}

function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  return currentDocument?.viewport ? { ...document, viewport: { ...currentDocument.viewport } } : document
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

function retitleHistory(history: History<MindDocument>, title: string): History<MindDocument> {
  return history.replaceAll((document) => retitleDocument(document, title))
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    cleanDocumentJson: null,
    dirty: false,
    document: null,
    history: null,
    historyCanRedo: false,
    historyCanUndo: false,
    selectedEdgeId: null,
    selectedNodeIds: []
  }),
  getters: {
    canRedo: (state): boolean => state.historyCanRedo,
    canUndo: (state): boolean => state.historyCanUndo
  },
  actions: {
    syncHistoryState(): void {
      this.historyCanUndo = this.history?.canUndo() ?? false
      this.historyCanRedo = this.history?.canRedo() ?? false
    },
    syncDirtyState(): void {
      this.dirty = serializeMindDocument(this.document) !== this.cleanDocumentJson
    },
    load(document: MindDocument): void {
      const next = cloneDocument(document)
      this.document = next
      this.selectedNodeIds = []
      this.selectedEdgeId = null
      this.cleanDocumentJson = serializeMindDocument(next)
      this.syncDirtyState()
      this.history = markRaw(createHistory(next))
      this.syncHistoryState()
    },
    commitCommandResult(result: CommandResult): void {
      const next = cloneDocument(result.document)
      this.document = next
      this.history?.push({
        document: next,
        patches: result.patches,
        inversePatches: result.inversePatches
      })
      this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    commit(document: MindDocument): void {
      const next = cloneDocument(document)
      const current = this.history?.current() ?? this.document ?? next
      this.commitCommandResult(replaceWithPatchResult(current, next))
    },
    commitCurrentDocument(): void {
      if (!this.document || !this.history) {
        return
      }

      const current = this.history.current()
      const currentJson = serializeMindDocument(current)
      const nextJson = serializeMindDocument(this.document)
      if (currentJson === nextJson) {
        this.syncDirtyState()
        this.syncHistoryState()
        return
      }

      this.commitCommandResult(replaceWithPatchResult(current, cloneDocument(this.document)))
    },
    finishInteraction(): void {
      this.commitCurrentDocument()
    },
    markClean(): void {
      this.cleanDocumentJson = serializeMindDocument(this.document)
      this.syncDirtyState()
    },
    hasDocumentSnapshot(snapshotJson: string): boolean {
      return serializeMindDocument(this.document) === snapshotJson
    },
    updateDocumentTitle(title: string): void {
      if (!this.document) {
        return
      }

      const wasDirty = this.dirty
      const next = retitleDocument(this.document, title)
      this.document = next
      if (this.cleanDocumentJson !== null) {
        const cleanDocument = JSON.parse(this.cleanDocumentJson) as MindDocument
        this.cleanDocumentJson = serializeMindDocument(retitleDocument(cleanDocument, title))
      }
      if (!wasDirty) {
        this.cleanDocumentJson = serializeMindDocument(next)
        this.history = markRaw(createHistory(next))
      } else if (this.history) {
        this.history = markRaw(retitleHistory(this.history, title))
        this.syncHistoryState()
      }
      this.syncDirtyState()
    },
    selectOnly(nodeId: string): void {
      this.selectedNodeIds = compactSelection(this.document, [nodeId])
      this.selectedEdgeId = null
    },
    setSelection(nodeIds: string[]): void {
      this.selectedNodeIds = compactSelection(this.document, [...nodeIds])
      this.selectedEdgeId = null
    },
    selectEdge(edgeId: string): void {
      this.selectedEdgeId = compactSelectedEdge(this.document, edgeId)
      if (this.selectedEdgeId) {
        this.selectedNodeIds = []
      }
    },
    clearSelection(): void {
      this.selectedNodeIds = []
      this.selectedEdgeId = null
    },
    addRootTopic(input: AddTopicInput = {}): string | null {
      if (!this.document || this.document.nodes.length > 0) {
        return null
      }

      const id = input.id ?? createNodeId(this.document)
      const title = input.title ?? 'New topic'
      assertTopicInput(id, title)
      const result = executeCommand(cloneDocument(this.document), addRootNodeCommand, { id, title })
      this.selectedNodeIds = [id]
      this.selectedEdgeId = null
      this.commitCommandResult(result)
      return id
    },
    addChildTopic(input: AddChildTopicInput = {}): string | null {
      if (!this.document) {
        return null
      }

      const parentId = input.parentId ?? this.selectedNodeIds[0]
      if (!parentId) {
        return null
      }

      const id = input.id ?? createNodeId(this.document)
      const result = executeCommand(cloneDocument(this.document), addChildNodeCommand, {
        parentId,
        id,
        title: input.title ?? 'New topic'
      })
      this.selectedNodeIds = [id]
      this.selectedEdgeId = null
      this.commitCommandResult(result)
      return id
    },
    editNodeTitle(nodeId: string, title: string): void {
      if (!this.document) {
        return
      }

      this.commitCommandResult(executeCommand(cloneDocument(this.document), editNodeTitleCommand, { nodeId, title }))
    },
    moveSelectedByWorldDelta(delta: Point): void {
      if (!this.document || this.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), moveNodesCommand, { nodeIds: this.selectedNodeIds, delta })
      )
    },
    moveSelectedByScreenDelta(delta: Point): void {
      if (!this.document) {
        return
      }

      const zoom = this.document.viewport.zoom || 1
      this.moveSelectedByWorldDelta({ x: delta.x / zoom, y: delta.y / zoom })
    },
    previewMoveSelectedByWorldDelta(delta: Point): void {
      if (!this.document || this.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      const next = moveNodes(cloneDocument(this.document), { nodeIds: this.selectedNodeIds, delta })
      this.document = next
      this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    previewMoveSelectedByScreenDelta(delta: Point): void {
      if (!this.document) {
        return
      }

      const zoom = this.document.viewport.zoom || 1
      this.previewMoveSelectedByWorldDelta({ x: delta.x / zoom, y: delta.y / zoom })
    },
    setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void {
      if (!this.document || this.selectedNodeIds.length !== 1) {
        return
      }

      const nodeId = this.selectedNodeIds[0]
      const selectedNode = this.document.nodes.find((node) => node.id === nodeId)
      if (!selectedNode) {
        this.selectedNodeIds = []
        return
      }

      if (isStylePatchNoop(selectedNode.style, stylePatch)) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setNodeStyleCommand, {
          nodeId,
          stylePatch
        })
      )
    },
    setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void {
      if (!this.document || !this.selectedEdgeId) {
        return
      }

      const edgeId = this.selectedEdgeId
      const selectedEdge = this.document.edges.find((edge) => edge.id === edgeId)
      if (!selectedEdge) {
        this.selectedEdgeId = null
        return
      }

      if (isStylePatchNoop(selectedEdge.style, stylePatch)) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setEdgeStyleCommand, {
          edgeId,
          stylePatch
        })
      )
    },
    deleteSelected(): void {
      if (!this.document) {
        return
      }

      if (this.selectedEdgeId) {
        const edgeId = this.selectedEdgeId
        if (!this.document.edges.some((edge) => edge.id === edgeId)) {
          this.selectedEdgeId = null
          return
        }

        this.selectedEdgeId = null
        this.selectedNodeIds = []
        this.commitCommandResult(executeCommand(cloneDocument(this.document), deleteEdgeDetachChildCommand, { edgeId }))
        return
      }

      if (this.selectedNodeIds.length === 0) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), deleteNodesPromoteChildrenCommand, { nodeIds: this.selectedNodeIds })
      )
    },
    undo(): void {
      if (!this.history?.canUndo()) {
        return
      }

      const currentDocument = this.document
      this.document = preserveUntrackedDocumentState(this.history.undo(), currentDocument)
      this.selectedNodeIds = compactSelection(this.document, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(this.document, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    redo(): void {
      if (!this.history?.canRedo()) {
        return
      }

      const currentDocument = this.document
      this.document = preserveUntrackedDocumentState(this.history.redo(), currentDocument)
      this.selectedNodeIds = compactSelection(this.document, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(this.document, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    setViewport(viewport: Viewport): void {
      if (!this.document) {
        return
      }

      this.document = {
        ...this.document,
        viewport: { ...viewport }
      }
      this.syncDirtyState()
    }
  }
})
