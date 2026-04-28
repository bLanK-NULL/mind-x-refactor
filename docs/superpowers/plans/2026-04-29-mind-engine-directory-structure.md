# Mind Engine Directory Structure Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organize `packages/mind-engine` tests under a dedicated test directory and split the large `editorSession.ts` module into focused internal files without changing public behavior.

**Architecture:** Keep the public API stable by preserving `packages/mind-engine/src/editorSession.ts` as a re-export shim. Move the implementation into `packages/mind-engine/src/editorSession/`, split pure helpers by responsibility, and keep `session.ts` as the coordinator that wires commands, history, selection, and state together. Move engine tests into `packages/mind-engine/src/__tests__/` so production modules are easier to scan while `vitest run src` still discovers all package tests.

**Tech Stack:** TypeScript, NodeNext ESM imports, Vitest, Immer, `@mind-x/shared`, `@mind-x/mind-engine`.

---

## Scope Check

This plan covers one package-level structure cleanup in `packages/mind-engine`: moving existing engine tests and splitting the already implemented editor session module. It does not change editor behavior, web store behavior, command semantics, history semantics, dirty tracking semantics, snapshot cloning, or Immer usage.

This plan intentionally does not move tests in `apps/web`, `apps/api`, or `packages/shared`. Those packages can choose their own test layout in a separate follow-up once the engine structure is settled.

## File Structure

Create and modify these files:

```text
packages/mind-engine/src/editorSession.ts
  Public compatibility shim. Re-exports from ./editorSession/index.js so
  package consumers and src/index.ts keep using the same public module path.

packages/mind-engine/src/editorSession/index.ts
  Public surface for the editorSession folder. Exports createEditorSession(),
  serializeMindDocument(), and public session types.

packages/mind-engine/src/editorSession/types.ts
  Public TypeScript types for editor session inputs, state, and API shape.

packages/mind-engine/src/editorSession/document.ts
  Document clone, serialization, title rewrite, and untracked viewport
  preservation helpers.

packages/mind-engine/src/editorSession/selection.ts
  Selection compaction helpers that drop node or edge selections that no
  longer exist in the current document.

packages/mind-engine/src/editorSession/styles.ts
  Style patch equality helpers used to skip no-op style commands.

packages/mind-engine/src/editorSession/state.ts
  Internal state type, default topic title constant, and dirty flag update.

packages/mind-engine/src/editorSession/session.ts
  Existing session coordinator moved from editorSession.ts. Owns history,
  command execution, selection commands, preview movement, revision updates,
  and public createEditorSession().

packages/mind-engine/src/__tests__/commands.test.ts
packages/mind-engine/src/__tests__/editorSession.test.ts
packages/mind-engine/src/__tests__/graph.test.ts
packages/mind-engine/src/__tests__/history.test.ts
packages/mind-engine/src/__tests__/patches.test.ts
  Existing package tests moved out of the production module root.
```

Keep `packages/mind-engine/src/index.ts` unchanged:

```ts
export * from './commands.js'
export * from './documentFactory.js'
export * from './editorSession.js'
export * from './graph.js'
export * from './patches.js'
export * from './history.js'
export * from './selection.js'
export * from './viewport.js'
```

The unchanged export works because `./editorSession.js` still resolves to the root shim after TypeScript compilation.

## Task 1: Move Mind Engine Tests Into `src/__tests__`

**Files:**
- Create: `packages/mind-engine/src/__tests__/`
- Move: `packages/mind-engine/src/commands.test.ts` to `packages/mind-engine/src/__tests__/commands.test.ts`
- Move: `packages/mind-engine/src/editorSession.test.ts` to `packages/mind-engine/src/__tests__/editorSession.test.ts`
- Move: `packages/mind-engine/src/graph.test.ts` to `packages/mind-engine/src/__tests__/graph.test.ts`
- Move: `packages/mind-engine/src/history.test.ts` to `packages/mind-engine/src/__tests__/history.test.ts`
- Move: `packages/mind-engine/src/patches.test.ts` to `packages/mind-engine/src/__tests__/patches.test.ts`

- [ ] **Step 1: Create the test directory and move files with git history**

Run:

```bash
mkdir -p packages/mind-engine/src/__tests__
git mv packages/mind-engine/src/commands.test.ts packages/mind-engine/src/__tests__/commands.test.ts
git mv packages/mind-engine/src/editorSession.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts
git mv packages/mind-engine/src/graph.test.ts packages/mind-engine/src/__tests__/graph.test.ts
git mv packages/mind-engine/src/history.test.ts packages/mind-engine/src/__tests__/history.test.ts
git mv packages/mind-engine/src/patches.test.ts packages/mind-engine/src/__tests__/patches.test.ts
```

Expected: the five test files are under `packages/mind-engine/src/__tests__/`.

- [ ] **Step 2: Rewrite moved test imports to point at parent modules**

Run:

```bash
perl -0pi -e "s/from '\\.\\/documentFactory\\.js'/from '..\\/documentFactory.js'/g; s/from '\\.\\/commands\\.js'/from '..\\/commands.js'/g; s/from '\\.\\/graph\\.js'/from '..\\/graph.js'/g; s/from '\\.\\/history\\.js'/from '..\\/history.js'/g; s/from '\\.\\/patches\\.js'/from '..\\/patches.js'/g; s/from '\\.\\/editorSession\\.js'/from '..\\/editorSession.js'/g" packages/mind-engine/src/__tests__/*.test.ts
```

Expected imports after the rewrite:

```ts
import { createEmptyDocument } from '../documentFactory.js'
import { createEditorSession, serializeMindDocument } from '../editorSession.js'
```

The other moved tests should follow the same parent-directory import shape for `commands.js`, `graph.js`, `history.js`, and `patches.js`.

- [ ] **Step 3: Confirm no engine test files remain in the production module root**

Run:

```bash
find packages/mind-engine/src -maxdepth 1 -name '*.test.ts' -print
```

Expected: no output.

- [ ] **Step 4: Run the engine test suite**

Run:

```bash
npm run test:engine
```

Expected: Vitest exits with code 0 and reports no failing tests.

- [ ] **Step 5: Commit the test move**

Run:

```bash
git add packages/mind-engine/src
git commit -m "refactor(engine): move tests into test directory"
```

Expected: one commit containing only the test file moves and import path updates.

## Task 2: Split `editorSession.ts` Into Focused Internal Modules

**Files:**
- Move: `packages/mind-engine/src/editorSession.ts` to `packages/mind-engine/src/editorSession/session.ts`
- Create: `packages/mind-engine/src/editorSession.ts`
- Create: `packages/mind-engine/src/editorSession/index.ts`
- Create: `packages/mind-engine/src/editorSession/types.ts`
- Create: `packages/mind-engine/src/editorSession/document.ts`
- Create: `packages/mind-engine/src/editorSession/selection.ts`
- Create: `packages/mind-engine/src/editorSession/styles.ts`
- Create: `packages/mind-engine/src/editorSession/state.ts`

- [ ] **Step 1: Move the existing session implementation into a folder**

Run:

```bash
mkdir -p packages/mind-engine/src/editorSession
git mv packages/mind-engine/src/editorSession.ts packages/mind-engine/src/editorSession/session.ts
```

Expected: `packages/mind-engine/src/editorSession/session.ts` contains the current editor session implementation.

- [ ] **Step 2: Add the root compatibility shim**

Create `packages/mind-engine/src/editorSession.ts`:

```ts
export * from './editorSession/index.js'
```

Expected: existing imports from `./editorSession.js` and package-root exports continue to work.

- [ ] **Step 3: Add public session types**

Create `packages/mind-engine/src/editorSession/types.ts`:

```ts
import type { EdgeStyle, MindDocument, Point, TopicNodeStyle, Viewport } from '@mind-x/shared'

export type AddTopicInput = { id?: string; title?: string }
export type AddChildTopicInput = AddTopicInput & { parentId?: string }

export type EditorSessionState = Readonly<{
  canRedo: boolean
  canUndo: boolean
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: readonly string[]
}>

export type EditorSession = {
  addChildTopic(input?: AddChildTopicInput): string | null
  addRootTopic(input?: AddTopicInput): string | null
  clearSelection(): void
  commit(document: MindDocument): void
  deleteSelected(): void
  editNodeTitle(nodeId: string, title: string): void
  finishInteraction(): void
  getState(): EditorSessionState
  hasDocumentSnapshot(snapshotJson: string): boolean
  load(document: MindDocument): void
  markClean(): void
  moveSelectedByScreenDelta(delta: Point): void
  moveSelectedByWorldDelta(delta: Point): void
  previewMoveSelectedByScreenDelta(delta: Point): void
  previewMoveSelectedByWorldDelta(delta: Point): void
  redo(): void
  selectEdge(edgeId: string): void
  selectOnly(nodeId: string): void
  setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void
  setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void
  setSelection(nodeIds: string[]): void
  setViewport(viewport: Viewport): void
  undo(): void
  updateDocumentTitle(title: string): void
}
```

Remove these type declarations from `packages/mind-engine/src/editorSession/session.ts` after this file exists:

```ts
export type AddTopicInput = { id?: string; title?: string }
export type AddChildTopicInput = AddTopicInput & { parentId?: string }
export type EditorSessionState = Readonly<{
  canRedo: boolean
  canUndo: boolean
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: readonly string[]
}>
export type EditorSession = {
  addChildTopic(input?: AddChildTopicInput): string | null
  addRootTopic(input?: AddTopicInput): string | null
  clearSelection(): void
  commit(document: MindDocument): void
  deleteSelected(): void
  editNodeTitle(nodeId: string, title: string): void
  finishInteraction(): void
  getState(): EditorSessionState
  hasDocumentSnapshot(snapshotJson: string): boolean
  load(document: MindDocument): void
  markClean(): void
  moveSelectedByScreenDelta(delta: Point): void
  moveSelectedByWorldDelta(delta: Point): void
  previewMoveSelectedByScreenDelta(delta: Point): void
  previewMoveSelectedByWorldDelta(delta: Point): void
  redo(): void
  selectEdge(edgeId: string): void
  selectOnly(nodeId: string): void
  setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void
  setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void
  setSelection(nodeIds: string[]): void
  setViewport(viewport: Viewport): void
  undo(): void
  updateDocumentTitle(title: string): void
}
```

- [ ] **Step 4: Add document helpers**

Create `packages/mind-engine/src/editorSession/document.ts`:

```ts
import { mindDocumentSchema, type MindDocument } from '@mind-x/shared'
import { produce } from 'immer'

export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(document) : null
}

export function cloneDocument(document: MindDocument): MindDocument {
  const parsed = mindDocumentSchema.parse(structuredClone(document))
  return produce(parsed, () => undefined)
}

export function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = produce(cloneDocument(document), (draft) => {
    draft.meta.title = title
  })
  mindDocumentSchema.parse(next)
  return next
}

export function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  if (!currentDocument?.viewport) {
    return cloneDocument(document)
  }

  return produce(cloneDocument(document), (draft) => {
    draft.viewport = { ...currentDocument.viewport }
  })
}
```

Remove these declarations from `packages/mind-engine/src/editorSession/session.ts` after this file exists:

```ts
export function serializeMindDocument(document: MindDocument | null): string | null {
  return document ? JSON.stringify(document) : null
}

function cloneDocument(document: MindDocument): MindDocument {
  const parsed = mindDocumentSchema.parse(structuredClone(document))
  return produce(parsed, () => undefined)
}

function retitleDocument(document: MindDocument, title: string): MindDocument {
  const next = produce(cloneDocument(document), (draft) => {
    draft.meta.title = title
  })
  mindDocumentSchema.parse(next)
  return next
}

function preserveUntrackedDocumentState(
  document: MindDocument,
  currentDocument: MindDocument | null | undefined
): MindDocument {
  if (!currentDocument?.viewport) {
    return cloneDocument(document)
  }

  return produce(cloneDocument(document), (draft) => {
    draft.viewport = { ...currentDocument.viewport }
  })
}
```

- [ ] **Step 5: Add selection helpers**

Create `packages/mind-engine/src/editorSession/selection.ts`:

```ts
import type { MindDocument } from '@mind-x/shared'

export function compactSelection(document: MindDocument | null, selectedNodeIds: string[]): string[] {
  if (!document) {
    return []
  }

  const nodeIds = new Set(document.nodes.map((node) => node.id))
  return selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId))
}

export function compactSelectedEdge(document: MindDocument | null, selectedEdgeId: string | null): string | null {
  if (!document || !selectedEdgeId) {
    return null
  }

  return document.edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null
}
```

Remove these declarations from `packages/mind-engine/src/editorSession/session.ts` after this file exists:

```ts
function compactSelection(document: MindDocument | null, selectedNodeIds: string[]): string[] {
  if (!document) {
    return []
  }

  const nodeIds = new Set(document.nodes.map((node) => node.id))
  return selectedNodeIds.filter((nodeId) => nodeIds.has(nodeId))
}

function compactSelectedEdge(document: MindDocument | null, selectedEdgeId: string | null): string | null {
  if (!document || !selectedEdgeId) {
    return null
  }

  return document.edges.some((edge) => edge.id === selectedEdgeId) ? selectedEdgeId : null
}
```

- [ ] **Step 6: Add style patch helpers**

Create `packages/mind-engine/src/editorSession/styles.ts`:

```ts
function styleValueEquals(currentValue: unknown, nextValue: unknown): boolean {
  if (Object.is(currentValue, nextValue)) {
    return true
  }

  if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
    return (
      Array.isArray(currentValue) &&
      Array.isArray(nextValue) &&
      currentValue.length === nextValue.length &&
      currentValue.every((value, index) => styleValueEquals(value, nextValue[index]))
    )
  }

  if (
    typeof currentValue !== 'object' ||
    currentValue === null ||
    typeof nextValue !== 'object' ||
    nextValue === null
  ) {
    return false
  }

  const currentRecord = currentValue as Record<string, unknown>
  const nextRecord = nextValue as Record<string, unknown>
  const currentKeys = Object.keys(currentRecord)
  const nextKeys = Object.keys(nextRecord)

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(nextRecord, key) && styleValueEquals(currentRecord[key], nextRecord[key])
    )
  )
}

export function isStylePatchNoop<TStyle extends object>(style: TStyle, stylePatch: Partial<TStyle>): boolean {
  return (Object.entries(stylePatch) as Array<[keyof TStyle, TStyle[keyof TStyle]]>).every(([key, value]) =>
    styleValueEquals(style[key], value)
  )
}
```

Remove these declarations from `packages/mind-engine/src/editorSession/session.ts` after this file exists:

```ts
function styleValueEquals(currentValue: unknown, nextValue: unknown): boolean {
  if (Object.is(currentValue, nextValue)) {
    return true
  }

  if (Array.isArray(currentValue) || Array.isArray(nextValue)) {
    return (
      Array.isArray(currentValue) &&
      Array.isArray(nextValue) &&
      currentValue.length === nextValue.length &&
      currentValue.every((value, index) => styleValueEquals(value, nextValue[index]))
    )
  }

  if (
    typeof currentValue !== 'object' ||
    currentValue === null ||
    typeof nextValue !== 'object' ||
    nextValue === null
  ) {
    return false
  }

  const currentRecord = currentValue as Record<string, unknown>
  const nextRecord = nextValue as Record<string, unknown>
  const currentKeys = Object.keys(currentRecord)
  const nextKeys = Object.keys(nextRecord)

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(nextRecord, key) && styleValueEquals(currentRecord[key], nextRecord[key])
    )
  )
}

function isStylePatchNoop<TStyle extends object>(style: TStyle, stylePatch: Partial<TStyle>): boolean {
  return (Object.entries(stylePatch) as Array<[keyof TStyle, TStyle[keyof TStyle]]>).every(([key, value]) =>
    styleValueEquals(style[key], value)
  )
}
```

- [ ] **Step 7: Add internal state helpers**

Create `packages/mind-engine/src/editorSession/state.ts`:

```ts
import type { MindDocument } from '@mind-x/shared'
import { serializeMindDocument } from './document.js'

export type InternalState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

export const DEFAULT_TOPIC_TITLE = 'New topic'

export function updateDirty(state: InternalState): void {
  state.dirty = serializeMindDocument(state.document) !== state.cleanDocumentJson
}
```

