# Inspector Position Session Storage Design

## Goal

The floating inspector should reopen at the last position used in the current browser tab session.

The remembered position applies to both node and edge inspectors. It is UI preference state only: it is not written into the mind document, does not participate in undo or redo history, and does not leave the current browser tab session.

## Current State

`apps/web/src/components/editor/InspectorPanel.vue` owns its position internally with a default value of `{ x: 24, y: 88 }`. Because the panel is conditionally mounted from `MindEditor.vue`, closing it or switching selected object types creates a new panel instance and loses the dragged position.

Node and edge inspectors already share the same generic `InspectorPanel` frame, but each `v-if` creates a separate panel instance.

## Chosen Behavior

- The default inspector position remains `{ x: 24, y: 88 }`.
- Dragging either a node inspector or edge inspector updates one shared inspector position for the editor.
- Switching between node and edge selection reuses the shared position.
- Closing and reopening the inspector in the same tab reuses the shared position.
- Refreshing the page in the same tab reuses the shared position through `sessionStorage`.
- Opening the app in an independent tab session starts from the default position. Duplicated or restored tabs follow the browser's `sessionStorage` behavior.
- Invalid, missing, or unavailable `sessionStorage` data falls back to the default position without blocking the inspector.

## Architecture

`MindEditor.vue` becomes the owner of shared inspector position state for the editor surface. It initializes that state from a web UI storage helper, passes it into each `InspectorPanel`, and persists updates when the panel reports a drag position change.

`InspectorPanel.vue` becomes a controlled floating frame:

- Receives a `position` prop.
- Emits `position-change` with the next clamped screen position while dragging.
- Keeps pointer capture and gesture isolation behavior unchanged.
- Continues to render the same title, close button, and slot content.

A small storage helper owns session persistence:

- Storage key: `mind-x-inspector-position`.
- Read from `window.sessionStorage` only when available.
- Parse stored JSON safely.
- Accept only finite numeric `{ x, y }` values.
- Clamp loaded and dragged positions to the same minimum offset currently used by the panel: `8px`.
- Swallow storage read and write failures.

## Data Flow

Opening the editor:

```text
MindEditor mounts
  -> readStoredInspectorPosition()
  -> use stored valid position or default position
  -> render InspectorPanel when node or edge is selected
```

Dragging the inspector:

```text
user drags InspectorPanel header
  -> InspectorPanel calculates clamped next position
  -> emits position-change
  -> MindEditor updates shared inspector position
  -> MindEditor writes the position to sessionStorage
```

Switching inspected object type:

```text
user selects node or edge
  -> MindEditor renders the matching inspector content
  -> both inspector variants receive the same shared position
```

## Error Handling

Storage access is best-effort. If `sessionStorage` is unavailable, blocked, malformed, or contains non-finite values, the UI falls back to the default inspector position and continues to work.

Position persistence failure does not interrupt dragging. The panel remains at the updated in-memory position for the current mounted editor.

## Testing

Unit tests cover the storage helper and drag-position utility behavior:

- Returns the default position when no stored value exists.
- Reads a valid stored position.
- Rejects malformed JSON, missing coordinates, non-number coordinates, and non-finite coordinates.
- Clamps loaded or dragged positions to the minimum `8px` offset.
- Writes valid positions to `sessionStorage`.
- Handles read and write exceptions without throwing.

Editor wiring is verified by checking that both node and edge inspector render paths pass and update the same shared position state. If the project does not have Vue component test utilities installed, this can remain a focused implementation-level assertion through extracted helpers and manual browser verification.

## Out Of Scope

- Persisting inspector position in project documents.
- Persisting across tabs with `localStorage`.
- Remembering separate positions for node and edge inspectors.
- Adding resize behavior or viewport-edge collision avoidance beyond the existing minimum top-left clamp.
