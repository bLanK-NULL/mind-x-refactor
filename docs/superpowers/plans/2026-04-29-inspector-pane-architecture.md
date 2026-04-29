# Inspector Pane Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor node inspection so `NodeInspector` owns shared BaseNode shell controls and dispatches all node-type-specific controls to dedicated inspector components.

**Architecture:** Keep `InspectorPanel` and `MindEditor` integration stable. Extract shared shell style controls into `NodeShellStyleInspector.vue`, create one inspector component per `MindNode` type under `components/inspectors/node-inspectors/`, and make `NodeInspector.vue` select the child inspector through an exhaustive `node.type` registry.

**Tech Stack:** Vue 3 single-file components, TypeScript, Ant Design Vue controls, Vitest source-boundary tests, `@mind-x/shared` discriminated union node types.

---

## File Structure

Create:

- `apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue`  
  Shared BaseNode shell style controls: color, tone, shape, border, and shadow.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`  
  Topic `data.title` and `contentStyle.textWeight` controls.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue`  
  Image `data.url`, `data.alt`, and `contentStyle.objectFit` controls.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue`  
  Link `data.title` and `data.url` controls. No `layout` control because it is fixed to `summary`.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue`  
  Attachment `data.fileName` and `data.url` controls. No `icon` control because it is fixed to `file`.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`  
  Code `data.code` and `contentStyle.wrap` controls.

- `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`  
  Task `data.items` and `contentStyle.density` controls.

- `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`  
  Source-boundary tests for the new inspector architecture.

Modify:

- `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`  
  Remove node-type field logic, render `NodeShellStyleInspector`, and dispatch to type inspectors through an exhaustive registry.

- `apps/web/src/features/editor/__tests__/editorControls.test.ts`  
  Keep the `MindEditor -> NodeInspector` wiring assertions, but replace old assertions that expect every field to live in `NodeInspector.vue`.

---

### Task 1: Extract Shared Node Shell Style Inspector

**Files:**

- Create: `apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue`
- Create: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`

- [ ] **Step 1: Write the failing shell inspector architecture test**

Create `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('node inspector architecture', () => {
  it('extracts BaseNode shell style controls into NodeShellStyleInspector', () => {
    const source = readEditorSource('../components/inspectors/NodeShellStyleInspector.vue')

    expect(source).toContain("import type { NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain('style: NodeShellStyle')
    expect(source).toContain('styleChange: [stylePatch: Partial<NodeShellStyle>]')
    expect(source).toContain('<ColorTokenPicker')
    expect(source).toContain('label="Color"')
    expect(source).toContain('label="Tone"')
    expect(source).toContain('label="Shape"')
    expect(source).toContain('label="Border"')
    expect(source).toContain('label="Shadow"')
    expect(source).toContain("emit('styleChange', { colorToken })")
    expect(source).toContain("emit('styleChange', { tone: tone as NodeShellStyle['tone'] })")
    expect(source).toContain("emit('styleChange', { shape: shape as NodeShellStyle['shape'] })")
    expect(source).toContain("emit('styleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })")
    expect(source).toContain("emit('styleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })")
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Expected: FAIL because `NodeShellStyleInspector.vue` does not exist yet.

- [ ] **Step 3: Implement `NodeShellStyleInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue`:

```vue
<script setup lang="ts">
import type { NodeShellStyle } from '@mind-x/shared'
import ColorTokenPicker from './ColorTokenPicker.vue'
import StyleField from './StyleField.vue'

defineProps<{
  style: NodeShellStyle
}>()

const emit = defineEmits<{
  styleChange: [stylePatch: Partial<NodeShellStyle>]
}>()

function emitToneChange(tone: unknown): void {
  emit('styleChange', { tone: tone as NodeShellStyle['tone'] })
}

function emitShapeChange(shape: unknown): void {
  emit('styleChange', { shape: shape as NodeShellStyle['shape'] })
}

function emitBorderStyleChange(borderStyle: unknown): void {
  emit('styleChange', { borderStyle: borderStyle as NodeShellStyle['borderStyle'] })
}

function emitShadowLevelChange(shadowLevel: unknown): void {
  emit('styleChange', { shadowLevel: shadowLevel as NodeShellStyle['shadowLevel'] })
}
</script>

