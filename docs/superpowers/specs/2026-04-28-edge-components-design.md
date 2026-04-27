# Edge Components Design

Date: 2026-04-28

Status: Approved for planning

## Goal

Add first-class edge components to the mind map editor. The first version supports visual edge presets while leaving room for future relationship semantics and richer object configuration.

The user should be able to select an edge, change its component preset from a floating inspector, and delete the edge so the child node becomes a root node while keeping its position and subtree.

## Confirmed Decisions

- First version prioritizes visual edge components, with future semantic edge expansion kept possible.
- Edge component presets are `plain`, `dashed`, `arrow`, and `dashed-arrow`.
- Do not expose edge color or stroke width in the first version.
- Edge selection and node selection are mutually exclusive.
- Edge picking uses a wide transparent hit path plus hover and selected feedback.
- Edge deletion is allowed. Deleting a parent-child edge detaches the child from its parent and keeps the child node in place as a root node.
- The floating inspector is the common configuration surface for this and future object configuration.
- The inspector appears only when an editable object is selected. If no object is selected, no inspector is shown.
- The inspector floats above the canvas, can be dragged, and can be closed.
- Arrow direction is fixed to `source -> target` in the first version, with data model room for future direction configuration.
- New child edges inherit the most recent existing child edge component from the same parent. If the parent has no child edges, the new edge uses `plain`.

## Non-Goals

- Custom edge colors.
- Custom edge width.
- User-defined edge components.
- Semantic edge types such as dependency, cause, reference, or blocking.
- Direction editing in the UI.
- Multi-edge selection or batch edge editing.
- A fixed right-side property panel.
- Replacing the self-owned renderer with a graph editing library.

## Data Model

`MindEdge` remains the structural parent-child relation in the persisted mind document, but gains optional visual configuration:

```ts
type EdgeComponent = 'plain' | 'dashed' | 'arrow' | 'dashed-arrow'

type MindEdge = {
  id: string
  source: string
  target: string
  type: 'mind-parent'
  component?: EdgeComponent
  data?: {
    direction?: 'source-target'
  }
}
```

`component` is optional for backward compatibility. Missing values are interpreted as `plain`. `data.direction` is reserved for future use and is not shown in the first UI.

The shared document schema accepts the four known component values, accepts missing `component`, and rejects unknown component values. Existing documents that only contain `{ id, source, target, type }` continue to load.

## Engine Commands

The pure engine layer gains focused edge commands:

```ts
setEdgeComponent(document, { edgeId, component })
deleteEdgeDetachChild(document, { edgeId })
```

`setEdgeComponent` updates only edge visual configuration and then validates the document tree.

`deleteEdgeDetachChild` removes exactly one edge. The target node remains in the document, keeps its absolute position, and becomes a root node. Any descendants of the target remain attached to the target, so deleting `parent -> child` does not flatten or delete the child's subtree.

`addChildNode` applies the default edge component rule:

- Find existing child edges where `source === parentId`.
- Use the component from the most recently inserted child edge.
- If no child edge exists or the latest child edge has no component, use `plain`.

The existing `assertMindTree` structural rules remain authoritative:

- Edge source and target nodes must exist.
- An edge cannot point from a node to itself.
- A node may have at most one parent edge.
- Cycles are invalid.

Edge components do not change these tree rules.

## Selection Model

The editor store keeps node and edge selection mutually exclusive:

```ts
type EditorState = {
  selectedNodeIds: string[]
  selectedEdgeId: string | null
}
```

Selection rules:

- Selecting a node clears `selectedEdgeId`.
- Setting node selection through box selection clears `selectedEdgeId`.
- Selecting an edge clears `selectedNodeIds`.
- Clicking empty canvas clears both node and edge selection.
- Starting a node drag on an unselected node selects that node and clears edge selection.
- Reloading a document, deleting a node, deleting an edge, undo, and redo compact selection so stale node IDs and stale edge IDs are removed.

Keyboard deletion follows the focused selection:

- If an edge is selected, `Delete` or `Backspace` detaches that edge.
- If no edge is selected, the existing selected-node deletion behavior remains unchanged.

Edge component changes and edge deletion are normal undoable document commits through the existing history system.

## Edge Interaction

`EdgeRenderer` becomes interactive while keeping one central path calculation.

Each edge renders:

- A visible path for normal drawing.
- A wider transparent path for pointer hit testing.

The transparent hit path handles hover and click without making the visible edge visually heavy. Hover feedback slightly emphasizes the visible path. Selected feedback uses a clearer selected color or outline treatment based on existing theme variables.

The SVG defines an arrow marker. `arrow` and `dashed-arrow` apply `marker-end` to the visible path. `dashed` and `dashed-arrow` apply `stroke-dasharray`. Missing or unknown components fall back defensively to `plain` in the renderer, even though the schema rejects unknown values.

