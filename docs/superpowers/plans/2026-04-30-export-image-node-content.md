# Export Image Node Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export clean whole-map PNGs from the multi-type node canvas while preserving the real rendered DOM of every `*NodeContent` component.

**Architecture:** Keep the current `html2canvas` pipeline, split bounds and clone preparation into focused services, and let export clean only editor-shell state in the cloned DOM. Node content components remain normal canvas renderers with no export-specific branches.

**Tech Stack:** Vue 3, TypeScript, Vitest, html2canvas 1.4.x, Vite path alias `@`.

---

## File Structure

- Create `apps/web/src/features/editor/services/exportBounds.ts`
  - Owns `EXPORT_PADDING`, `DocumentBounds`, and `calculateDocumentBounds(document)`.
- Create `apps/web/src/features/editor/services/exportClone.ts`
  - Owns `prepareExportClone(clonedDocument, clonedRoot, bounds)`.
  - Inserts the export grid/background layer.
  - Removes generic selection/active classes from the clone.
  - Hides generic export-ignore elements.
- Modify `apps/web/src/features/editor/services/exportPng.ts`
  - Remains the public export/download entry point.
  - Imports bounds and clone helpers.
  - Re-exports `calculateDocumentBounds` and `DocumentBounds` for current callers/tests.
  - Adds `useCORS`, `imageTimeout`, and non-white background behavior.
- Modify `apps/web/src/features/editor/__tests__/exportPng.test.ts`
  - Keeps public export behavior covered.
  - Verifies html2canvas options and that export does not blur active controls.
- Create `apps/web/src/features/editor/__tests__/exportClone.test.ts`
  - Covers cloned DOM cleanup directly.
- Modify `apps/web/src/features/editor/components/canvas/BaseNode.vue`
  - Marks the resize handle as a generic export-ignore affordance.
- Modify `apps/web/src/features/editor/__tests__/baseNode.test.ts`
  - Verifies the resize handle has an export-ignore marker.
- Modify `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
  - Adds a source-level guard that `*NodeContent` components do not gain export-specific code.

## Task 1: Extract Export Bounds

**Files:**
- Create: `apps/web/src/features/editor/services/exportBounds.ts`
- Modify: `apps/web/src/features/editor/services/exportPng.ts`
- Modify: `apps/web/src/features/editor/__tests__/exportPng.test.ts`

- [ ] **Step 1: Write the failing direct bounds import test**

In `apps/web/src/features/editor/__tests__/exportPng.test.ts`, change the bounds test import from:

```ts
const { calculateDocumentBounds } = await import('@/features/editor/services/exportPng')
```

to:

```ts
const { calculateDocumentBounds } = await import('@/features/editor/services/exportBounds')
```

- [ ] **Step 2: Run the focused export test to verify it fails**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts
```

Expected: FAIL with an import error for `@/features/editor/services/exportBounds`.

- [ ] **Step 3: Create the bounds module**

Create `apps/web/src/features/editor/services/exportBounds.ts`:

```ts
import type { MindDocument } from '@mind-x/shared'

export const EXPORT_PADDING = 24

export type DocumentBounds = {
  height: number
  maxX: number
  maxY: number
  minX: number
  minY: number
  width: number
}

export function calculateDocumentBounds(document: MindDocument): DocumentBounds | null {
  if (document.nodes.length === 0) {
    return null
  }

  const minX = Math.min(...document.nodes.map((node) => node.position.x))
  const minY = Math.min(...document.nodes.map((node) => node.position.y))
  const maxX = Math.max(...document.nodes.map((node) => node.position.x + node.size.width))
  const maxY = Math.max(...document.nodes.map((node) => node.position.y + node.size.height))

  return {
    height: Math.ceil(maxY - minY + EXPORT_PADDING * 2),
    maxX,
    maxY,
    minX,
    minY,
    width: Math.ceil(maxX - minX + EXPORT_PADDING * 2)
  }
}
```

- [ ] **Step 4: Wire exportPng to the new bounds module while preserving its public exports**

In `apps/web/src/features/editor/services/exportPng.ts`, replace the local `EXPORT_PADDING`, `DocumentBounds`, and `calculateDocumentBounds` declarations with imports and re-exports:

```ts
import type { MindDocument } from '@mind-x/shared'
import html2canvas from 'html2canvas'
import {
  calculateDocumentBounds,
  EXPORT_PADDING
} from './exportBounds'

export { calculateDocumentBounds } from './exportBounds'
export type { DocumentBounds } from './exportBounds'

const EXPORT_BACKGROUND = '#ffffff'
```

Keep the rest of `exportPng.ts` unchanged in this task. `exportDocumentAsPng` should still calculate `x` and `y` with `bounds.minX - EXPORT_PADDING` and `bounds.minY - EXPORT_PADDING`.

