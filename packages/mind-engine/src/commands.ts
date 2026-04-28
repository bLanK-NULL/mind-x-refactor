import {
  DEFAULT_ATTACHMENT_CONTENT_STYLE,
  DEFAULT_CODE_CONTENT_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_IMAGE_CONTENT_STYLE,
  DEFAULT_LINK_CONTENT_STYLE,
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TASK_CONTENT_STYLE,
  DEFAULT_TOPIC_STYLE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  mindNodeSchema,
  mindDocumentSchema,
  type AttachmentContentStyle,
  type CodeContentStyle,
  type EdgeStyle,
  type ImageContentStyle,
  type LinkContentStyle,
  type MindDocument,
  type MindNode,
  type MindNodeType,
  type NodeShellStyle,
  type Point,
  type TaskContentStyle,
  type TopicNodeStyle,
  type TopicContentStyle
} from '@mind-x/shared'
import type { Draft } from 'immer'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph.js'
import { createPatchResult, type PatchResult } from './patches.js'

const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72
const MIN_NODE_WIDTH = 120
const MIN_NODE_HEIGHT = 44
const NODE_SHELL_STYLE_KEYS = new Set(Object.keys(DEFAULT_NODE_SHELL_STYLE))
const TOPIC_STYLE_KEYS = new Set(Object.keys(DEFAULT_TOPIC_STYLE))
const TOPIC_CONTENT_STYLE_KEYS = new Set(Object.keys(DEFAULT_TOPIC_CONTENT_STYLE))
const EDGE_STYLE_KEYS = new Set(Object.keys(DEFAULT_EDGE_STYLE))
const EDGE_LABEL_STYLE_KEYS = new Set(Object.keys(DEFAULT_EDGE_STYLE.labelStyle))
const EDGE_ENDPOINT_STYLE_KEYS = new Set(Object.keys(DEFAULT_EDGE_STYLE.endpointStyle))
const EDGE_ANIMATION_STYLE_KEYS = new Set(Object.keys(DEFAULT_EDGE_STYLE.animation))
const LEGACY_TOPIC_SIZE_TO_NODE_SIZE = {
  lg: { width: 220, height: 72 },
  md: DEFAULT_NODE_SIZE_BY_TYPE.topic,
  sm: { width: 150, height: 44 }
} as const satisfies Record<TopicNodeStyle['size'], { width: number; height: number }>

export type CommandRecipe<TInput> = (draft: Draft<MindDocument>, input: TInput) => void
export type CommandResult = PatchResult<MindDocument>

function asDocument(draft: Draft<MindDocument>): MindDocument {
  return draft as unknown as MindDocument
}

