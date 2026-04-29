# Node And Edge Double-Click Inspector Design

Date: 2026-04-29

Status: Pending user review

## Goal

Change canvas object interaction so selecting an object and inspecting an object are separate actions.

Single-clicking a node or edge keeps the existing lightweight canvas behavior: select the object, prepare for drag or resize where applicable, and keep the canvas responsive. It must not open the floating inspector pane.

Double-clicking a node or edge opens the floating inspector pane for that object. For nodes, double-click also lets the type-specific content component decide whether it supports inline editing. At minimum, `TopicNodeContent` supports inline title editing on double-click.

This design also moves inline edit ownership out of `BaseNode.vue` and into the relevant `*NodeContent.vue` components.

## Non-Goals

- Do not redesign the inspector pane UI.
- Do not change persisted document schema.
- Do not change node or edge style controls.
- Do not add new node types.
- Do not add multi-edge or multi-node inspector support.
- Do not move inspector state into `@mind-x/mind-engine`; inspector visibility is a Web UI concern.
- Do not require every `*NodeContent` component to support inline editing.

## Chosen Approach

Use separate selection and inspection state.

The editor session/store remains the authority for selection:

```text
selectedNodeIds
selectedEdgeId
```

`MindEditor.vue` owns a separate UI-only inspection target:

```ts
type InspectionTarget =
  | { type: 'node'; id: string }
  | { type: 'edge'; id: string }
```

Selection changes happen on single-click, drag start, resize start, box selection, keyboard deletion, undo, redo, and document load as they do today. Inspection changes only when a node or edge emits an explicit inspect event, which is triggered by double-click.

This keeps the boundary clear:

- Selection is canvas interaction state.
- Inspection is floating-panel UI state.
- Inline editing belongs to node content components that opt into it.

## Interaction Rules

### Nodes

- Single-clicking a node selects it and may begin drag behavior.
- Single-clicking a node does not open the inspector pane.
- Resizing a node keeps the existing selected-node behavior.
- Double-clicking a node selects it and opens the node inspector pane.
- If the node content component supports inline editing, the same double-click starts that component's local edit mode.
- If the node content component does not support inline editing, double-click still opens the inspector pane.

`TopicNodeContent.vue` must support inline editing on double-click. Other node content components may keep, add, or remove inline editing independently, but that decision stays inside each content component.

### Edges

- Single-clicking an edge selects it.
- Single-clicking an edge does not open the inspector pane.
- Double-clicking an edge selects it and opens the edge inspector pane.
- Edge hover and selected feedback continue to work through the existing wide transparent hit path.

### Canvas And Inspector Lifecycle

- Closing the inspector clears only the inspection target. It does not clear the current selection.
- Clicking empty canvas clears both selection and inspection.
- Deleting the inspected object hides the inspector.
- Undo, redo, or document reload hides the inspector if the inspected object no longer exists.
- Single-clicking another node or edge updates selection but does not switch the inspector. The inspector switches only on double-click, closes through its close action, or disappears when its object is no longer present.

## Component Responsibilities

### MindEditor.vue

`MindEditor.vue` owns the `inspectionTarget` ref and derives inspector content from it.

It computes:

```ts
inspectedNode = inspectionTarget.type === 'node'
  ? document.nodes.find((node) => node.id === inspectionTarget.id)
  : null

inspectedEdge = inspectionTarget.type === 'edge'
  ? document.edges.find((edge) => edge.id === inspectionTarget.id)
  : null
```

`InspectorPanel` renders from `inspectedNode` or `inspectedEdge`, not from `selectedNode` or `selectedEdge`.

`MindEditor.vue` handles:

- `selectNode(nodeId)`: select only the node, without opening the inspector.
- `inspectNode(nodeId)`: select only the node, then set `inspectionTarget` to that node.
- `selectEdge(edgeId)`: select only the edge, without opening the inspector.
- `inspectEdge(edgeId)`: select only the edge, then set `inspectionTarget` to that edge.
- `closeInspector()`: clear `inspectionTarget` only.
- Empty canvas pointer down: clear both selection and inspection.

