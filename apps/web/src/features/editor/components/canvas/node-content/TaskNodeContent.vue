<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode } from '@mind-x/shared'
import { nextTick, ref, watch } from 'vue'
import { isValidPlainText } from '@mind-x/mind-engine'

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

function draftTitleFor(item: TaskItem): string {
  return (draftTitles.value[item.id] ?? item.title).trim()
}

function createDraftItems(): TaskItem[] {
  return props.node.data.items.map((item) => ({
    ...item,
    title: draftTitleFor(item)
  }))
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
    ...createDraftItems(),
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

  commitItems(createDraftItems().filter((item) => item.id !== itemId))
}

function toggleTaskItem(itemId: string, done: boolean): void {
  commitItems(createDraftItems().map((item) => (item.id === itemId ? { ...item, done } : item)))
}

function commitTaskTitle(item: TaskItem): void {
  const title = draftTitleFor(item)
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

  commitItems(createDraftItems().map((candidate) => (candidate.id === item.id ? { ...candidate, title } : candidate)))
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
        :aria-label="`Mark ${draftTitles[item.id] ?? item.title} complete`"
        class="task-node__checkbox"
        :checked="item.done"
        type="checkbox"
        @change="(event: Event) => toggleTaskItem(item.id, (event.target as HTMLInputElement).checked)"
        @pointerdown.stop
      />
      <input
        :ref="(element) => setInputRef(item.id, element as HTMLInputElement | null)"
        v-model="draftTitles[item.id]"
        :aria-label="`Edit task ${draftTitles[item.id] ?? item.title}`"
        class="task-node__input"
        :class="{ 'task-node__input--done': item.done }"
        :maxlength="PLAIN_TEXT_MAX_LENGTH"
        @blur="commitTaskTitle(item)"
        @keydown.enter.prevent="commitTaskTitle(item)"
        @keydown.esc.prevent="cancelTaskTitleEdit(item)"
        @pointerdown.stop
      />
      <button
        :aria-label="`Delete task ${draftTitles[item.id] ?? item.title}`"
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
  color: var(--color-text-subtle);
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
