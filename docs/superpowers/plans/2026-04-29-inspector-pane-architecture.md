# Inspector Pane Architecture Implementation Plan

> Superseded correction, 2026-04-29: shared node shell controls now live inline in `NodeInspector.vue`. There is no separate shell-style inspector component.

**Goal:** Refactor node inspection so `NodeInspector` owns shared BaseNode shell controls and dispatches all node-type-specific controls to dedicated inspector components.

**Architecture:** Keep `InspectorPanel` and `MindEditor` integration stable. `NodeInspector.vue` renders shell style controls, then a divider, then a dynamic type-specific inspector selected through an exhaustive `node.type` registry.

**Final structure:**

```text
InspectorPanel
  EdgeInspector
  NodeInspector
    shell style controls
    divider
    TopicNodeInspector | ImageNodeInspector | LinkNodeInspector | AttachmentNodeInspector | CodeNodeInspector | TaskNodeInspector
```

## File Structure

Create or keep:

- `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`
- `apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue`
- `apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue`
- `apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue`
- `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`
- `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`
- `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`

Modify:

- `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- `apps/web/src/features/editor/__tests__/editorControls.test.ts`

## Implementation Summary

### Type-Specific Inspectors

Keep one focused component per `MindNode` type under `components/inspectors/node-inspectors/`.

- `TopicNodeInspector.vue`: topic `data.title` and `contentStyle.textWeight`.
- `ImageNodeInspector.vue`: image `data.url`, `data.alt`, and `contentStyle.objectFit`.
- `LinkNodeInspector.vue`: link `data.title` and `data.url`.
- `AttachmentNodeInspector.vue`: attachment `data.fileName` and `data.url`.
- `CodeNodeInspector.vue`: code `data.code` and `contentStyle.wrap`.
- `TaskNodeInspector.vue`: task `data.items` and `contentStyle.density`.

Fixed-literal style schemas can omit controls until they have more than one meaningful option, but the type-specific inspector file should still exist to preserve the architecture.

### NodeInspector

`NodeInspector.vue` should:

- Import `ColorTokenPicker.vue` and `StyleField.vue` directly.
- Render shell controls for `node.shellStyle.colorToken`, `tone`, `shape`, `borderStyle`, and `shadowLevel`.
- Emit `shellStyleChange` directly from those shell controls.
- Render `<a-divider class="node-inspector__divider" />` after the shell controls.
- Dispatch to the selected type-specific inspector with `<component :is="getInspectorComponent(node)" :node="node" />`.
- Forward child `contentChange` and `contentStyleChange` events unchanged.

`NodeInspector.vue` should not:

- Import or render a separate shell-style inspector component.
- Contain `node.type === ...` template checks.
- Contain `v-else-if` type branches.
- Contain old type-specific helper logic such as `updateTopicTitle` or `replaceTaskItem`.

### Registry

Use an exhaustive component registry:

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

## Test Updates

`nodeInspectorArchitecture.test.ts` should assert:

- `NodeInspector.vue` imports `ColorTokenPicker.vue` and `StyleField.vue` directly.
- `NodeInspector.vue` contains `<ColorTokenPicker`.
- `NodeInspector.vue` contains `<a-divider class="node-inspector__divider" />`.
- `NodeInspector.vue` imports and registers all six type-specific inspectors.
- `NodeInspector.vue` contains `<component` and `:is="getInspectorComponent(node)"`.
- `NodeInspector.vue` does not contain `node.type ===`, `v-else-if`, `updateTopicTitle`, or `replaceTaskItem`.

`editorControls.test.ts` should keep the `MindEditor -> NodeInspector` wiring assertions and assert that `NodeInspector.vue` remains the selected-node editing boundary.

## Verification

Run:

```bash
rg -n "<removed shell inspector component name>" apps docs
rg -n "node\\.type ===|v-else-if|updateTopicTitle|replaceTaskItem" apps/web/src/features/editor/components/inspectors/NodeInspector.vue
rg -n "TopicNodeInspector|ImageNodeInspector|LinkNodeInspector|AttachmentNodeInspector|CodeNodeInspector|TaskNodeInspector" apps/web/src/features/editor/components/inspectors/NodeInspector.vue
npm run typecheck
npm test
```

Expected:

- The first command has no output.
- The second command has no output.
- The third command shows all six imports and all six registry entries.
- Typecheck and tests exit 0.
