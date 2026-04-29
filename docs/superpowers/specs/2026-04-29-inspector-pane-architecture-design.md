# Inspector Pane Architecture Design

Date: 2026-04-29

Status: Approved for spec review

## Goal

Refactor the editor inspector pane so node inspection follows the same layered architecture as node rendering.

The desired hierarchy is:

```text
InspectorPanel
  EdgeInspector
  NodeInspector
    TopicNodeInspector
    ImageNodeInspector
    LinkNodeInspector
    AttachmentNodeInspector
    CodeNodeInspector
    TaskNodeInspector
```

`NodeInspector` should expose controls for the shared outer node shell, the style layer rendered by `BaseNode`. Type-specific node controls should live in dedicated inspector components instead of being implemented with a long `v-if` and `v-else-if` chain inside `NodeInspector.vue`.

This becomes the inspector-pane convention for future work: the panel frame stays generic, shared object controls stay in the shared inspector, and type-specific controls are isolated in type-specific components.

## Non-Goals

- Do not redesign the visual appearance of the inspector pane.
- Do not change `InspectorPanel` drag, position persistence, or close behavior.
- Do not change the persisted document schema.
- Do not add new node types.
- Do not add new user-facing controls beyond fields already represented by current node `data` and meaningful `contentStyle` fields.
- Do not refactor edge inspection beyond preserving the current `EdgeInspector` entry point.

## Chosen Approach

Use `NodeInspector` as a stable node-inspection shell and dynamic type dispatcher.

This keeps the public `MindEditor -> NodeInspector` integration stable while moving node-type knowledge into focused components. It also mirrors the existing rendering architecture:

```text
NodeRenderer
  BaseNode
    node-content/TopicNodeContent
    node-content/ImageNodeContent
    ...

NodeInspector
  NodeShellStyleInspector
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
  NodeShellStyleInspector.vue
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

`NodeInspector.vue` becomes the stable entry point for selected-node inspection.

It owns:

- The common node inspector section layout.
- Rendering `NodeShellStyleInspector` for `node.shellStyle`.
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

### NodeShellStyleInspector

`NodeShellStyleInspector.vue` owns the shared BaseNode shell controls:

- Color.
- Tone.
- Shape.
- Border.
- Shadow.

It receives a `NodeShellStyle` and emits a `Partial<NodeShellStyle>` patch.

### Type-Specific Node Inspectors

Each node inspector receives a narrowed node type and emits only patches relevant to that node's `data` or `contentStyle`.

`TopicNodeInspector.vue` owns:

- `data.title`.
- `contentStyle.textWeight`.

`ImageNodeInspector.vue` owns:

- `data.url`.
- `data.alt`.
- `contentStyle.objectFit`.

`LinkNodeInspector.vue` owns:

- `data.title`.
- `data.url`.
- No visible `contentStyle.layout` control while the schema only allows the fixed `summary` value.

`AttachmentNodeInspector.vue` owns:

- `data.fileName`.
- `data.url`.
- No visible `contentStyle.icon` control while the schema only allows the fixed `file` value.

`CodeNodeInspector.vue` owns:

- `data.code`.
- `contentStyle.wrap`.

`TaskNodeInspector.vue` owns:

- `data.items`.
- `contentStyle.density`.

Fixed-literal style schemas should still have a type-specific inspector component. The component may omit a control for that style until the schema has more than one meaningful option. This keeps the architecture complete without adding fake UI.

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

`NodeShellStyleInspector.vue` uses:

```ts
type NodeShellStyleInspectorProps = {
  style: NodeShellStyle
}

type NodeShellStyleInspectorEmits = {
  styleChange: [stylePatch: Partial<NodeShellStyle>]
}
```

Each type-specific inspector uses the same emit names as `NodeInspector`, but with a narrowed node prop:

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
    -> NodeShellStyleInspector emits shell style patch
    -> TypeNodeInspector emits data or content style patch
  -> MindEditor handlers
  -> editor store update methods
```

`MindEditor.vue` continues to call:

- `editor.updateNodeData(selectedNode.value.id, dataPatch)`.
- `editor.setSelectedNodeContentStyle(stylePatch)`.
- `editor.setSelectedNodeShellStyle(stylePatch)`.

The refactor changes component ownership, not state ownership.

## Validation And Error Handling

Validation moves to the component that owns the field:

- Plain text validation lives in topic, link, attachment, and task inspectors where those fields are edited.
- URL validation lives in image, link, and attachment inspectors.
- Code length validation lives in `CodeNodeInspector.vue`.
- Task item replacement validation lives in `TaskNodeInspector.vue`.

Invalid user edits should preserve the current behavior: do not emit an update patch when the value fails validation. This refactor does not add inline error messages or change save behavior.

If an inspector component receives the wrong node type through a programming error, TypeScript should catch it through narrowed props and registry usage. Runtime fallback UI is not required because `MindNode` is a validated discriminated union.

## Testing

Tests should shift from asserting that one large `NodeInspector.vue` file contains every field to asserting the new boundaries.

Recommended coverage:

- `NodeInspector.vue` imports `NodeShellStyleInspector.vue`.
- `NodeInspector.vue` imports and registers all six type-specific node inspectors.
- `NodeInspector.vue` has no template checks like `node.type === 'topic'`, `node.type === 'image'`, or an equivalent `v-else-if` chain for node-specific field groups.
- `NodeShellStyleInspector.vue` emits shell style patches for Color, Tone, Shape, Border, and Shadow.
- Each type-specific inspector exposes its expected data fields and validation helpers.
- Type-specific content-style controls are tested where there is a meaningful editable option: topic text weight, image object fit, code wrap, and task density.
- Existing `MindEditor.vue` tests continue to verify the external `NodeInspector` event wiring.

## Future Convention

Future inspector work should follow this rule:

- `InspectorPanel` is only the frame.
- Selection-level inspectors such as `NodeInspector` and `EdgeInspector` own shared controls for that selected object category.
- Concrete node-type controls live in `node-inspectors/*NodeInspector.vue`.
- `NodeInspector.vue` may dispatch by type, but it should not grow node-type field logic.

This keeps inspector code scalable as node types grow and keeps each file small enough to understand without reading unrelated node behavior.
