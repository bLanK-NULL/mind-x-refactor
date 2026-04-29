# Inline Node Shell Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unnecessary `NodeShellStyleInspector.vue` component and make `NodeInspector.vue` directly own the shared BaseNode shell style controls.

**Architecture:** `NodeInspector.vue` is the node shell inspector pane. It renders shared shell controls for `node.shellStyle` at the top, a divider in the middle, and the selected type-specific `*NodeInspector` below. Type-specific inspectors remain split under `components/inspectors/node-inspectors/`.

**Tech Stack:** Vue 3 single-file components, TypeScript, Ant Design Vue controls, Vitest source-boundary tests, `@mind-x/shared` node style types.

---

## File Structure

Delete:

- `apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue`

Modify:

- `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- `apps/web/src/features/editor/__tests__/editorControls.test.ts`
- `docs/superpowers/specs/2026-04-29-inspector-pane-architecture-design.md`
- `docs/superpowers/plans/2026-04-29-inspector-pane-architecture.md`

---

### Task 1: Inline Shell Controls In NodeInspector

**Files:**

- Modify: `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- Delete: `apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue`

- [ ] **Step 1: Replace `NodeInspector.vue`**

Replace `apps/web/src/features/editor/components/inspectors/NodeInspector.vue` with:

```vue
<script setup lang="ts">
import type { MindNode, NodeShellStyle } from '@mind-x/shared'
import type { Component } from 'vue'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'
import AttachmentNodeInspector from './node-inspectors/AttachmentNodeInspector.vue'
import CodeNodeInspector from './node-inspectors/CodeNodeInspector.vue'
import ImageNodeInspector from './node-inspectors/ImageNodeInspector.vue'
import LinkNodeInspector from './node-inspectors/LinkNodeInspector.vue'
import TaskNodeInspector from './node-inspectors/TaskNodeInspector.vue'
import TopicNodeInspector from './node-inspectors/TopicNodeInspector.vue'

defineProps<{
  node: MindNode
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
  shellStyleChange: [stylePatch: Partial<NodeShellStyle>]
}>()

const inspectorComponentByType = {
  attachment: AttachmentNodeInspector,
  code: CodeNodeInspector,
  image: ImageNodeInspector,
  link: LinkNodeInspector,
  task: TaskNodeInspector,
  topic: TopicNodeInspector
} satisfies Record<MindNode['type'], Component>

function getInspectorComponent(node: MindNode): Component {
  return inspectorComponentByType[node.type]
}

function emitToneChange(tone: unknown): void {
  emit('shellStyleChange', { tone: tone as NodeShellStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('shellStyleChange', { shape: shape as NodeShellStyle['shape'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('shellStyleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('shellStyleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })
}
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <StyleField label="Color">
      <ColorTokenPicker
        :value="node.shellStyle.colorToken"
        @change="(colorToken) => emit('shellStyleChange', { colorToken })"
      />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="node.shellStyle.tone"
        size="small"
        @change="emitToneChange"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="node.shellStyle.shape"
        size="small"
        @change="emitShapeChange"
      >
        <a-select-option value="rounded">Rounded</a-select-option>
        <a-select-option value="rectangle">Rectangle</a-select-option>
        <a-select-option value="pill">Pill</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Border">
      <a-select
        :value="node.shellStyle.borderStyle"
        size="small"
        @change="emitBorderStyleChange"
      >
        <a-select-option value="none">None</a-select-option>
        <a-select-option value="solid">Solid</a-select-option>
        <a-select-option value="dashed">Dashed</a-select-option>
      </a-select>
    </StyleField>
    <StyleField label="Shadow">
      <a-segmented
        :options="['none', 'sm', 'md']"
        :value="node.shellStyle.shadowLevel"
        size="small"
        @change="emitShadowLevelChange"
      />
    </StyleField>
    <a-divider class="node-inspector__divider" />
    <component
      :is="getInspectorComponent(node)"
      :node="node"
      @content-change="(dataPatch: Record<string, unknown>) => emit('contentChange', dataPatch)"
      @content-style-change="(stylePatch: Record<string, unknown>) => emit('contentStyleChange', stylePatch)"
    />
  </section>
</template>

<style scoped>
.node-inspector {
  display: grid;
  gap: 10px;
}

.node-inspector__divider {
  margin: 2px 0;
}
</style>
```

- [ ] **Step 2: Delete `NodeShellStyleInspector.vue`**

Run:

```bash
rm apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue
```

---

### Task 2: Update Tests And Docs

**Files:**

- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`
- Modify: `docs/superpowers/specs/2026-04-29-inspector-pane-architecture-design.md`
- Modify: `docs/superpowers/plans/2026-04-29-inspector-pane-architecture.md`

- [ ] **Step 1: Update tests**

Update tests so they assert:

```ts
expect(source).toContain("import ColorTokenPicker from './ColorTokenPicker.vue'")
expect(source).toContain("import StyleField from './StyleField.vue'")
expect(source).not.toContain('NodeShellStyleInspector')
expect(source).toContain('<ColorTokenPicker')
expect(source).toContain('<a-divider class="node-inspector__divider" />')
expect(source).toContain('<component')
expect(source).toContain(':is="getInspectorComponent(node)"')
expect(source).not.toMatch(/node\.type\s*===/)
expect(source).not.toContain('v-else-if')
expect(source).not.toContain('replaceTaskItem')
```

Keep the existing assertions that all six `*NodeInspector` imports and registry entries exist.

- [ ] **Step 2: Update docs**

In both planning docs, remove instructions to create/import `NodeShellStyleInspector.vue`. State the final structure as:

```text
InspectorPanel
  EdgeInspector
  NodeInspector
    shell style controls
    divider
    TopicNodeInspector | ImageNodeInspector | LinkNodeInspector | AttachmentNodeInspector | CodeNodeInspector | TaskNodeInspector
```

- [ ] **Step 3: Verify no stale references**

Run:

```bash
rg -n "NodeShellStyleInspector" apps docs
```

Expected: no output.

---

### Task 3: Final Verification

**Files:**

- Verify repository state.

- [ ] **Step 1: Run guard searches**

Run:

```bash
rg -n "node\\.type ===|v-else-if|updateTopicTitle|replaceTaskItem" apps/web/src/features/editor/components/inspectors/NodeInspector.vue
rg -n "TopicNodeInspector|ImageNodeInspector|LinkNodeInspector|AttachmentNodeInspector|CodeNodeInspector|TaskNodeInspector" apps/web/src/features/editor/components/inspectors/NodeInspector.vue
```

Expected: first command has no output; second command shows all six imports and all six registry entries.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: both commands exit 0.

---

## Self-Review

- Spec coverage: this plan removes the shell component, keeps type inspectors split, places shell controls above a divider, and updates tests/docs.
- Placeholder scan: no placeholder markers or open-ended implementation steps remain.
- Type consistency: `MindNode`, `NodeShellStyle`, `Component`, `contentChange`, `contentStyleChange`, and `shellStyleChange` match current code.
