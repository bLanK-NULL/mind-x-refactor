# Patch Command History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor editor undo and redo from full-document snapshots to an Immer patch-based command runner and patch history.

**Architecture:** Add a small patch utility module in `@mind-x/mind-engine`, convert engine document commands into Immer draft recipes, and run them through a unified `executeCommand()` API. Replace snapshot history with patch entries that apply forward patches for redo and inverse patches for undo, then migrate the Pinia editor store to commit command results while preserving current viewport, dirty-state, selection, and external rename semantics.

**2026-04-28 update:** Theme changes are no longer part of `@mind-x/mind-engine` command history. `MindDocument.meta.theme` is still persisted by the web editor store, but undo and redo preserve the current theme instead of replaying theme patches.

**Tech Stack:** TypeScript, Vitest, Immer 11.1.4, Vue 3, Pinia, npm workspaces.

---

## File Structure

- Modify: `packages/mind-engine/package.json`
  - Add `immer` as a runtime dependency of the engine package.
- Modify: `package-lock.json`
  - Let npm record the installed Immer version and workspace dependency edge.
- Create: `packages/mind-engine/src/patches.ts`
  - Own Immer patch enablement, shared `PatchResult<T>`, `createPatchResult()`, and `replaceWithPatchResult()`.
- Modify: `packages/mind-engine/src/commands.ts`
  - Convert command implementations into draft recipes.
  - Add `executeCommand()`.
  - Keep existing command function names as compatibility wrappers returning `MindDocument`.
  - Add engine recipes for root creation and multi-node deletion so store content edits can use command results.
- Modify: `packages/mind-engine/src/history.ts`
  - Replace snapshot stack with patch entries.
  - Add `replaceAll()` for external title renames.
- Modify: `packages/mind-engine/src/index.ts`
  - Export patch utilities.
- Modify: `packages/mind-engine/src/commands.test.ts`
  - Add runner and inverse-patch coverage while preserving wrapper behavior tests.
- Modify: `packages/mind-engine/src/history.test.ts`
  - Replace snapshot-history tests with patch-history tests.
- Modify: `apps/web/src/stores/editor.ts`
  - Migrate undoable content actions to `executeCommand()`.
  - Keep viewport outside history.
  - Replace manual history retitling with `history.replaceAll()`.
- Modify: `apps/web/src/stores/editor.test.ts`
  - Add redo-branch rename coverage; existing editor behavior tests remain the main regression suite.

---

### Task 1: Add Immer Dependency And Patch Utilities

**Files:**
- Modify: `packages/mind-engine/package.json`
- Modify: `package-lock.json`
- Create: `packages/mind-engine/src/patches.ts`
- Modify: `packages/mind-engine/src/index.ts`

- [ ] **Step 1: Install Immer for the engine workspace**

Run:

```bash
npm install immer@^11.1.4 -w packages/mind-engine --cache /tmp/mind-x-npm-cache
```

Expected: command exits with code 0. `packages/mind-engine/package.json` gains an `immer` dependency and `package-lock.json` updates.

- [ ] **Step 2: Create patch utility tests through history compile pressure**

No standalone patch test file is needed. The tests in Task 2 and Task 3 import `replaceWithPatchResult()` and `PatchResult<T>`, so they will fail until this task's implementation exists.

- [ ] **Step 3: Create `packages/mind-engine/src/patches.ts`**

Create the file with this exact content:

```ts
import { enablePatches, produceWithPatches, type Draft, type Patch } from 'immer'

enablePatches()

export type PatchResult<T extends object> = {
  document: T
  patches: Patch[]
  inversePatches: Patch[]
}

export function createPatchResult<T extends object>(
  document: T,
  recipe: (draft: Draft<T>) => void
): PatchResult<T> {
  const [nextDocument, patches, inversePatches] = produceWithPatches(document, recipe)
  return {
    document: nextDocument,
    patches,
    inversePatches
  }
}

export function replaceWithPatchResult<T extends object>(previous: T, next: T): PatchResult<T> {
  const clonedNext = structuredClone(next)

  if (JSON.stringify(previous) === JSON.stringify(clonedNext)) {
    return {
      document: clonedNext,
      patches: [],
      inversePatches: []
    }
  }

  return createPatchResult(previous, (draft) => {
    const target = draft as unknown as Record<string, unknown>
    for (const key of Object.keys(target)) {
      delete target[key]
    }
    Object.assign(target, clonedNext)
  })
}
```

