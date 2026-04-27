import {
  DEFAULT_EDGE_COMPONENT,
  type MindDocument,
  type MindEdge,
  type MindEdgeComponent,
  type Point
} from '@mind-x/shared'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph.js'

const DEFAULT_NODE_WIDTH = 160
const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72

function cloneDocument(document: MindDocument): MindDocument {
  return structuredClone(document)
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

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildNode(document: MindDocument, input: AddChildNodeInput): MindDocument {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (findNode(document, input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  assertPlainTextTitle(input.title)
  const next = cloneDocument(document)
  const parent = findNode(next, input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(next, input.parentId).length
  const parentWidth = parent.size?.width ?? DEFAULT_NODE_WIDTH
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }
  const component = getNewChildEdgeComponent(next, input.parentId)

  next.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  next.edges.push(createParentEdge(input.parentId, input.id, { component }))
  assertMindTree(next)
  return next
}

export type EditNodeTitleInput = {
  nodeId: string
  title: string
}

export function editNodeTitle(document: MindDocument, input: EditNodeTitleInput): MindDocument {
  assertPlainTextTitle(input.title)
  const next = cloneDocument(document)
  const node = findNode(next, input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  node.data.title = input.title
  assertMindTree(next)
  return next
}

export type MoveNodesInput = {
  nodeIds: string[]
  delta: Point
}

export function moveNodes(document: MindDocument, input: MoveNodesInput): MindDocument {
  const next = cloneDocument(document)
  const selected = new Set(input.nodeIds)
  for (const node of next.nodes) {
    if (selected.has(node.id)) {
      node.position = {
        x: node.position.x + input.delta.x,
        y: node.position.y + input.delta.y
      }
    }
  }
  assertMindTree(next)
  return next
}

export type SetEdgeComponentInput = {
  edgeId: string
  component: MindEdgeComponent
}

export function setEdgeComponent(document: MindDocument, input: SetEdgeComponentInput): MindDocument {
  const next = cloneDocument(document)
  const edge = next.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  edge.component = input.component
  assertMindTree(next)
  return next
}

export type DeleteEdgeInput = {
  edgeId: string
}

export function deleteEdgeDetachChild(document: MindDocument, input: DeleteEdgeInput): MindDocument {
  const next = cloneDocument(document)
  const edge = next.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  next.edges = next.edges.filter((candidate) => candidate.id !== input.edgeId)
  assertMindTree(next)
  return next
}

export type DeleteNodeInput = {
  nodeId: string
}

export function deleteNodePromoteChildren(document: MindDocument, input: DeleteNodeInput): MindDocument {
  const next = cloneDocument(document)
  const node = findNode(next, input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  const parentId = getParentId(next, input.nodeId)
  const childIds = getChildIds(next, input.nodeId)
  const componentByChildId = new Map(
    next.edges
      .filter((edge) => edge.source === input.nodeId)
      .map((edge) => [edge.target, getEdgeComponent(edge)])
  )

  next.nodes = next.nodes.filter((candidate) => candidate.id !== input.nodeId)
  next.edges = next.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      next.edges.push(createParentEdge(parentId, childId, { component: componentByChildId.get(childId) }))
    }
  }

  assertMindTree(next)
  return next
}
