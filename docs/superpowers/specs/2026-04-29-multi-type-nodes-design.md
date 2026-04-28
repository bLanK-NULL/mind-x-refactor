# Multi-Type Nodes Design

Date: 2026-04-29

Status: Approved for spec review

## Goal

Extend the mind map editor from a text-topic-only model to a first-class multi-type node model.

The first supported node types are:

- Text nodes, stored as the existing `topic` node type.
- Image nodes, backed by image URLs.
- Link nodes.
- Attachment nodes, backed by file URLs.
- Code block nodes, with automatic language detection and syntax highlighting.
- Task list nodes, containing multiple todo items.

All node types are peers in the graph. Any node type can be a root, a parent, a child, or a leaf. Tree validity continues to depend on node ids and parent edges, not on node type.

## Non-Goals

- Do not add rich card nodes in this phase.
- Do not add local image upload, file upload, or backend asset storage.
- Do not build a general rich text editor.
- Do not make links or attachments fetch remote metadata automatically.
- Do not preserve v2 save compatibility at write boundaries.
- Do not redesign edge behavior or edge style editing.

## Chosen Approach

Use a v3 document contract with first-class node union types.

This is a deliberate schema upgrade instead of hiding new behaviors inside `topic.data`. It keeps text, image, link, attachment, code, and task nodes at the same conceptual level and gives each type room for its own data and content style.

The current `topic` type remains the storage type for text nodes. Existing v2 topic nodes migrate to v3 topic nodes.

## Architecture

Each v3 node has two layers:

```ts
type MindNodeBase = {
  id: string
  type: NodeType
  position: Point
  size: Size
  shellStyle: NodeShellStyle
}
```

Specific node types extend the base with type-specific `data` and `contentStyle`:

```ts
type SpecificMindNode = MindNodeBase & {
  data: TypeSpecificData
  contentStyle: TypeSpecificStyle
}
```

`NodeShellStyle` is shared by every node type. It owns the outer visual treatment: color token, tone, shape, border, shadow, and other node-frame properties.

`size` is not part of `NodeShellStyle` in v3. Explicit `node.size` is the source of rendered width and height, and manual resize updates that field.

Each concrete node type owns an independent content style schema. A type may expose no content style controls in the first UI, but the schema still reserves a stable place for type-specific presentation.

## V3 Document Contract

`MindDocument` upgrades to `version: 3`.

The v3 document keeps the existing meta, viewport, and edge concepts. The main change is that `nodes` becomes a discriminated union:

```ts
type MindNode =
  | TopicNode
  | ImageNode
  | LinkNode
  | AttachmentNode
  | CodeNode
  | TaskNode
```

### Topic Node

Topic remains the persisted text node type.

```ts
type TopicNodeData = {
  title: PlainText
}
```

### Image Node

Image nodes use URLs only in the first version.

```ts
type ImageNodeData = {
  url: string
  alt?: PlainText
  caption?: PlainText
}
```

The first UI exposes only `url`. `alt` and `caption` are reserved for later editing and accessibility improvements.

### Link Node

```ts
type LinkNodeData = {
  url: string
  title: PlainText
  description?: PlainText
}
```

The first UI exposes `url` and `title`.

### Attachment Node

Attachment nodes represent a remote or externally reachable file link. They do not upload or store file bytes.

```ts
type AttachmentNodeData = {
  url: string
  fileName: PlainText
  fileSizeLabel?: PlainText
  mimeType?: PlainText
}
```

The first UI exposes `url` and `fileName`.

### Code Node

```ts
type CodeNodeData = {
  code: string
  language?: string
}
```

The code node uses a mature syntax highlighting library. The implementation plan will compare current `highlight.js` and `Shiki` documentation through Context7 before choosing the integration. Because automatic language detection is required, `highlight.js` is a likely candidate, but the plan should verify current package behavior, bundle impact, and Vue integration details.

The first UI exposes code editing. The renderer highlights the code with automatic language detection at render time. Rendering must not mutate the document just because a language was detected. The optional `language` field is reserved as a future explicit override or imported hint.

### Task Node

Task nodes are task list nodes, not single-task nodes.