- [ ] **Step 4: Export patch utilities**

In `packages/mind-engine/src/index.ts`, add this line after the graph export:

```ts
export * from './patches.js'
```

The complete file should become:

```ts
export * from './commands.js'
export * from './documentFactory.js'
export * from './graph.js'
export * from './patches.js'
export * from './history.js'
export * from './selection.js'
export * from './viewport.js'
```

- [ ] **Step 5: Run focused typecheck**

Run:

```bash
npm run typecheck -w packages/mind-engine
```

Expected: PASS. If this fails because later tasks have not changed imports yet, fix only syntax or dependency issues introduced in `patches.ts`.

- [ ] **Step 6: Commit patch utilities**

Run:

```bash
git add packages/mind-engine/package.json package-lock.json packages/mind-engine/src/patches.ts packages/mind-engine/src/index.ts
git commit -m "feat(engine): add immer patch utilities"
```

Expected: commit succeeds.

---

### Task 2: Convert Engine Commands To Draft Recipes And Runner

**Files:**
- Modify: `packages/mind-engine/src/commands.test.ts`
- Modify: `packages/mind-engine/src/commands.ts`

- [ ] **Step 1: Add command runner imports to tests**

In `packages/mind-engine/src/commands.test.ts`, replace the command import block with:

```ts
import { applyPatches } from 'immer'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import {
  addChildNode,
  addChildNodeCommand,
  addRootNode,
  addRootNodeCommand,
  deleteEdgeDetachChild,
  deleteNodePromoteChildren,
  deleteNodePromoteChildrenCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitle,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  setEdgeComponent,
  setEdgeComponentCommand
} from './commands.js'
import { getParentId } from './graph.js'
```

- [ ] **Step 2: Add failing runner tests**

Add these tests at the top of the `describe('commands', () => {` block in `packages/mind-engine/src/commands.test.ts`:

```ts
  it('executes command recipes with forward and inverse patches', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    const result = executeCommand(doc, addRootNodeCommand, {
      id: 'root',
      title: 'Root'
    })

    expect(result.document.nodes.map((node) => node.id)).toEqual(['root'])
    expect(result.patches.length).toBeGreaterThan(0)
    expect(result.inversePatches.length).toBeGreaterThan(0)
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
    expect(applyPatches(doc, result.patches)).toEqual(result.document)
  })

  it('keeps compatibility command wrappers returning documents', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })

    const withRoot = addRootNode(doc, { id: 'root', title: 'Root' })
    const result = addChildNode(withRoot, {
      parentId: 'root',
      id: 'child',
      title: 'Child'
    })

    expect(result.nodes.map((node) => node.id)).toEqual(['root', 'child'])
    expect(getParentId(result, 'child')).toBe('root')
  })

  it('generates inverse patches for title, movement, edge, and delete commands', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'child', type: 'topic', position: { x: 240, y: 0 }, data: { title: 'Child' } }
    )
    doc.edges.push({ id: 'root->child', source: 'root', target: 'child', type: 'mind-parent' })

    const edited = executeCommand(doc, editNodeTitleCommand, { nodeId: 'root', title: 'Edited Root' })
    const moved = executeCommand(edited.document, moveNodesCommand, {
      nodeIds: ['root', 'child'],
      delta: { x: 5, y: -2 }
    })
    const styled = executeCommand(moved.document, setEdgeComponentCommand, {
      edgeId: 'root->child',
      component: 'dashed-arrow'
    })
    const deleted = executeCommand(styled.document, deleteNodePromoteChildrenCommand, { nodeId: 'root' })

    let reverted = applyPatches(deleted.document, deleted.inversePatches)
    reverted = applyPatches(reverted, styled.inversePatches)
    reverted = applyPatches(reverted, moved.inversePatches)
    reverted = applyPatches(reverted, edited.inversePatches)

    expect(reverted).toEqual(doc)
  })

  it('deletes multiple selected nodes as one command result', () => {
    const doc = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    doc.nodes.push(
      { id: 'root', type: 'topic', position: { x: 0, y: 0 }, data: { title: 'Root' } },
      { id: 'left', type: 'topic', position: { x: 240, y: -72 }, data: { title: 'Left' } },
      { id: 'right', type: 'topic', position: { x: 240, y: 72 }, data: { title: 'Right' } }
    )
    doc.edges.push(
      { id: 'root->left', source: 'root', target: 'left', type: 'mind-parent' },
      { id: 'root->right', source: 'root', target: 'right', type: 'mind-parent' }
    )

    const result = executeCommand(doc, deleteNodesPromoteChildrenCommand, { nodeIds: ['left', 'right'] })

    expect(result.document.nodes.map((node) => node.id)).toEqual(['root'])
    expect(result.document.edges).toEqual([])
    expect(applyPatches(result.document, result.inversePatches)).toEqual(doc)
  })
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test -w packages/mind-engine -- src/commands.test.ts
```