It also watches or derives stale targets defensively so the inspector disappears after deletion, undo, redo, or document reload when the target id no longer exists.

### EdgeRenderer.vue

`EdgeRenderer.vue` keeps the existing select event and adds an inspect event:

```ts
type EdgeRendererEmits = {
  select: [edgeId: string]
  inspect: [edgeId: string]
}
```

The hit path behavior becomes:

```vue
@click.stop="emit('select', edge.id)"
@dblclick.stop="emit('inspect', edge.id)"
```

The renderer does not know about inspector panel state. It only reports user intent.

### BaseNode.vue

`BaseNode.vue` remains the shared outer node shell.

It owns:

- Absolute positioning.
- Shell style resolution.
- Selected visual state.
- Pointer-down selection and drag start.
- Drag preview movement events.
- Resize handle interaction.

It no longer owns:

- `editing` state.
- `startEditing`.
- `commitEdit`.
- `cancelEdit`.
- Slot props for edit coordination.
- Knowledge of whether a node type supports inline editing.

Because inline double-click editing moves into content components, `BaseNode.vue` must not block all pointer events on content with a permanent non-editing `pointer-events: none` wrapper. Content must be able to receive double-click. Single-click and drag remain stable because unhandled pointer events bubble to `BaseNode.vue`.

`BaseNode.vue` may still emit an inspect event for double-clicks on shell areas outside content:

```ts
inspect: [nodeId: string]
```

But inline editing starts only in content components that implement it.

### NodeRenderer.vue

`NodeRenderer.vue` remains the bridge between generic node shell and type-specific content.

It:

- Selects the content component from the existing exhaustive registry.
- Wraps each content component in `BaseNode`.
- Forwards `BaseNode` shell inspect events upward.
- Forwards content inspect events upward with the node id.
- Forwards content commit events upward with the node id and data patch.

`NodeRenderer.vue` no longer adapts `BaseNode` edit slot callbacks. It does not own edit state and does not send edit request tokens down to content.

The content component contract becomes:

```ts
type NodeContentProps<TNode> = {
  node: TNode
}

type NodeContentEmits = {
  inspect: []
  commit: [dataPatch: Record<string, unknown>]
  cancel?: []
}
```

Narrower commit payloads are allowed inside a concrete component, as long as they are compatible with the existing `editor.updateNodeData(nodeId, dataPatch)` path after `NodeRenderer` adds the node id.

### TopicNodeContent.vue

`TopicNodeContent.vue` owns topic inline editing.

On double-click inside the topic content:

1. Stop propagation so the event is handled once.
2. Enter local editing mode.
3. Emit `inspect` so the node inspector opens.
4. Focus and select the title input.

It validates and commits the title using the existing topic rules:

- Trim title before commit.
- Reject empty plain text.
- Reject text containing `<` or `>`.
- Emit `commit` with `{ title }` when the value changed.
- Cancel and reset local draft when unchanged or on Escape.

This makes `TopicNodeContent.vue` the place where topic-specific inline editing lives. Future content components can follow the same pattern only if inline editing makes sense for that type.

## Data Flow

### Single-Click Node Selection

```text
user pointerdown on node
  -> BaseNode emits select(nodeId)
  -> NodeRenderer forwards select(nodeId)
  -> MindEditor calls editor.selectOnly(nodeId)
  -> selectedNodeIds updates
  -> no inspectionTarget change
  -> inspector remains closed or keeps showing the last inspected object
```

### Double-Click Topic Node

```text
user double-clicks topic content
  -> TopicNodeContent enters local editing mode
  -> TopicNodeContent emits inspect()
  -> NodeRenderer emits inspect(nodeId)
  -> MindEditor calls editor.selectOnly(nodeId)
  -> MindEditor sets inspectionTarget = { type: 'node', id: nodeId }
  -> NodeInspector opens for that node
```

