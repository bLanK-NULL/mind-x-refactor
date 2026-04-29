import type { MindDocument } from '@mind-x/shared'

export const EXPORT_PADDING = 24

export type DocumentBounds = {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export function calculateDocumentBounds(document: MindDocument): DocumentBounds | null {
  if (document.nodes.length === 0) {
    return null
  }

  const minX = Math.min(...document.nodes.map((node) => node.position.x))
  const minY = Math.min(...document.nodes.map((node) => node.position.y))
  const maxX = Math.max(...document.nodes.map((node) => node.position.x + node.size.width))
  const maxY = Math.max(...document.nodes.map((node) => node.position.y + node.size.height))

  return {
    height: Math.ceil(maxY - minY + EXPORT_PADDING * 2),
    maxX,
    maxY,
    minX,
    minY,
    width: Math.ceil(maxX - minX + EXPORT_PADDING * 2)
  }
}