Expected: FAIL because `executeCommand`, `addRootNodeCommand`, and the other `*Command` exports do not exist yet.

- [ ] **Step 4: Replace `packages/mind-engine/src/commands.ts` with draft recipe implementation**

Replace the full file with:

```ts
import {
  DEFAULT_EDGE_COMPONENT,
  mindDocumentSchema,
  type MindDocument,
  type MindEdge,
  type MindEdgeComponent,
  type Point,
  type ThemeName
} from '@mind-x/shared'
import type { Draft } from 'immer'
import { assertMindTree, createParentEdge, findNode, getChildIds, getParentId } from './graph.js'
import { createPatchResult, type PatchResult } from './patches.js'

const DEFAULT_NODE_WIDTH = 160
const ROOT_NODE_WIDTH = 180
const ROOT_NODE_HEIGHT = 56
const CHILD_GAP_X = 80
const SIBLING_GAP_Y = 72

export type CommandRecipe<TInput> = (draft: Draft<MindDocument>, input: TInput) => void
export type CommandResult = PatchResult<MindDocument>

function asDocument(draft: Draft<MindDocument>): MindDocument {
  return draft as unknown as MindDocument
}

function getEdgeComponent(edge: MindEdge): MindEdgeComponent {
  return edge.component ?? DEFAULT_EDGE_COMPONENT
}

function getNewChildEdgeComponent(document: MindDocument, parentId: string): MindEdgeComponent {
  const childEdges = document.edges.filter((edge) => edge.source === parentId)
  const latestChildEdge = childEdges.at(-1)
  return latestChildEdge ? getEdgeComponent(latestChildEdge) : DEFAULT_EDGE_COMPONENT
}

function assertPlainTextTitle(title: string): void {
  if (/[<>]/.test(title) || title.trim().length === 0) {
    throw new Error('Node title must be non-empty plain text')
  }
}

export function executeCommand<TInput>(
  document: MindDocument,
  command: CommandRecipe<TInput>,
  input: TInput
): CommandResult {
  const result = createPatchResult(document, (draft) => {
    command(draft, input)
  })
  mindDocumentSchema.parse(result.document)
  return result
}

export type AddRootNodeInput = {
  id: string
  title: string
}

export function addRootNodeCommand(draft: Draft<MindDocument>, input: AddRootNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (draft.nodes.length > 0) {
    throw new Error('Root node already exists')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  assertPlainTextTitle(input.title)

  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position: { x: 0, y: 0 },
    size: { width: ROOT_NODE_WIDTH, height: ROOT_NODE_HEIGHT },
    data: { title: input.title }
  })
  assertMindTree(asDocument(draft))
}

export function addRootNode(document: MindDocument, input: AddRootNodeInput): MindDocument {
  return executeCommand(document, addRootNodeCommand, input).document
}

export type AddChildNodeInput = {
  parentId: string
  id: string
  title: string
}

export function addChildNodeCommand(draft: Draft<MindDocument>, input: AddChildNodeInput): void {
  if (input.id.trim().length === 0) {
    throw new Error('Node id must be non-empty')
  }
  if (findNode(asDocument(draft), input.id)) {
    throw new Error(`Node ${input.id} already exists`)
  }
  assertPlainTextTitle(input.title)
  const parent = findNode(asDocument(draft), input.parentId)
  if (!parent) {
    throw new Error(`Parent node ${input.parentId} does not exist`)
  }

  const childCount = getChildIds(asDocument(draft), input.parentId).length
  const parentWidth = parent.size?.width ?? DEFAULT_NODE_WIDTH
  const position = {
    x: parent.position.x + parentWidth + CHILD_GAP_X,
    y: parent.position.y + childCount * SIBLING_GAP_Y
  }
  const component = getNewChildEdgeComponent(asDocument(draft), input.parentId)

  draft.nodes.push({
    id: input.id,
    type: 'topic',
    position,
    data: { title: input.title }
  })
  draft.edges.push(createParentEdge(input.parentId, input.id, { component }))
  assertMindTree(asDocument(draft))
}

export function addChildNode(document: MindDocument, input: AddChildNodeInput): MindDocument {
  return executeCommand(document, addChildNodeCommand, input).document
}

export type EditNodeTitleInput = {
  nodeId: string
  title: string
}

export function editNodeTitleCommand(draft: Draft<MindDocument>, input: EditNodeTitleInput): void {
  assertPlainTextTitle(input.title)
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }
  node.data.title = input.title
  assertMindTree(asDocument(draft))
}

export function editNodeTitle(document: MindDocument, input: EditNodeTitleInput): MindDocument {
  return executeCommand(document, editNodeTitleCommand, input).document
}

export type MoveNodesInput = {
  nodeIds: string[]
  delta: Point
}

export function moveNodesCommand(draft: Draft<MindDocument>, input: MoveNodesInput): void {
  const selected = new Set(input.nodeIds)
  for (const node of draft.nodes) {
    if (selected.has(node.id)) {
      node.position = {
        x: node.position.x + input.delta.x,
        y: node.position.y + input.delta.y
      }
    }
  }
  assertMindTree(asDocument(draft))
}

export function moveNodes(document: MindDocument, input: MoveNodesInput): MindDocument {
  return executeCommand(document, moveNodesCommand, input).document
}

export type SetEdgeComponentInput = {
  edgeId: string
  component: MindEdgeComponent
}

export function setEdgeComponentCommand(draft: Draft<MindDocument>, input: SetEdgeComponentInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  edge.component = input.component
  assertMindTree(asDocument(draft))
}

export function setEdgeComponent(document: MindDocument, input: SetEdgeComponentInput): MindDocument {
  return executeCommand(document, setEdgeComponentCommand, input).document
}

export type DeleteEdgeInput = {
  edgeId: string
}

export function deleteEdgeDetachChildCommand(draft: Draft<MindDocument>, input: DeleteEdgeInput): void {
  const edge = draft.edges.find((candidate) => candidate.id === input.edgeId)
  if (!edge) {
    throw new Error(`Edge ${input.edgeId} does not exist`)
  }

  draft.edges = draft.edges.filter((candidate) => candidate.id !== input.edgeId)
  assertMindTree(asDocument(draft))
}

export function deleteEdgeDetachChild(document: MindDocument, input: DeleteEdgeInput): MindDocument {
  return executeCommand(document, deleteEdgeDetachChildCommand, input).document
}

export type DeleteNodeInput = {
  nodeId: string
}

export function deleteNodePromoteChildrenCommand(draft: Draft<MindDocument>, input: DeleteNodeInput): void {
  const node = findNode(asDocument(draft), input.nodeId)
  if (!node) {
    throw new Error(`Node ${input.nodeId} does not exist`)
  }

  const parentId = getParentId(asDocument(draft), input.nodeId)
  const childIds = getChildIds(asDocument(draft), input.nodeId)
  const componentByChildId = new Map(
    draft.edges
      .filter((edge) => edge.source === input.nodeId)
      .map((edge) => [edge.target, getEdgeComponent(edge as unknown as MindEdge)])
  )

  draft.nodes = draft.nodes.filter((candidate) => candidate.id !== input.nodeId)
  draft.edges = draft.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  if (parentId) {
    for (const childId of childIds) {
      draft.edges.push(createParentEdge(parentId, childId, { component: componentByChildId.get(childId) }))
    }
  }

  assertMindTree(asDocument(draft))
}

export function deleteNodePromoteChildren(document: MindDocument, input: DeleteNodeInput): MindDocument {
  return executeCommand(document, deleteNodePromoteChildrenCommand, input).document
}

export type DeleteNodesInput = {
  nodeIds: string[]
}

export function deleteNodesPromoteChildrenCommand(draft: Draft<MindDocument>, input: DeleteNodesInput): void {
  for (const nodeId of input.nodeIds) {
    if (draft.nodes.some((node) => node.id === nodeId)) {
      deleteNodePromoteChildrenCommand(draft, { nodeId })
    }
  }
  assertMindTree(asDocument(draft))
}

export function deleteNodesPromoteChildren(document: MindDocument, input: DeleteNodesInput): MindDocument {
  return executeCommand(document, deleteNodesPromoteChildrenCommand, input).document
}
```

