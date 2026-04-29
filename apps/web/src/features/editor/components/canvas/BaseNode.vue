<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import { computed } from 'vue'
import { resolveNodeShellClass, resolveNodeShellStyle } from '../../utils/objectStyles'

const props = defineProps<{
  node: MindNode
  selected: boolean
}>()

const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  inspect: [nodeId: string]
  resize: [nodeId: string, delta: { width: number; height: number }]
  resizeEnd: []
  select: [nodeId: string]
}>()

let draggingPointerId: number | null = null
let resizingPointerId: number | null = null
let lastPointer: Point | null = null

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

function onPointerDown(event: PointerEvent): void {
  event.stopPropagation()
  emit('select', props.node.id)
  draggingPointerId = event.pointerId
  lastPointer = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (draggingPointerId !== event.pointerId || !lastPointer) {
    return
  }

  event.stopPropagation()
  const nextPointer = { x: event.clientX, y: event.clientY }
  emit('drag', props.node.id, {
    x: nextPointer.x - lastPointer.x,
    y: nextPointer.y - lastPointer.y
  })
  lastPointer = nextPointer
}

function endDrag(event: PointerEvent): void {
  if (draggingPointerId !== event.pointerId) {
    return
  }

  event.stopPropagation()
  draggingPointerId = null
  lastPointer = null
  emit('dragEnd')
}

function onResizePointerDown(event: PointerEvent): void {
  event.stopPropagation()
  emit('select', props.node.id)
  resizingPointerId = event.pointerId
  lastPointer = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onResizePointerMove(event: PointerEvent): void {
  if (resizingPointerId !== event.pointerId || !lastPointer) {
    return
  }

  event.stopPropagation()
  const nextPointer = { x: event.clientX, y: event.clientY }
  emit('resize', props.node.id, {
    height: nextPointer.y - lastPointer.y,
    width: nextPointer.x - lastPointer.x
  })
  lastPointer = nextPointer
}

function endResize(event: PointerEvent): void {
  if (resizingPointerId !== event.pointerId) {
    return
  }

  event.stopPropagation()
  resizingPointerId = null
  lastPointer = null
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
    @dblclick.stop="emit('inspect', node.id)"
    @pointercancel="endDrag"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
  >
    <div class="base-node__content">
      <slot />
    </div>
    <span
      aria-hidden="true"
      class="base-node__resize-handle"
      data-editor-export-ignore="true"
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
