import type { DocumentBounds } from '@mind-x/mind-engine'
import { describe, expect, it } from 'vitest'
import { prepareExportClone } from '@/features/editor/services/exportClone'

class TestClassList {
  private readonly classNames = new Set<string>()

  add(...classNames: string[]): void {
    for (const className of classNames) {
      this.classNames.add(className)
    }
  }

  contains(className: string): boolean {
    return this.classNames.has(className)
  }

  remove(className: string): void {
    this.classNames.delete(className)
  }

  setFromClassName(className: string): void {
    this.classNames.clear()
    for (const value of className.split(/\s+/).filter(Boolean)) {
      this.classNames.add(value)
    }
  }

  toString(): string {
    return [...this.classNames].join(' ')
  }
}

class TestElement {
  readonly attributes = new Map<string, string>()
  readonly children: TestElement[] = []
  readonly classList = new TestClassList()
  readonly style: Record<string, string> = {}
  textContent = ''

  get className(): string {
    return this.classList.toString()
  }

  set className(value: string) {
    this.classList.setFromClassName(value)
  }

  get firstChild(): TestElement | null {
    return this.children[0] ?? null
  }

  appendChild(child: TestElement): TestElement {
    this.children.push(child)
    return child
  }

  insertBefore(child: TestElement, before: TestElement | null): TestElement {
    if (!before) {
      this.children.push(child)
      return child
    }

    const index = this.children.indexOf(before)
    if (index === -1) {
      this.children.push(child)
    } else {
      this.children.splice(index, 0, child)
    }
    return child
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  querySelector<TElement = TestElement>(selector: string): TElement | null {
    return (this.querySelectorAll<TElement>(selector)[0] ?? null)
  }

  querySelectorAll<TElement = TestElement>(selectorList: string): TElement[] {
    const selectors = selectorList.split(',').map((selector) => selector.trim())
    const matches: TestElement[] = []
    this.collect((element) => {
      if (selectors.some((selector) => element.matches(selector))) {
        matches.push(element)
      }
    })
    return matches as TElement[]
  }

  getElementsByClassName(className: string): TestElement[] {
    const matches: TestElement[] = []
    this.collect((element) => {
      if (element.classList.contains(className)) {
        matches.push(element)
      }
    })
    return matches
  }

  private collect(visitor: (element: TestElement) => void): void {
    for (const child of this.children) {
      visitor(child)
      child.collect(visitor)
    }
  }

  private matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1))
    }

    const attributeMatch = selector.match(/^\[([^=]+)="([^"]+)"\]$/)
    if (attributeMatch) {
      return this.attributes.get(attributeMatch[1]) === attributeMatch[2]
    }

    return false
  }
}

class TestDocument {
  createElement(): HTMLElement {
    return new TestElement() as unknown as HTMLElement
  }
}

function bounds(overrides: Partial<DocumentBounds> = {}): DocumentBounds {
  return {
    height: 104,
    maxX: 140,
    maxY: 44,
    minX: -40,
    minY: -12,
    width: 228,
    ...overrides
  }
}

function createCloneRoot(): { clonedDocument: Document; clonedRoot: HTMLElement } {
  const clonedDocument = new TestDocument() as unknown as Document
  const clonedRoot = clonedDocument.createElement('div')
  return { clonedDocument, clonedRoot }
}

describe('exportClone', () => {
  it('prepares the cloned export root without replacing node content', () => {
    const { clonedDocument, clonedRoot } = createCloneRoot()
    clonedRoot.style.transform = 'translate(50px, 20px) scale(0.5)'

    const content = clonedDocument.createElement('span')
    content.className = 'task-node__input'
    content.textContent = 'Keep rendered task input'
    clonedRoot.appendChild(content)

    prepareExportClone(clonedDocument, clonedRoot, bounds())

    const background = clonedRoot.querySelector<HTMLElement>('[data-editor-export-background="true"]')
    expect(clonedRoot.style.transform).toBe('none')
    expect(background).not.toBeNull()
    expect(background?.style.left).toBe('-64px')
    expect(background?.style.top).toBe('-36px')
    expect(background?.style.width).toBe('228px')
    expect(background?.style.height).toBe('104px')
    expect(background?.style.background).toContain('linear-gradient')
    expect(background?.style.backgroundSize).toBe('24px 24px')
    expect(clonedRoot.querySelector('.task-node__input')?.textContent).toBe('Keep rendered task input')
  })

  it('hides editor-only affordances and removes selected state classes from the clone', () => {
    const { clonedDocument, clonedRoot } = createCloneRoot()

    const node = clonedDocument.createElement('div')
    node.className = 'base-node topic-node--selected'
    clonedRoot.appendChild(node)

    const edgePath = clonedDocument.createElement('path')
    edgePath.classList.add(
      'edge-renderer__path',
      'edge-renderer__path--active',
      'edge-renderer__path--selected'
    )
    clonedRoot.appendChild(edgePath)

    const resizeHandle = clonedDocument.createElement('span')
    resizeHandle.className = 'base-node__resize-handle'
    resizeHandle.setAttribute('data-editor-export-ignore', 'true')
    clonedRoot.appendChild(resizeHandle)

    const selectionLayer = clonedDocument.createElement('div')
    selectionLayer.setAttribute('data-html2canvas-ignore', 'true')
    clonedRoot.appendChild(selectionLayer)

    prepareExportClone(clonedDocument, clonedRoot, bounds())

    expect(node.classList.contains('topic-node--selected')).toBe(false)
    expect(edgePath.classList.contains('edge-renderer__path--active')).toBe(false)
    expect(edgePath.classList.contains('edge-renderer__path--selected')).toBe(false)
    expect(resizeHandle.style.display).toBe('none')
    expect(selectionLayer.style.display).toBe('none')
  })
})
