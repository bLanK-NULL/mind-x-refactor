<script setup lang="ts">
import { CloseOutlined } from '@ant-design/icons-vue'
import { reactive, ref } from 'vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const position = reactive({ x: 24, y: 88 })
const draggingPointerId = ref<number | null>(null)
const lastPointer = ref<{ x: number; y: number } | null>(null)

function startDrag(event: PointerEvent): void {
  draggingPointerId.value = event.pointerId
  lastPointer.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
  event.stopPropagation()
}

function moveDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId || !lastPointer.value) {
    return
  }

  const nextPointer = { x: event.clientX, y: event.clientY }
  position.x = Math.max(8, position.x + nextPointer.x - lastPointer.value.x)
  position.y = Math.max(8, position.y + nextPointer.y - lastPointer.value.y)
  lastPointer.value = nextPointer
  event.preventDefault()
  event.stopPropagation()
}

function endDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId) {
    return
  }

  draggingPointerId.value = null
  lastPointer.value = null
  event.preventDefault()
  event.stopPropagation()
}
</script>

<template>
  <aside
    class="inspector-panel"
    data-editor-control
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @click.stop
    @pointerdown.stop
  >
    <header
      class="inspector-panel__header"
      @pointercancel="endDrag"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
    >
      <h2 class="inspector-panel__title">{{ title }}</h2>
      <a-button aria-label="Close inspector" shape="circle" size="small" type="text" @click="emit('close')">
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
  cursor: grab;
  user-select: none;
}

.inspector-panel__header:active {
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