- [ ] **Step 5: Run the focused export test to verify it passes**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts
```

Expected: PASS for all tests in `exportPng.test.ts`.

- [ ] **Step 6: Commit the bounds extraction**

```bash
git add apps/web/src/features/editor/services/exportBounds.ts apps/web/src/features/editor/services/exportPng.ts apps/web/src/features/editor/__tests__/exportPng.test.ts
git commit -m "refactor(web): split export bounds calculation"
```

## Task 2: Add Clone Preparation Unit

**Files:**
- Create: `apps/web/src/features/editor/services/exportClone.ts`
- Create: `apps/web/src/features/editor/__tests__/exportClone.test.ts`

- [ ] **Step 1: Write failing clone preparation tests**

Create `apps/web/src/features/editor/__tests__/exportClone.test.ts`:

```ts
import type { DocumentBounds } from '@/features/editor/services/exportBounds'
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
```

- [ ] **Step 2: Run the clone test to verify it fails**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportClone.test.ts
```

Expected: FAIL with an import error for `@/features/editor/services/exportClone`.

- [ ] **Step 3: Create the clone preparation helper**

Create `apps/web/src/features/editor/services/exportClone.ts`:

```ts
import type { DocumentBounds } from './exportBounds'
import { EXPORT_PADDING } from './exportBounds'

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
```

- [ ] **Step 4: Run the clone test to verify it passes**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportClone.test.ts
```

Expected: PASS for both `exportClone` tests.

- [ ] **Step 5: Commit the clone helper**

```bash
git add apps/web/src/features/editor/services/exportClone.ts apps/web/src/features/editor/__tests__/exportClone.test.ts
git commit -m "feat(web): prepare cloned canvas for png export"
```

## Task 3: Wire Clone Preparation Into PNG Export

**Files:**
- Modify: `apps/web/src/features/editor/services/exportPng.ts`
- Modify: `apps/web/src/features/editor/__tests__/exportPng.test.ts`

- [ ] **Step 1: Update the html2canvas options assertion to fail against current exportPng**

In `apps/web/src/features/editor/__tests__/exportPng.test.ts`, replace the `expect(html2canvasMock).toHaveBeenCalledWith(root, { ... })` block inside `renders the document export root from the document bounds origin and triggers a PNG download` with:

```ts
expect(html2canvasMock).toHaveBeenCalledWith(root, expect.objectContaining({
  backgroundColor: null,
  height: 104,
  imageTimeout: 8000,
  scale: 2,
  useCORS: true,
  width: 228,
  x: 96,
  y: 56
}))
```

Replace the current clone callback assertion in the same test:

```ts
const options = html2canvasMock.mock.calls[0]?.[1]
const clonedRoot = { style: { transform: 'translate(50px, 20px) scale(0.5)' } } as HTMLElement
options.onclone(globalThis.document, clonedRoot)
expect(clonedRoot.style.transform).toBe('none')
```

with:

```ts
const options = html2canvasMock.mock.calls[0]?.[1]
const clonedDocument = originalDocument.implementation.createHTMLDocument('export clone')
const clonedRoot = clonedDocument.createElement('div')
const selectedNode = clonedDocument.createElement('div')
selectedNode.className = 'base-node topic-node--selected'
clonedRoot.style.transform = 'translate(50px, 20px) scale(0.5)'
clonedRoot.appendChild(selectedNode)

options.onclone(clonedDocument, clonedRoot)

expect(clonedRoot.style.transform).toBe('none')
expect(clonedRoot.querySelector('[data-editor-export-background="true"]')).not.toBeNull()
expect(selectedNode.classList.contains('topic-node--selected')).toBe(false)
```

- [ ] **Step 2: Add the active-element regression test**

In `apps/web/src/features/editor/__tests__/exportPng.test.ts`, add this test before the negative bounds test:

```ts
it('does not blur active editing controls before export', async () => {
  const blur = vi.fn()
  const click = vi.fn()
  const appendChild = vi.fn()
  const removeChild = vi.fn()
  const link = { click, download: '', href: '' }
  const canvas = {
    toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })))
  }

  html2canvasMock.mockResolvedValueOnce(canvas)
  vi.stubGlobal('document', {
    activeElement: { blur },
    body: { appendChild, removeChild },
    createElement: vi.fn(() => link)
  })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mind-map'), revokeObjectURL: vi.fn() })

  const { exportDocumentAsPng } = await import('@/features/editor/services/exportPng')
  await exportDocumentAsPng({
    document: document({
      nodes: [
        topicNode('root', 'Root', { x: 120, y: 80 })
      ]
    }),
    root: {} as HTMLElement
  })

  expect(blur).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Run the export test to verify the options assertion fails**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts
