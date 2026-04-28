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

<template>
  <aside
    class="inspector-panel"
    data-editor-control
    :style="{ transform: `translate(${activePosition.x}px, ${activePosition.y}px)` }"
    @click.stop
    @pointerdown.stop
  >
    <header class="inspector-panel__header">
      <div
        class="inspector-panel__drag-handle"
        @lostpointercapture="cleanupDrag"
        @pointercancel="endDrag"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
      >
        <h2 class="inspector-panel__title">{{ title }}</h2>
      </div>
      <a-button
        aria-label="Close inspector"
        shape="circle"
        size="small"
        type="text"
        @click="emit('close')"
        @pointerdown.stop
      >
        <template #icon>
          <CloseOutlined />
        </template>
      </a-button>
    </header>
    <div class="inspector-panel__body">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.inspector-panel {
  position: absolute;
  z-index: 25;
  top: 0;
  left: 0;
  display: grid;
  width: 260px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-panel);
}

.inspector-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-bottom: 1px solid var(--color-border-soft);
}

.inspector-panel__drag-handle {
  flex: 1;
  min-width: 0;
  cursor: grab;
  user-select: none;
}

.inspector-panel__drag-handle:active {
  cursor: grabbing;
}

.inspector-panel__title {
  margin: 0;
  color: var(--color-text-strong);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.3;
}

.inspector-panel__body {
  display: grid;
  gap: 12px;
  padding: 12px;
}
</style>
