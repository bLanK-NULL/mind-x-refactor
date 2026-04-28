<script setup lang="ts">
import type { MindNode, Point } from '@mind-x/shared'
import { computed, nextTick, ref, watch } from 'vue'
import { resolveTopicContentClass, resolveTopicNodeClass, resolveTopicNodeStyle } from '../../utils/objectStyles'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

const props = defineProps<{
  node: TopicNodeModel
  selected: boolean
}>()

const emit = defineEmits<{
  drag: [nodeId: string, delta: Point]
  dragEnd: []
  edit: [nodeId: string, title: string]
  select: [nodeId: string]
}>()

const editing = ref(false)
const draftTitle = ref(props.node.data.title)
const editError = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const draggingPointerId = ref<number | null>(null)
const lastPointer = ref<Point | null>(null)

const nodeStyle = computed(() => ({
  ...resolveTopicNodeStyle(props.node.shellStyle),
  height: `${props.node.size.height}px`,
  transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
  width: `${props.node.size.width}px`
}))

const nodeClass = computed(() => [
  ...resolveTopicNodeClass(props.node.shellStyle),
  ...resolveTopicContentClass(props.node.contentStyle),
  { 'topic-node--selected': props.selected }
])

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
  editError.value = ''
  draftTitle.value = props.node.data.title
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}

function validateTitle(title: string): string {
  if (title.length === 0 || /[<>]/.test(title)) {
    return 'Use non-empty plain text.'
  }
  return ''
}

async function commitEdit(): Promise<void> {
  const title = draftTitle.value.trim()
  const error = validateTitle(title)
  if (error) {
    editError.value = error
    await nextTick()
    titleInputRef.value?.focus()
    return
  }

  editError.value = ''
  if (title.length > 0 && title !== props.node.data.title) {
    emit('edit', props.node.id, title)
  } else {
    draftTitle.value = props.node.data.title
  }
  editing.value = false
}

function cancelEdit(): void {
  editing.value = false
  editError.value = ''
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
  emit('dragEnd')
}
</script>

<template>
  <div
    class="topic-node"
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
    <template v-if="editing">
      <input
        ref="titleInputRef"
        v-model="draftTitle"
        :aria-invalid="editError.length > 0"
        class="topic-node__input"
        maxlength="120"
        @blur="commitEdit"
        @input="editError = ''"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
        @pointerdown.stop
      />
      <span v-if="editError" class="topic-node__error">{{ editError }}</span>
    </template>
    <span v-else class="topic-node__title">{{ node.data.title }}</span>
  </div>
</template>

<style scoped>
.topic-node {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 140px;
  max-width: 240px;
  padding: 10px 14px;
  border: 1px solid var(--object-border);
  border-radius: 8px;
  background: var(--object-fill);
  box-shadow: var(--shadow-node);
  color: var(--object-text);
  cursor: grab;
  user-select: none;
}

.topic-node:active {
  cursor: grabbing;
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

.topic-node--weight-regular .topic-node__title,
.topic-node--weight-regular .topic-node__input {
  font-weight: 400;
}

.topic-node--weight-medium .topic-node__title,
.topic-node--weight-medium .topic-node__input {
  font-weight: 650;
}

.topic-node--weight-bold .topic-node__title,
.topic-node--weight-bold .topic-node__input {
  font-weight: 750;
}

.topic-node__title {
  display: block;
  width: 100%;
  overflow: hidden;
  font-size: 14px;
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
}

.topic-node__error {
  align-self: stretch;
  overflow: hidden;
  color: var(--color-danger);
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
