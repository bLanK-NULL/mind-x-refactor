# Mind Engine Pure Rules Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move selected side-effect-free editor rules from `apps/web` into `packages/mind-engine`.

**Architecture:** Add small engine modules for node validation, document bounds, and failed-save draft selection, export them from `@mind-x/mind-engine`, and update web call sites to import from the package. Browser, DOM, Vue, CSS mapping, syntax highlighting, network, local storage, and PNG download orchestration stay in `apps/web`.

**Tech Stack:** TypeScript, npm workspaces, Vitest, Vue 3, Vite, `@mind-x/shared`, `@mind-x/mind-engine`.

---

## Scope Check

This plan implements `docs/superpowers/specs/2026-04-30-mind-engine-pure-rules-extraction-design.md`.

The scope is one package-boundary extraction. It does not change editor behavior, document schemas, command semantics, session behavior, style rendering, syntax highlighting, local draft persistence, server sync, PNG rendering, or visible UI.

## Target File Structure

Create these engine modules:

```text
packages/mind-engine/src/documentBounds.ts
packages/mind-engine/src/nodeValidation.ts
packages/mind-engine/src/saveFailureDraft.ts
packages/mind-engine/src/__tests__/documentBounds.test.ts
packages/mind-engine/src/__tests__/nodeValidation.test.ts
packages/mind-engine/src/__tests__/saveFailureDraft.test.ts
```

Modify:

```text
packages/mind-engine/src/index.ts
apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue
apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue
apps/web/src/features/editor/services/exportClone.ts
apps/web/src/features/editor/services/exportPng.ts
apps/web/src/features/editor/views/EditorView.vue
apps/web/src/features/editor/__tests__/exportClone.test.ts
apps/web/src/features/editor/__tests__/exportPng.test.ts
apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Remove after replacements:

```text
apps/web/src/features/editor/services/exportBounds.ts
apps/web/src/features/editor/services/saveFailureDraft.ts
apps/web/src/features/editor/utils/nodeValidation.ts
apps/web/src/features/editor/__tests__/nodeValidation.test.ts
apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts
```

## Task 1: Move Node Validation Into Mind Engine

**Files:**
- Move: `apps/web/src/features/editor/__tests__/nodeValidation.test.ts` to `packages/mind-engine/src/__tests__/nodeValidation.test.ts`
- Create: `packages/mind-engine/src/nodeValidation.ts`
- Modify: `packages/mind-engine/src/index.ts`
- Modify: node inspector and task content imports under `apps/web/src/features/editor/components/`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
- Delete: `apps/web/src/features/editor/utils/nodeValidation.ts`

- [ ] **Step 1: Move the existing validation test into the engine test directory**

Run:

```bash
git mv apps/web/src/features/editor/__tests__/nodeValidation.test.ts packages/mind-engine/src/__tests__/nodeValidation.test.ts
```

Expected: `git status --short` shows the test file moved from web to engine.

- [ ] **Step 2: Rewrite the moved test import to target the missing engine module**

Edit `packages/mind-engine/src/__tests__/nodeValidation.test.ts` so it contains:

```ts
import { CODE_NODE_CODE_MAX_LENGTH, PLAIN_TEXT_MAX_LENGTH } from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import { isValidCode, isValidOptionalPlainText, isValidPlainText, isValidWebUrl } from '../nodeValidation.js'

describe('nodeValidation', () => {
  it('rejects plain text values that strict document parsing would reject', () => {
    expect(isValidPlainText('Title')).toBe(true)
    expect(isValidPlainText('')).toBe(false)
    expect(isValidPlainText('<b>Title</b>')).toBe(false)
    expect(isValidPlainText('x'.repeat(PLAIN_TEXT_MAX_LENGTH + 1))).toBe(false)
  })

  it('allows empty optional text but still enforces syntax and max length', () => {
    expect(isValidOptionalPlainText('')).toBe(true)
    expect(isValidOptionalPlainText('Alt text')).toBe(true)
    expect(isValidOptionalPlainText('<alt>')).toBe(false)
    expect(isValidOptionalPlainText('x'.repeat(PLAIN_TEXT_MAX_LENGTH + 1))).toBe(false)
  })

  it('rejects oversized code edits before they reach the strict schema', () => {
    expect(isValidCode('const answer = 42')).toBe(true)
    expect(isValidCode('x'.repeat(CODE_NODE_CODE_MAX_LENGTH + 1))).toBe(false)
  })

  it('accepts only http and https URLs', () => {
    expect(isValidWebUrl('https://example.com')).toBe(true)
    expect(isValidWebUrl('http://example.com')).toBe(true)
    expect(isValidWebUrl('javascript:alert(1)')).toBe(false)
  })
})
```

- [ ] **Step 3: Run the moved test and verify it fails for the missing module**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/nodeValidation.test.ts
```

