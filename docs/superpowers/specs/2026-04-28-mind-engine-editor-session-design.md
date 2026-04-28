# Mind Engine Editor Session Design

Date: 2026-04-28

Status: Approved for spec review

## Goal

Strengthen `packages/mind-engine` so it owns the core editor session model instead of only exposing individual command helpers. The web editor should remain responsible for Vue, DOM events, toolbar wiring, inspectors, server sync, local drafts, and PNG export, but it should no longer own document command coordination, selection consistency, history bookkeeping, dirty tracking, or drag-preview commit rules.

The target outcome is a thinner `apps/web/src/stores/editor.ts`, a clearer engine API for future editing features, and stronger pure engine tests for session behavior.

## Chosen Approach

Use a staged editor-session migration.

First, add an `EditorSession` layer in `packages/mind-engine` above the existing graph, command, patch, and history modules. Then convert the Pinia editor store into a shallow adapter around that session. This keeps current product behavior stable while moving the boundary to the package that already owns mind-map rules.

This design does not introduce a full headless UI action system. Keyboard shortcuts, context menus, DOM drag events, viewport DOM integration, and inspector UI remain in `apps/web`. Those web events call semantic engine-backed store actions such as `addChildTopic`, `deleteSelected`, `previewMoveSelectedByScreenDelta`, and `finishInteraction`.

## Non-Goals

- Do not redesign visible editor interaction rules.
- Do not move keyboard shortcut parsing, context-menu placement, DOM hit testing, or d3 viewport binding into `mind-engine`.
- Do not replace the existing command, graph, patch, or history modules.
- Do not introduce browser E2E tests as part of this architecture change.
- Do not change API persistence, local draft storage, project routing, or PNG export behavior except as needed to consume the thinner editor store.

## Architecture Boundary

The package responsibilities remain:

- `packages/shared`: document schemas, DTOs, migration, style contracts, and shared constants.
- `packages/mind-engine`: mind-map graph rules, document commands, patch history, selection consistency, and editor session state.
- `apps/web`: Vue components, Pinia adapter, browser services, server sync, local draft handling, cross-tab events, and export.
- `apps/api`: authentication, project persistence, backend validation, and HTTP errors.

`EditorSession` becomes the owner of:

- Current `MindDocument`.
- Node selection.
- Edge selection.
- Undo and redo history.
- Dirty versus clean snapshot tracking.
- Command dispatch.
- Drag preview and interaction commit behavior.
- Selection and edge compaction after document changes.
- Style patch no-op detection.
- External document title synchronization rules.

`apps/web/src/stores/editor.ts` becomes the only Vue-facing adapter. Components continue using the store rather than directly creating sessions.

## Editor Session API

The public session API should be close to:

```ts
type EditorSession = {
  getState(): EditorSessionState
  load(document: MindDocument): void
  markClean(): void
  hasDocumentSnapshot(snapshotJson: string): boolean

  selectOnly(nodeId: string): void
  setSelection(nodeIds: string[]): void
  selectEdge(edgeId: string): void
  clearSelection(): void

  addRootTopic(input?: AddTopicInput): string | null
  addChildTopic(input?: AddChildTopicInput): string | null
  editNodeTitle(nodeId: string, title: string): void
  setSelectedNodeStyle(stylePatch: Partial<TopicNodeStyle>): void
  setSelectedEdgeStyle(stylePatch: Partial<EdgeStyle>): void
  deleteSelected(): void

  previewMoveSelectedByWorldDelta(delta: Point): void
  previewMoveSelectedByScreenDelta(delta: Point): void
  moveSelectedByWorldDelta(delta: Point): void
  moveSelectedByScreenDelta(delta: Point): void
  finishInteraction(): void

  undo(): void
  redo(): void
  setViewport(viewport: Viewport): void
  updateDocumentTitle(title: string): void
}
```

`EditorSessionState` is a shallow immutable view:

```ts
type EditorSessionState = Readonly<{
  document: Readonly<MindDocument> | null
  dirty: boolean
  selectedNodeIds: readonly string[]
  selectedEdgeId: string | null
  canUndo: boolean
  canRedo: boolean
  revision: number
}>
```

`revision` increments whenever the session-visible state changes. The web adapter can use it to synchronize shallow state without deep watching the document.

## Immer State Model

The session should use Immer internally for immutable state transitions. The existing command layer already uses Immer patches for document changes and should remain the source of document-level undo and redo entries.

The internal state shape can be:

```ts
type EditorSessionInternalState = {
  cleanDocumentJson: string | null
  document: MindDocument | null
  history: History<MindDocument> | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  revision: number
}
```

The session should not deep-clone the full document on every `getState()` call. That would be too expensive for frequent interactions such as drag preview. Instead:

- Immer produces new immutable references through structural sharing.
- `getState()` returns a shallow view of the current immutable references and derived flags.
- The returned document is treated as read-only by TypeScript and by architectural contract.
- Engine tests should catch web attempts to mutate state outside session methods.
- Immer auto-freezing can protect produced trees in development and tests.

This combines a strong engine boundary with editor-scale performance. Immer protects internal transitions; shallow state output avoids repeatedly cloning large mind maps.

