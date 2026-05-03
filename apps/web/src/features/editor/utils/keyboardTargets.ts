const TEXT_EDITING_INPUT_TYPES = new Set([
  '',
  'date',
  'datetime-local',
  'email',
  'month',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'time',
  'url',
  'week'
])

type KeyboardShortcutLike = {
  ctrlKey: boolean
  key: string
  metaKey: boolean
}

export function isSaveShortcut(event: KeyboardShortcutLike): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's'
}

const EDITOR_SHORTCUT_PROTECTED_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[data-editor-control]',
  '.editor-toolbar',
  '.editor-context-menu'
].join(', ')

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target instanceof HTMLTextAreaElement) {
    return true
  }

  if (target instanceof HTMLInputElement) {
    return TEXT_EDITING_INPUT_TYPES.has(target.type)
  }

  return target.isContentEditable
}

export function isEditorShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target instanceof HTMLInputElement) {
    return true
  }

  return isTextEditingTarget(target) || target.closest(EDITOR_SHORTCUT_PROTECTED_SELECTOR) !== null
}