- [ ] **Step 5: Run command tests**

Run:

```bash
npm run test -w packages/mind-engine -- src/commands.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run engine typecheck**

Run:

```bash
npm run typecheck -w packages/mind-engine
```

Expected: PASS.

- [ ] **Step 7: Commit command runner**

Run:

```bash
git add packages/mind-engine/src/commands.ts packages/mind-engine/src/commands.test.ts
git commit -m "feat(engine): execute document commands as patches"
```

Expected: commit succeeds.

---

### Task 3: Replace Snapshot History With Patch History

**Files:**
- Modify: `packages/mind-engine/src/history.test.ts`
- Modify: `packages/mind-engine/src/history.ts`

- [ ] **Step 1: Replace history tests with patch-history tests**

Replace `packages/mind-engine/src/history.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './documentFactory.js'
import { createHistory } from './history.js'
import { replaceWithPatchResult } from './patches.js'

describe('history', () => {
  it('undoes and redoes document patch entries', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const next = {
      ...initial,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
    }
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, next))

    expect(history.current().nodes).toHaveLength(1)
    expect(history.undo().nodes).toHaveLength(0)
    expect(history.redo().nodes).toHaveLength(1)
  })

  it('truncates redo history after pushing a new value following undo', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const first = {
      ...initial,
      nodes: [{ id: 'first', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'First' } }]
    }
    const replacement = {
      ...initial,
      nodes: [{ id: 'replacement', type: 'topic' as const, position: { x: 10, y: 20 }, data: { title: 'Replacement' } }]
    }
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, first))
    history.undo()
    history.push(replaceWithPatchResult(initial, replacement))

    expect(history.canRedo()).toBe(false)
    expect(history.redo().nodes.map((node) => node.id)).toEqual(['replacement'])
  })

  it('does not push empty patch results', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    history.push(replaceWithPatchResult(initial, structuredClone(initial)))

    expect(history.canUndo()).toBe(false)
    expect(history.current()).toEqual(initial)
  })

  it('returns cloned current documents', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    const current = history.current()
    current.meta.title = 'Mutated outside history'

    expect(history.current().meta.title).toBe('Doc')
  })

  it('keeps boundary undo and redo as no-op reads', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const history = createHistory(initial)

    expect(history.undo()).toEqual(initial)
    expect(history.redo()).toEqual(initial)
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })

  it('replaces all historical states while preserving current index and redo entries', () => {
    const initial = createEmptyDocument({ projectId: 'p1', title: 'Doc', now: '2026-04-26T00:00:00.000Z' })
    const first = {
      ...initial,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Root' } }]
    }
    const second = {
      ...first,
      nodes: [{ id: 'root', type: 'topic' as const, position: { x: 0, y: 0 }, data: { title: 'Edited Root' } }]
    }
    const history = createHistory(initial)
    history.push(replaceWithPatchResult(initial, first))
    history.push(replaceWithPatchResult(first, second))
    history.undo()

    const renamedHistory = history.replaceAll((document) => ({
      ...document,
      meta: {
        ...document.meta,
        title: 'Renamed Project'
      }
    }))

    expect(renamedHistory.current().meta.title).toBe('Renamed Project')
    expect(renamedHistory.current().nodes[0].data.title).toBe('Root')
    expect(renamedHistory.canUndo()).toBe(true)
    expect(renamedHistory.canRedo()).toBe(true)

    expect(renamedHistory.undo().meta.title).toBe('Renamed Project')
    expect(renamedHistory.current().nodes).toEqual([])

    expect(renamedHistory.redo().nodes[0].data.title).toBe('Root')
    expect(renamedHistory.redo().nodes[0].data.title).toBe('Edited Root')
    expect(renamedHistory.current().meta.title).toBe('Renamed Project')
  })
})
```

- [ ] **Step 2: Run history tests to verify failure**

Run:

```bash
npm run test -w packages/mind-engine -- src/history.test.ts
```

Expected: FAIL because `history.push()` still accepts snapshots and `replaceAll()` does not exist.

- [ ] **Step 3: Replace `packages/mind-engine/src/history.ts`**

Replace the full file with:

```ts
import { applyPatches, type Patch } from 'immer'
import { type PatchResult, replaceWithPatchResult } from './patches.js'