The renderer emits edge selection events to the editor shell:

```ts
select(edgeId)
```

The edge layer continues to use `pointer-events` carefully so edge hit testing works while node dragging, context menus, and viewport gestures stay predictable.

## Floating Inspector

The editor gains a reusable floating `InspectorPanel` above the canvas.

Behavior:

- The panel is hidden when no editable object is selected.
- Selecting an edge opens the panel in a default canvas overlay position.
- Closing the panel clears the current selection.
- The panel can be dragged. Its screen position is UI state for the current editor session only and is not persisted in the document.
- Dragging the panel must not pan or zoom the viewport.

The first inspector content is `EdgeInspector`:

- Shows a compact "Edge component" preset control.
- Offers four presets: `plain`, `dashed`, `arrow`, and `dashed-arrow`.
- Shows a delete action that detaches the selected edge.

The panel container is intentionally generic so future node, text, color, or semantic relationship inspectors can reuse the same surface without changing the editor layout.

## Toolbar And Layout

The current top toolbar remains focused on global editor actions such as add, undo, redo, delete, save, and export.

The main canvas remains the primary editing surface. No fixed right-side property panel is added. Object-specific configuration lives in the floating inspector overlay.

The existing context menu can remain node-focused for this version. Edge editing is driven by left-click selection plus the inspector, not by edge right-click menus.

## Data Flow

Changing an edge component:

```text
user clicks edge
  -> editor.selectEdge(edgeId)
  -> floating inspector opens
  -> user picks component preset
  -> editor.setSelectedEdgeComponent(component)
  -> engine setEdgeComponent command returns validated document
  -> editor commits document to history
  -> dirty state updates
```

Deleting an edge:

```text
user selects edge
  -> user clicks inspector delete or presses Delete/Backspace
  -> editor.deleteSelected()
  -> engine deleteEdgeDetachChild command removes edge
  -> target node remains at same position as a root
  -> editor commits document to history
  -> stale edge selection clears
  -> dirty state updates
```

Adding a child:

```text
user selects parent node
  -> user adds child
  -> engine addChildNode places new child
  -> engine creates parent edge using latest child-edge component from the same parent, or plain
  -> editor selects the new child node
```

## Error Handling

- Missing edge `component` is treated as `plain`.
- Unknown edge `component` is rejected by schema validation.
- Renderer-level fallback still treats unknown runtime values as `plain` to avoid a blank or crashed canvas if bad data slips through.
- Edge commands throw clear errors for missing edge IDs or invalid documents.
- Deleting an already-removed selected edge is a no-op at the store level after selection compaction.
- If an undo, redo, reload, node delete, or edge delete removes the selected edge, `selectedEdgeId` becomes `null`.
- The floating inspector is included in the viewport gesture exclusion list so dragging or clicking it does not pan or zoom the canvas.

## Testing

Shared schema tests:

- Accept `plain`, `dashed`, `arrow`, and `dashed-arrow`.
- Accept missing `component`.
- Reject unknown component values.

Engine tests:

- `setEdgeComponent` updates the target edge and preserves tree validity.
- `deleteEdgeDetachChild` removes the edge, keeps the target node, preserves target position, and leaves the target subtree intact.
- `addChildNode` inherits the most recent existing child edge component from the same parent.
- `addChildNode` defaults to `plain` when there is no sibling edge component to inherit.

Editor store tests:

- Selecting an edge clears node selection.
- Selecting nodes clears edge selection.
- Edge component changes are undoable and mark the document dirty.
- `Delete` or `Backspace` detaches the selected edge when an edge is selected.
- Stale edge selection is cleared after deletion, undo, redo, and load.

Renderer and integration checks:

- Edge renderer emits selection from the hit path.
- Hover and selected classes are derived from edge state.
- Typecheck verifies Vue component integration.
- Build verifies SVG marker and Ant Design controls integrate cleanly.

Verification commands:

```bash
npm run typecheck
npm test
npm run build
```

## Implementation Notes

Keep the implementation scoped to the existing editor architecture:

- `packages/shared` owns schema and exported types.
- `packages/mind-engine` owns pure edge commands and inheritance logic.
- `apps/web/src/stores/editor.ts` owns selection state, history commits, and UI-facing actions.
- `apps/web/src/components/editor/EdgeRenderer.vue` owns SVG paths, hit testing, hover, selected state, dash style, and arrow markers.
- `apps/web/src/components/editor/InspectorPanel.vue` owns floating panel frame, drag behavior, and close behavior.
- `apps/web/src/components/editor/EdgeInspector.vue` owns edge-specific preset and delete controls.
- `apps/web/src/components/editor/MindEditor.vue` wires selection, delete handling, and inspector visibility.

Avoid a full component registry in the first version. The four presets can be represented by a small typed configuration map that can grow later if edge semantics become a real product feature.
