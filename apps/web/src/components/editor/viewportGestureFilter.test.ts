import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allowsViewportGesture } from '@/features/editor/utils/viewportGestureFilter'

class TestElement {
  constructor(
    private readonly matches: string[] = [],
    private readonly parent: TestElement | null = null
  ) {}

  closest(selectors: string): TestElement | null {
    const options = selectors.split(',').map((selector) => selector.trim())
    let current: TestElement | null = this

    while (current) {
      if (options.some((selector) => current?.matches.includes(selector))) {
        return current
      }
      current = current.parent
    }

    return null
  }
}

function eventFor(type: string, options: { button?: number; ctrlKey?: boolean; target?: EventTarget | null } = {}): Event {
  return {
    button: options.button ?? 0,
    ctrlKey: options.ctrlKey ?? false,
    target: options.target ?? (new TestElement() as unknown as EventTarget),
    type
  } as unknown as Event
}

describe('viewport gesture filter', () => {
  beforeEach(() => {
    vi.stubGlobal('Element', TestElement)
  })

  it('allows primary-button pointer gestures and regular wheel gestures on the pane', () => {
    expect(allowsViewportGesture(eventFor('mousedown'))).toBe(true)
    expect(allowsViewportGesture(eventFor('wheel'))).toBe(true)
  })

  it('keeps d3 zoom default protections for non-primary and ctrl gestures', () => {
    expect(allowsViewportGesture(eventFor('mousedown', { button: 1 }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { button: 2 }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { ctrlKey: true }))).toBe(false)
    expect(allowsViewportGesture(eventFor('wheel', { ctrlKey: true }))).toBe(true)
  })

  it('excludes editor controls, nodes, context menus, inspectors, inputs, and buttons', () => {
    const toolbar = new TestElement(['.editor-toolbar'])
    const toolbarButton = new TestElement(['button'], toolbar)
    const node = new TestElement(['[data-editor-node]'])
    const contextMenu = new TestElement(['.editor-context-menu'])
    const control = new TestElement(['[data-editor-control]'])
    const inspector = new TestElement(['.inspector-panel'])

    expect(allowsViewportGesture(eventFor('mousedown', { target: toolbarButton as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: node as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: contextMenu as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: inspector as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: new TestElement(['input']) as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: new TestElement(['button']) as unknown as EventTarget }))).toBe(false)
    expect(allowsViewportGesture(eventFor('mousedown', { target: control as unknown as EventTarget }))).toBe(false)
  })
})
