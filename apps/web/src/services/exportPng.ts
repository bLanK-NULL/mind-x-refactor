import type { MindDocument, MindNode } from '@mind-x/shared'
import html2canvas from 'html2canvas'

const FALLBACK_NODE_WIDTH = 180
const FALLBACK_NODE_HEIGHT = 56
const EXPORT_PADDING = 24
const EXPORT_BACKGROUND = '#ffffff'

export type DocumentBounds = {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export type ExportPngInput = {
  document: MindDocument
  root: HTMLElement
}

export function calculateDocumentBounds(document: MindDocument): DocumentBounds | null {
  if (document.nodes.length === 0) {
    return null
  }

  const minX = Math.min(...document.nodes.map((node) => node.position.x))
  const minY = Math.min(...document.nodes.map((node) => node.position.y))
  const maxX = Math.max(...document.nodes.map((node) => node.position.x + nodeWidth(node)))
  const maxY = Math.max(...document.nodes.map((node) => node.position.y + nodeHeight(node)))

  return {
    height: Math.ceil(maxY - minY + EXPORT_PADDING * 2),
    maxX,
    maxY,
    minX,
    minY,
    width: Math.ceil(maxX - minX + EXPORT_PADDING * 2)
  }
}

export function createPngFilename(title: string): string {
  const safeTitle = title
    .replace(/[\\/]+/g, '-')
    .replace(/[\u0000-\u001f\u007f<>:"|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (safeTitle.length === 0) {
    return 'mind-map.png'
  }

  return safeTitle.toLowerCase().endsWith('.png') ? safeTitle : `${safeTitle}.png`
}

export async function exportDocumentAsPng(input: ExportPngInput): Promise<string | false> {
  const bounds = calculateDocumentBounds(input.document)
  if (bounds === null) {
    return false
  }

  const canvas = await html2canvas(input.root, {
    backgroundColor: EXPORT_BACKGROUND,
    height: bounds.height,
    onclone: (_clonedDocument, clonedRoot) => {
      clonedRoot.style.transform = 'none'
    },
    scale: 2,
    width: bounds.width,
    x: bounds.minX - EXPORT_PADDING,
    y: bounds.minY - EXPORT_PADDING
  })
  const filename = createPngFilename(input.document.meta.title)
  await downloadCanvas(canvas, filename)
  return filename
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  if (canvas.toBlob) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value === null) {
          reject(new Error('Unable to export PNG'))
          return
        }
        resolve(value)
      }, 'image/png')
    })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, filename)
    URL.revokeObjectURL(url)
    return
  }

  triggerDownload(canvas.toDataURL('image/png'), filename)
}

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function nodeWidth(node: MindNode): number {
  return node.size?.width ?? FALLBACK_NODE_WIDTH
}

function nodeHeight(node: MindNode): number {
  return node.size?.height ?? FALLBACK_NODE_HEIGHT
}