<template>
  <section class="node-shell-style-inspector" aria-label="Node shell style inspector">
    <StyleField label="Color">
      <ColorTokenPicker
        :value="style.colorToken"
        @change="(colorToken) => emit('styleChange', { colorToken })"
      />
    </StyleField>
    <StyleField label="Tone">
      <a-segmented
        :options="['soft', 'solid', 'outline']"
        :value="style.tone"
        size="small"
        @change="emitToneChange"
      />
    </StyleField>
    <StyleField label="Shape">
      <a-select
        :value="style.shape"
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
        :value="style.borderStyle"
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
        :value="style.shadowLevel"
        size="small"
        @change="emitShadowLevelChange"
      />
    </StyleField>
  </section>
</template>

<style scoped>
.node-shell-style-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 4: Run the shell inspector test to verify it passes**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/components/inspectors/NodeShellStyleInspector.vue
git commit -m "refactor(web): extract node shell inspector"
```

---

### Task 2: Create Type-Specific Node Inspectors

**Files:**

- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`
- Create: `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`

- [ ] **Step 1: Extend the architecture test for all type-specific inspectors**

Append these tests inside the existing `describe('node inspector architecture', () => { ... })` block in `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`:

```ts
  it('provides a focused inspector for topic nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/TopicNodeInspector.vue')

    expect(source).toContain("type TopicNodeModel = Extract<MindNode, { type: 'topic' }>")
    expect(source).toContain('node: TopicNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('label="Title"')
    expect(source).toContain('label="Text"')
    expect(source).toContain("emit('contentChange', { title })")
    expect(source).toContain("emit('contentStyleChange', { textWeight })")
  })

  it('provides a focused inspector for image nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/ImageNodeInspector.vue')

    expect(source).toContain("type ImageNodeModel = Extract<MindNode, { type: 'image' }>")
    expect(source).toContain('node: ImageNodeModel')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('isValidOptionalPlainText')
    expect(source).toContain('label="URL"')
    expect(source).toContain('label="Alt"')
    expect(source).toContain('label="Fit"')
    expect(source).toContain("emit('contentChange', { url, alt: props.node.data.alt })")
    expect(source).toContain("emit('contentStyleChange', { objectFit: objectFit as ImageContentStyle['objectFit'] })")
  })

  it('provides a focused inspector for link nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/LinkNodeInspector.vue')

    expect(source).toContain("type LinkNodeModel = Extract<MindNode, { type: 'link' }>")
    expect(source).toContain('node: LinkNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('label="Title"')
    expect(source).toContain('label="URL"')
    expect(source).toContain("emit('contentChange', { title, url: props.node.data.url })")
    expect(source).toContain("emit('contentChange', { title: props.node.data.title, url })")
    expect(source).not.toContain('label="Layout"')
  })

  it('provides a focused inspector for attachment nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/AttachmentNodeInspector.vue')

    expect(source).toContain("type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>")
    expect(source).toContain('node: AttachmentNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('isValidWebUrl')
    expect(source).toContain('label="File"')
    expect(source).toContain('label="URL"')
    expect(source).toContain("emit('contentChange', { fileName, url: props.node.data.url })")
    expect(source).toContain("emit('contentChange', { fileName: props.node.data.fileName, url })")
    expect(source).not.toContain('label="Icon"')
  })

  it('provides a focused inspector for code nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/CodeNodeInspector.vue')

    expect(source).toContain("type CodeNodeModel = Extract<MindNode, { type: 'code' }>")
    expect(source).toContain('node: CodeNodeModel')
    expect(source).toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).toContain('isValidCode')
    expect(source).toContain('label="Code"')
    expect(source).toContain('label="Wrap"')
    expect(source).toContain("emit('contentChange', { code })")
    expect(source).toContain("emit('contentStyleChange', { wrap: checkedValue(event) })")
  })

  it('provides a focused inspector for task nodes', () => {
    const source = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(source).toContain("type TaskNodeModel = Extract<MindNode, { type: 'task' }>")
    expect(source).toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(source).toContain('node: TaskNodeModel')
    expect(source).toContain('isValidPlainText')
    expect(source).toContain('label="Tasks"')
    expect(source).toContain('label="Density"')
    expect(source).toContain('replaceTaskItem')
    expect(source).toContain("emit('contentChange', { items })")
    expect(source).toContain("emit('contentStyleChange', { density: density as TaskContentStyle['density'] })")
  })
```

