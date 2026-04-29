# Node Content Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine NodeContent behavior so code blocks use fixed readable highlighting with vertical scrolling, task blocks own their task-item interactions, and image blocks can preview via Space.

**Architecture:** Keep `NodeRenderer.vue` as the event bridge from type-specific content components to `editor.updateNodeData`. Move task item data editing out of the inspector and into `TaskNodeContent.vue`; keep inspector responsibility limited to shell style and type-specific presentation style. Preserve `TopicNodeContent.vue` inline title editing as-is and add regression coverage around the updated content boundaries.

**Tech Stack:** Vue 3 single-file components, TypeScript, Pinia editor store bridge, Vitest source/SSR tests, `@mind-x/shared` node schemas, current `highlight.js` wrapper.

---

## File Structure

Modify:

- `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`  
  Remove theme-token-driven syntax colors and make the code viewport vertically scrollable.
- `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`  
  Add task item add/delete/toggle/title editing UI and emit `commit` data patches.
- `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`  
  Add focusable Space-key preview behavior and a lightweight teleported image preview overlay.
- `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`  
  Pass selection state only to image content so selected image nodes can receive Space.
- `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`  
  Remove task item data editing controls; keep density style control only.
- `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`  
  Update content ownership tests for interactive tasks and image preview.
- `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`  
  Update task inspector architecture expectations.
- `apps/web/src/features/editor/__tests__/editorControls.test.ts`  
  Keep the generic NodeInspector boundary test aligned with the new task ownership.

Do not modify:

- `apps/web/src/features/editor/components/canvas/node-content/TopicNodeContent.vue`; the current inline title editing already belongs in the content component and should be preserved.
- `packages/shared/src/document.ts`; the existing task schema remains valid because task nodes still store `data.items`.
- `packages/mind-engine/src/commands.ts`; `updateNodeDataCommand` already validates merged node data through `mindDocumentSchema`.

---

### Task 1: Make CodeNodeContent Theme-Independent And Scrollable

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Write failing source-boundary tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add this test inside `describe('NodeRenderer', () => { ... })`:

```ts
  it('keeps code highlighting fixed and vertically scrollable without theme-token coloring', () => {
    const source = readNodeContentSource('CodeNodeContent')

    expect(source).toContain('overflow-y: auto')
    expect(source).toContain('overflow-x: auto')
    expect(source).toContain('scrollbar-gutter: stable')
    expect(source).toContain('background: #111827')
    expect(source).toContain('color: #e5e7eb')
    expect(source).toContain(':deep(.hljs-keyword)')
    expect(source).toContain('color: #93c5fd')
    expect(source).not.toContain('var(--color-primary)')
    expect(source).not.toContain('var(--color-success)')
    expect(source).not.toContain('currentColor 58%')
    expect(source).not.toContain('background: transparent')
  })
```

Also update the existing `keeps non-topic content read-only on the canvas` test by removing these assertions because task content will become interactive in Task 2:

```ts
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('type TaskItem')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('replaceItem')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__input')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__done')
    expect(readNodeContentSource('TaskNodeContent')).not.toContain('task-node__error')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: FAIL because `CodeNodeContent.vue` still uses theme variables and `overflow: hidden`.

- [ ] **Step 3: Replace CodeNodeContent styles**

In `apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue`, keep the `<script setup>` and `<template>` unchanged. Replace the entire `<style scoped>` block with:

```vue
<style scoped>
.code-node__content {
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
}

.code-node__pre {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  overflow-y: auto;
  border-radius: 4px;
  background: #111827;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  scrollbar-gutter: stable;
  white-space: pre;
}

.code-node__code--wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.hljs {
  display: block;
  color: #e5e7eb;
}

:deep(.hljs-keyword),
:deep(.hljs-built_in),
:deep(.hljs-title),
:deep(.hljs-title.function_),
:deep(.hljs-attr) {
  color: #93c5fd;
}

:deep(.hljs-string),
:deep(.hljs-number),
:deep(.hljs-literal) {
  color: #86efac;
}

:deep(.hljs-comment) {
  color: #9ca3af;
}
</style>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/components/canvas/node-content/CodeNodeContent.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): make code node content scrollable"
```

---

### Task 2: Move Task Item Interactions Into TaskNodeContent

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue`
- Modify: `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`
- Modify: `apps/web/src/features/editor/__tests__/editorControls.test.ts`

