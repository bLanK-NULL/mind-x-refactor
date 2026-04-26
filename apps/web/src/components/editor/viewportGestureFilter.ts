type ZoomFilterEvent = Event & {
  button?: number
  ctrlKey?: boolean
}

const EXCLUDED_VIEWPORT_TARGETS = [
  '[data-editor-node]',
  '[data-editor-control]',
  '.editor-toolbar',
  '.editor-context-menu',
  'input',
  'textarea',
  'button',
  'select'
].join(', ')

export function allowsViewportGesture(event: Event): boolean {
  const zoomEvent = event as ZoomFilterEvent
  const keepsD3DefaultProtection = (!zoomEvent.ctrlKey || zoomEvent.type === 'wheel') && !zoomEvent.button
  if (!keepsD3DefaultProtection) {
    return false
  }

  const target = zoomEvent.target
  if (!(target instanceof Element)) {
    return true
  }

  return !target.closest(EXCLUDED_VIEWPORT_TARGETS)
}