- [ ] **Step 2: Run the expanded test to verify it fails**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Expected: FAIL because `node-inspectors/*NodeInspector.vue` files do not exist yet.

- [ ] **Step 3: Create `TopicNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/TopicNodeInspector.vue`:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateTitle(event: Event): void {
  const title = textValue(event).trim()
  if (isValidPlainText(title)) {
    emit('contentChange', { title })
  }
}

function emitTextWeightChange(textWeight: unknown): void {
  emit('contentStyleChange', { textWeight })
}
</script>

<template>
  <section class="topic-node-inspector" aria-label="Topic node inspector">
    <StyleField label="Title">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.title" size="small" @change="updateTitle" />
    </StyleField>
    <StyleField label="Text">
      <a-select
        :value="node.contentStyle.textWeight"
        size="small"
        @change="emitTextWeightChange"
      >
        <a-select-option value="regular">Regular</a-select-option>
        <a-select-option value="medium">Medium</a-select-option>
        <a-select-option value="bold">Bold</a-select-option>
      </a-select>
    </StyleField>
  </section>
</template>

<style scoped>
.topic-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 4: Create `ImageNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/ImageNodeInspector.vue`:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type ImageContentStyle, type MindNode } from '@mind-x/shared'
import { isValidOptionalPlainText, isValidWebUrl } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { url, alt: props.node.data.alt })
  }
}

function updateAlt(event: Event): void {
  const alt = textValue(event).trim()
  if (isValidOptionalPlainText(alt)) {
    emit('contentChange', { url: props.node.data.url, alt: alt || undefined })
  }
}

function emitObjectFitChange(objectFit: unknown): void {
  emit('contentStyleChange', { objectFit: objectFit as ImageContentStyle['objectFit'] })
}
</script>

<template>
  <section class="image-node-inspector" aria-label="Image node inspector">
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
    <StyleField label="Alt">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.alt" size="small" @change="updateAlt" />
    </StyleField>
    <StyleField label="Fit">
      <a-segmented
        :options="['cover', 'contain']"
        :value="node.contentStyle.objectFit"
        size="small"
        @change="emitObjectFitChange"
      />
    </StyleField>
  </section>
</template>

<style scoped>
.image-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 5: Create `LinkNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/LinkNodeInspector.vue`:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText, isValidWebUrl } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type LinkNodeModel = Extract<MindNode, { type: 'link' }>

const props = defineProps<{
  node: LinkNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateTitle(event: Event): void {
  const title = textValue(event).trim()
  if (isValidPlainText(title)) {
    emit('contentChange', { title, url: props.node.data.url })
  }
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { title: props.node.data.title, url })
  }
}
</script>

<template>
  <section class="link-node-inspector" aria-label="Link node inspector">
    <StyleField label="Title">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.title" size="small" @change="updateTitle" />
    </StyleField>
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
  </section>
</template>

<style scoped>
.link-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 6: Create `AttachmentNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/AttachmentNodeInspector.vue`:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidPlainText, isValidWebUrl } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type AttachmentNodeModel = Extract<MindNode, { type: 'attachment' }>