export type HistoryEntry = {
  patches: Patch[]
  inversePatches: Patch[]
}

export type History<T extends object> = {
  current(): T
  push(result: PatchResult<T>): void
  undo(): T
  redo(): T
  canUndo(): boolean
  canRedo(): boolean
  replaceAll(transform: (document: T) => T): History<T>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function cloneEntry(entry: HistoryEntry): HistoryEntry {
  return {
    patches: clone(entry.patches),
    inversePatches: clone(entry.inversePatches)
  }
}

export function createHistory<T extends object>(initial: T): History<T> {
  const base = clone(initial)
  let current = clone(initial)
  let entries: HistoryEntry[] = []
  let index = 0

  return {
    current() {
      return clone(current)
    },
    push(result) {
      if (result.patches.length === 0) {
        current = clone(result.document)
        return
      }

      entries = entries.slice(0, index)
      entries.push({
        patches: clone(result.patches),
        inversePatches: clone(result.inversePatches)
      })
      index = entries.length
      current = clone(result.document)
    },
    undo() {
      if (index > 0) {
        const entry = entries[index - 1]
        current = applyPatches(current, entry.inversePatches)
        index -= 1
      }
      return clone(current)
    },
    redo() {
      if (index < entries.length) {
        const entry = entries[index]
        current = applyPatches(current, entry.patches)
        index += 1
      }
      return clone(current)
    },
    canUndo() {
      return index > 0
    },
    canRedo() {
      return index < entries.length
    },
    replaceAll(transform) {
      const originalEntries = entries.map(cloneEntry)
      const originalIndex = index
      const states = [clone(base)]
      let replayed = clone(base)

      for (const entry of originalEntries) {
        replayed = applyPatches(replayed, entry.patches)
        states.push(clone(replayed))
      }

      const transformedStates = states.map((state) => transform(clone(state)))
      const nextHistory = createHistory(transformedStates[0])

      for (let stateIndex = 1; stateIndex < transformedStates.length; stateIndex += 1) {
        nextHistory.push(replaceWithPatchResult(transformedStates[stateIndex - 1], transformedStates[stateIndex]))
      }

      for (let stateIndex = transformedStates.length - 1; stateIndex > originalIndex; stateIndex -= 1) {
        nextHistory.undo()
      }

      return nextHistory
    }
  }
}
```

- [ ] **Step 4: Run history tests**

Run:

```bash
npm run test -w packages/mind-engine -- src/history.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all engine tests**

Run:

```bash
npm run test -w packages/mind-engine
```

Expected: PASS.

- [ ] **Step 6: Run engine typecheck**

Run:

```bash
npm run typecheck -w packages/mind-engine
```

Expected: PASS.

- [ ] **Step 7: Commit patch history**

Run:

```bash
git add packages/mind-engine/src/history.ts packages/mind-engine/src/history.test.ts
git commit -m "feat(engine): store undo history as patches"
```

Expected: commit succeeds.

---

### Task 4: Migrate Editor Store To Command Results

**Files:**
- Modify: `apps/web/src/stores/editor.test.ts`
- Modify: `apps/web/src/stores/editor.ts`

- [ ] **Step 1: Add a redo-branch rename regression test**

Add this test after `keeps external project renames through undo and redo on a dirty document` in `apps/web/src/stores/editor.test.ts`:

```ts
  it('keeps external project renames through redo history after undo', () => {
    const store = loadedStore(
      emptyDocument({
        nodes: [{ id: 'root', type: 'topic', position: { x: 10, y: 20 }, data: { title: 'Root' } }]
      })
    )
    store.editNodeTitle('root', 'First edit')
    store.editNodeTitle('root', 'Second edit')
    store.undo()

    store.updateDocumentTitle('Renamed While Redo Exists')

    expect(store.document?.meta.title).toBe('Renamed While Redo Exists')
    expect(store.document?.nodes[0].data.title).toBe('First edit')
    expect(store.canRedo).toBe(true)

    store.undo()
    expect(store.document?.meta.title).toBe('Renamed While Redo Exists')
    expect(store.document?.nodes[0].data.title).toBe('Root')

    store.redo()
    expect(store.document?.meta.title).toBe('Renamed While Redo Exists')
    expect(store.document?.nodes[0].data.title).toBe('First edit')

    store.redo()
    expect(store.document?.meta.title).toBe('Renamed While Redo Exists')
    expect(store.document?.nodes[0].data.title).toBe('Second edit')
  })
```

- [ ] **Step 2: Run store tests to verify failure**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: FAIL while the store still uses snapshot history APIs incompatible with the new patch history.

- [ ] **Step 3: Update editor store imports**

In `apps/web/src/stores/editor.ts`, replace the engine import block with:

```ts
import {
  addChildNodeCommand,
  addRootNodeCommand,
  createHistory,
  deleteEdgeDetachChildCommand,
  deleteNodesPromoteChildrenCommand,
  editNodeTitleCommand,
  executeCommand,
  moveNodes,
  moveNodesCommand,
  replaceWithPatchResult,
  setEdgeComponentCommand,
  type CommandResult,
  type History
} from '@mind-x/mind-engine'
```

- [ ] **Step 4: Remove the old local theme helper**

Delete this helper from `apps/web/src/stores/editor.ts`:

```ts
function rethemeDocument(document: MindDocument, theme: ThemeName): MindDocument {
  const next = cloneDocument(document)
  next.meta = {
    ...next.meta,
    theme
  }
  mindDocumentSchema.parse(next)
  return next
}
```

- [ ] **Step 5: Replace manual history retitling**

Replace the entire `retitleHistory()` helper with:

```ts
function retitleHistory(history: History<MindDocument>, title: string): History<MindDocument> {
  return history.replaceAll((document) => retitleDocument(document, title))
}
```

- [ ] **Step 6: Replace `commit()` and `commitCurrentDocument()`**

In the `actions` block, replace the existing `commit(document: MindDocument)` and `commitCurrentDocument()` actions with:

```ts
    commitCommandResult(result: CommandResult): void {
      const next = cloneDocument(result.document)
      this.document = next
      this.history?.push({
        document: next,
        patches: result.patches,
        inversePatches: result.inversePatches
      })
      this.selectedNodeIds = compactSelection(next, this.selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(next, this.selectedEdgeId)
      this.syncDirtyState()
      this.syncHistoryState()
    },
    commit(document: MindDocument): void {
      const next = cloneDocument(document)
      const current = this.history?.current() ?? this.document ?? next
      this.commitCommandResult(replaceWithPatchResult(current, next))
    },
    commitCurrentDocument(): void {
      if (!this.document || !this.history) {
        return
      }

      const current = this.history.current()
      const currentJson = serializeMindDocument(current)
      const nextJson = serializeMindDocument(this.document)
      if (currentJson === nextJson) {
        this.syncDirtyState()
        this.syncHistoryState()
        return
      }

      this.commitCommandResult(replaceWithPatchResult(current, cloneDocument(this.document)))
    },
```

- [ ] **Step 7: Migrate root, child, title, and move actions**

Replace these action bodies in `apps/web/src/stores/editor.ts`:

```ts
    setDocumentTheme(theme: ThemeName): void {
      if (!this.document || this.document.meta.theme === theme) {
        return
      }

      this.document = {
        ...this.document,
        meta: {
          ...this.document.meta,
          theme
        }
      }
      this.syncDirtyState()
      this.syncHistoryState()
    },
```

```ts
    addRootTopic(input: AddTopicInput = {}): string | null {
      if (!this.document || this.document.nodes.length > 0) {
        return null
      }

      const id = input.id ?? createNodeId(this.document)
      const title = input.title ?? 'New topic'
      assertTopicInput(id, title)
      const result = executeCommand(cloneDocument(this.document), addRootNodeCommand, { id, title })
      this.selectedNodeIds = [id]
      this.selectedEdgeId = null
      this.commitCommandResult(result)
      return id
    },
```

```ts
    addChildTopic(input: AddChildTopicInput = {}): string | null {
      if (!this.document) {
        return null
      }

      const parentId = input.parentId ?? this.selectedNodeIds[0]
      if (!parentId) {
        return null
      }

      const id = input.id ?? createNodeId(this.document)
      const result = executeCommand(cloneDocument(this.document), addChildNodeCommand, {
        parentId,
        id,
        title: input.title ?? 'New topic'
      })
      this.selectedNodeIds = [id]
      this.selectedEdgeId = null
      this.commitCommandResult(result)
      return id
    },
```

```ts
    editNodeTitle(nodeId: string, title: string): void {
      if (!this.document) {
        return
      }

      this.commitCommandResult(executeCommand(cloneDocument(this.document), editNodeTitleCommand, { nodeId, title }))
    },
```

```ts
    moveSelectedByWorldDelta(delta: Point): void {
      if (!this.document || this.selectedNodeIds.length === 0 || (delta.x === 0 && delta.y === 0)) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), moveNodesCommand, { nodeIds: this.selectedNodeIds, delta })
      )
    },
```

- [ ] **Step 8: Migrate edge component and delete actions**

Replace `setSelectedEdgeComponent()` and `deleteSelected()` with:

```ts
    setSelectedEdgeComponent(component: MindEdgeComponent): void {
      if (!this.document || !this.selectedEdgeId) {
        return
      }

      const selectedEdge = this.document.edges.find((edge) => edge.id === this.selectedEdgeId)
      if (!selectedEdge) {
        this.selectedEdgeId = null
        return
      }

      if ((selectedEdge.component ?? DEFAULT_EDGE_COMPONENT) === component) {
        return
      }

      this.commitCommandResult(
        executeCommand(cloneDocument(this.document), setEdgeComponentCommand, {
          edgeId: this.selectedEdgeId,
          component
        })
      )
    },
    deleteSelected(): void {
      if (!this.document) {
        return
      }

      if (this.selectedEdgeId) {
        const edgeId = this.selectedEdgeId
        if (!this.document.edges.some((edge) => edge.id === edgeId)) {
          this.selectedEdgeId = null
          return
        }

        this.selectedEdgeId = null
        this.selectedNodeIds = []
        this.commitCommandResult(executeCommand(cloneDocument(this.document), deleteEdgeDetachChildCommand, { edgeId }))
        return
      }

      if (this.selectedNodeIds.length === 0) {
        return
      }

      const selectedNodeIds = [...this.selectedNodeIds]
      const result = executeCommand(cloneDocument(this.document), deleteNodesPromoteChildrenCommand, {
        nodeIds: selectedNodeIds
      })

      this.selectedNodeIds = compactSelection(result.document, selectedNodeIds)
      this.selectedEdgeId = compactSelectedEdge(result.document, this.selectedEdgeId)
      this.commitCommandResult(result)
    },
```

- [ ] **Step 9: Keep preview movement outside history**

Leave `previewMoveSelectedByWorldDelta()` using the compatibility `moveNodes()` wrapper:

```ts
      const next = moveNodes(cloneDocument(this.document), { nodeIds: this.selectedNodeIds, delta })
```

This keeps drag preview mutating the displayed document without pushing history. `finishInteraction()` uses `commitCurrentDocument()` from Step 6 to create one synthetic patch entry from the history current document to the final previewed document.

- [ ] **Step 10: Run focused store tests**

Run:

```bash
npm run test -w apps/web -- src/stores/editor.test.ts
```

Expected: PASS.

- [ ] **Step 11: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 12: Commit store migration**

Run:

```bash
git add apps/web/src/stores/editor.ts apps/web/src/stores/editor.test.ts
git commit -m "feat(web): commit editor actions as patch commands"
```

Expected: commit succeeds.

---

### Task 5: Full Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: no uncommitted files.

- [ ] **Step 5: Record final verification**

No commit is needed if Step 4 is clean.

If Step 4 shows uncommitted files, stop and inspect them with:

```bash
git diff --stat
git diff --check
```

Expected: final worktree is clean and the latest commits are the task commits from this plan. If verification exposed a new defect, create a focused follow-up fix task instead of making an unplanned catch-all commit.

---

## Self-Review

Spec coverage:

- Unified command runner: Task 2.
- Immer patches and inverse patches: Tasks 1 and 2.
- Patch-based history with undo and redo: Task 3.
- External rename preserving past and redo states: Tasks 3 and 4.
- Viewport remains outside undo history: Task 4 preserves `setViewport()` and preview behavior; Task 5 verifies existing tests.
- Store selection and dirty semantics: Task 4 keeps existing compaction and sync calls; existing tests remain active.
- Tests across engine and web: Tasks 2, 3, 4, and 5.

Placeholder scan:

- No placeholder sections are intentionally left for implementers.
- Every file change includes an exact target path.
- Every verification step includes the command and expected result.

Type consistency:

- `PatchResult<T>` is defined once in `patches.ts`.
- `CommandResult` aliases `PatchResult<MindDocument>`.
- `History<T>.push()` accepts `PatchResult<T>`.
- The web store commits `CommandResult` or `replaceWithPatchResult()` output through one helper.