- [ ] **Step 1: Write failing TaskNodeContent ownership tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add this test inside `describe('NodeRenderer', () => { ... })`:

Add this helper near `readNodeContentSource` first:

```ts
function readEditorSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}
```

```ts
  it('keeps task item interactions inside TaskNodeContent instead of the inspector pane', () => {
    const taskContentSource = readNodeContentSource('TaskNodeContent')
    const taskInspectorSource = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(taskContentSource).toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(taskContentSource).toContain('commit: [dataPatch: Record<string, unknown>]')
    expect(taskContentSource).toContain('function createNextTaskId')
    expect(taskContentSource).toContain('function commitItems')
    expect(taskContentSource).toContain('function addTaskItem')
    expect(taskContentSource).toContain('function deleteTaskItem')
    expect(taskContentSource).toContain('function toggleTaskItem')
    expect(taskContentSource).toContain('function commitTaskTitle')
    expect(taskContentSource).toContain("emit('commit', { items: nextItems })")
    expect(taskContentSource).toContain('task-node__input')
    expect(taskContentSource).toContain('task-node__add')
    expect(taskContentSource).toContain('task-node__delete')
    expect(taskContentSource).toContain('@pointerdown.stop')
    expect(taskContentSource).toContain('@keydown.enter.prevent')
    expect(taskContentSource).toContain('@keydown.esc.prevent')

    expect(taskInspectorSource).not.toContain("type TaskItem = TaskNodeModel['data']['items'][number]")
    expect(taskInspectorSource).not.toContain('contentChange')
    expect(taskInspectorSource).not.toContain('replaceTaskItem')
    expect(taskInspectorSource).not.toContain('label="Tasks"')
    expect(taskInspectorSource).not.toContain('<a-input')
    expect(taskInspectorSource).not.toContain('<a-checkbox')
    expect(taskInspectorSource).toContain('label="Density"')
    expect(taskInspectorSource).toContain('contentStyleChange')
  })
```

In `apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts`, replace the current `provides a focused inspector for task nodes` test body with:

```ts
    const source = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(source).toContain("type TaskNodeModel = Extract<MindNode, { type: 'task' }>")
    expect(source).toContain('node: TaskNodeModel')
    expect(source).toContain('label="Density"')
    expect(source).toContain("emit('contentStyleChange', { density: density as TaskContentStyle['density'] })")
    expect(source).not.toContain('label="Tasks"')
    expect(source).not.toContain('contentChange')
    expect(source).not.toContain('replaceTaskItem')
    expect(source).not.toContain('<a-input')
    expect(source).not.toContain('<a-checkbox')
```

In `apps/web/src/features/editor/__tests__/editorControls.test.ts`, keep the existing `keeps NodeInspector as the selected node editing boundary` assertions and add:

```ts
    const taskInspectorSource = readEditorSource('../components/inspectors/node-inspectors/TaskNodeInspector.vue')

    expect(taskInspectorSource).toContain('contentStyleChange')
    expect(taskInspectorSource).not.toContain('contentChange')
    expect(taskInspectorSource).not.toContain('replaceTaskItem')
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
```

Expected: FAIL because `TaskNodeContent.vue` is still read-only and `TaskNodeInspector.vue` still owns item editing.

- [ ] **Step 3: Replace TaskNodeContent.vue**

Replace `apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue` with:

```vue
<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'
import { isValidPlainText } from '../../../utils/nodeValidation'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>
type TaskItem = TaskNodeModel['data']['items'][number]

const props = defineProps<{
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  commit: [dataPatch: Record<string, unknown>]
}>()

const draftTitles = ref<Record<string, string>>(createDraftTitles(props.node.data.items))
const editError = ref('')
const pendingFocusId = ref<string | null>(null)
const inputRefs = new Map<string, HTMLInputElement>()

watch(
  () => props.node.data.items,
  (items) => {
    draftTitles.value = createDraftTitles(items)
    if (pendingFocusId.value) {
      void focusPendingInput()
    }
  },
  { deep: true }
)

function createDraftTitles(items: TaskItem[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.title]))
}

function setInputRef(itemId: string, element: HTMLInputElement | null): void {
  if (element) {
    inputRefs.set(itemId, element)
  } else {
    inputRefs.delete(itemId)
  }
}

async function focusPendingInput(): Promise<void> {
  const itemId = pendingFocusId.value
  if (!itemId) {
    return
  }

  await nextTick()
  const input = inputRefs.get(itemId)
  input?.focus()
  input?.select()
  pendingFocusId.value = null
}

function createNextTaskId(items: TaskItem[]): string {
  const existingIds = new Set(items.map((item) => item.id))
  let index = items.length + 1
  while (existingIds.has(`task-${index}`)) {
    index += 1
  }
  return `task-${index}`
}

function cloneItems(): TaskItem[] {
  return props.node.data.items.map((item) => ({ ...item }))
}

function commitItems(nextItems: TaskItem[]): void {
  if (nextItems.length === 0 || !nextItems.every((item) => isValidPlainText(item.title))) {
    return
  }

  editError.value = ''
  emit('commit', { items: nextItems })
}

function addTaskItem(): void {
  const nextId = createNextTaskId(props.node.data.items)
  pendingFocusId.value = nextId
  commitItems([
    ...cloneItems(),
    {
      id: nextId,
      title: 'New task',
      done: false
    }
  ])
}

function deleteTaskItem(itemId: string): void {
  if (props.node.data.items.length <= 1) {
    return
  }

  commitItems(cloneItems().filter((item) => item.id !== itemId))
}

function toggleTaskItem(itemId: string, done: boolean): void {
  commitItems(cloneItems().map((item) => (item.id === itemId ? { ...item, done } : item)))
}

function commitTaskTitle(item: TaskItem): void {
  const title = (draftTitles.value[item.id] ?? '').trim()
  if (!isValidPlainText(title)) {
    editError.value = 'Use non-empty plain text.'
    draftTitles.value = {
      ...draftTitles.value,
      [item.id]: item.title
    }
    return
  }

  if (title === item.title) {
    editError.value = ''
    return
  }

  commitItems(cloneItems().map((candidate) => (candidate.id === item.id ? { ...candidate, title } : candidate)))
}

function cancelTaskTitleEdit(item: TaskItem): void {
  editError.value = ''
  draftTitles.value = {
    ...draftTitles.value,
    [item.id]: item.title
  }
}
</script>

<template>
  <div class="task-node__content" :class="`task-node__content--${node.contentStyle.density}`">
    <div v-for="item in node.data.items" :key="item.id" class="task-node__item">
      <input
        class="task-node__checkbox"
        :checked="item.done"
        type="checkbox"
        @change="(event: Event) => toggleTaskItem(item.id, (event.target as HTMLInputElement).checked)"
        @pointerdown.stop
      />
      <input
        :ref="(element) => setInputRef(item.id, element as HTMLInputElement | null)"
        v-model="draftTitles[item.id]"
        class="task-node__input"
        :class="{ 'task-node__input--done': item.done }"
        :maxlength="PLAIN_TEXT_MAX_LENGTH"
        @blur="commitTaskTitle(item)"
        @keydown.enter.prevent="commitTaskTitle(item)"
        @keydown.esc.prevent="cancelTaskTitleEdit(item)"
        @pointerdown.stop
      />
      <button
        aria-label="Delete task"
        class="task-node__delete"
        :disabled="node.data.items.length <= 1"
        type="button"
        @click.stop="deleteTaskItem(item.id)"
        @pointerdown.stop
      >
        -
      </button>
    </div>
    <button class="task-node__add" type="button" @click.stop="addTaskItem" @pointerdown.stop>
      Add task
    </button>
    <span v-if="editError" class="task-node__error">{{ editError }}</span>
  </div>
</template>

<style scoped>
.task-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.task-node__content--comfortable {
  gap: 7px;
}

.task-node__content--compact {
  gap: 4px;
}

.task-node__item {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.task-node__checkbox {
  width: 14px;
  height: 14px;
  margin: 0;
}

.task-node__input {
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: 0;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1.25;
}

.task-node__input:focus {
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.task-node__input--done {
  color: color-mix(in srgb, currentColor 58%, transparent);
  text-decoration: line-through;
}

.task-node__delete,
.task-node__add {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font-size: 12px;
  line-height: 1.2;
}

.task-node__delete {
  width: 22px;
  height: 22px;
  padding: 0;
}

.task-node__delete:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.task-node__add {
  align-self: flex-start;
  padding: 3px 7px;
}

.task-node__error {
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 4: Replace TaskNodeInspector.vue**

Replace `apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue` with:

```vue
<script setup lang="ts">
import type { MindNode, TaskContentStyle } from '@mind-x/shared'
import StyleField from '../StyleField.vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>

