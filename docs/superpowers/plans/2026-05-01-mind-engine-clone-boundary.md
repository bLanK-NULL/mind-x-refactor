# Mind Engine Clone Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant deep cloning around `@mind-x/mind-engine` in two acceptance-gated stages: Stage A removes duplicate session/web clones, then Stage C tightens the public engine boundary around history.

**Architecture:** Stage A keeps external input protection in `EditorSession.load()` and `EditorSession.commit()` but stops cloning session-owned immutable documents before command execution. Stage C keeps history behavior tested inside the engine package while removing the package-root export that encourages app-level direct history consumption.

**Tech Stack:** TypeScript, Vue 3, Pinia, Immer, Vitest, npm workspaces.

---

## File Structure

- Modify `apps/web/src/features/editor/stores/editor.ts`
  - Remove `cloneForSession()`.
  - Keep `toRaw` for `serializeMindDocument()`.
  - Call `session.load()` and `session.commit()` directly.

- Modify `apps/web/src/features/editor/__tests__/editor.store.test.ts`
  - Add source-level assertions that the web adapter does not clone before passing documents to the engine session.

- Modify `packages/mind-engine/src/editorSession/session.ts`
  - Stop cloning `state.document` before internal command execution.
  - Stop cloning Immer command results inside `commitCommandResult()`.
  - Keep clones at `load()` and `commit()` external input boundaries.
  - Keep history boundary behavior unchanged.

- Modify `packages/mind-engine/src/__tests__/editorSession.test.ts`
  - Add source-level assertions that session command paths no longer pass `cloneDocument(state.document)` to `executeCommand()` or preview command wrappers.
  - Keep behavior tests for frozen documents, undo/redo, preview finalization, and commit isolation.

- Modify `packages/mind-engine/src/index.ts`
  - Stage C removes `export * from './history.js'` from the package-root API.

- Modify `packages/mind-engine/src/__tests__/history.test.ts`
  - No behavioral rewrite expected. Keep direct internal import from `../history.js` so history remains tested as an engine implementation detail.

---

## Task 1: Add Stage A Boundary Tests

