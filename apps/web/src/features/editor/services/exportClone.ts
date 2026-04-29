import { EXPORT_PADDING, type DocumentBounds } from '@mind-x/mind-engine'

const CANVAS_GRID_BACKGROUND =
  'linear-gradient(var(--color-grid) 1px, transparent 1px), ' +
  'linear-gradient(90deg, var(--color-grid) 1px, transparent 1px), ' +
  'var(--color-canvas)'
const CANVAS_GRID_SIZE = '24px 24px'
const EXPORT_IGNORE_SELECTOR = [
  '[data-html2canvas-ignore="true"]',
  '[data-editor-export-ignore="true"]',
  '.base-node__resize-handle'
].join(', ')
const EDITOR_STATE_CLASS_NAMES = [
  'topic-node--selected',
  'edge-renderer__path--active',
  'edge-renderer__path--selected'
]

export function prepareExportClone(
  clonedDocument: Document,
  clonedRoot: HTMLElement,
  bounds: DocumentBounds
): void {
  clonedRoot.style.transform = 'none'
  insertCanvasBackground(clonedDocument, clonedRoot, bounds)
  hideIgnoredElements(clonedRoot)
  removeEditorStateClasses(clonedRoot)
}

function insertCanvasBackground(
  clonedDocument: Document,
  clonedRoot: HTMLElement,
  bounds: DocumentBounds
): void {
  const left = bounds.minX - EXPORT_PADDING
  const top = bounds.minY - EXPORT_PADDING
  const background = clonedDocument.createElement('div')
  background.setAttribute('data-editor-export-background', 'true')
  Object.assign(background.style, {
    background: CANVAS_GRID_BACKGROUND,
    backgroundPosition: `${-left}px ${-top}px`,
    backgroundSize: CANVAS_GRID_SIZE,
    height: `${bounds.height}px`,
    left: `${left}px`,
    pointerEvents: 'none',
    position: 'absolute',
    top: `${top}px`,
    width: `${bounds.width}px`
  })
  clonedRoot.insertBefore(background, clonedRoot.firstChild)
}

function hideIgnoredElements(clonedRoot: HTMLElement): void {
  for (const element of Array.from(clonedRoot.querySelectorAll<HTMLElement>(EXPORT_IGNORE_SELECTOR))) {
    element.style.display = 'none'
  }
}

function removeEditorStateClasses(clonedRoot: HTMLElement): void {
  for (const className of EDITOR_STATE_CLASS_NAMES) {
    if (clonedRoot.classList.contains(className)) {
      clonedRoot.classList.remove(className)
    }

    for (const element of Array.from(clonedRoot.getElementsByClassName(className))) {
      element.classList.remove(className)
    }
  }
}
