import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isEditorShortcutTarget } from '@/features/editor/utils/keyboardTargets'

class TestHTMLElement {
  constructor(readonly isContentEditable = false) {}

  closest(_selector: string): TestHTMLElement | null {
    return null
  }
}

class TestHTMLInputElement extends TestHTMLElement {
  constructor(readonly type: string) {
    super(false)
  }
}

class TestHTMLTextAreaElement extends TestHTMLElement {}

function inputTarget(type: string): EventTarget {
  return new TestHTMLInputElement(type) as unknown as EventTarget
}

class TestControlElement extends TestHTMLElement {
  constructor(private readonly selector: string) {
    super(false)
  }

  override closest(value: string): TestHTMLElement | null {
    return value.split(',').map((part) => part.trim()).includes(this.selector) ? this : null
  }
}

function controlTarget(selector: string): EventTarget {
  return new TestControlElement(selector) as unknown as EventTarget
}

describe('keyboard targets', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLElement', TestHTMLElement)
    vi.stubGlobal('HTMLInputElement', TestHTMLInputElement)
    vi.stubGlobal('HTMLTextAreaElement', TestHTMLTextAreaElement)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('protects text editing fields from global shortcuts', () => {
    expect(isEditorShortcutTarget(inputTarget(''))).toBe(true)
    expect(isEditorShortcutTarget(inputTarget('text'))).toBe(true)
    expect(isEditorShortcutTarget(inputTarget('number'))).toBe(true)
    expect(isEditorShortcutTarget(new TestHTMLTextAreaElement() as unknown as EventTarget)).toBe(true)
    expect(isEditorShortcutTarget(new TestHTMLElement(true) as unknown as EventTarget)).toBe(true)
  })

  it('protects interactive and editor-control targets from global shortcuts', () => {
    expect(isEditorShortcutTarget(inputTarget('radio'))).toBe(true)
    expect(isEditorShortcutTarget(inputTarget('checkbox'))).toBe(true)
    expect(isEditorShortcutTarget(inputTarget('button'))).toBe(true)
    expect(isEditorShortcutTarget(inputTarget('range'))).toBe(true)
    expect(isEditorShortcutTarget(controlTarget('[data-editor-control]'))).toBe(true)
    expect(isEditorShortcutTarget(controlTarget('.editor-toolbar'))).toBe(true)
    expect(isEditorShortcutTarget(controlTarget('.editor-context-menu'))).toBe(true)
  })

  it('ignores missing and non-element targets', () => {
    expect(isEditorShortcutTarget(null)).toBe(false)
    expect(isEditorShortcutTarget({} as EventTarget)).toBe(false)
  })
})
