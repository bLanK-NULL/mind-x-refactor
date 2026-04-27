import type { MindDocument, MindEdge, MindEdgeComponent, MindNode } from '@mind-x/shared'

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

export type CreateParentEdgeOptions = {
  component?: MindEdgeComponent
}

export function createParentEdge(source: string, target: string, options: CreateParentEdgeOptions = {}): MindEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: 'mind-parent',
    ...(options.component ? { component: options.component } : {})
  }
}

export function assertMindTree(document: MindDocument): void {
  const nodeIds = new Set(document.nodes.map((node) => node.id))
  const parentCountByNode = new Map<string, number>()
  const childIdsByNode = new Map<string, string[]>()

  for (const nodeId of nodeIds) {
    childIdsByNode.set(nodeId, [])
  }

  for (const edge of document.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new Error(`Edge ${edge.id} source ${edge.source} does not exist`)
    }
    if (!nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} target ${edge.target} does not exist`)
    }
    if (edge.source === edge.target) {
      throw new Error(`Node ${edge.source} cannot be its own parent`)
    }
    parentCountByNode.set(edge.target, (parentCountByNode.get(edge.target) ?? 0) + 1)
    childIdsByNode.get(edge.source)?.push(edge.target)
  }

  for (const [nodeId, parentCount] of parentCountByNode.entries()) {
    if (parentCount > 1) {
      throw new Error(`Node ${nodeId} has more than one parent`)
    }
  }

  const visitStateByNode = new Map<string, 'visiting' | 'visited'>()

  function visit(nodeId: string): void {
    const visitState = visitStateByNode.get(nodeId)
    if (visitState === 'visiting') {
      throw new Error(`Cycle detected at node ${nodeId}`)
    }
    if (visitState === 'visited') {
      return
    }

    visitStateByNode.set(nodeId, 'visiting')
    for (const childId of childIdsByNode.get(nodeId) ?? []) {
      visit(childId)
    }
    visitStateByNode.set(nodeId, 'visited')
  }

  for (const nodeId of nodeIds) {
    visit(nodeId)
  }
}