When the title edit commits:

```text
TopicNodeContent emits commit({ title })
  -> NodeRenderer emits editCommit(nodeId, { title })
  -> MindEditor calls editor.updateNodeData(nodeId, { title })
  -> engine validates and commits an undoable document change
```

### Double-Click Non-Editable Node Content

```text
user double-clicks node shell or non-editable content
  -> BaseNode or content emits inspect(nodeId)
  -> MindEditor selects node and sets inspectionTarget
  -> NodeInspector opens
  -> no inline editing starts unless that content component implements it
```

### Single-Click Edge Selection

```text
user clicks edge hit path
  -> EdgeRenderer emits select(edgeId)
  -> MindEditor calls editor.selectEdge(edgeId)
  -> selectedEdgeId updates
  -> no inspectionTarget change
```

### Double-Click Edge Inspection

```text
user double-clicks edge hit path
  -> EdgeRenderer emits inspect(edgeId)
  -> MindEditor calls editor.selectEdge(edgeId)
  -> MindEditor sets inspectionTarget = { type: 'edge', id: edgeId }
  -> EdgeInspector opens
```

## Error Handling

- If the inspected node id cannot be found, `inspectedNode` is `null` and the node inspector is not rendered.
- If the inspected edge id cannot be found, `inspectedEdge` is `null` and the edge inspector is not rendered.
- A stale inspection target should be cleared after document changes so future state checks remain simple.
- Content commit validation errors remain local to the content component and keep focus in the relevant input.
- Engine validation errors from `updateNodeData`, style updates, or edge updates continue through the existing editor store path.

## Testing Expectations

### Source Boundary Tests

Update existing source-boundary tests so they assert:

- `MindEditor.vue` has an explicit inspection target state.
- `InspectorPanel` for nodes is driven by `inspectedNode`, not `selectedNode`.
- `InspectorPanel` for edges is driven by `inspectedEdge`, not `selectedEdge`.
- `EdgeRenderer.vue` emits both `select` and `inspect`.
- The edge hit path keeps `@click.stop` for selection and adds `@dblclick.stop` for inspection.
- `BaseNode.vue` no longer contains `editing = ref(false)`, `startEditing`, `commitEdit`, or `cancelEdit`.
- `BaseNode.vue` no longer exposes edit slot props.
- `BaseNode.vue` keeps shared drag, resize, shell style, and selected-state responsibilities.
- `NodeRenderer.vue` forwards inspect events and content commit events with node ids.
- `NodeRenderer.vue` does not create edit request versions or own edit state.
- `TopicNodeContent.vue` owns its local editing state and double-click handler.

### Behavioral Tests

Add or update component tests where practical:

- Single-clicking a node selects it without opening the inspector.
- Single-clicking an edge selects it without opening the inspector.
- Double-clicking a topic node opens the node inspector and enters topic inline edit mode.
- Double-clicking a non-editable node still opens the node inspector.
- Double-clicking an edge opens the edge inspector.
- Closing the inspector preserves selection.
- Clicking empty canvas clears both selection and inspection.
- Deleting, undoing, redoing, or reloading away the inspected object hides the inspector.

## Acceptance Criteria

- Single-click node selection no longer opens `InspectorPanel`.
- Single-click edge selection no longer opens `InspectorPanel`.
- Double-clicking a node opens the node inspector.
- Double-clicking an edge opens the edge inspector.
- `TopicNodeContent` owns double-click inline title editing.
- `BaseNode` no longer owns inline editing state or edit slot callbacks.
- `NodeRenderer -> BaseNode -> *NodeContent` data flow keeps shell behavior generic and content editing type-specific.
- Existing drag, resize, selection, inspector style editing, undo, redo, and delete behaviors remain intact.
