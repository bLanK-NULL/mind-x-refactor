# Patch Command History Design

## Goal

Refactor the mind map editor's undo and redo implementation from full-document snapshot history to an Immer patch-based command system.

The refactor should make editor mutations flow through a unified engine command runner. Commands describe document changes as Immer draft recipes, the runner produces forward and inverse patches, and history applies those patches for undo and redo.

## Confirmed Decisions

- Use Immer for patch generation and application.
- Convert engine commands to draft recipes executed by a unified command runner.
- Store patch entries in history instead of full document snapshots.
- Keep viewport behavior unchanged: viewport changes mark the document dirty but do not enter undo/redo history.
- Keep external project rename behavior unchanged: renaming the project updates current, clean, past, and future history states without becoming an undoable user action.
- Preserve current selection, dirty-state, and stale-selection responsibilities in the web editor store.

## Current Context

The current `packages/mind-engine/src/history.ts` stores a stack of full document snapshots and moves an index for undo and redo. The web editor store pushes full `MindDocument` values into that history.

This works, but it makes history storage coarse and forces non-user changes such as external project renames to rebuild the history by walking the stack with repeated undo and redo calls.

The engine already owns pure document commands such as adding child nodes, editing titles, moving nodes, setting edge components, deleting edges, and deleting nodes. Those commands are the right layer to become patch-producing operations.

## Immer Patch Usage

Immer patch support must be enabled once with `enablePatches()`. The command runner uses `produceWithPatches()` to produce:

- the next immutable `MindDocument`
- forward patches for redo
- inverse patches for undo

History uses `applyPatches()` to apply inverse patches during undo and forward patches during redo.

The design follows the Immer patch APIs documented at:

- https://immerjs.github.io/immer/patches
- https://immerjs.github.io/immer/api

## Engine Command Model

Engine commands become draft recipes. A command recipe receives a `Draft<MindDocument>` and an input object, mutates the draft, and validates the resulting graph.

The public runner shape should be:

```ts
import type { Draft, Patch } from 'immer'
import type { MindDocument } from '@mind-x/shared'

export type CommandRecipe<TInput> = (draft: Draft<MindDocument>, input: TInput) => void

export type CommandResult = {
  document: MindDocument
  patches: Patch[]
  inversePatches: Patch[]
}

export function executeCommand<TInput>(
  document: MindDocument,
  command: CommandRecipe<TInput>,
  input: TInput
): CommandResult
```

Concrete commands can be exported as command recipes:

```ts
executeCommand(document, addChildNodeCommand, input)
executeCommand(document, editNodeTitleCommand, input)
executeCommand(document, moveNodesCommand, input)
executeCommand(document, setEdgeComponentCommand, input)
executeCommand(document, deleteEdgeDetachChildCommand, input)
executeCommand(document, deleteNodePromoteChildrenCommand, input)
```

To reduce migration risk, existing command function names such as `addChildNode`, `editNodeTitle`, and `moveNodes` may remain as compatibility wrappers that call the runner and return only `result.document`. The web editor store should migrate to the runner path so undo and redo use patch entries.

## History Model

History stores an initial base document, a current document, a list of patch entries, and the current entry index.

```ts
export type HistoryEntry = {
  patches: Patch[]
  inversePatches: Patch[]
}

export type History<T> = {
  current(): T
  push(result: CommandResult): void
  undo(): T
  redo(): T
  canUndo(): boolean
  canRedo(): boolean
  replaceAll(transform: (document: T) => T): History<T>
}
```

`push(result)` truncates any redo branch, appends the command entry, and sets the current document to `result.document`.

`undo()` applies the current entry's `inversePatches` to the current document and moves the index backward.

`redo()` applies the next entry's `patches` to the current document and moves the index forward.

`current()` returns a cloned document so callers cannot mutate history internals.

`replaceAll(transform)` supports external non-undoable document changes such as project renames. It transforms the base document and every replayed state, then rebuilds an equivalent patch history with the original current index preserved. This keeps undo and redo behavior stable while ensuring project title changes persist across history traversal.

No-op command results with no patches should not be pushed.

## Web Editor Store Flow

The store should use the runner for undoable content commands:

1. Clone the current document.
2. Execute the engine command through `executeCommand()`.
3. Commit the `CommandResult` through a new `commitCommandResult()` helper.
4. Compact stale node and edge selection.
5. Sync dirty and history state.

`commit(document)` can remain temporarily for compatibility or for synthetic commits, but the primary path for editor content changes should be command results.

Drag preview remains special:

- Preview move actions update `document` without pushing history.
- `finishInteraction()` compares the current document against `history.current()`.
- If they differ, it creates one synthetic patch entry from the history current document to the previewed document.
- This preserves the existing behavior where many preview moves become one undoable entry.

Undo and redo keep the current viewport:

1. Capture `this.document?.viewport`.
2. Apply history undo or redo.
3. Reattach the captured viewport.
4. Compact stale selection.
5. Sync dirty and history state.

`setViewport()` remains outside undo history and directly updates `document.viewport`.

## External Project Rename

`updateDocumentTitle()` remains a non-undoable external update.

When the current document is clean, it updates the document title, clean snapshot, and resets history around the renamed document.

When the current document is dirty, it updates:

- current document title
- clean document snapshot title
- past history states
- redo history states

The user can still undo and redo their content edits after the rename, but the project title should stay renamed across those operations.

## Error Handling

Command recipes continue to throw clear domain errors:

- empty node IDs
- duplicate node IDs
- invalid title text
- missing parent nodes
- missing edited or deleted nodes
- missing edited or deleted edges
- invalid tree structure

The runner should not catch and hide these errors. If a command recipe throws, no command result is committed and the store state remains unchanged.

No-op guards remain close to the store or command boundary:

- no loaded document
- no selected node or edge
- zero movement delta
- setting an edge component to its effective current value
- undo or redo at a history boundary

## Testing Plan

Engine runner tests:

- each command produces the expected next document
- each command produces forward and inverse patches
- applying inverse patches restores the previous document
- applying forward patches redoes the command
- invalid commands throw without producing committed state

Engine history tests:

- push, undo, and redo with patch entries
- redo branch truncation after a new push
- boundary undo and redo return the current document without mutation
- `current()` returns an isolated clone
- no-op patch results are not pushed
- `replaceAll()` preserves the current index and applies external title changes across past and future states

Web editor store tests:

- existing undo and redo behavior for add, edit, delete, move, theme, and edge component changes
- repeated drag preview commits as one history entry
- viewport changes mark dirty without entering undo history
- undo and redo preserve the current viewport
- external project renames persist across undo and redo
- stale node and edge selections are compacted after commits, undo, redo, and load

## Non-Goals

- Do not add event sourcing or command replay from command name and input.
- Do not make viewport changes undoable.
- Do not move selection state into engine history.
- Do not redesign the editor UI.
- Do not remove compatibility wrappers until all call sites are migrated and tests prove they are unused.

## Risks

Patch paths are array-based and depend on document array order. Existing commands already preserve array order intentionally, so this is acceptable, but tests should cover delete and promote behaviors carefully.

External rename history transformation is the most subtle part of the refactor. It needs focused tests because it must update historical states without adding a user-visible undo entry.

Immer is a new dependency for `@mind-x/mind-engine`. It should be added to that package's dependencies and lockfile during implementation.