## Web Store Adapter

The Pinia editor store should hold a raw session instance and shallow reactive fields derived from `session.getState()`.

Conceptually:

```ts
const session = markRaw(createEditorSession())

state: {
  document: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  dirty: false,
  canUndo: false,
  canRedo: false,
  revision: 0
}
```

Each action calls the session, then synchronizes store fields:

```ts
function syncFromSession() {
  const state = session.getState()
  this.document = state.document
  this.selectedNodeIds = [...state.selectedNodeIds]
  this.selectedEdgeId = state.selectedEdgeId
  this.dirty = state.dirty
  this.canUndo = state.canUndo
  this.canRedo = state.canRedo
  this.revision = state.revision
}
```

The store should not replace one large deep reactive `snapshot` object on every edit. Vue's shallow-state pattern is a better fit for large immutable structures: the document root reference changes when the engine produces a new document, while nested document data is treated as immutable.

Existing component-facing names should stay as stable as possible. `MindEditor.vue` should still read `editor.document`, `editor.selectedNodeIds`, `editor.selectedEdgeId`, `editor.dirty`, `editor.canUndo`, and `editor.canRedo`, and still call store actions such as `addChildTopic`, `deleteSelected`, and `finishInteraction`.

## Data Flow

The main editor path becomes:

```text
UI event
  -> Pinia editor adapter action
  -> EditorSession method
  -> engine command or session state update
  -> Pinia shallow field sync
  -> Vue render
```

Server sync remains in `EditorView` and `syncService`:

```text
save action
  -> read current immutable document from store
  -> PUT document to API
  -> if snapshot still matches current session state, load saved document or mark clean
  -> if save fails, persist current/captured document as local draft
```

Local draft restore remains a web concern, but the restored document is loaded or committed through the session-backed store.

## Key Behavior Rules

- `load(document)` validates or migrates the document before entering the session, clears selection, initializes history, stores the clean snapshot, and resets dirty.
- `markClean()` records the current document as clean and recalculates dirty.
- `setViewport(viewport)` updates the document and dirty state but does not enter undo or redo history.
- `previewMoveSelected...()` updates the current document and dirty state but does not push history.
- `finishInteraction()` commits the previewed document delta as one history entry if the document changed.
- `undo()` and `redo()` restore document history but preserve untracked viewport behavior from the current implementation.
- Selection is compacted after document changes so deleted nodes or edges cannot remain selected.
- Selecting an edge clears node selection; selecting nodes clears edge selection.
- Style patch methods skip no-op patches and do not create empty history entries.
- `updateDocumentTitle(title)` handles external project rename synchronization without turning the rename into a user edit or corrupting existing history.

Behavior changes are limited to obvious consistency fixes around dangling selection, empty history entries, and preview/commit coherence. Visible product rules such as Tab adding a child, deleting a node promoting children, and deleting an edge detaching the child remain unchanged.

## File Organization

Initial file changes:

```text
packages/mind-engine/src/
  editorSession.ts
  editorSession.test.ts
  commands.ts
  history.ts
  graph.ts
  patches.ts
  index.ts

apps/web/src/stores/
  editor.ts

apps/web/src/components/editor/
  MindEditor.vue
```

If `editorSession.ts` clearly grows beyond a focused session coordinator, split it after the first implementation pass:

```text
packages/mind-engine/src/editorSession/
  index.ts
  state.ts
  selection.ts
  documentActions.ts
  styleActions.ts
```

Do not split preemptively before the real boundaries are visible.

## Error Handling

- Engine command methods continue throwing `Error` for invalid titles, invalid style patches, missing command targets, or invalid documents.
- Selection methods stay tolerant: nonexistent selected node or edge IDs are compacted away rather than treated as user-facing errors.
- The web store should not swallow engine errors. Tests and existing UI paths should reveal unexpected invalid calls.
- Async user-facing errors from save, load, local draft, export, auth, and routing remain handled in web services and views.
- Invalid loaded documents should fail before becoming session state.

## Testing

Add focused `packages/mind-engine/src/editorSession.test.ts` coverage for:

- Load, clean snapshot, dirty, and markClean.
- Add root and child topic selection behavior.
- Delete node and edge selection compaction.
- Undo and redo flags and document restoration.
- Viewport updates not entering history.
- Drag preview followed by `finishInteraction()` producing one undo entry.
- Style no-op patches not entering history.
- External title update preserving dirty semantics and history consistency.
- `getState()` returning shallow immutable state with revision changes.

Keep existing command, graph, history, patch, API, sync service, and component helper tests. Update web store tests so they verify adapter behavior instead of duplicating engine session rules.

## Acceptance Criteria

- `packages/mind-engine` exports a documented `createEditorSession` or equivalent API.
- `apps/web/src/stores/editor.ts` no longer owns command result handling, history push logic, dirty snapshot comparison, selection compaction, or style no-op checks.
- `MindEditor.vue` remains mostly an event and render shell.
- Existing editor behavior remains stable except for approved consistency fixes.
- Engine session tests cover the core state machine.
- Existing `npm run typecheck`, `npm test`, and `npm run build` pass after implementation.
