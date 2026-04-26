import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '@mind-x/mind-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const html2canvasMock = vi.hoisted(() => vi.fn())

vi.mock('html2canvas', () => ({
  default: html2canvasMock
}))

function document(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    ...createEmptyDocument({
      now: '2026-04-26T00:00:00.000Z',
      projectId: 'project-1',
      title: 'Project One'
    }),
    ...overrides
  }
}

describe('exportPng', () => {
  const originalDocument = globalThis.document
  const originalUrl = globalThis.URL

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument
    })
    Object.defineProperty(globalThis, 'URL', {
      configurable: true,
      value: originalUrl
    })
  })

  it('calculates document bounds with node size fallback and padding', async () => {
    const { calculateDocumentBounds } = await import('./exportPng')
    const bounds = calculateDocumentBounds(
      document({
        nodes: [
          { data: { title: 'Root' }, id: 'root', position: { x: -20, y: 10 }, type: 'topic' },
          {
            data: { title: 'Child' },
            id: 'child',
            position: { x: 220, y: -30 },
            size: { height: 80, width: 200 },
            type: 'topic'
          }
        ]
      })
    )

    expect(bounds).toEqual({
      height: 144,
      maxX: 420,
      maxY: 66,
      minX: -20,
      minY: -30,
      width: 488
    })
  })

  it('sanitizes unsafe document titles for png filenames', async () => {
    const { createPngFilename } = await import('./exportPng')

    expect(createPngFilename('Roadmap/Q2\u0000: Draft')).toBe('Roadmap-Q2 Draft.png')
    expect(createPngFilename('   ')).toBe('mind-map.png')
    expect(createPngFilename('already.png')).toBe('already.png')
  })

  it('returns false without rendering when the document has no nodes', async () => {
    const { exportDocumentAsPng } = await import('./exportPng')

    await expect(exportDocumentAsPng({ document: document(), root: {} as HTMLElement })).resolves.toBe(false)

    expect(html2canvasMock).not.toHaveBeenCalled()
  })

  it('renders the document export root from the document bounds origin and triggers a PNG download', async () => {
    vi.useFakeTimers()
    const click = vi.fn()
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const link = { click, download: '', href: '' }
    const createElement = vi.fn(() => link)
    const createObjectURL = vi.fn(() => 'blob:mind-map')
    const revokeObjectURL = vi.fn()
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })))
    }
    const root = { scrollHeight: 240, scrollWidth: 320 } as HTMLElement

    html2canvasMock.mockResolvedValueOnce(canvas)
    vi.stubGlobal('document', { body: { appendChild, removeChild }, createElement })
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    const { exportDocumentAsPng } = await import('./exportPng')
    await expect(
      exportDocumentAsPng({
        document: document({
          meta: { ...document().meta, title: 'Project/One' },
          nodes: [{ data: { title: 'Root' }, id: 'root', position: { x: 120, y: 80 }, type: 'topic' }]
        }),
        root
      })
    ).resolves.toBe('Project-One.png')

    expect(html2canvasMock).toHaveBeenCalledWith(root, {
      backgroundColor: '#ffffff',
      height: 104,
      onclone: expect.any(Function),
      scale: 2,
      width: 228,
      x: 96,
      y: 56
    })
    const options = html2canvasMock.mock.calls[0]?.[1]
    const clonedRoot = { style: { transform: 'translate(50px, 20px) scale(0.5)' } } as HTMLElement
    options.onclone(globalThis.document, clonedRoot)
    expect(clonedRoot.style.transform).toBe('none')
    expect(link.download).toBe('Project-One.png')
    expect(link.href).toBe('blob:mind-map')
    expect(click).toHaveBeenCalled()
    expect(appendChild).toHaveBeenCalledWith(link)
    expect(removeChild).toHaveBeenCalledWith(link)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runOnlyPendingTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mind-map')
  })

  it('uses negative bounds origins when exporting documents with negative-positioned nodes', async () => {
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })))
    }
    const root = {} as HTMLElement

    html2canvasMock.mockResolvedValueOnce(canvas)
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      createElement: vi.fn(() => ({ click: vi.fn(), download: '', href: '' }))
    })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mind-map'), revokeObjectURL: vi.fn() })

    const { exportDocumentAsPng } = await import('./exportPng')
    await exportDocumentAsPng({
      document: document({
        nodes: [{ data: { title: 'Root' }, id: 'root', position: { x: -40, y: -12 }, type: 'topic' }]
      }),
      root
    })

    expect(html2canvasMock).toHaveBeenCalledWith(root, expect.objectContaining({ x: -64, y: -36 }))
  })
})