function assertPlainTextTitle(title: string): void {
  if (/[<>]/.test(title) || title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
}

function assertKnownKeys(value: unknown, allowedKeys: Set<string>, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return
  }

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown ${label} style field ${key}`)
    }
  }
}

function assertKnownNodeShellStylePatchKeys(stylePatch: Partial<NodeShellStyle>): void {
  assertKnownKeys(stylePatch, NODE_SHELL_STYLE_KEYS, 'node shell')
}

export function assertKnownTopicContentStylePatchKeys(stylePatch: Partial<TopicContentStyle>): void {
  assertKnownKeys(stylePatch, TOPIC_CONTENT_STYLE_KEYS, 'topic content')
}

function assertKnownTopicStylePatchKeys(stylePatch: Partial<TopicNodeStyle>): void {
  assertKnownKeys(stylePatch, TOPIC_STYLE_KEYS, 'node')
}

function assertKnownEdgeStylePatchKeys(stylePatch: Partial<EdgeStyle>): void {
  assertKnownKeys(stylePatch, EDGE_STYLE_KEYS, 'edge')
  assertKnownKeys(stylePatch.labelStyle, EDGE_LABEL_STYLE_KEYS, 'edge label')
  assertKnownKeys(stylePatch.endpointStyle, EDGE_ENDPOINT_STYLE_KEYS, 'edge endpoint')
  assertKnownKeys(stylePatch.animation, EDGE_ANIMATION_STYLE_KEYS, 'edge animation')
}

export function executeCommand<TInput>(
  document: MindDocument,
  command: CommandRecipe<TInput>,
  input: TInput
): CommandResult {
  const result = createPatchResult(document, (draft) => {
    command(draft, input)
  })
  mindDocumentSchema.parse(result.document)
  return result
}

export type AddRootNodeInput = {
  id: string
  title: string
}

type NodeDataByType = {
  attachment: Extract<MindNode, { type: 'attachment' }>['data']
  code: Extract<MindNode, { type: 'code' }>['data']
  image: Extract<MindNode, { type: 'image' }>['data']
  link: Extract<MindNode, { type: 'link' }>['data']
  task: Extract<MindNode, { type: 'task' }>['data']
  topic: Extract<MindNode, { type: 'topic' }>['data']
}

type NodeContentStyleByType = {
  attachment: AttachmentContentStyle
  code: CodeContentStyle
  image: ImageContentStyle
  link: LinkContentStyle
  task: TaskContentStyle
  topic: TopicContentStyle
}

export type AddNodeInput<TType extends MindNodeType = MindNodeType> = {
  id: string
  type: TType
  data?: Partial<NodeDataByType[TType]>
}

export type AddChildMindNodeInput<TType extends MindNodeType = MindNodeType> = AddNodeInput<TType> & {
  parentId: string
}

function defaultNodeData(type: MindNodeType): NodeDataByType[MindNodeType] {
  if (type === 'topic') {
    return { title: 'New topic' }
  }
  if (type === 'image') {
    return { url: 'https://example.com/image.png' }
  }
  if (type === 'link') {
    return { title: 'New link', url: 'https://example.com' }
  }
  if (type === 'attachment') {
    return { fileName: 'attachment.pdf', url: 'https://example.com/attachment.pdf' }
  }
  if (type === 'code') {
    return { code: '' }
  }
  return { items: [{ id: 'task-1', title: 'New task', done: false }] }
}

function defaultContentStyle(type: MindNodeType): NodeContentStyleByType[MindNodeType] {
  if (type === 'topic') {
    return { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
  if (type === 'image') {
    return { ...DEFAULT_IMAGE_CONTENT_STYLE }
  }
  if (type === 'link') {
    return { ...DEFAULT_LINK_CONTENT_STYLE }
  }
  if (type === 'attachment') {
    return { ...DEFAULT_ATTACHMENT_CONTENT_STYLE }
  }
  if (type === 'code') {
    return { ...DEFAULT_CODE_CONTENT_STYLE }
  }
  return { ...DEFAULT_TASK_CONTENT_STYLE }
}

function createNode(input: AddNodeInput & { position: Point }): MindNode {
  const data = {
    ...defaultNodeData(input.type),
    ...(input.data ?? {})
  }

  return mindNodeSchema.parse({
    id: input.id,
    type: input.type,
    position: input.position,
    size: DEFAULT_NODE_SIZE_BY_TYPE[input.type],
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    data,
    contentStyle: defaultContentStyle(input.type)
  })
}

export function addRootMindNodeCommand(draft: Draft<MindDocument>, input: AddNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (draft.nodes.length > 0) {
    throw new Error('Root node already exists')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }

  draft.nodes.push(createNode({ ...input, position: { x: 0, y: 0 } }) as Draft<MindNode>)
  assertMindTree(asDocument(draft))
}

export function addRootNodeCommand(draft: Draft<MindDocument>, input: AddRootNodeInput): void {
  assertPlainTextTitle(input.title)
  addRootMindNodeCommand(draft, { id: input.id, type: 'topic', data: { title: input.title } })
}

export function addRootNode(document: MindDocument, input: AddNodeInput | AddRootNodeInput): MindDocument {
  if ('type' in input) {
    return executeCommand(document, addRootMindNodeCommand, input).document
  }
  return executeCommand(document, addRootNodeCommand, input).document
}

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildMindNodeCommand(draft: Draft<MindDocument>, input: AddChildMindNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  const parent = findNode(asDocument(draft), input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(asDocument(draft), input.parentId).length
  const parentWidth = parent.size.width
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }
  draft.nodes.push(createNode({ ...input, position }) as Draft<MindNode>)
  draft.edges.push(createParentEdge(input.parentId, input.id))
  assertMindTree(asDocument(draft))
}

export function addChildNodeCommand(draft: Draft<MindDocument>, input: AddChildNodeInput): void {
  assertPlainTextTitle(input.title)
  addChildMindNodeCommand(draft, {
    parentId: input.parentId,
    id: input.id,
    type: 'topic',
    data: { title: input.title }
  })
}

export function addChildNode(document: MindDocument, input: AddChildMindNodeInput | AddChildNodeInput): MindDocument {
  if ('type' in input) {
    return executeCommand(document, addChildMindNodeCommand, input).document
  }
  return executeCommand(document, addChildNodeCommand, input).document
}

export type EditNodeTitleInput = {
  nodeId: string
  title: string
}

export function editNodeTitleCommand(draft: Draft<MindDocument>, input: EditNodeTitleInput): void {
  assertPlainTextTitle(input.title)
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  if (node.type !== 'topic') {
    throw new Error(`Node ${input.nodeId} does not support title editing`)
  }
  node.data.title = input.title
  assertMindTree(asDocument(draft))
}

export function editNodeTitle(document: MindDocument, input: EditNodeTitleInput): MindDocument {
  return executeCommand(document, editNodeTitleCommand, input).document
}

export type MoveNodesInput = {
  nodeIds: string[]
  delta: Point
}

export function moveNodesCommand(draft: Draft<MindDocument>, input: MoveNodesInput): void {
  const selected = new Set(input.nodeIds)
  for (const node of draft.nodes) {
    if (selected.has(node.id)) {
      node.position = {
        x: node.position.x + input.delta.x,
        y: node.position.y + input.delta.y
      }
    }
  }
  assertMindTree(asDocument(draft))
}

export function moveNodes(document: MindDocument, input: MoveNodesInput): MindDocument {
  return executeCommand(document, moveNodesCommand, input).document
}

export type ResizeNodesInput = {
  nodeIds: string[]
  delta: { width: number; height: number }
}

export function resizeNodesCommand(draft: Draft<MindDocument>, input: ResizeNodesInput): void {
  const selected = new Set(input.nodeIds)
  for (const node of draft.nodes) {
    if (selected.has(node.id)) {
      node.size = {
        width: Math.max(MIN_NODE_WIDTH, node.size.width + input.delta.width),
        height: Math.max(MIN_NODE_HEIGHT, node.size.height + input.delta.height)
      }
    }
  }
  assertMindTree(asDocument(draft))
}

export function resizeNodes(document: MindDocument, input: ResizeNodesInput): MindDocument {
  return executeCommand(document, resizeNodesCommand, input).document
}

export type SetNodeShellStyleInput = {
  nodeId: string
  stylePatch: Partial<NodeShellStyle>
}

export type SetNodeStyleInput = {
  nodeId: string
  stylePatch: Partial<TopicNodeStyle>
}

export type UpdateNodeDataInput = {
  nodeId: string
  dataPatch: Record<string, unknown>
}

export type SetNodeContentStyleInput = {
  nodeId: string
  stylePatch: Record<string, unknown>
}

export function setNodeShellStyleCommand(draft: Draft<MindDocument>, input: SetNodeShellStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  assertKnownNodeShellStylePatchKeys(input.stylePatch)

  node.shellStyle = {
    ...node.shellStyle,
    ...input.stylePatch
  }
  assertMindTree(asDocument(draft))
}

export function setNodeStyleCommand(draft: Draft<MindDocument>, input: SetNodeStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  assertKnownTopicStylePatchKeys(input.stylePatch)

  const { size, textWeight, ...shellStylePatch } = input.stylePatch
  node.shellStyle = {
    ...node.shellStyle,
    ...shellStylePatch
  }

  if (size !== undefined || textWeight !== undefined) {
    if (node.type !== 'topic') {
      throw new Error(`Node ${input.nodeId} does not support topic style fields`)
    }
    if (size !== undefined) {
      node.size = { ...LEGACY_TOPIC_SIZE_TO_NODE_SIZE[size] }
    }
    if (textWeight !== undefined) {
      node.contentStyle = {
        ...node.contentStyle,
        textWeight
      }
    }
  }

  assertMindTree(asDocument(draft))
}

export function updateNodeDataCommand(draft: Draft<MindDocument>, input: UpdateNodeDataInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  node.data = {
    ...node.data,
    ...input.dataPatch
  } as Draft<MindNode>['data']
  assertMindTree(asDocument(draft))
}

export function setNodeContentStyleCommand(draft: Draft<MindDocument>, input: SetNodeContentStyleInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  node.contentStyle = {
    ...node.contentStyle,
    ...input.stylePatch
  } as Draft<MindNode>['contentStyle']
  assertMindTree(asDocument(draft))
}

export function setNodeStyle(document: MindDocument, input: SetNodeStyleInput): MindDocument {
  return executeCommand(document, setNodeStyleCommand, input).document
}

export type SetEdgeStyleInput = {
  edgeId: string
  stylePatch: Partial<EdgeStyle>
}

export function setEdgeStyleCommand(draft: Draft<MindDocument>, input: SetEdgeStyleInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }
  assertKnownEdgeStylePatchKeys(input.stylePatch)

  edge.style = {
    ...edge.style,
    ...input.stylePatch
  }
  assertMindTree(asDocument(draft))
}

export function setEdgeStyle(document: MindDocument, input: SetEdgeStyleInput): MindDocument {
  return executeCommand(document, setEdgeStyleCommand, input).document
}

export type DeleteEdgeInput = {
  edgeId: string
}

export function deleteEdgeDetachChildCommand(draft: Draft<MindDocument>, input: DeleteEdgeInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  draft.edges = draft.edges.filter((candidate) => candidate.id !== input.edgeId)
  assertMindTree(asDocument(draft))
}

export function deleteEdgeDetachChild(document: MindDocument, input: DeleteEdgeInput): MindDocument {
  return executeCommand(document, deleteEdgeDetachChildCommand, input).document
}

export type DeleteNodeInput = {
  nodeId: string
}

export function deleteNodePromoteChildrenCommand(draft: Draft<MindDocument>, input: DeleteNodeInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  const parentId = getParentId(asDocument(draft), input.nodeId)
  const childIds = getChildIds(asDocument(draft), input.nodeId)

  draft.nodes = draft.nodes.filter((candidate) => candidate.id !== input.nodeId)
  draft.edges = draft.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      draft.edges.push(createParentEdge(parentId, childId))
    }
  }

  assertMindTree(asDocument(draft))
}

export function deleteNodePromoteChildren(document: MindDocument, input: DeleteNodeInput): MindDocument {
  return executeCommand(document, deleteNodePromoteChildrenCommand, input).document
}

export type DeleteNodesInput = {
  nodeIds: string[]
}

export function deleteNodesPromoteChildrenCommand(draft: Draft<MindDocument>, input: DeleteNodesInput): void {
  for (const nodeId of input.nodeIds) {
    if (draft.nodes.some((node) => node.id === nodeId)) {
      deleteNodePromoteChildrenCommand(draft, { nodeId })
    }
  }
  assertMindTree(asDocument(draft))
}

export function deleteNodesPromoteChildren(document: MindDocument, input: DeleteNodesInput): MindDocument {
  return executeCommand(document, deleteNodesPromoteChildrenCommand, input).document
}
