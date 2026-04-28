import type {
  EdgeStyle,
  MindDocument,
  MindNodeType,
  NodeShellStyle,
  Point,
  TopicNodeStyle,
  Viewport
} from '@mind-x/shared'

export type AddTopicInput = { id?: string; title?: string }
export type AddChildTopicInput = AddTopicInput & { parentId?: string }
export type AddMindNodeInput = { id?: string; type: MindNodeType; data?: Record<string, unknown> }
export type AddChildMindNodeSessionInput = AddMindNodeInput & { parentId?: string }

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
  addChildNode(input: AddChildMindNodeSessionInput): string | null
  addChildTopic(input?: AddChildTopicInput): string | null
  addRootNode(input: AddMindNodeInput): string | null
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
  setSelectedNodeContentStyle(stylePatch: Record<string, unknown>): void
  setSelectedNodeShellStyle(stylePatch: Partial<NodeShellStyle>): void
  setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void
  setSelection(nodeIds: string[]): void
  setViewport(viewport: Viewport): void
  undo(): void
  updateNodeData(nodeId: string, dataPatch: Record<string, unknown>): void
  updateDocumentTitle(title: string): void
}
