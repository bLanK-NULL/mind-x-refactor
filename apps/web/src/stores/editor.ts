import {
  DEFAULT_EDGE_COMPONENT,
  mindDocumentSchema,
  type MindDocument,
  type MindEdgeComponent,
  type Point,
  type ThemeName,
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
  setDocumentThemeCommand,
  setEdgeComponentCommand,
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

function preserveViewport(document: MindDocument, viewport: Viewport | undefined): MindDocument {
  return viewport ? { ...document, viewport: { ...viewport } } : document
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
    setDocumentTheme(theme: ThemeName): void {
      if (!this.document || this.document.meta.theme === theme) {
        return
      }

      this.commitCommandResult(executeCommand(cloneDocument(this.document), setDocumentThemeCommand, { theme }))
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
    setSelectedEdgeComponent(component: MindEdgeComponent): void {
      if (!this.document || !this.selectedEdgeId) {
        return
      }

      const selectedEdge = this.document.edges.find((edge) => edge.id === this.selectedEdgeId)
      if (!selectedEdge) {
        this.selectedEdgeId = null
        return
      }

      if ((selectedEdge.component ?? DEFAULT_EDGE_COMPONENT) === component) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setEdgeComponentCommand, {
          edgeId: this.selectedEdgeId,
          component
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

      const currentViewport = this.document?.viewport
      this.document = preserveViewport(this.history.undo(), currentViewport)
      this.selectedNodeIds = compactSelection(this.document, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(this.document, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    redo(): void {
      if (!this.history?.canRedo()) {
        return
      }

      const currentViewport = this.document?.viewport
      this.document = preserveViewport(this.history.redo(), currentViewport)
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
