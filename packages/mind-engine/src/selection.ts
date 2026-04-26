import type { MindNode, Point, Size } from '@mind-x/shared'

export type Rect = Point & Size

export function nodeIntersectsRect(node: MindNode, rect: Rect): boolean {
  const width = node.size?.width ?? 160
  const height = node.size?.height ?? 48
  return (
    node.position.x < rect.x + rect.width &&
    node.position.x + width > rect.x &&
    node.position.y < rect.y + rect.height &&
    node.position.y + height > rect.y
  )
}

export function getNodesInRect(nodes: MindNode[], rect: Rect): string[] {
  return nodes.filter((node) => nodeIntersectsRect(node, rect)).map((node) => node.id)
}
