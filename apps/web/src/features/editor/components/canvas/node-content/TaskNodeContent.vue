<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>
type TaskItem = TaskNodeModel['data']['items'][number]

const props = defineProps<{
  editing: boolean
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  cancel: []
  commit: [dataPatch: { items: TaskItem[] }]
}>()

const draftItems = ref<TaskItem[]>(cloneItems(props.node.data.items))
const editError = ref('')
const firstInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) {
      return
    }

    editError.value = ''
    draftItems.value = cloneItems(props.node.data.items)
    await nextTick()
    firstInputRef.value?.focus()
  }
)

function cloneItems(items: TaskItem[]): TaskItem[] {
  return items.map((item) => ({ ...item }))
}

function replaceItem(index: number, patch: Partial<TaskItem>): void {
  draftItems.value = draftItems.value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
}

function validateItems(items: TaskItem[]): string {
  if (items.length === 0) {
    return 'Add at least one task.'
  }
  if (items.some((item) => item.title.trim().length === 0 || /[<>]/.test(item.title))) {
    return 'Use non-empty plain text.'
  }
  return ''
}

function areItemsEqual(left: TaskItem[], right: TaskItem[]): boolean {
  return left.length === right.length && left.every((item, index) => {
    const other = right[index]
    return item.id === other.id
      && item.title === other.title
      && item.done === other.done
      && item.notes === other.notes
      && item.dueDate === other.dueDate
      && item.priority === other.priority
  })
}

async function commitEdit(): Promise<void> {
  const items = draftItems.value.map((item) => ({ ...item, title: item.title.trim() }))
  const error = validateItems(items)
  if (error) {
    editError.value = error
    await nextTick()
    firstInputRef.value?.focus()
    return
  }

  editError.value = ''
  if (areItemsEqual(items, props.node.data.items)) {
    emit('cancel')
    return
  }

  emit('commit', { items })
}

function cancelEdit(): void {
  editError.value = ''
  draftItems.value = cloneItems(props.node.data.items)
  emit('cancel')
}

function onFocusout(event: FocusEvent): void {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && (event.currentTarget as HTMLElement).contains(nextTarget)) {
    return
  }

  void commitEdit()
}
</script>

<template>
  <div class="task-node__content" :class="`task-node__content--${node.contentStyle.density}`" @focusout="onFocusout">
    <template v-if="editing">
      <label
        v-for="(item, index) in draftItems"
        :key="item.id"
        class="task-node__item task-node__item--editing"
      >
        <input
          :checked="item.done"
          class="task-node__checkbox"
          type="checkbox"
          @change="replaceItem(index, { done: ($event.target as HTMLInputElement).checked })"
          @pointerdown.stop
        />
        <input
          :ref="(element) => { if (index === 0) firstInputRef = element as HTMLInputElement | null }"
          :value="item.title"
          class="task-node__input"
          maxlength="160"
          @input="replaceItem(index, { title: ($event.target as HTMLInputElement).value }); editError = ''"
          @keydown.enter.prevent="commitEdit"
          @keydown.esc.prevent="cancelEdit"
          @pointerdown.stop
        />
      </label>
      <span v-if="editError" class="task-node__error">{{ editError }}</span>
      <button class="task-node__done" type="button" @click.stop="commitEdit" @pointerdown.stop>Done</button>
    </template>
    <template v-else>
      <div v-for="item in node.data.items" :key="item.id" class="task-node__item">
        <input class="task-node__checkbox" :checked="item.done" disabled type="checkbox" />
        <span class="task-node__title" :class="{ 'task-node__title--done': item.done }">{{ item.title }}</span>
      </div>
    </template>
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
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.task-node__item--editing {
  width: 100%;
}

.task-node__checkbox {
  flex: 0 0 auto;
}

.task-node__title {
  overflow: hidden;
  flex: 1;
  font-size: 13px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-node__title--done {
  color: color-mix(in srgb, currentColor 58%, transparent);
  text-decoration: line-through;
}

.task-node__input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: inherit;
  font-size: 13px;
}

.task-node__done {
  align-self: flex-end;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
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