**Files:**
- Modify: `apps/web/src/features/editor/__tests__/editor.store.test.ts`
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`

- [ ] **Step 1: Add source helpers to the web editor store test**

At the top of `apps/web/src/features/editor/__tests__/editor.store.test.ts`, add `readFileSync`:

```ts
import { readFileSync } from 'node:fs'
```

Below `documentWithRoot()`, add this helper:

```ts
function readEditorStoreSource(): string {
  return readFileSync(new URL('../stores/editor.ts', import.meta.url), 'utf8')
}
```

- [ ] **Step 2: Add the failing web source test**

Inside `describe('editor store adapter', () => {`, after the `beforeEach()` block, add:

```ts
  it('delegates document ownership boundaries to the engine session', () => {
    const source = readEditorStoreSource()

    expect(source).not.toContain('function cloneForSession')
    expect(source).not.toContain('JSON.parse(JSON.stringify(toRaw(document)))')
    expect(source).toContain('session.load(nextDocument)')
    expect(source).toContain('session.commit(nextDocument)')
  })
```

- [ ] **Step 3: Run the web source test and verify it fails**

Run:

```sh
npm run test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts
```

Expected: FAIL because `cloneForSession()` still exists and `load()` / `commit()` still call it.

- [ ] **Step 4: Add source helper to the engine session test**

At the top of `packages/mind-engine/src/__tests__/editorSession.test.ts`, add `readFileSync`:

```ts
import { readFileSync } from 'node:fs'
```

Below `documentWithEdgeChain()`, add:

```ts
function readEditorSessionSource(): string {
  return readFileSync(new URL('../editorSession/session.ts', import.meta.url), 'utf8')
}
```

- [ ] **Step 5: Add the failing engine source test**

Inside `describe('editor session', () => {`, before the existing behavior tests, add:

```ts
  it('does not deep-clone session-owned documents before command execution', () => {
    const source = readEditorSessionSource()

    expect(source).not.toContain('executeCommand(cloneDocument(state.document)')
    expect(source).not.toContain('moveNodes(cloneDocument(state.document)')
    expect(source).not.toContain('resizeNodes(cloneDocument(state.document)')
    expect(source).not.toContain('const next = cloneDocument(result.document)')
    expect(source).toContain('const next = result.document')
  })
```

- [ ] **Step 6: Run the engine source test and verify it fails**

Run:

```sh
npm run test -w packages/mind-engine -- src/__tests__/editorSession.test.ts
```

Expected: FAIL because session command paths still contain `cloneDocument(state.document)` and `commitCommandResult()` still clones `result.document`.

- [ ] **Step 7: Commit the failing Stage A tests**

Run:

```sh
git add apps/web/src/features/editor/__tests__/editor.store.test.ts packages/mind-engine/src/__tests__/editorSession.test.ts
git commit -m "test: capture clone boundary expectations"
```

---

## Task 2: Implement Stage A Clone Cleanup

**Files:**
- Modify: `apps/web/src/features/editor/stores/editor.ts`
- Modify: `packages/mind-engine/src/editorSession/session.ts`

- [ ] **Step 1: Remove web pre-cloning**

In `apps/web/src/features/editor/stores/editor.ts`, keep this Vue import unchanged because `serializeMindDocument()` still uses `toRaw`:

```ts
import { markRaw, ref, shallowRef, toRaw } from 'vue'
```

Delete this helper:

```ts
function cloneForSession(document: MindDocument): MindDocument {
  return JSON.parse(JSON.stringify(toRaw(document))) as MindDocument
}
```

Change `load()` from:

```ts
  function load(nextDocument: MindDocument): void {
    session.load(cloneForSession(nextDocument))
    syncFromSession()
  }
```

to:

```ts
  function load(nextDocument: MindDocument): void {
    session.load(nextDocument)
    syncFromSession()
  }
```

Change `commit()` from:

```ts
  function commit(nextDocument: MindDocument): void {
    session.commit(cloneForSession(nextDocument))
    syncFromSession()
  }
```

to:

```ts
  function commit(nextDocument: MindDocument): void {
    session.commit(nextDocument)
    syncFromSession()
  }
```

- [ ] **Step 2: Update `commitCommandResult()`**

In `packages/mind-engine/src/editorSession/session.ts`, change:

```ts
  function commitCommandResult(result: CommandResult): void {
    const next = cloneDocument(result.document)
    history?.push({
      document: next,
      patches: result.patches,
      inversePatches: result.inversePatches
    })
    pendingPreviewBaseline = null
    syncAfterDocumentChange(next)
  }
```

to:

```ts
  function commitCommandResult(result: CommandResult): void {
    const next = result.document
    history?.push({
      document: next,
      patches: result.patches,
      inversePatches: result.inversePatches
    })
    pendingPreviewBaseline = null
    syncAfterDocumentChange(next)
  }
```

- [ ] **Step 3: Remove command execution input clones**

In `packages/mind-engine/src/editorSession/session.ts`, replace each command execution form like:

```ts
executeCommand(cloneDocument(state.document), moveNodesCommand, {
```

with:

```ts
executeCommand(state.document, moveNodesCommand, {
```

Apply the same change for:

```ts
executeCommand(state.document, resizeNodesCommand, {
executeCommand(state.document, addRootMindNodeCommand, {
executeCommand(state.document, addChildMindNodeCommand, {
executeCommand(state.document, deleteEdgeDetachChildCommand, { edgeId: edge.id })
executeCommand(state.document, setEdgeStyleCommand, {
executeCommand(state.document, setNodeShellStyleCommand, {
executeCommand(state.document, setNodeContentStyleCommand, {
executeCommand(state.document, deleteEdgeDetachChildCommand, { edgeId })
executeCommand(state.document, deleteNodesPromoteChildrenCommand, {
executeCommand(state.document, editNodeTitleCommand, { nodeId, title })
executeCommand(state.document, updateNodeDataCommand, { nodeId, dataPatch })
```

- [ ] **Step 4: Remove preview wrapper input clones**

In `previewMoveSelectedByWorldDelta()`, change:

```ts
    syncAfterDocumentChange(moveNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta }))
```

to:

```ts
    syncAfterDocumentChange(moveNodes(state.document, { nodeIds: state.selectedNodeIds, delta }))
```

In `previewResizeSelectedByDelta()`, change:

```ts
    syncAfterDocumentChange(resizeNodes(cloneDocument(state.document), { nodeIds: state.selectedNodeIds, delta }))
```

to:

```ts
    syncAfterDocumentChange(resizeNodes(state.document, { nodeIds: state.selectedNodeIds, delta }))
```

- [ ] **Step 5: Remove preview finalization clone**

In `finalizePendingPreview()`, change:

```ts
    const next = cloneDocument(state.document)
```

to:

```ts
    const next = state.document
```

Keep `replaceWithPatchResult(baseline, trackedNext)` unchanged.

- [ ] **Step 6: Confirm external boundary clones remain**

Verify these lines still exist in `packages/mind-engine/src/editorSession/session.ts`:

```ts
      const next = cloneDocument(document)
```

inside both `commit(document: MindDocument)` and `load(document: MindDocument)`.

- [ ] **Step 7: Run Stage A focused tests**

Run:

```sh
npm run test -w packages/mind-engine -- src/__tests__/editorSession.test.ts
npm run test -w apps/web -- src/features/editor/__tests__/editor.store.test.ts
```

Expected: both commands PASS.

- [ ] **Step 8: Run Stage A full acceptance tests**

Run:

```sh
npm run test -w packages/mind-engine
npm run test -w apps/web -- src/features/editor
```

Expected: both commands PASS.

- [ ] **Step 9: Commit Stage A implementation**

Run:

```sh
git add apps/web/src/features/editor/stores/editor.ts apps/web/src/features/editor/__tests__/editor.store.test.ts packages/mind-engine/src/editorSession/session.ts packages/mind-engine/src/__tests__/editorSession.test.ts
git commit -m "refactor(engine): remove redundant session document clones"
```

---

## Task 3: Add Stage C Public Boundary Test

**Files:**
- Modify: `packages/mind-engine/src/__tests__/editorSession.test.ts`

- [ ] **Step 1: Add package-root source helper**

In `packages/mind-engine/src/__tests__/editorSession.test.ts`, below `readEditorSessionSource()`, add:

```ts
function readEngineIndexSource(): string {
  return readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
}
```

- [ ] **Step 2: Add the failing root export test**

Inside `describe('editor session', () => {`, after the clone-boundary source test, add:

```ts
  it('keeps low-level history out of the package-root API', () => {
    const source = readEngineIndexSource()

    expect(source).not.toContain("export * from './history.js'")
    expect(source).toContain("export * from './editorSession.js'")
    expect(source).toContain("export * from './commands.js'")
  })
```

- [ ] **Step 3: Run the engine session test and verify it fails**

Run:

```sh
npm run test -w packages/mind-engine -- src/__tests__/editorSession.test.ts
```

Expected: FAIL because `packages/mind-engine/src/index.ts` still exports `./history.js`.

- [ ] **Step 4: Commit the failing Stage C test**

Run:

```sh
git add packages/mind-engine/src/__tests__/editorSession.test.ts
git commit -m "test: capture engine history export boundary"
```

---

## Task 4: Implement Stage C Boundary Tightening

**Files:**
- Modify: `packages/mind-engine/src/index.ts`

- [ ] **Step 1: Verify app code does not import history**

Run:

```sh
rg -n "createHistory|\\bHistory\\b|from '@mind-x/mind-engine'" apps/web/src apps/api/src packages/shared/src -S
```

Expected: app code may import other `@mind-x/mind-engine` exports, but does not import `createHistory` or `History`.

- [ ] **Step 2: Remove the package-root history export**

In `packages/mind-engine/src/index.ts`, remove this line:

```ts
export * from './history.js'
```

Keep the surrounding exports unchanged:

```ts
export * from './editorSession.js'
export * from './graph.js'
export * from './patches.js'
export * from './nodeValidation.js'
```

- [ ] **Step 3: Keep internal history tests unchanged**

Leave `packages/mind-engine/src/__tests__/history.test.ts` importing directly from the internal module:

```ts
import { createHistory } from '../history.js'
```

This preserves behavior coverage while no longer advertising history from the package root.

- [ ] **Step 4: Run Stage C focused tests**

Run:

```sh
npm run test -w packages/mind-engine -- src/__tests__/editorSession.test.ts src/__tests__/history.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run package typecheck**

Run:

```sh
npm run typecheck
```

Expected: PASS. If this fails because a package-root consumer still imports history, update that consumer to an internal test import if it is a test, or route app code through `EditorSession` if it is product code.

- [ ] **Step 6: Commit Stage C implementation**

Run:

```sh
git add packages/mind-engine/src/index.ts packages/mind-engine/src/__tests__/editorSession.test.ts
git commit -m "refactor(engine): keep history out of root exports"
```

---

## Task 5: Final Verification

**Files:**
- No expected code changes.

- [ ] **Step 1: Search for removed clone patterns**

Run:

```sh
rg -n "cloneForSession|executeCommand\\(cloneDocument\\(state\\.document\\)|moveNodes\\(cloneDocument\\(state\\.document\\)|resizeNodes\\(cloneDocument\\(state\\.document\\)|const next = cloneDocument\\(result\\.document\\)|export \\* from './history\\.js'" apps/web/src packages/mind-engine/src -S
```

Expected: no matches.

- [ ] **Step 2: Search for direct app history usage**

Run:

```sh
rg -n "createHistory|\\bHistory\\b" apps/web/src apps/api/src -S
```

Expected: no matches.

- [ ] **Step 3: Run final focused acceptance**

Run:

```sh
npm run test -w packages/mind-engine
npm run test -w apps/web -- src/features/editor
```

Expected: both commands PASS.

- [ ] **Step 4: Run final typecheck**

Run:

```sh
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Inspect git diff**

Run:

```sh
git diff --stat HEAD~4..HEAD
git status --short
```

Expected: commits contain only the plan, tests, and clone-boundary implementation. Working tree is clean unless the user has unrelated changes.

---

## Self-Review Notes

- Spec coverage: Stage A clone cleanup is covered by Tasks 1 and 2. Stage C package-root boundary tightening is covered by Tasks 3 and 4. Final validation is covered by Task 5.
- External input protection remains intact because `load()` and `commit()` keep `cloneDocument(document)`.
- History clone semantics remain intact because `history.ts` is not changed.
- Collaborative editing is not introduced.