const props = defineProps<{
  node: AttachmentNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function updateFileName(event: Event): void {
  const fileName = textValue(event).trim()
  if (isValidPlainText(fileName)) {
    emit('contentChange', { fileName, url: props.node.data.url })
  }
}

function updateUrl(event: Event): void {
  const url = textValue(event).trim()
  if (isValidWebUrl(url)) {
    emit('contentChange', { fileName: props.node.data.fileName, url })
  }
}
</script>

<template>
  <section class="attachment-node-inspector" aria-label="Attachment node inspector">
    <StyleField label="File">
      <a-input :maxlength="PLAIN_TEXT_MAX_LENGTH" :value="node.data.fileName" size="small" @change="updateFileName" />
    </StyleField>
    <StyleField label="URL">
      <a-input :value="node.data.url" size="small" type="url" @change="updateUrl" />
    </StyleField>
  </section>
</template>

<style scoped>
.attachment-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 7: Create `CodeNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/CodeNodeInspector.vue`:

```vue
<script setup lang="ts">
import { CODE_NODE_CODE_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { isValidCode } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type CodeNodeModel = Extract<MindNode, { type: 'code' }>

defineProps<{
  node: CodeNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function updateCode(event: Event): void {
  const code = textValue(event)
  if (isValidCode(code)) {
    emit('contentChange', { code })
  }
}
</script>

<template>
  <section class="code-node-inspector" aria-label="Code node inspector">
    <StyleField label="Code">
      <a-textarea
        :maxlength="CODE_NODE_CODE_MAX_LENGTH"
        :value="node.data.code"
        :auto-size="{ minRows: 5, maxRows: 8 }"
        size="small"
        @change="updateCode"
      />
    </StyleField>
    <StyleField label="Wrap">
      <a-checkbox
        :checked="node.contentStyle.wrap"
        @change="(event: Event) => emit('contentStyleChange', { wrap: checkedValue(event) })"
      >
        Wrap long lines
      </a-checkbox>
    </StyleField>
  </section>
</template>

<style scoped>
.code-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
```

- [ ] **Step 8: Create `TaskNodeInspector.vue`**

Create `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode, type TaskContentStyle } from '@mind-x/shared'
import { isValidPlainText } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>
type TaskItem = TaskNodeModel['data']['items'][number]

const props = defineProps<{
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function replaceTaskItem(index: number, patch: Partial<TaskItem>): void {
  const items = props.node.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : { ...item }))
  if (items.every((item) => isValidPlainText(item.title))) {
    emit('contentChange', { items })
  }
}

function emitDensityChange(density: unknown): void {
  emit('contentStyleChange', { density: density as TaskContentStyle['density'] })
}
</script>

<template>
  <section class="task-node-inspector" aria-label="Task node inspector">
    <StyleField label="Tasks">
      <div class="task-node-inspector__tasks">
        <label v-for="(item, index) in node.data.items" :key="item.id" class="task-node-inspector__task">
          <a-checkbox
            :checked="item.done"
            @change="(event: Event) => replaceTaskItem(index, { done: checkedValue(event) })"
          />
          <a-input
            :maxlength="PLAIN_TEXT_MAX_LENGTH"
            :value="item.title"
            size="small"
            @change="(event: Event) => replaceTaskItem(index, { title: textValue(event).trim() })"
          />
        </label>
      </div>
    </StyleField>
    <StyleField label="Density">
      <a-segmented
        :options="['comfortable', 'compact']"
        :value="node.contentStyle.density"
        size="small"
        @change="emitDensityChange"
      />
    </StyleField>
  </section>
</template>

<style scoped>
.task-node-inspector {
  display: grid;
  gap: 10px;
}

.task-node-inspector__tasks {
  display: grid;
  gap: 6px;
}

.task-node-inspector__task {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}
</style>
```

- [ ] **Step 9: Run the type-specific inspector tests**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts
```

Expected: PASS.

- [ ] **Step 10: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/components/inspectors/node-inspectors
git commit -m "refactor(web): add typed node inspectors"
```

---

### Task 3: Refactor NodeInspector Into Shell Plus Registry Dispatcher

**Files:**

- Modify: `apps/web/src/features/editor/components/inspectors/NodeInspector.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`

- [ ] **Step 1: Add the failing dispatcher test**

Append this test inside `describe('node inspector architecture', () => { ... })` in `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`:

```ts
  it('keeps NodeInspector as the shell style host and exhaustive type dispatcher', () => {
    const source = readEditorSource('../components/inspectors/NodeInspector.vue')

    expect(source).toContain("import type { MindNode, NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain("import type { Component } from 'vue'")
    expect(source).toContain("import NodeShellStyleInspector from './NodeShellStyleInspector.vue'")
    expect(source).toContain("import AttachmentNodeInspector from './node-inspectors/AttachmentNodeInspector.vue'")
    expect(source).toContain("import CodeNodeInspector from './node-inspectors/CodeNodeInspector.vue'")
    expect(source).toContain("import ImageNodeInspector from './node-inspectors/ImageNodeInspector.vue'")
    expect(source).toContain("import LinkNodeInspector from './node-inspectors/LinkNodeInspector.vue'")
    expect(source).toContain("import TaskNodeInspector from './node-inspectors/TaskNodeInspector.vue'")
    expect(source).toContain("import TopicNodeInspector from './node-inspectors/TopicNodeInspector.vue'")
    expect(source).toContain('satisfies Record<MindNode[\\'type\\'], Component>')
    expect(source).toContain('attachment: AttachmentNodeInspector')
    expect(source).toContain('code: CodeNodeInspector')
    expect(source).toContain('image: ImageNodeInspector')
    expect(source).toContain('link: LinkNodeInspector')
    expect(source).toContain('task: TaskNodeInspector')
    expect(source).toContain('topic: TopicNodeInspector')
    expect(source).toContain('<NodeShellStyleInspector')
    expect(source).toContain(':style="node.shellStyle"')
    expect(source).toContain('<component')
    expect(source).toContain(':is="getInspectorComponent(node)"')
    expect(source).not.toMatch(/node\\.type\\s*===/)
    expect(source).not.toContain('v-else-if')
    expect(source).not.toContain('updateTopicTitle')
    expect(source).not.toContain('replaceTaskItem')
  })
```

- [ ] **Step 2: Update the old editor controls test to assert only external wiring**

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, replace the entire test named `lets NodeInspector edit shell style, content style, and type-specific node data` with:

```ts
  it('keeps NodeInspector as the selected node editing boundary', () => {
    const source = readEditorSource('../components/inspectors/NodeInspector.vue')

    expect(source).toContain("import type { MindNode, NodeShellStyle } from '@mind-x/shared'")
    expect(source).toContain('node: MindNode')
    expect(source).toContain('contentChange: [dataPatch: Record<string, unknown>]')
    expect(source).toContain('contentStyleChange: [stylePatch: Record<string, unknown>]')
    expect(source).toContain('shellStyleChange: [stylePatch: Partial<NodeShellStyle>]')
    expect(source).toContain('<NodeShellStyleInspector')
    expect(source).toContain('@style-change="(stylePatch: Partial<NodeShellStyle>) => emit(\\'shellStyleChange\\', stylePatch)"')
    expect(source).toContain('<component')
    expect(source).toContain('@content-change="(dataPatch: Record<string, unknown>) => emit(\\'contentChange\\', dataPatch)"')
    expect(source).toContain('@content-style-change="(stylePatch: Record<string, unknown>) => emit(\\'contentStyleChange\\', stylePatch)"')
    expect(source).not.toContain('CODE_NODE_CODE_MAX_LENGTH')
    expect(source).not.toContain('PLAIN_TEXT_MAX_LENGTH')
    expect(source).not.toContain('isValidCode')
    expect(source).not.toContain('isValidPlainText')
    expect(source).not.toContain('replaceTaskItem')
  })
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
```

Expected: FAIL because `NodeInspector.vue` still owns the old type-specific controls.

- [ ] **Step 4: Replace `NodeInspector.vue` with the registry dispatcher**

Replace `apps/web/src/features/editor/components/inspectors/NodeInspector.vue` with:

```vue
<script setup lang="ts">
import type { MindNode, NodeShellStyle } from '@mind-x/shared'
import type { Component } from 'vue'
import NodeShellStyleInspector from './NodeShellStyleInspector.vue'
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
</script>

<template>
  <section class="node-inspector" aria-label="Node inspector">
    <NodeShellStyleInspector
      :style="node.shellStyle"
      @style-change="(stylePatch: Partial<NodeShellStyle>) => emit('shellStyleChange', stylePatch)"
    />
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
</style>
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/web/src/features/editor/components/inspectors/NodeInspector.vue apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
git commit -m "refactor(web): dispatch node inspectors by type"
```

---

## Verification Checklist

After all tasks:

- Run `npm run typecheck`.
- Run `npm test`.
- Run `rg -n "node\\.type ===|v-else-if|updateTopicTitle|replaceTaskItem" apps/web/src/features/editor/components/inspectors/NodeInspector.vue` and expect no output.
- Run `rg -n "TopicNodeInspector|ImageNodeInspector|LinkNodeInspector|AttachmentNodeInspector|CodeNodeInspector|TaskNodeInspector" apps/web/src/features/editor/components/inspectors/NodeInspector.vue` and expect all six imports and registry entries.
- Run `git status --short` and confirm only intentional changes remain before final handoff.

## Self-Review

- Spec coverage: the plan covers the shared shell style inspector, all six type-specific node inspectors, `NodeInspector` registry dispatch, validation ownership, and test boundary changes.
- Placeholder scan: no placeholder markers or open-ended implementation instructions remain.
- Type consistency: `MindNode`, `NodeShellStyle`, `ImageContentStyle`, and `TaskContentStyle` names match the current shared exports; event names match the existing `MindEditor -> NodeInspector` contract.
