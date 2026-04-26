import type { MindDocument, Point, Viewport } from '@mind-x/shared'
import {
  addChildNode,
  createHistory,
  deleteNodePromoteChildren,
  editNodeTitle,
  moveNodes,
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
  dirty: boolean
  document: MindDocument | null
  history: History<MindDocument> | null
  historyCanRedo: boolean
  historyCanUndo: boolean
  selectedNodeIds: string[]
}

let generatedNodeSequence = 0

function cloneDocument(document: MindDocument): MindDocument {
  return JSON.parse(JSON.stringify(toRaw(document))) as MindDocument
}

function createNodeId(): string {
  generatedNodeSequence += 1
  return `node-${generatedNodeSequence}`
}

function compactSelection(document: MindDocument | null, selectedNodeIds: string[]): string[] {
  if (!document) {
    return []
  }

  const nodeIds = new Set(document.nodes.map((node) => node.id))
  return selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId))
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    dirty: false,
    document: null,
    history: null,
    historyCanRedo: false,
    historyCanUndo: false,
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
    load(document: MindDocument): void {
      const next = cloneDocument(document)
      this.document = next
      this.selectedNodeIds = []
      this.dirty = false
      this.history = markRaw(createHistory(next))
      this.syncHistoryState()
    },
    commit(document: MindDocument): void {
      const next = cloneDocument(document)
      this.document = next
      this.history?.push(next)
      this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
      this.dirty = true
      this.syncHistoryState()
    },
    selectOnly(nodeId: string): void {
      this.selectedNodeIds = compactSelection(this.document, [nodeId])
    },
    setSelection(nodeIds: string[]): void {
      this.selectedNodeIds = compactSelection(this.document, [...nodeIds])
    },
    clearSelection(): void {
      this.selectedNodeIds = []
    },
    addRootTopic(input: AddTopicInput = {}): string | null {
      if (!this.document || this.document.nodes.length > 0) {
        return null
      }

      const id = input.id ?? createNodeId()
      const next = cloneDocument(this.document)
      next.nodes.push({
        id,
        type: 'topic',
        position: { x: 0, y: 0 },
        size: { width: 180, height: 56 },
        data: { title: input.title ?? 'New topic' }
      })
      this.selectedNodeIds = [id]
      this.commit(next)
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

      const id = input.id ?? createNodeId()
      const next = addChildNode(cloneDocument(this.document), {
        parentId,
        id,
        title: input.title ?? 'New topic'
      })
      this.selectedNodeIds = [id]
      this.commit(next)
      return id
    },
    editNodeTitle(nodeId: string, title: string): void {
      if (!this.document) {
        return
      }

      this.commit(editNodeTitle(cloneDocument(this.document), { nodeId, title }))
    },
    moveSelectedByWorldDelta(delta: Point): void {
      if (!this.document || this.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      this.commit(moveNodes(cloneDocument(this.document), { nodeIds: this.selectedNodeIds, delta }))
    },
    moveSelectedByScreenDelta(delta: Point): void {
      if (!this.document) {
        return
      }

      const zoom = this.document.viewport.zoom || 1
      this.moveSelectedByWorldDelta({ x: delta.x / zoom, y: delta.y / zoom })
    },
    deleteSelected(): void {
      if (!this.document || this.selectedNodeIds.length === 0) {
        return
      }

      let next = cloneDocument(this.document)
      for (const nodeId of this.selectedNodeIds) {
        if (next.nodes.some((node) => node.id === nodeId)) {
          next = deleteNodePromoteChildren(next, { nodeId })
        }
      }

      this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
      this.commit(next)
    },
    undo(): void {
      if (!this.history?.canUndo()) {
        return
      }

      this.document = this.history.undo()
      this.selectedNodeIds = compactSelection(this.document, this.selectedNodeIds)
      this.dirty = true
      this.syncHistoryState()
    },
    redo(): void {
      if (!this.history?.canRedo()) {
        return
      }

      this.document = this.history.redo()
      this.selectedNodeIds = compactSelection(this.document, this.selectedNodeIds)
      this.dirty = true
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
      this.dirty = true
    }
  }
})
