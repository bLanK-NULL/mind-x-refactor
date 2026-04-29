import type { MindDocument } from '@mind-x/shared'
import html2canvas from 'html2canvas'
import {
  calculateDocumentBounds,
  EXPORT_PADDING
} from './exportBounds'
import { prepareExportClone } from './exportClone'

export { calculateDocumentBounds } from './exportBounds'
export type { DocumentBounds } from './exportBounds'

const EXPORT_IMAGE_TIMEOUT = 8000

export type ExportPngInput = {
  document: MindDocument
  root: HTMLElement
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
    backgroundColor: null,
    height: bounds.height,
    imageTimeout: EXPORT_IMAGE_TIMEOUT,
    onclone: (clonedDocument, clonedRoot) => {
      prepareExportClone(clonedDocument, clonedRoot, bounds)
    },
    scale: 2,
    useCORS: true,
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
    revokeObjectUrlSoon(url)
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

function revokeObjectUrlSoon(url: string): void {
  const setTimeoutFn = globalThis.window?.setTimeout ?? globalThis.setTimeout
  if (setTimeoutFn) {
    setTimeoutFn(() => URL.revokeObjectURL(url), 0)
    return
  }

  URL.revokeObjectURL(url)
}