Expected: FAIL with an error equivalent to `Cannot find module '../nodeValidation.js'`.

- [ ] **Step 4: Add the engine node validation module**

Create `packages/mind-engine/src/nodeValidation.ts`:

```ts
import { CODE_NODE_CODE_MAX_LENGTH, PLAIN_TEXT_MAX_LENGTH } from '@mind-x/shared'

export function isValidPlainText(value: string): boolean {
  const text = value.trim()
  return text.length > 0 && text.length <= PLAIN_TEXT_MAX_LENGTH && !/[<>]/.test(text)
}

export function isValidOptionalPlainText(value: string): boolean {
  const text = value.trim()
  return text.length === 0 || (text.length <= PLAIN_TEXT_MAX_LENGTH && !/[<>]/.test(text))
}

export function isValidCode(value: string): boolean {
  return value.length <= CODE_NODE_CODE_MAX_LENGTH
}

export function isValidWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Export node validation from the engine package root**

Add this line to `packages/mind-engine/src/index.ts`:

```ts
export * from './nodeValidation.js'
```

Expected `packages/mind-engine/src/index.ts` contains this export alongside the existing command, session, graph, selection, and viewport exports.

- [ ] **Step 6: Run the engine node validation test and verify it passes**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/nodeValidation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Update web component imports to use `@mind-x/mind-engine`**

Run:

```bash
perl -0pi -e "s|from '../../../utils/nodeValidation'|from '@mind-x/mind-engine'|g" \
  apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue \
  apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue \
  apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue \
  apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue \
  apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue \
  apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue
```

Expected import examples:

```ts
import { isValidPlainText } from '@mind-x/mind-engine'
```

```ts
import { isValidOptionalPlainText, isValidWebUrl } from '@mind-x/mind-engine'
```

```ts
import { isValidCode } from '@mind-x/mind-engine'
```

- [ ] **Step 8: Update source-assertion tests for the new import path**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, replace this assertion:

```ts
expect(taskContentSource).toContain("import { isValidPlainText } from '../../../utils/nodeValidation'")
```

with:

```ts
expect(taskContentSource).toContain("import { isValidPlainText } from '@mind-x/mind-engine'")
```

- [ ] **Step 9: Delete the old web node validation module**

Run:

```bash
git rm apps/web/src/features/editor/utils/nodeValidation.ts
```

Expected: no production source imports the deleted module.

- [ ] **Step 10: Confirm no old validation imports remain**

Run:

```bash
rg -n "utils/nodeValidation|nodeValidation.test" apps/web/src packages/mind-engine/src
```

Expected: no output for `utils/nodeValidation`; the only `nodeValidation.test` path should be the moved engine test if shown by git status.

- [ ] **Step 11: Run focused validation tests**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/nodeValidation.test.ts apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit node validation extraction**

Run:

```bash
git add packages/mind-engine/src apps/web/src/features/editor
git commit -m "refactor(engine): extract node validation helpers"
```

Expected: one commit containing the engine validation module, moved validation tests, web import updates, and deleted web validation module.

## Task 2: Move Document Bounds Into Mind Engine

**Files:**
- Create: `packages/mind-engine/src/documentBounds.ts`
- Create: `packages/mind-engine/src/__tests__/documentBounds.test.ts`
- Modify: `packages/mind-engine/src/index.ts`
- Modify: `apps/web/src/features/editor/services/exportPng.ts`
- Modify: `apps/web/src/features/editor/services/exportClone.ts`
- Modify: `apps/web/src/features/editor/__tests__/exportPng.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/exportClone.test.ts`
- Delete: `apps/web/src/features/editor/services/exportBounds.ts`

- [ ] **Step 1: Add the failing engine document bounds test**

Create `packages/mind-engine/src/__tests__/documentBounds.test.ts`:

```ts
import {
  DEFAULT_NODE_SHELL_STYLE,
  DEFAULT_NODE_SIZE_BY_TYPE,
  DEFAULT_TOPIC_CONTENT_STYLE,
  type MindDocument,
  type Point,
  type Size
} from '@mind-x/shared'
import { describe, expect, it } from 'vitest'
import { calculateDocumentBounds } from '../documentBounds.js'

