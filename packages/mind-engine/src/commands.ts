import type { MindDocument, Point } from '@mind-x/shared'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph.js'

const DEFAULT_NODE_WIDTH = 160
const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72

function cloneDocument(document: MindDocument): MindDocument {
  return structuredClone(document)
}

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildNode(document: MindDocument, input: AddChildNodeInput): MindDocument {
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

  next.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  next.edges.push(createParentEdge(input.parentId, input.id))
  assertMindTree(next)
  return next
}

export type EditNodeTitleInput = {
  nodeId: string
  title: string
}

export function editNodeTitle(document: MindDocument, input: EditNodeTitleInput): MindDocument {
  if (/[<>]/.test(input.title) || input.title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
  const next = cloneDocument(document)
  const node = findNode(next, input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  node.data.title = input.title
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

  next.nodes = next.nodes.filter((candidate) => candidate.id !== input.nodeId)
  next.edges = next.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      next.edges.push(createParentEdge(parentId, childId))
    }
  }

  assertMindTree(next)
  return next
}