defineProps<{
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function emitDensityChange(density: unknown): void {
  emit('contentStyleChange', { density: density as TaskContentStyle['density'] })
}
</script>

<template>
  <section class="task-node-inspector" aria-label="Task node inspector">
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
</style>
```

- [ ] **Step 5: Run focused tests and verify they pass**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/editor/components/canvas/node-content/TaskNodeContent.vue apps/web/src/features/editor/components/inspectors/node-inspectors/TaskNodeInspector.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts apps/web/src/features/editor/__tests__/nodeInspectorArchitecture.test.ts apps/web/src/features/editor/__tests__/editorControls.test.ts
git commit -m "feat(web): move task editing into task node content"
```

---

### Task 3: Add Space-Key Image Preview

**Files:**

- Modify: `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`
- Modify: `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue`
- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Write failing image preview tests**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, add this test inside `describe('NodeRenderer', () => { ... })`:

```ts
  it('supports selected image node preview from the Space key', () => {
    const rendererSource = readNodeRendererSource()
    const imageSource = readNodeContentSource('ImageNodeContent')

    expect(rendererSource).toContain('const props = defineProps')
    expect(rendererSource).toContain('function getContentProps(node: MindNode)')
    expect(rendererSource).toContain("node.type === 'image'")
    expect(rendererSource).toContain('selected: props.selectedNodeIds.includes(node.id)')
    expect(rendererSource).toContain('v-bind="getContentProps(node)"')

    expect(imageSource).toContain('selected?: boolean')
    expect(imageSource).toContain('const previewOpen = ref(false)')
    expect(imageSource).toContain('const previewRootRef = ref<HTMLElement | null>(null)')
    expect(imageSource).toContain('function openPreview')
    expect(imageSource).toContain('function closePreview')
    expect(imageSource).toContain('@keydown.space.prevent.stop="openPreview"')
    expect(imageSource).toContain('<Teleport to="body">')
    expect(imageSource).toContain('role="dialog"')
    expect(imageSource).toContain('aria-modal="true"')
    expect(imageSource).toContain('@keydown.esc.prevent.stop="closePreview"')
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: FAIL because `NodeRenderer.vue` does not pass image selection state and `ImageNodeContent.vue` has no preview overlay.

- [ ] **Step 3: Update NodeRenderer.vue to pass selected state only to images**

In `apps/web/src/features/editor/components/canvas/NodeRenderer.vue`, change the props declaration from a bare call to a named constant:

```ts
const props = defineProps<{
  nodes: MindNode[]
  selectedNodeIds: string[]
}>()
```

Add this function below `getContentComponent`:

```ts
function getContentProps(node: MindNode): { node: MindNode; selected?: boolean } {
  if (node.type === 'image') {
    return {
      node,
      selected: props.selectedNodeIds.includes(node.id)
    }
  }

  return { node }
}
```

Update the dynamic component in the template from:

```vue
        :node="node"
```

to:

```vue
        v-bind="getContentProps(node)"
```

Keep the existing `@commit` and `@inspect` event listeners unchanged.

- [ ] **Step 4: Replace ImageNodeContent.vue**

Replace `apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue` with:

```vue
<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'

type ImageNodeModel = Extract<MindNode, { type: 'image' }>

const props = defineProps<{
  node: ImageNodeModel
  selected?: boolean
}>()

const objectFit = computed(() => props.node.contentStyle.objectFit)
const previewLabel = computed(() => {
  const label = props.node.data.alt?.trim() || 'image'
  return `Preview ${label}`
})
const previewOpen = ref(false)
const previewRootRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

watch(
  () => props.selected,
  async (selected) => {
    if (selected) {
      await nextTick()
      previewRootRef.value?.focus({ preventScroll: true })
    }
  }
)

watch(previewOpen, async (open) => {
  await nextTick()
  if (open) {
    closeButtonRef.value?.focus()
  } else if (props.selected) {
    previewRootRef.value?.focus({ preventScroll: true })
  }
})

function openPreview(): void {
  previewOpen.value = true
}

function closePreview(): void {
  previewOpen.value = false
}
</script>

<template>
  <div
    ref="previewRootRef"
    class="image-node__content"
    role="button"
    tabindex="0"
    :aria-label="previewLabel"
    @keydown.space.prevent.stop="openPreview"
  >
    <img
      class="image-node__image"
      :alt="node.data.alt ?? ''"
      draggable="false"
      :src="node.data.url"
      :style="{ objectFit }"
      @dragstart.prevent
    />
    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="image-node-preview"
        role="dialog"
        aria-modal="true"
        :aria-label="previewLabel"
        @click.self="closePreview"
        @keydown.esc.prevent.stop="closePreview"
      >
        <button
          ref="closeButtonRef"
          aria-label="Close image preview"
          class="image-node-preview__close"
          data-editor-control
          type="button"
          @click="closePreview"
          @pointerdown.stop
        >
          Close
        </button>
        <img class="image-node-preview__image" :alt="node.data.alt ?? ''" :src="node.data.url" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.image-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  justify-content: center;
  outline: 0;
}

