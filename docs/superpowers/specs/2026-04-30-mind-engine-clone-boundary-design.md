# Mind Engine Clone Boundary Design

Date: 2026-04-30

Status: Approved for spec review

## Goal

Reduce redundant deep cloning around `@mind-x/mind-engine` while keeping current editor behavior stable. The work should clarify which copies are true API boundary protection and which copies are now unnecessary because editor documents are produced through Immer as immutable state.

The implementation is split into two acceptance-gated stages:

1. Stage A removes obvious redundant clones without changing public behavior.
2. Stage C tightens the engine public boundary after Stage A passes validation.

Collaborative editing preparation is explicitly out of scope for this change.

## Confirmed Decisions

- Do Stage A first and validate it before starting Stage C.
- Preserve current undo, redo, dirty-state, viewport, and drag-preview behavior.
- Keep `load(document)` and `commit(document)` as external input boundaries that protect the session from caller-owned objects.
- Do not add collaborative editing, CRDT, OT, semantic command transaction metadata, remote sync protocols, or revision-vector concepts.
- Prefer existing Immer-based immutable document flow over repeated `structuredClone()` calls inside the session.
- Keep the project architecture clean: engine owns editor-domain rules and session behavior, while web remains a thin Vue/Pinia adapter.

## Current Context

`packages/mind-engine` now uses Immer in two important places:

- Document commands run through `produceWithPatches()` and return a next immutable document plus forward and inverse patches.
- `EditorSession` updates its internal state with `produce()` and exposes a shallow immutable session state view.

Despite that, the current code still deep-clones documents in multiple layers:

- `apps/web/src/features/editor/stores/editor.ts` clones documents before calling `session.load()` and `session.commit()`.
- `EditorSession` clones the current document before most command executions.
- `commitCommandResult()` clones command results before pushing to history and syncing session state.
- `History` clones values at its API boundary and while storing patch entries.

Some of these copies still serve a clear purpose. Others are now redundant because the value is already owned by the session or returned by Immer.

## Stage A: Remove Redundant Internal Clones

Stage A is a conservative performance and clarity pass. It should not change public API semantics.

### Keep These Copies

Keep `EditorSession.load(document)` cloning its input. Loading is an external boundary: the caller may still own and mutate the object after passing it in.

Keep `EditorSession.commit(document)` cloning its input. Commit supports full-document replacement paths such as local draft restore, so it must protect the session from caller-owned draft objects.

Keep `History.current()`, `History.undo()`, and `History.redo()` returning isolated values for now. This preserves the current public contract while Stage A focuses only on redundant session and web adapter copies.

Keep defensive history entry copies for now. Patch arrays are stored inside history and should not become caller-mutable as part of this first stage.

### Remove These Copies

Remove the web adapter's `cloneForSession()` deep clone before `session.load()` and `session.commit()`. The engine session already owns those input boundaries, so cloning in web duplicates the same protection.

Remove `cloneDocument(state.document)` before internal command execution. `state.document` is already session-owned immutable state. `executeCommand()` can safely receive it and use Immer to create the next document.

Remove the extra clone in `commitCommandResult()` when the command result already comes from Immer. The command result document can become the next session document and the history current document without being deep-cloned first.

For preview paths, prefer command wrappers or command execution against the current session document without first deep-cloning. The preview result is an Immer-produced immutable document.

### Stage A Acceptance Criteria

- Engine tests pass.
- Web editor store tests pass.
- Existing behavior for undo, redo, drag preview finalization, dirty state, viewport preservation, and external title updates is unchanged.
- The test that mutates a local draft after `store.commit(draft)` still passes, proving `commit()` remains an external input boundary.
- Web no longer performs its own full-document clone before calling `session.load()` or `session.commit()`.
- Session command paths no longer deep-clone the current session document before passing it to engine commands.

## Stage C: Tighten the Engine Public Boundary

Stage C happens only after Stage A is validated.

The goal is to make the preferred engine consumption model clearer: application code should use `EditorSession` and public command helpers, not the low-level history implementation.

### Boundary Direction

Treat `History` as a low-level engine implementation detail rather than a primary app-facing API. The web app should not import or instantiate `createHistory()` directly.

Prefer `EditorSession` as the orchestration boundary for:

- Current document state.
- Selection.
- Dirty tracking.
- Undo and redo.
- Drag preview finalization.
- External project title synchronization.

Keep command helpers available where they are already useful as pure document transformations. Do not collapse all command APIs into `EditorSession`.

### Possible Code Changes

If no app code imports `createHistory()` from `@mind-x/mind-engine`, remove the package-root export of `history.ts` or move the export to a deliberately internal path if the package structure supports it.

Keep history tests inside `packages/mind-engine`; they verify the internal implementation even if history is no longer promoted as a package-root API.

Update imports in tests as needed so tests can still target internal modules without encouraging app-level usage.

Document the preferred boundary through exports and naming rather than adding a large abstraction layer.

### Stage C Acceptance Criteria

- `apps/web` and `apps/api` do not depend on `createHistory()` or `History`.
- The package-root engine API no longer encourages direct history consumption if the removal is non-breaking for app code.
- History behavior remains tested inside the engine package.
- Editor behavior remains unchanged after Stage C.

## Non-Goals

- Do not introduce collaborative editing architecture.
- Do not add CRDT, OT, remote operation merge, presence, base revision, client id, or semantic transaction metadata.
- Do not change visible editor behavior.
- Do not make viewport changes undoable.
- Do not redesign command history beyond the clone-boundary cleanup.
- Do not remove external input protection from `load()` or `commit()`.
- Do not change API persistence, sync service behavior, local draft format, or PNG export behavior.

## Testing Plan

Run focused engine tests after Stage A:

```sh
npm run test -w packages/mind-engine
```

Run focused web editor tests after Stage A:

```sh
npm run test -w apps/web -- src/features/editor
```

Run the same focused checks after Stage C, then run package type checks if exports change:

```sh
npm run typecheck
```

If package-root exports change in Stage C, also search for direct history imports across the repo before and after the change.

## Risks

Removing internal clones can reveal hidden mutation bugs if any session consumer mutates returned documents outside session methods. Current `EditorSession.getState()` already returns the document by reference, and tests expect the document to be frozen, so this risk should be manageable.

Removing or demoting root `history` exports may be source-incompatible for external consumers. This repo is private and app code appears to use `EditorSession`, but Stage C should still validate imports before changing exports.

`History.current()` remains intentionally conservative in this work. A later refactor can revisit whether history should return immutable references instead of cloned values after history has been fully established as an internal-only implementation detail.
