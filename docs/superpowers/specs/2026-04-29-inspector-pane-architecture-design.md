# Inspector Pane Architecture Design

Date: 2026-04-29

Status: Approved for implementation

## Goal

Refactor the editor inspector pane so node inspection follows the same layered architecture as node rendering while keeping shared node-shell controls in the selected-node inspector itself.

The desired hierarchy is:

```text
InspectorPanel
  EdgeInspector
  NodeInspector
    shell style controls
    divider
    TopicNodeInspector | ImageNodeInspector | LinkNodeInspector | AttachmentNodeInspector | CodeNodeInspector | TaskNodeInspector
```

`NodeInspector` exposes controls for the shared outer node shell, the style layer rendered by `BaseNode`. Type-specific node controls live in dedicated inspector components instead of being implemented with a long `v-if` and `v-else-if` chain inside `NodeInspector.vue`.

This is the inspector-pane convention for future work: the panel frame stays generic, shared object controls stay in the shared inspector, and type-specific controls are isolated in type-specific components.

## Non-Goals

- Do not redesign the visual appearance of the inspector pane.
- Do not change `InspectorPanel` drag, position persistence, or close behavior.
- Do not change the persisted document schema.
- Do not add new node types.
- Do not add new user-facing controls beyond fields already represented by current node `data` and meaningful `contentStyle` fields.
- Do not refactor edge inspection beyond preserving the current `EdgeInspector` entry point.

## Chosen Approach

Use `NodeInspector` as a stable node-inspection shell and dynamic type dispatcher.

This keeps the public `MindEditor -> NodeInspector` integration stable while moving node-type field knowledge into focused components. It also mirrors the rendering architecture:

```text
NodeRenderer
  BaseNode
    node-content/TopicNodeContent
    node-content/ImageNodeContent
    ...

NodeInspector
  shell style controls
  divider
  node-inspectors/TopicNodeInspector
  node-inspectors/ImageNodeInspector
  ...
```

The important boundary is that `NodeInspector` knows that node types exist, but it does not know the editable fields of each type. It selects the correct child component from a registry and forwards events upward.

## Component Structure

Inspector components live under:

```text
apps/web/src/features/editor/components/inspectors/
  InspectorPanel.vue
  EdgeInspector.vue
  NodeInspector.vue
  node-inspectors/
    TopicNodeInspector.vue
    ImageNodeInspector.vue
    LinkNodeInspector.vue
    AttachmentNodeInspector.vue
    CodeNodeInspector.vue
    TaskNodeInspector.vue
```

### InspectorPanel

`InspectorPanel.vue` remains a generic floating frame. It owns panel chrome, drag handling, position clamping, and close events. It does not know whether its slot contains a node inspector or edge inspector.

### EdgeInspector

`EdgeInspector.vue` remains the edge-specific inspector. It continues to own edge style controls and delete behavior.

### NodeInspector

`NodeInspector.vue` is the stable entry point for selected-node inspection.

It owns:

- The common node inspector section layout.
- Inline shell controls for `node.shellStyle`: color, tone, shape, border, and shadow.
- The divider between shared shell controls and type-specific controls.
- Selecting the type-specific inspector from a registry keyed by `node.type`.
- Forwarding child `contentChange`, `contentStyleChange`, and `shellStyleChange` events to `MindEditor`.

It does not own:

- Topic title editing.
- Image URL or alt editing.
- Link fields.
- Attachment fields.
- Code text editing.
- Task item replacement.
- Type-specific content-style controls.

`NodeInspector.vue` should not contain template branches such as `node.type === 'topic'` to render type-specific field groups.

### Type-Specific Node Inspectors

Each node inspector receives a narrowed node type and emits only patches relevant to that node's `data` or `contentStyle`.

- `TopicNodeInspector.vue` owns `data.title` and `contentStyle.textWeight`.
- `ImageNodeInspector.vue` owns `data.url`, `data.alt`, and `contentStyle.objectFit`.
- `LinkNodeInspector.vue` owns `data.title` and `data.url`.
- `AttachmentNodeInspector.vue` owns `data.fileName` and `data.url`.
- `CodeNodeInspector.vue` owns `data.code` and `contentStyle.wrap`.
- `TaskNodeInspector.vue` owns `data.items` and `contentStyle.density`.

Fixed-literal style schemas should still have a type-specific inspector component. The component may omit a control for that style until the schema has more than one meaningful option.

## Component Contracts

`NodeInspector.vue` keeps the existing external contract:

```ts
type NodeInspectorProps = {
  node: MindNode
}

type NodeInspectorEmits = {
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
  shellStyleChange: [stylePatch: Partial<NodeShellStyle>]
}
```

Each type-specific inspector uses the same content emit names as `NodeInspector`, but with a narrowed node prop:

```ts
type TopicNodeInspectorProps = {
  node: Extract<MindNode, { type: 'topic' }>
}

type TopicNodeInspectorEmits = {
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}
```

Specific implementations may use narrower internal patch types, but the emitted shape remains compatible with the existing editor update path.

## Registry

`NodeInspector.vue` uses an exhaustive registry similar to `NodeRenderer.vue`:

```ts
const inspectorComponentByType = {
  attachment: AttachmentNodeInspector,
  code: CodeNodeInspector,
  image: ImageNodeInspector,
  link: LinkNodeInspector,
  task: TaskNodeInspector,
  topic: TopicNodeInspector
} satisfies Record<MindNode['type'], Component>
```

Adding a future node type requires adding its inspector component and registering it here. TypeScript should make missing registrations visible when the shared `MindNode` union expands.

## Data Flow

The existing update path remains unchanged:

```text
MindEditor
  -> NodeInspector
    -> inline shell controls emit shell style patches
    -> TypeNodeInspector emits data or content style patches
  -> MindEditor handlers
  -> editor store update methods
```

`MindEditor.vue` continues to call:

- `editor.updateNodeData(selectedNode.value.id, dataPatch)`
- `editor.setSelectedNodeContentStyle(stylePatch)`
- `editor.setSelectedNodeShellStyle(stylePatch)`

## Testing Expectations

Source-boundary tests should assert:

- `NodeInspector.vue` imports `ColorTokenPicker.vue` and `StyleField.vue` directly.
- `NodeInspector.vue` contains the shell controls and `<a-divider class="node-inspector__divider" />`.
- `NodeInspector.vue` imports and registers all six type-specific node inspectors.
- `NodeInspector.vue` has no template checks like `node.type === 'topic'`, `node.type === 'image'`, or an equivalent `v-else-if` chain for node-specific field groups.
- Each type-specific inspector owns its narrowed node data and content-style controls.
- Existing `MindEditor.vue` tests continue to verify the external `NodeInspector` event wiring.

## Rule Of Thumb

- `InspectorPanel` is only the frame.
- Selection-level inspectors such as `NodeInspector` and `EdgeInspector` own shared controls for that selected object category.
- Concrete node-type controls live in `node-inspectors/*NodeInspector.vue`.
- `NodeInspector.vue` may dispatch by type, but it should not grow node-type field logic.
