import type { EdgeStyle, MindDocument, NodeShellStyle, Point, Viewport } from '@mind-x/shared'
import {
  createEditorSession,
  type AddChildMindNodeSessionInput,
  type AddChildTopicInput,
  type AddMindNodeInput,
  type AddTopicInput,
  type EditorSession
} from '@mind-x/mind-engine'
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
  const document = shallowRef<MindDocument | null>(null)
  const selectedNodeIds = ref<string[]>([])
  const selectedEdgeId = ref<string | null>(null)
  const dirty = ref(false)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const revision = ref(0)

  function syncFromSession(): void {
    const state = session.getState()
    document.value = state.document
    selectedNodeIds.value = [...state.selectedNodeIds]
    selectedEdgeId.value = state.selectedEdgeId
    dirty.value = state.dirty
    canUndo.value = state.canUndo
    canRedo.value = state.canRedo
    revision.value = state.revision
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

  function addRootNode(input: AddMindNodeInput): string | null {
    const id = session.addRootNode(input)
    syncFromSession()
    return id
  }

  function addChildTopic(input: AddChildTopicInput = {}): string | null {
    const id = session.addChildTopic(input)
    syncFromSession()
    return id
  }

  function addChildNode(input: AddChildMindNodeSessionInput): string | null {
    const id = session.addChildNode(input)
    syncFromSession()
    return id
  }

  function editNodeTitle(nodeId: string, title: string): void {
    session.editNodeTitle(nodeId, title)
    syncFromSession()
  }

  function updateNodeData(nodeId: string, dataPatch: Record<string, unknown>): void {
    session.updateNodeData(nodeId, dataPatch)
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

  function previewResizeSelectedByDelta(delta: { width: number; height: number }): void {
    session.previewResizeSelectedByDelta(delta)
    syncFromSession()
  }

  function resizeSelectedByDelta(delta: { width: number; height: number }): void {
    session.resizeSelectedByDelta(delta)
    syncFromSession()
  }

  function deleteEdge(edgeId: string): void {
    session.deleteEdge(edgeId)
    syncFromSession()
  }

  function setEdgeStyle(edgeId: string, stylePatch: Partial<EdgeStyle>): void {
    session.setEdgeStyle(edgeId, stylePatch)
    syncFromSession()
  }

  function setNodeShellStyle(nodeId: string, stylePatch: Partial<NodeShellStyle>): void {
    session.setNodeShellStyle(nodeId, stylePatch)
    syncFromSession()
  }

  function setNodeContentStyle(nodeId: string, stylePatch: Record<string, unknown>): void {
    session.setNodeContentStyle(nodeId, stylePatch)
    syncFromSession()
  }

  function setSelectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>): void {
    session.setSelectedNodeShellStyle(stylePatch)
    syncFromSession()
  }

  function setSelectedNodeContentStyle(stylePatch: Record<string, unknown>): void {
    session.setSelectedNodeContentStyle(stylePatch)
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
    addChildNode,
    addChildTopic,
    addRootNode,
    addRootTopic,
    canRedo,
    canUndo,
    clearSelection,
    commit,
    deleteEdge,
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
    previewResizeSelectedByDelta,
    redo,
    resizeSelectedByDelta,
    revision,
    selectEdge,
    selectedEdgeId,
    selectedNodeIds,
    selectOnly,
    setEdgeStyle,
    setNodeContentStyle,
    setNodeShellStyle,
    setSelectedEdgeStyle,
    setSelectedNodeContentStyle,
    setSelectedNodeShellStyle,
    setSelection,
    setViewport,
    undo,
    updateNodeData,
    updateDocumentTitle
  }
})