```ts
type TaskNodeData = {
  items: Array<{
    id: string
    title: PlainText
    done: boolean
    notes?: PlainText
    dueDate?: string
    priority?: 'low' | 'normal' | 'high'
  }>
}
```

The first UI exposes multiple todo rows with `title` and `done`. `notes`, `dueDate`, and `priority` are schema-level extension fields only.

## Migration

`migrateMindDocument(input)` remains the single compatibility entry point. Its output target becomes v3.

Rules:

- Valid v3 input parses and returns as v3.
- Valid v2 input migrates to v3.
- Valid v1 input migrates to v3, either through a v1-to-v2 intermediate step or equivalent direct logic.
- Invalid input still throws schema validation errors.
- v2 `topic` nodes keep `type: 'topic'`.
- v2 `node.data.title` is preserved.
- v2 `node.style` becomes v3 `node.shellStyle`.
- v2 `node.size` is preserved when present.
- v2 `node.style.size` is not kept as a shell style field. If a v2 topic lacks explicit `node.size`, migration uses a deterministic default-size map for the old `sm`, `md`, and `lg` tokens to choose initial width and height, then discards the token.
- v3 `topic.contentStyle` receives the default topic content style.
- v3 nodes require explicit `size`.
- Old topic nodes without `size` receive default dimensions.
- v1 and v2 edge data migrates to the v3 edge contract without changing graph semantics.

Read boundaries migrate historical data:

- API repository reads from stored DB JSON.
- Web server response parsing.
- Web local draft parsing.

Write boundaries are strict:

- Save requests accept v3 documents only.
- API service and repository writes operate on v3 `MindDocument`.
- Web server saves and local draft saves write v3 only.
- `@mind-x/mind-engine` and the editor store accept and produce v3 only.

## Engine Commands

The engine adds generic node commands while keeping topic helpers for compatibility with current callers.

New command surface:

```ts
addRootNode({ id?, type, data? })
addChildNode({ parentId?, id?, type, data? })
updateNodeData({ nodeId, dataPatch })
setNodeShellStyle({ nodeId, stylePatch })
setNodeContentStyle({ nodeId, stylePatch })
resizeNodes({ nodeIds, sizePatch | delta })
```

Compatibility methods remain:

```ts
addRootTopic(input?)
addChildTopic(input?)
editNodeTitle(nodeId, title)
setSelectedNodeStyle(stylePatch)
```

The compatibility methods delegate to the generic commands. Existing keyboard and toolbar behavior that creates a topic can keep using topic-specific helpers.

Movement, selection, deletion, tree validation, undo, redo, and dirty tracking remain type-agnostic. They continue to operate on node ids and parent edges.

Resize behaves like drag preview:

- During pointer movement, update the visible document without pushing undo history.
- On resize end, commit the full resize as one undoable history entry.
- Resize is an outer shell capability shared by all node types.

## Web Component Model

Canvas nodes split into a shared shell and type-specific content.

```text
apps/web/src/features/editor/components/canvas/
  BaseNode.vue
  NodeRenderer.vue
  node-content/
    TopicNodeContent.vue
    ImageNodeContent.vue
    LinkNodeContent.vue
    AttachmentNodeContent.vue
    CodeNodeContent.vue
    TaskNodeContent.vue
```

`BaseNode.vue` owns:

- Absolute positioning.
- Shared size and shell style rendering.
- Selection state.
- Dragging.
- Resize handles.
- Double-click transition into edit mode.
- Non-editing event blocking for internal content.
- Commit and cancel coordination for content edits.

Content components own:

- Read-only rendering for their node type.
- Editing UI for their node type.
- Type-specific validation messages.
- Emitting data patches when edits commit.

`NodeRenderer.vue` chooses the content component by `node.type` and wraps it with `BaseNode`.

## Interaction Rules

Single-click selects a node and shows the floating inspector. It does not edit.

Double-click enters edit mode. The shell then lets the inner content component handle its own interactions.

When not editing, the shell blocks internal pointer and keyboard interactions that would otherwise trigger link navigation, input edits, checkbox changes, or code selection. This keeps node selection and dragging predictable.

When editing, internal components decide the editing experience:

- Topic: edit the title.
- Image: edit the image URL.
- Link: edit title and URL.
- Attachment: edit file name and URL.
- Code: edit code text.
- Task: edit todo text and toggle completion.

Committed edits become undoable document commands.

## Add Node Entry Points

The toolbar supports adding node types explicitly.

- A default add-root/add-child affordance keeps text/topic as the quick action.
- A dropdown lets the user choose text, image, link, attachment, code, or task.
- When the document has no root, the toolbar can add any node type as root.
- When a node is selected, the toolbar can add any node type as a child.

The context menu supports "Add child as..." for all node types.

The Tab shortcut keeps the current behavior and adds a text/topic child.

## Inspector

The inspector becomes type-aware.

Shared shell style controls appear for every selected node:

- Color token.
- Tone.
- Shape.
- Border.
- Shadow.

Width and height are controlled by canvas resize handles. The first inspector may display dimensions, but it should not reintroduce the old `style.size` token as a second source of sizing.

Type-specific content fields appear below the shared shell controls:

- Topic: title.
- Image: URL.
- Link: title and URL.
- Attachment: file name and URL.
- Code: code text.
- Task: todo rows with title and done.

Type-specific content style controls appear only where the first UI needs them. Types without useful content style controls still keep a default `contentStyle` in the schema.

## Rendering Defaults

Each type has a default size:

- Topic: compact text node.
- Image: larger visual node.
- Link: medium summary node.
- Attachment: medium file node.
- Code: medium-wide code block.
- Task: medium task list node.

Content fills the shell by default with `width: 100%` and `height: 100%`. Overflow behavior is type-specific and should remain readable inside the resized shell.

PNG export bounds use the v3 explicit node `size`.

## Error Handling

Schema validation rejects:

- Empty required plain-text fields.
- Invalid URLs for URL-backed nodes.
- Empty task lists when a task node is created.
- Unknown node types.
- Unknown shell style keys.
- Unknown content style keys for a node type.
- v1 or v2 documents submitted to the v3-only save endpoint.

Code text may be empty so a newly created code block can enter edit mode before content is typed.

Engine commands reject:

- Missing node ids.
- Duplicate node ids.
- Missing parents.
- Type-incompatible data patches.
- Type-incompatible content style patches.
- Invalid resize dimensions.

Content components show local validation messages for fields they edit. Unexpected engine errors are not swallowed by the store.

## Testing

Shared tests:

- v3 schema accepts every supported node type.
- v1 documents migrate to v3.
- v2 documents migrate to v3.
- Missing v3 sizes are filled during migration.
- v2 topic styles migrate to v3 shell styles.
- Save request schema accepts v3 and rejects v1/v2.
- Invalid URLs, empty required fields, and unknown style fields are rejected.

Engine tests:

- Add every node type as root and child.
- Every node type can have children.
- Node data updates are undoable.
- Shell style updates are undoable.
- Content style updates are undoable.
- Resize preview commits as one undoable history entry.
- Move, delete, selection, undo, and redo work across mixed node types.
- Topic compatibility helpers still create topic nodes.

Web tests:

- `NodeRenderer` dispatches by node type.
- `BaseNode` selects on single click.
- `BaseNode` enters edit mode on double click.
- Non-editing mode blocks inner link, checkbox, input, and code interactions.
- Editing mode lets content components emit data patches.
- Toolbar and context menu add the selected node type.
- Tab adds a topic child.
- Inspector renders shared shell controls and type-specific fields.
- PNG export bounds use explicit v3 node sizes.

## Acceptance Criteria

- `MindDocument` current schema is v3.
- `migrateMindDocument` returns v3 for v1, v2, and v3 inputs.
- New saves write v3 only.
- Text, image, link, attachment, code, and task nodes render on the canvas.
- All supported node types can be roots, parents, children, and leaves.
- The shared node shell owns selection, dragging, resizing, and edit-mode gating.
- Type-specific content components own their own rendering and editing.
- Toolbar, context menu, and Tab behavior match the agreed add-node rules.
- Code nodes use a mature highlighting library with automatic language detection.
- Tests cover schema, migration, engine commands, component dispatch, interaction gating, and export bounds.
