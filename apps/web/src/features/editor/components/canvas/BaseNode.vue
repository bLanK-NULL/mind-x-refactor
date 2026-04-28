<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import { computed, ref } from 'vue'
import { resolveNodeShellClass, resolveNodeShellStyle } from '../../utils/objectStyles'

const props = defineProps<{
  node: MindNode
  selected: boolean
}>()

const emit = defineEmits<{
  cancelEdit: [nodeId: string]
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  editCommit: [nodeId: string, payload: unknown]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()

const editing = ref(false)
const draggingPointerId = ref<number | null>(null)
const resizingPointerId = ref<number | null>(null)
const lastPointer = ref<Point | null>(null)

const nodeStyle = computed(() => ({
  ...resolveNodeShellStyle(props.node.shellStyle),
  height: `${props.node.size.height}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size.width}px`
}))

const nodeClass = computed(() => [
  ...resolveNodeShellClass(props.node.shellStyle),
  { 'topic-node--selected': props.selected }
])

function startEditing(): void {
  editing.value = true
}

function commitEdit(payload: unknown): void {
  editing.value = false
  emit('editCommit', props.node.id, payload)
}

function cancelEdit(): void {
  editing.value = false
  emit('cancelEdit', props.node.id)
}

function onPointerDown(event: PointerEvent): void {
  if (editing.value) {
    return
  }

  event.stopPropagation()
  emit('select', props.node.id)
  draggingPointerId.value = event.pointerId
  lastPointer.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId || !lastPointer.value) {
    return
  }

  event.stopPropagation()
  const nextPointer = { x: event.clientX, y: event.clientY }
  emit('drag', props.node.id, {
    x: nextPointer.x - lastPointer.value.x,
    y: nextPointer.y - lastPointer.value.y
  })
  lastPointer.value = nextPointer
}

function endDrag(event: PointerEvent): void {
  if (draggingPointerId.value !== event.pointerId) {
    return
  }

  event.stopPropagation()
  draggingPointerId.value = null
  lastPointer.value = null
  emit('dragEnd')
}

function onResizePointerDown(event: PointerEvent): void {
  if (editing.value) {
    return
  }

  event.stopPropagation()
  emit('select', props.node.id)
  resizingPointerId.value = event.pointerId
  lastPointer.value = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onResizePointerMove(event: PointerEvent): void {
  if (resizingPointerId.value !== event.pointerId || !lastPointer.value) {
    return
  }

  event.stopPropagation()
  const nextPointer = { x: event.clientX, y: event.clientY }
  emit('resize', props.node.id, {
    height: nextPointer.y - lastPointer.value.y,
    width: nextPointer.x - lastPointer.value.x
  })
  lastPointer.value = nextPointer
}

function endResize(event: PointerEvent): void {
  if (resizingPointerId.value !== event.pointerId) {
    return
  }

  event.stopPropagation()
  resizingPointerId.value = null
  lastPointer.value = null
  emit('resizeEnd')
}
</script>

<template>
  <div
    class="base-node"
    data-editor-node
    :data-editor-node-id="node.id"
    :class="nodeClass"
    :style="nodeStyle"
    @dblclick.stop="startEditing"
    @pointercancel="endDrag"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
  >
    <div class="base-node__content" :class="{ 'base-node__content--blocked': !editing }">
      <slot
        :cancel-edit="cancelEdit"
        :commit-edit="commitEdit"
        :editing="editing"
      />
    </div>
    <span
      aria-hidden="true"
      class="base-node__resize-handle"
      @pointercancel="endResize"
      @pointerdown="onResizePointerDown"
      @pointermove="onResizePointerMove"
      @pointerup="endResize"
    />
  </div>
</template>

<style scoped>
.base-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--object-border);
  border-radius: 8px;
  background: var(--object-fill);
  box-shadow: var(--shadow-node);
  color: var(--object-text);
  cursor: grab;
  user-select: none;
}

.base-node:active {
  cursor: grabbing;
}

.base-node__content {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.base-node__content--blocked {
  pointer-events: none;
}

.base-node__resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 10px;
  height: 10px;
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  background: var(--color-surface);
  cursor: nwse-resize;
}

.topic-node--tone-outline {
  background: var(--color-surface);
}

.topic-node--shape-rectangle {
  border-radius: 2px;
}

.topic-node--shape-rounded {
  border-radius: 8px;
}

.topic-node--shape-pill {
  border-radius: 999px;
}

.topic-node--border-none {
  border-color: transparent;
}

.topic-node--border-dashed {
  border-style: dashed;
}

.topic-node--shadow-none {
  box-shadow: none;
}

.topic-node--shadow-sm {
  box-shadow: var(--shadow-node);
}

.topic-node--shadow-md {
  box-shadow: 0 10px 26px rgb(15 23 42 / 14%);
}

.topic-node--selected {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-node-selected);
}
</style>