```

Expected: FAIL because `backgroundColor` is still `'#ffffff'`, `useCORS` is missing, `imageTimeout` is missing, and the `onclone` callback does not insert an export background.

- [ ] **Step 4: Update exportPng to use clone preparation and export-safe image options**

In `apps/web/src/features/editor/services/exportPng.ts`, update the imports and constants at the top to:

```ts
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
```

In `exportDocumentAsPng`, replace the `html2canvas` options object with:

```ts
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
```

Do not add any `document.activeElement`, `blur`, `focus`, `commit`, or node-type-specific export code.

- [ ] **Step 5: Run the export and clone tests**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts src/features/editor/__tests__/exportClone.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 6: Commit exportPng wiring**

```bash
git add apps/web/src/features/editor/services/exportPng.ts apps/web/src/features/editor/__tests__/exportPng.test.ts
git commit -m "feat(web): export png with cloned canvas cleanup"
```

## Task 4: Mark Shell Controls As Export-Ignored

**Files:**
- Modify: `apps/web/src/features/editor/components/canvas/BaseNode.vue`
- Modify: `apps/web/src/features/editor/__tests__/baseNode.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Add a failing BaseNode source assertion**

In `apps/web/src/features/editor/__tests__/baseNode.test.ts`, add this assertion after the existing resize handle assertion:

```ts
expect(source).toContain('data-editor-export-ignore="true"')
```

- [ ] **Step 2: Add a NodeContent export-boundary regression assertion**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add this test before `prevents native image and link dragging from competing with canvas drag`:

```ts
it('keeps export-specific concerns out of node content components', () => {
  for (const fileName of [
    'AttachmentNodeContent',
    'CodeNodeContent',
    'ImageNodeContent',
    'LinkNodeContent',
    'TaskNodeContent',
    'TopicNodeContent'
  ]) {
    const source = readNodeContentSource(fileName)

    expect(source).not.toContain('exportMode')
    expect(source).not.toContain('data-editor-export')
    expect(source).not.toContain('html2canvas')
    expect(source).not.toContain('prepareExportClone')
  }
})
```

- [ ] **Step 3: Run shell/source tests to verify the BaseNode assertion fails**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/baseNode.test.ts src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: FAIL in `baseNode.test.ts` because `BaseNode.vue` does not yet mark the resize handle as export-ignored. The new NodeContent boundary test should PASS.

- [ ] **Step 4: Mark the resize handle as a generic export-ignore element**

In `apps/web/src/features/editor/components/canvas/BaseNode.vue`, update the resize handle span to include `data-editor-export-ignore="true"`:

```vue
<span
  aria-hidden="true"
  class="base-node__resize-handle"
  data-editor-export-ignore="true"
  @pointercancel="endResize"
  @pointerdown="onResizePointerDown"
  @pointermove="onResizePointerMove"
  @pointerup="endResize"
/>
```

Do not change any files under `apps/web/src/features/editor/components/canvas/node-content/`.

- [ ] **Step 5: Run shell/source tests to verify they pass**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/baseNode.test.ts src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 6: Commit shell marker changes**

```bash
git add apps/web/src/features/editor/components/canvas/BaseNode.vue apps/web/src/features/editor/__tests__/baseNode.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): ignore node resize handles during export"
```

## Task 5: Final Verification

**Files:**
- Verify: `apps/web/src/features/editor/services/exportBounds.ts`
- Verify: `apps/web/src/features/editor/services/exportClone.ts`
- Verify: `apps/web/src/features/editor/services/exportPng.ts`
- Verify: `apps/web/src/features/editor/components/canvas/BaseNode.vue`
- Verify: `apps/web/src/features/editor/components/canvas/node-content/*.vue`

- [ ] **Step 1: Run focused editor tests**

Run:

```bash
npm run test -w apps/web -- src/features/editor/__tests__/exportPng.test.ts src/features/editor/__tests__/exportClone.test.ts src/features/editor/__tests__/baseNode.test.ts src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS for all four focused test files.

- [ ] **Step 2: Run the full web test suite**

Run:

```bash
npm run test -w apps/web
```

Expected: PASS for the web test suite.

- [ ] **Step 3: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Confirm NodeContent files stayed free of export-specific logic**

Run:

```bash
rg -n "exportMode|data-editor-export|html2canvas|prepareExportClone" apps/web/src/features/editor/components/canvas/node-content
```

Expected: no matches.

- [ ] **Step 5: Confirm only intended files changed**

Run:

```bash
git status --short
```

Expected: only files from this plan are modified or untracked. If earlier task commits were created, this should be clean.

- [ ] **Step 6: Record final verification**

If Task 5 found any required fixes, commit those fixes:

```bash
git add apps/web/src/features/editor
git commit -m "test(web): verify export png cleanup"
```

If there were no fixes and the worktree is clean, do not create an empty commit.