.image-node__content:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.image-node__image {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 4px;
}

.image-node-preview {
  position: fixed;
  z-index: 1000;
  display: grid;
  place-items: center;
  inset: 0;
  padding: 40px;
  background: rgb(15 23 42 / 78%);
}

.image-node-preview__image {
  max-width: min(96vw, 1200px);
  max-height: 88vh;
  border-radius: 6px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 34%);
  object-fit: contain;
}

.image-node-preview__close {
  position: fixed;
  top: 18px;
  right: 18px;
  padding: 7px 10px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 4px;
  background: rgb(15 23 42 / 88%);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
</style>
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
npm run typecheck -w apps/web
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/editor/components/canvas/NodeRenderer.vue apps/web/src/features/editor/components/canvas/node-content/ImageNodeContent.vue apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "feat(web): add image node keyboard preview"
```

---

### Task 4: Preserve TopicNodeContent Boundary And Run Full Verification

**Files:**

- Modify: `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`

- [ ] **Step 1: Add a regression test for TopicNodeContent staying self-contained**

In `apps/web/src/features/editor/__tests__/nodeRenderer.test.ts`, extend the existing `keeps topic inline editing inside TopicNodeContent` test with these assertions:

```ts
    expect(source).toContain('validateTitle')
    expect(source).toContain('titleInputRef')
    expect(source).toContain('@keydown.enter.prevent="commitEdit"')
    expect(source).toContain('@keydown.esc.prevent="cancelEdit"')
    expect(source).toContain('@pointerdown.stop')
    expect(source).not.toContain('selected?: boolean')
    expect(source).not.toContain('previewOpen')
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the relevant web editor test suite**

Run:

```bash
npm test -- apps/web/src/features/editor/__tests__
```

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/editor/__tests__/nodeRenderer.test.ts
git commit -m "test(web): lock node content ownership boundaries"
```

---

## Manual Verification

After automated verification passes, run the web app:

```bash
npm run dev:web
```

Open the local Vite URL and verify:

- A code node with many lines shows a vertical scrollbar inside the node.
- Code token colors stay the same when the global theme changes.
- A task node allows checking items, editing titles, adding an item, and deleting items directly on the node.
- The task inspector no longer shows task item rows; it only shows density.
- Selecting an image node focuses it; pressing Space opens the image preview.
- Escape, clicking the preview backdrop, or the Close button closes the image preview.
- Topic nodes still double-click into title editing and still commit with Enter/cancel with Escape.

## Self-Review

Spec coverage:

- CodeNodeContent fixed, non-theme highlighting: Task 1.
- CodeNodeContent vertical scrolling: Task 1.
- TaskNodeContent add/delete/modify/toggle interactions: Task 2.
- Task item interaction no longer controlled by inspector pane: Task 2.
- ImageNodeContent Space preview: Task 3.
- TopicNodeContent named in the request with no new behavior: Task 4 preserves the current self-contained topic editing boundary.

Placeholder scan:

- No banned placeholder wording or unspecified edge-handling steps remain.
- Every implementation step names exact files and exact code to insert or replace.

Type consistency:

- Content components emit `commit` data patches because `NodeRenderer.vue` already translates content `commit` events into `editCommit` for `MindEditor.vue`.
- `TaskItem` is consistently `TaskNodeModel['data']['items'][number]`.
- `selected?: boolean` is only introduced for `ImageNodeContent.vue`, and `NodeRenderer.vue` passes it only for image nodes through `getContentProps`.