Remove these declarations from `packages/mind-engine/src/editorSession/session.ts` after this file exists:

```ts
type InternalState = {
  cleanDocumentJson: string | null
  dirty: boolean
  document: MindDocument | null
  revision: number
  selectedEdgeId: string | null
  selectedNodeIds: string[]
}

const DEFAULT_TOPIC_TITLE = 'New topic'

function updateDirty(state: InternalState): void {
  state.dirty = serializeMindDocument(state.document) !== state.cleanDocumentJson
}
```

- [ ] **Step 8: Add the folder public index**

Create `packages/mind-engine/src/editorSession/index.ts`:

```ts
export { createEditorSession } from './session.js'
export { serializeMindDocument } from './document.js'
export type { AddChildTopicInput, AddTopicInput, EditorSession, EditorSessionState } from './types.js'
```

Expected: the public export set from `editorSession.ts` is preserved.

- [ ] **Step 9: Replace the moved session import block**

In `packages/mind-engine/src/editorSession/session.ts`, replace the current top import block with:

```ts
import { type EdgeStyle, type MindDocument, type Point, type TopicNodeStyle, type Viewport } from '@mind-x/shared'
import { produce } from 'immer'
import {
  addChildNodeCommand,
  addRootNodeCommand,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  setEdgeStyleCommand,
  setNodeStyleCommand,
  type CommandResult
} from '../commands.js'
import { createHistory, type History } from '../history.js'
import { replaceWithPatchResult } from '../patches.js'
import { cloneDocument, preserveUntrackedDocumentState, retitleDocument, serializeMindDocument } from './document.js'
import { compactSelectedEdge, compactSelection } from './selection.js'
import { DEFAULT_TOPIC_TITLE, type InternalState, updateDirty } from './state.js'
import { isStylePatchNoop } from './styles.js'
import type { AddChildTopicInput, AddTopicInput, EditorSession } from './types.js'
```

Expected: `session.ts` imports production modules through `../` and imports newly split editor-session helpers through `./`.

- [ ] **Step 10: Confirm extracted declarations are not duplicated in `session.ts`**

Run:

```bash
rg -n "function styleValueEquals|function compactSelection|function compactSelectedEdge|export function serializeMindDocument|type InternalState =" packages/mind-engine/src/editorSession/session.ts
```

Expected: no output.

- [ ] **Step 11: Run the focused editor session test**

Run:

```bash
npm run test -w packages/mind-engine -- src/__tests__/editorSession.test.ts
```

Expected: Vitest exits with code 0 and reports no failing editor session tests.

- [ ] **Step 12: Run package typecheck**

Run:

```bash
npm run typecheck -w packages/mind-engine
```

Expected: TypeScript exits with code 0.

- [ ] **Step 13: Commit the editor session split**

Run:

```bash
git add packages/mind-engine/src
git commit -m "refactor(engine): split editor session modules"
```

Expected: one commit containing only the editor session folder split and related import updates.

## Task 3: Final Verification

**Files:**
- Verify: `packages/mind-engine/src`
- Verify: repository root scripts

- [ ] **Step 1: Run the full engine suite**

Run:

```bash
npm run test:engine
```

Expected: Vitest exits with code 0 and reports no failing engine tests.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
npm run typecheck -w packages/mind-engine
```

Expected: TypeScript exits with code 0.

- [ ] **Step 3: Run repository typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits with code 0 for shared, engine, api, and web projects.

- [ ] **Step 4: Run the full repository test suite**

Run:

```bash
npm test
```

Expected: Vitest exits with code 0 and reports no failing tests.

- [ ] **Step 5: Run the production build**

Run:

```bash
npm run build
```

Expected: build exits with code 0. A Vite large chunk warning is acceptable if it matches the existing application build behavior.

- [ ] **Step 6: Confirm the worktree is clean**

Run:

```bash
git status --short
```

Expected: no output.

## Execution Handoff

Project preference in `AGENTS.md` selects `superpowers:subagent-driven-development` when a plan can be executed by subagents. Execute this plan with one worker per task, review after each task, and keep the commits listed above.
