import type { EdgeStyle, MindDocument, NodeShellStyle, Point, Viewport } from '@mind-x/shared'

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
  setSelectedNodeStyle(stylePatch: Partial<NodeShellStyle>): void
  setSelection(nodeIds: string[]): void
  setViewport(viewport: Viewport): void
  undo(): void
  updateDocumentTitle(title: string): void
}
