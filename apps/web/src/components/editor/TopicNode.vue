<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  node: MindNode
  selected: boolean
}>()

const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  edit: [nodeId: string, title: string]
  select: [nodeId: string]
}>()

const editing = ref(false)
const draftTitle = ref(props.node.data.title)
const titleInputRef = ref<HTMLInputElement | null>(null)
const draggingPointerId = ref<number | null>(null)
const lastPointer = ref<Point | null>(null)

const nodeStyle = computed(() => ({
  height: `${props.node.size?.height ?? 56}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size?.width ?? 180}px`
}))

watch(
  () => props.node.data.title,
  (title) => {
    if (!editing.value) {
      draftTitle.value = title
    }
  }
)

async function startEditing(): Promise<void> {
  editing.value = true
  draftTitle.value = props.node.data.title
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

function commitEdit(): void {
  const title = draftTitle.value.trim()
  editing.value = false
  if (title.length > 0 && title !== props.node.data.title) {
    emit('edit', props.node.id, title)
  } else {
    draftTitle.value = props.node.data.title
  }
}

function cancelEdit(): void {
  editing.value = false
  draftTitle.value = props.node.data.title
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
}
</script>

<template>
  <div
    class="topic-node"
    data-editor-node
    :class="{ 'topic-node--selected': selected }"
    :style="nodeStyle"
    @dblclick.stop="startEditing"
    @pointercancel="endDrag"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
  >
    <input
      v-if="editing"
      ref="titleInputRef"
      v-model="draftTitle"
      class="topic-node__input"
      maxlength="120"
      @blur="commitEdit"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
      @pointerdown.stop
    />
    <span v-else class="topic-node__title">{{ node.data.title }}</span>
  </div>
</template>

<style scoped>
.topic-node {
  position: absolute;
  display: flex;
  align-items: center;
  min-width: 140px;
  max-width: 240px;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgb(15 23 42 / 10%);
  color: #111827;
  cursor: grab;
  user-select: none;
}

.topic-node:active {
  cursor: grabbing;
}

.topic-node--selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgb(22 119 255 / 16%), 0 6px 18px rgb(15 23 42 / 12%);
}

.topic-node__title {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-node__input {
  width: 100%;
  min-width: 0;
  padding: 2px 0;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 14px;
  font-weight: 650;
}
</style>