function document(overrides: Partial<MindDocument> = {}): MindDocument {
  return {
    version: 3,
    meta: {
      projectId: 'project-1',
      title: 'Project One',
      updatedAt: '2026-04-26T00:00:00.000Z'
    },
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
    ...overrides
  }
}

function topicNode(id: string, title: string, position: Point, size: Size = DEFAULT_NODE_SIZE_BY_TYPE.topic) {
  return {
    data: { title },
    id,
    position,
    size,
    shellStyle: { ...DEFAULT_NODE_SHELL_STYLE },
    type: 'topic' as const,
    contentStyle: { ...DEFAULT_TOPIC_CONTENT_STYLE }
  }
}

describe('documentBounds', () => {
  it('returns null for documents without nodes', () => {
    expect(calculateDocumentBounds(document())).toBeNull()
  })

  it('calculates bounds from explicit v3 node sizes and padding', () => {
    const bounds = calculateDocumentBounds(
      document({
        nodes: [
          topicNode('root', 'Root', { x: -20, y: 10 }, { height: 56, width: 180 }),
          topicNode('child', 'Child', { x: 220, y: -30 }, { height: 80, width: 200 })
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

  it('keeps negative node origins in the returned bounds', () => {
    expect(
      calculateDocumentBounds(
        document({
          nodes: [
            topicNode('root', 'Root', { x: -40, y: -12 })
          ]
        })
      )
    ).toMatchObject({
      minX: -40,
      minY: -12
    })
  })
})
```

- [ ] **Step 2: Run the new document bounds test and verify it fails for the missing module**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/documentBounds.test.ts
```

Expected: FAIL with an error equivalent to `Cannot find module '../documentBounds.js'`.

- [ ] **Step 3: Add the engine document bounds module**

Create `packages/mind-engine/src/documentBounds.ts`:

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

- [ ] **Step 4: Export document bounds from the engine package root**

Add this line to `packages/mind-engine/src/index.ts`:

```ts
export * from './documentBounds.js'
```

Expected: `packages/mind-engine/src/index.ts` now exports `documentBounds.js` and `nodeValidation.js`.

- [ ] **Step 5: Run the engine document bounds test and verify it passes**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/documentBounds.test.ts
```

Expected: PASS.

- [ ] **Step 6: Update export PNG orchestration to import bounds from the engine**

Edit the top of `apps/web/src/features/editor/services/exportPng.ts` so it starts like this:

```ts
import type { MindDocument } from '@mind-x/shared'
import html2canvas from 'html2canvas'
import {
  calculateDocumentBounds,
  EXPORT_PADDING
} from '@mind-x/mind-engine'
import { prepareExportClone } from './exportClone'
```

Remove these re-exports from the same file:

```ts
export { calculateDocumentBounds } from './exportBounds'
export type { DocumentBounds } from './exportBounds'
```

- [ ] **Step 7: Update export clone to use engine bounds types and padding**

Edit the top of `apps/web/src/features/editor/services/exportClone.ts` so it starts like this:

```ts
import { EXPORT_PADDING, type DocumentBounds } from '@mind-x/mind-engine'
```

Keep the rest of the file unchanged.

- [ ] **Step 8: Update export clone tests to import the engine bounds type**

Edit the first import in `apps/web/src/features/editor/__tests__/exportClone.test.ts`:

```ts
import type { DocumentBounds } from '@mind-x/mind-engine'
```

Keep the Vitest and `prepareExportClone` imports unchanged.

- [ ] **Step 9: Remove the bounds-only unit test from web export PNG tests**

In `apps/web/src/features/editor/__tests__/exportPng.test.ts`, remove this test block because `packages/mind-engine/src/__tests__/documentBounds.test.ts` now owns it:

```ts
  it('calculates document bounds from explicit v3 node sizes and padding', async () => {
    const { calculateDocumentBounds } = await import('@/features/editor/services/exportBounds')
    const bounds = calculateDocumentBounds(
      document({
        nodes: [
          topicNode('root', 'Root', { x: -20, y: 10 }, { height: 56, width: 180 }),
          topicNode('child', 'Child', { x: 220, y: -30 }, { height: 80, width: 200 })
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
```

The remaining export PNG tests should continue to cover filename creation, empty-document behavior, html2canvas options, clone preparation, download cleanup, active editor controls, and negative origin orchestration.

- [ ] **Step 10: Delete the old web export bounds module**

Run:

```bash
git rm apps/web/src/features/editor/services/exportBounds.ts
```

- [ ] **Step 11: Confirm no old export bounds imports remain**

Run:

```bash
rg -n "exportBounds|calculateDocumentBounds" apps/web/src packages/mind-engine/src
```

Expected:

```text
apps/web/src/features/editor/services/exportPng.ts:3:  calculateDocumentBounds,
packages/mind-engine/src/documentBounds.ts:14:export function calculateDocumentBounds(document: MindDocument): DocumentBounds | null {
packages/mind-engine/src/__tests__/documentBounds.test.ts:...:import { calculateDocumentBounds } from '../documentBounds.js'
```

Line numbers may differ. No result should point to `apps/web/src/features/editor/services/exportBounds.ts`.

- [ ] **Step 12: Run focused bounds and export tests**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/documentBounds.test.ts apps/web/src/features/editor/__tests__/exportPng.test.ts apps/web/src/features/editor/__tests__/exportClone.test.ts
```

Expected: PASS.

- [ ] **Step 13: Commit document bounds extraction**

Run:

```bash
git add packages/mind-engine/src apps/web/src/features/editor
git commit -m "refactor(engine): extract document bounds calculation"
```

Expected: one commit containing the engine bounds module, engine bounds tests, web export import updates, and deleted web bounds module.

## Task 3: Move Failed Save Draft Selection Into Mind Engine

**Files:**
- Move: `apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts` to `packages/mind-engine/src/__tests__/saveFailureDraft.test.ts`
- Create: `packages/mind-engine/src/saveFailureDraft.ts`
- Modify: `packages/mind-engine/src/index.ts`
- Modify: `apps/web/src/features/editor/views/EditorView.vue`
- Delete: `apps/web/src/features/editor/services/saveFailureDraft.ts`

- [ ] **Step 1: Move the failed-save draft test into the engine test directory**

Run:

```bash
git mv apps/web/src/features/editor/__tests__/saveFailureDraft.test.ts packages/mind-engine/src/__tests__/saveFailureDraft.test.ts
```

Expected: `git status --short` shows the test moved from web to engine.

- [ ] **Step 2: Rewrite the moved test import to target the missing engine module**

Edit `packages/mind-engine/src/__tests__/saveFailureDraft.test.ts` so it contains:

```ts
import type { MindDocument } from '@mind-x/shared'
import { createEmptyDocument } from '../documentFactory.js'
import { describe, expect, it } from 'vitest'
import { selectFailedSaveDraftDocument } from '../saveFailureDraft.js'

function document(projectId: string, title: string): MindDocument {
  return createEmptyDocument({
    now: '2026-04-26T00:00:00.000Z',
    projectId,
    title
  })
}

describe('saveFailureDraft', () => {
  it('uses the captured save snapshot after navigation changes the current project', () => {
    const capturedDocument = document('project-a', 'Project A')
    const currentDocument = document('project-b', 'Project B')

    const draftDocument = selectFailedSaveDraftDocument({
      capturedDocument,
      currentDocument,
      isCurrentProject: false,
      saveSessionStillCurrent: false,
      snapshotStillCurrent: false
    })

    expect(draftDocument).toBe(capturedDocument)
  })

  it('uses the captured save snapshot after navigation returns to the same project with a newer editor session', () => {
    const capturedDocument = document('project-a', 'Unsaved Project A')
    const currentDocument = document('project-a', 'Reloaded Project A')

    const draftDocument = selectFailedSaveDraftDocument({
      capturedDocument,
      currentDocument,
      isCurrentProject: true,
      saveSessionStillCurrent: false,
      snapshotStillCurrent: false
    })

    expect(draftDocument).toBe(capturedDocument)
  })

  it('uses newer live edits when the failed save still belongs to the current project', () => {
    const capturedDocument = document('project-a', 'Project A')
    const currentDocument = document('project-a', 'Project A with newer edits')

    const draftDocument = selectFailedSaveDraftDocument({
      capturedDocument,
      currentDocument,
      isCurrentProject: true,
      saveSessionStillCurrent: true,
      snapshotStillCurrent: false
    })

    expect(draftDocument).toBe(currentDocument)
  })
})
```

- [ ] **Step 3: Run the moved test and verify it fails for the missing module**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/saveFailureDraft.test.ts
```

Expected: FAIL with an error equivalent to `Cannot find module '../saveFailureDraft.js'`.

- [ ] **Step 4: Add the engine failed-save draft selection module**

Create `packages/mind-engine/src/saveFailureDraft.ts`:

```ts
import type { MindDocument } from '@mind-x/shared'

type SelectFailedSaveDraftInput = {
  capturedDocument: MindDocument
  currentDocument: MindDocument | null
  isCurrentProject: boolean
  saveSessionStillCurrent: boolean
  snapshotStillCurrent: boolean
}

export function selectFailedSaveDraftDocument({
  capturedDocument,
  currentDocument,
  isCurrentProject,
  saveSessionStillCurrent,
  snapshotStillCurrent
}: SelectFailedSaveDraftInput): MindDocument {
  if (!isCurrentProject || !saveSessionStillCurrent || snapshotStillCurrent || currentDocument === null) {
    return capturedDocument
  }

  return currentDocument
}
```

- [ ] **Step 5: Export failed-save draft selection from the engine package root**

Add this line to `packages/mind-engine/src/index.ts`:

```ts
export * from './saveFailureDraft.js'
```

Expected: `packages/mind-engine/src/index.ts` exports the three new pure-rule modules.

- [ ] **Step 6: Run the engine failed-save draft test and verify it passes**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/saveFailureDraft.test.ts
```

Expected: PASS.

- [ ] **Step 7: Update EditorView to import the helper from the engine**

In `apps/web/src/features/editor/views/EditorView.vue`, replace:

```ts
import { selectFailedSaveDraftDocument } from '@/features/editor/services/saveFailureDraft'
```

with:

```ts
import { selectFailedSaveDraftDocument } from '@mind-x/mind-engine'
```

- [ ] **Step 8: Delete the old web failed-save draft module**

Run:

```bash
git rm apps/web/src/features/editor/services/saveFailureDraft.ts
```

- [ ] **Step 9: Confirm no old failed-save draft imports remain**

Run:

```bash
rg -n "saveFailureDraft|selectFailedSaveDraftDocument" apps/web/src packages/mind-engine/src
```

Expected results should include:

```text
apps/web/src/features/editor/views/EditorView.vue:...:import { selectFailedSaveDraftDocument } from '@mind-x/mind-engine'
packages/mind-engine/src/saveFailureDraft.ts:...:export function selectFailedSaveDraftDocument({
packages/mind-engine/src/__tests__/saveFailureDraft.test.ts:...:import { selectFailedSaveDraftDocument } from '../saveFailureDraft.js'
```

No result should point to `apps/web/src/features/editor/services/saveFailureDraft.ts`.

- [ ] **Step 10: Run focused failed-save tests**

Run:

```bash
npx vitest run packages/mind-engine/src/__tests__/saveFailureDraft.test.ts apps/web/src/features/editor/__tests__/syncService.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit failed-save draft selection extraction**

Run:

```bash
git add packages/mind-engine/src apps/web/src/features/editor
git commit -m "refactor(engine): extract failed save draft selection"
```

Expected: one commit containing the engine helper, moved helper tests, EditorView import update, and deleted web helper module.

## Task 4: Final Boundary Verification

**Files:**
- Verify only. No planned source edits unless checks reveal missed imports or formatting issues.

- [ ] **Step 1: Confirm selected duplicate web modules are gone**

Run:

```bash
test ! -e apps/web/src/features/editor/services/exportBounds.ts
test ! -e apps/web/src/features/editor/services/saveFailureDraft.ts
test ! -e apps/web/src/features/editor/utils/nodeValidation.ts
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Confirm engine exports the extracted pure rules**

Run:

```bash
rg -n "documentBounds|nodeValidation|saveFailureDraft" packages/mind-engine/src/index.ts packages/mind-engine/src
```

Expected: results include `packages/mind-engine/src/index.ts` exports for:

```ts
export * from './documentBounds.js'
export * from './nodeValidation.js'
export * from './saveFailureDraft.js'
```

- [ ] **Step 3: Confirm no disallowed dependencies entered `mind-engine`**

Run:

```bash
rg -n "vue|HTMLElement|Document|window|sessionStorage|localforage|html2canvas|highlight\\.js|CSSProperties|ant-design|axios" packages/mind-engine/src
```

Expected: no output.

- [ ] **Step 4: Confirm web imports extracted helpers from the engine package**

Run:

```bash
rg -n "calculateDocumentBounds|EXPORT_PADDING|DocumentBounds|isValidPlainText|isValidOptionalPlainText|isValidCode|isValidWebUrl|selectFailedSaveDraftDocument" apps/web/src/features/editor
```

Expected: all production imports for these helpers come from `@mind-x/mind-engine`, while local definitions are absent from web source.

- [ ] **Step 5: Run the engine package test suite**

Run:

```bash
npm run test:engine
```

Expected: PASS.

- [ ] **Step 6: Run the web package test suite**

Run:

```bash
npm run test -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Run the repository typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Inspect final git status**

Run:

```bash
git status --short
```

Expected: clean working tree if all task commits were created.
