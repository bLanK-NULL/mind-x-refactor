# Inspector Position Session Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember the floating inspector's last dragged position within the current browser tab session.

**Architecture:** Add a focused editor UI helper for inspector position defaults, clamping, and `sessionStorage` persistence. Make `InspectorPanel.vue` a controlled floating frame that receives position and emits drag updates, then let `MindEditor.vue` own one shared position for both node and edge inspectors.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Vitest, browser `sessionStorage`, existing `Point` type from `@mind-x/shared`.

---

## File Structure

- Create `apps/web/src/components/editor/inspectorPosition.ts`: owns the default position, storage key, minimum offset, clamping, safe reads from `sessionStorage`, and safe writes to `sessionStorage`.
- Create `apps/web/src/components/editor/inspectorPosition.test.ts`: covers default fallback, valid reads, invalid stored data, clamping, successful writes, and storage exceptions.
- Modify `apps/web/src/components/editor/InspectorPanel.vue`: remove internal persistent `position`, accept a `position` prop, maintain only transient drag state, and emit `position-change`.
- Modify `apps/web/src/components/editor/MindEditor.vue`: initialize one shared inspector position from the helper, persist every drag update, and pass the same position to node and edge inspector panels.

## Task 1: Inspector Position Storage Helper

**Files:**
- Create: `apps/web/src/components/editor/inspectorPosition.ts`
- Create: `apps/web/src/components/editor/inspectorPosition.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/editor/inspectorPosition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INSPECTOR_POSITION,
  INSPECTOR_MIN_OFFSET,
  INSPECTOR_POSITION_STORAGE_KEY,
  clampInspectorPosition,
  readStoredInspectorPosition,
  writeStoredInspectorPosition
} from './inspectorPosition'

class FakeInspectorPositionStorage {
  items = new Map<string, string>()
  failReads = false
  failWrites = false

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('read failed')
    }

    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('write failed')
    }

    this.items.set(key, value)
  }
}

describe('inspector position persistence', () => {
  it('returns the default position when storage has no value', () => {
    const storage = new FakeInspectorPositionStorage()

    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
  })

  it('reads a valid stored position', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify({ x: 180, y: 220 }))

    expect(readStoredInspectorPosition(storage)).toEqual({ x: 180, y: 220 })
  })

  it.each([
    ['malformed json', '{'],
    ['null', 'null'],
    ['missing x', '{"y": 20}'],
    ['missing y', '{"x": 20}'],
    ['string x', '{"x": "20", "y": 30}'],
    ['string y', '{"x": 20, "y": "30"}'],
    ['null x', '{"x": null, "y": 30}'],
    ['null y', '{"x": 20, "y": null}']
  ])('falls back to default for %s', (_label, storedValue) => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, storedValue)

    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
  })

  it('clamps loaded positions to the minimum top-left offset', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.items.set(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify({ x: -100, y: 2 }))

    expect(readStoredInspectorPosition(storage)).toEqual({
      x: INSPECTOR_MIN_OFFSET,
      y: INSPECTOR_MIN_OFFSET
    })
  })

  it('clamps arbitrary inspector positions', () => {
    expect(clampInspectorPosition({ x: 4, y: 320 })).toEqual({ x: INSPECTOR_MIN_OFFSET, y: 320 })
  })

  it('writes clamped positions to storage', () => {
    const storage = new FakeInspectorPositionStorage()

    expect(writeStoredInspectorPosition({ x: 64, y: -9 }, storage)).toBe(true)
    expect(storage.items.get(INSPECTOR_POSITION_STORAGE_KEY)).toBe(
      JSON.stringify({ x: 64, y: INSPECTOR_MIN_OFFSET })
    )
  })

  it('handles storage read and write failures without throwing', () => {
    const storage = new FakeInspectorPositionStorage()
    storage.failReads = true
    storage.failWrites = true

    expect(() => readStoredInspectorPosition(storage)).not.toThrow()
    expect(readStoredInspectorPosition(storage)).toEqual(DEFAULT_INSPECTOR_POSITION)
    expect(() => writeStoredInspectorPosition({ x: 64, y: 96 }, storage)).not.toThrow()
    expect(writeStoredInspectorPosition({ x: 64, y: 96 }, storage)).toBe(false)
  })

  it('returns false when no storage object is available for writes', () => {
    expect(writeStoredInspectorPosition({ x: 64, y: 96 }, null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm exec -w apps/web -- vitest run src/components/editor/inspectorPosition.test.ts
```

Expected: FAIL because `./inspectorPosition` does not exist.

- [ ] **Step 3: Create the storage helper**

Create `apps/web/src/components/editor/inspectorPosition.ts`:

```ts
import type { Point } from '@mind-x/shared'

export const DEFAULT_INSPECTOR_POSITION: Point = { x: 24, y: 88 }
export const INSPECTOR_MIN_OFFSET = 8
export const INSPECTOR_POSITION_STORAGE_KEY = 'mind-x-inspector-position'

type InspectorPositionStorage = Pick<Storage, 'getItem' | 'setItem'>

function getBrowserSessionStorage(): InspectorPositionStorage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage
  } catch {
    return null
  }
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function defaultInspectorPosition(): Point {
  return { ...DEFAULT_INSPECTOR_POSITION }
}

export function clampInspectorPosition(position: Point): Point {
  return {
    x: Math.max(INSPECTOR_MIN_OFFSET, position.x),
    y: Math.max(INSPECTOR_MIN_OFFSET, position.y)
  }
}

export function readStoredInspectorPosition(
  storage: InspectorPositionStorage | null = getBrowserSessionStorage()
): Point {
  if (!storage) {
    return defaultInspectorPosition()
  }

  try {
    const rawPosition = storage.getItem(INSPECTOR_POSITION_STORAGE_KEY)
    if (!rawPosition) {
      return defaultInspectorPosition()
    }

    const parsedPosition: unknown = JSON.parse(rawPosition)
    if (typeof parsedPosition !== 'object' || parsedPosition === null) {
      return defaultInspectorPosition()
    }

    const { x, y } = parsedPosition as { x?: unknown; y?: unknown }
    if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) {
      return defaultInspectorPosition()
    }

    return clampInspectorPosition({ x, y })
  } catch {
    return defaultInspectorPosition()
  }
}

export function writeStoredInspectorPosition(
  position: Point,
  storage: InspectorPositionStorage | null = getBrowserSessionStorage()
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(INSPECTOR_POSITION_STORAGE_KEY, JSON.stringify(clampInspectorPosition(position)))
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npm exec -w apps/web -- vitest run src/components/editor/inspectorPosition.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper**

Run:

```bash
git add apps/web/src/components/editor/inspectorPosition.ts apps/web/src/components/editor/inspectorPosition.test.ts
git commit -m "feat(web): add inspector position session storage"
```

Expected: commit succeeds with only the helper and helper test staged.

## Task 2: Controlled Inspector Panel

**Files:**
- Modify: `apps/web/src/components/editor/InspectorPanel.vue:1-99`
- Uses: `apps/web/src/components/editor/inspectorPosition.ts`

- [ ] **Step 1: Replace the script block with controlled position handling**

In `apps/web/src/components/editor/InspectorPanel.vue`, replace the full `<script setup lang="ts">` block with:

```vue
<script setup lang="ts">
import type { Point } from '@mind-x/shared'
import { CloseOutlined } from '@ant-design/icons-vue'
import { computed, ref } from 'vue'
import { clampInspectorPosition } from './inspectorPosition'

const props = defineProps<{
  position: Point
  title: string
}>()

const emit = defineEmits<{
  close: []
  positionChange: [position: Point]
}>()

const draggingPointerId = ref<number | null>(null)
const lastPointer = ref<Point | null>(null)
const draftPosition = ref<Point | null>(null)
const activePosition = computed(() => draftPosition.value ?? props.position)

function startDrag(event: PointerEvent): void {
  draggingPointerId.value = event.pointerId
  lastPointer.value = { x: event.clientX, y: event.clientY }
  draftPosition.value = { ...props.position }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
  event.stopPropagation()
}

function moveDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId || !lastPointer.value || !draftPosition.value) {
    return
  }

  const nextPointer = { x: event.clientX, y: event.clientY }
  const nextPosition = clampInspectorPosition({
    x: draftPosition.value.x + nextPointer.x - lastPointer.value.x,
    y: draftPosition.value.y + nextPointer.y - lastPointer.value.y
  })
  draftPosition.value = nextPosition
  lastPointer.value = nextPointer
  emit('positionChange', nextPosition)
  event.preventDefault()
  event.stopPropagation()
}

function endDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId) {
    return
  }

  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }

  cleanupDrag(event)
  event.preventDefault()
  event.stopPropagation()
}

function cleanupDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId) {
    return
  }

  draggingPointerId.value = null
  lastPointer.value = null
  draftPosition.value = null
}
</script>
```

- [ ] **Step 2: Update the template transform binding**

In the `<aside>` element in `apps/web/src/components/editor/InspectorPanel.vue`, replace:

```vue
:style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
```

with:

```vue
:style="{ transform: `translate(${activePosition.x}px, ${activePosition.y}px)` }"
```

- [ ] **Step 3: Run typecheck to catch component contract errors**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: FAIL because `MindEditor.vue` still renders `InspectorPanel` without the required `position` prop and without handling `position-change`.

## Task 3: MindEditor Shared Inspector Position

**Files:**
- Modify: `apps/web/src/components/editor/MindEditor.vue:1-240`
- Uses: `apps/web/src/components/editor/inspectorPosition.ts`

- [ ] **Step 1: Add inspector position helper imports**

In `apps/web/src/components/editor/MindEditor.vue`, add this import after the `InspectorPanel` import:

```ts
import { readStoredInspectorPosition, writeStoredInspectorPosition } from './inspectorPosition'
```

- [ ] **Step 2: Add shared inspector position state**

After the `contextMenu` reactive object in `apps/web/src/components/editor/MindEditor.vue`, add:

```ts
const inspectorPosition = ref<Point>(readStoredInspectorPosition())
```

- [ ] **Step 3: Add the shared position update handler**

After the closing brace of `clearSelectionFromCanvas` and before `setSelectedNodeStyle`, add:

```ts
function setInspectorPosition(position: Point): void {
  inspectorPosition.value = position
  writeStoredInspectorPosition(position)
}
```

- [ ] **Step 4: Pass the shared position to the node inspector panel**

Replace the node inspector panel block:

```vue
<InspectorPanel v-if="selectedNode" title="Node" @close="editor.clearSelection">
  <NodeInspector :style="selectedNode.style" @style-change="setSelectedNodeStyle" />
</InspectorPanel>
```

with:

```vue
<InspectorPanel
  v-if="selectedNode"
  :position="inspectorPosition"
  title="Node"
  @close="editor.clearSelection"
  @position-change="setInspectorPosition"
>
  <NodeInspector :style="selectedNode.style" @style-change="setSelectedNodeStyle" />
</InspectorPanel>
```

- [ ] **Step 5: Pass the shared position to the edge inspector panel**

Replace the edge inspector panel block:

```vue
<InspectorPanel v-if="selectedEdge" title="Edge" @close="editor.clearSelection">
  <EdgeInspector
    :style="selectedEdge.style"
    @delete="deleteSelectedEdgeFromInspector"
    @style-change="setSelectedEdgeStyle"
  />
</InspectorPanel>
```

with:

```vue
<InspectorPanel
  v-if="selectedEdge"
  :position="inspectorPosition"
  title="Edge"
  @close="editor.clearSelection"
  @position-change="setInspectorPosition"
>
  <EdgeInspector
    :style="selectedEdge.style"
    @delete="deleteSelectedEdgeFromInspector"
    @style-change="setSelectedEdgeStyle"
  />
</InspectorPanel>
```

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
npm exec -w apps/web -- vitest run src/components/editor/inspectorPosition.test.ts
npm run typecheck -w apps/web
```

Expected: both commands PASS.

- [ ] **Step 7: Commit controlled panel wiring**

Run:

```bash
git add apps/web/src/components/editor/InspectorPanel.vue apps/web/src/components/editor/MindEditor.vue
git commit -m "feat(web): remember inspector panel position"
```

Expected: commit succeeds with only `InspectorPanel.vue` and `MindEditor.vue` staged.

## Task 4: Final Verification

**Files:**
- Verify: `apps/web/src/components/editor/inspectorPosition.ts`
- Verify: `apps/web/src/components/editor/InspectorPanel.vue`
- Verify: `apps/web/src/components/editor/MindEditor.vue`

- [ ] **Step 1: Run the web editor test suite**

Run:

```bash
npm exec -w apps/web -- vitest run src/components/editor
```

Expected: PASS.

- [ ] **Step 2: Run web typecheck**

Run:

```bash
npm run typecheck -w apps/web
```

Expected: PASS.

- [ ] **Step 3: Run the full project build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manually verify in browser**

Run:

```bash
npm run dev:web
```

Expected: Vite reports a local URL on port `5173` unless the port is already occupied.

Manual browser checks:

```text
1. Open the editor.
2. Select a node so the Node inspector appears.
3. Drag the inspector away from the default top-left position.
4. Close the inspector and select a node again.
5. Confirm the inspector reopens at the dragged position.
6. Select an edge.
7. Confirm the Edge inspector opens at the same dragged position.
8. Refresh the tab.
9. Select a node or edge.
10. Confirm the inspector uses the same session position.
11. Open the app in a fresh independent tab.
12. Confirm the inspector starts at the default position.
```

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: no modified tracked files remain after the implementation commits. An unrelated untracked `AGENTS.md` may remain and must not be staged unless the user explicitly asks for it.
