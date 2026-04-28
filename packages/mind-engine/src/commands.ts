import {
  DEFAULT_EDGE_COMPONENT,
  mindDocumentSchema,
  type MindDocument,
  type MindEdge,
  type MindEdgeComponent,
  type Point
} from '@mind-x/shared'
import type { Draft } from 'immer'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph.js'
import { createPatchResult, type PatchResult } from './patches.js'

const DEFAULT_NODE_WIDTH = 160
const ROOT_NODE_WIDTH = 180
const ROOT_NODE_HEIGHT = 56
const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72

export type CommandRecipe<TInput> = (draft: Draft<MindDocument>, input: TInput) => void
export type CommandResult = PatchResult<MindDocument>

function asDocument(draft: Draft<MindDocument>): MindDocument {
  return draft as unknown as MindDocument
}

function getEdgeComponent(edge: MindEdge): MindEdgeComponent {
  return edge.component ?? DEFAULT_EDGE_COMPONENT
}

function getNewChildEdgeComponent(document: MindDocument, parentId: string): MindEdgeComponent {
  const childEdges = document.edges.filter((edge) => edge.source === parentId)
  const latestChildEdge = childEdges.at(-1)
  return latestChildEdge ? getEdgeComponent(latestChildEdge) : DEFAULT_EDGE_COMPONENT
}

function assertPlainTextTitle(title: string): void {
  if (/[<>]/.test(title) || title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
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

export function addRootNodeCommand(draft: Draft<MindDocument>, input: AddRootNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (draft.nodes.length > 0) {
    throw new Error('Root node already exists')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  assertPlainTextTitle(input.title)

  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position: { x: 0, y: 0 },
    size: { width: ROOT_NODE_WIDTH, height: ROOT_NODE_HEIGHT },
    data: { title: input.title }
  })
  assertMindTree(asDocument(draft))
}

export function addRootNode(document: MindDocument, input: AddRootNodeInput): MindDocument {
  return executeCommand(document, addRootNodeCommand, input).document
}

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildNodeCommand(draft: Draft<MindDocument>, input: AddChildNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  assertPlainTextTitle(input.title)
  const parent = findNode(asDocument(draft), input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(asDocument(draft), input.parentId).length
  const parentWidth = parent.size?.width ?? DEFAULT_NODE_WIDTH
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }
  const component = getNewChildEdgeComponent(asDocument(draft), input.parentId)

  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  draft.edges.push(createParentEdge(input.parentId, input.id, { component }))
  assertMindTree(asDocument(draft))
}

export function addChildNode(document: MindDocument, input: AddChildNodeInput): MindDocument {
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

export type SetEdgeComponentInput = {
  edgeId: string
  component: MindEdgeComponent
}

export function setEdgeComponentCommand(draft: Draft<MindDocument>, input: SetEdgeComponentInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  edge.component = input.component
  assertMindTree(asDocument(draft))
}

export function setEdgeComponent(document: MindDocument, input: SetEdgeComponentInput): MindDocument {
  return executeCommand(document, setEdgeComponentCommand, input).document
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
  const componentByChildId = new Map(
    draft.edges
      .filter((edge) => edge.source === input.nodeId)
      .map((edge) => [edge.target, getEdgeComponent(edge as unknown as MindEdge)])
  )

  draft.nodes = draft.nodes.filter((candidate) => candidate.id !== input.nodeId)
  draft.edges = draft.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      draft.edges.push(createParentEdge(parentId, childId, { component: componentByChildId.get(childId) }))
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
