import type { MindDocument, MindEdge, MindNode } from '@mind-x/shared'

export function findNode(document: MindDocument, nodeId: string): MindNode | undefined {
  return document.nodes.find((node) => node.id === nodeId)
}

export function getParentId(document: MindDocument, nodeId: string): string | null {
  const parentEdges = document.edges.filter((edge) => edge.target === nodeId)
  if (parentEdges.length === 0) {
    return null
  }
  if (parentEdges.length > 1) {
    throw new Error(`Node ${nodeId} has more than one parent`)
  }
  return parentEdges[0].source
}

export function getChildIds(document: MindDocument, nodeId: string): string[] {
  return document.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target)
}

export function createParentEdge(source: string, target: string): MindEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'mind-parent'
  }
}

export function assertMindTree(document: MindDocument): void {
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const parentCountByNode = new Map<string, number>()

  for (const edge of document.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} source ${edge.source} does not exist`)
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} target ${edge.target} does not exist`)
    }
    parentCountByNode.set(edge.target, (parentCountByNode.get(edge.target) ?? 0) + 1)
  }

  for (const [nodeId, parentCount] of parentCountByNode.entries()) {
    if (parentCount > 1) {
      throw new Error(`Node ${nodeId} has more than one parent`)
    }
  }
}
