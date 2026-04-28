import type { MindDocument } from '@mind-x/shared'

export function compactSelection(document: MindDocument | null, selectedNodeIds: string[]): string[] {
  if (!document) {
    return []
  }

  const nodeIds = new Set(document.nodes.map((node) => node.id))
  return selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId))
}

export function compactSelectedEdge(document: MindDocument | null, selectedEdgeId: string | null): string | null {
  if (!document || !selectedEdgeId) {
    return null
  }

  return document.edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null
}
