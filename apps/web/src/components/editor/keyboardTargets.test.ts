import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTextEditingTarget } from '@/features/editor/utils/keyboardTargets'

class TestHTMLElement {
  constructor(readonly isContentEditable = false) {}
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
    expect(isTextEditingTarget(inputTarget(''))).toBe(true)
    expect(isTextEditingTarget(inputTarget('text'))).toBe(true)
    expect(isTextEditingTarget(inputTarget('number'))).toBe(true)
    expect(isTextEditingTarget(new TestHTMLTextAreaElement() as unknown as EventTarget)).toBe(true)
    expect(isTextEditingTarget(new TestHTMLElement(true) as unknown as EventTarget)).toBe(true)
  })

  it('allows non-text controls to fall through to editor shortcuts', () => {
    expect(isTextEditingTarget(inputTarget('radio'))).toBe(false)
    expect(isTextEditingTarget(inputTarget('checkbox'))).toBe(false)
    expect(isTextEditingTarget(inputTarget('button'))).toBe(false)
    expect(isTextEditingTarget(inputTarget('range'))).toBe(false)
  })

  it('ignores missing and non-element targets', () => {
    expect(isTextEditingTarget(null)).toBe(false)
    expect(isTextEditingTarget({} as EventTarget)).toBe(false)
  })
})
