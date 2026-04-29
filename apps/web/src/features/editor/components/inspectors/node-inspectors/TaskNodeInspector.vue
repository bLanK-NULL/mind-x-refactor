<script setup lang="ts">
import { PLAIN_TEXT_MAX_LENGTH, type MindNode, type TaskContentStyle } from '@mind-x/shared'
import { isValidPlainText } from '../../../utils/nodeValidation'
import StyleField from '../StyleField.vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>
type TaskItem = TaskNodeModel['data']['items'][number]

const props = defineProps<{
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  contentChange: [dataPatch: Record<string, unknown>]
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function textValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function checkedValue(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function replaceTaskItem(index: number, patch: Partial<TaskItem>): void {
  const items = props.node.data.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : { ...item }))
  if (items.every((item) => isValidPlainText(item.title))) {
    emit('contentChange', { items })
  }
}

function emitDensityChange(density: unknown): void {
  emit('contentStyleChange', { density: density as TaskContentStyle['density'] })
}
</script>

<template>
  <section class="task-node-inspector" aria-label="Task node inspector">
    <StyleField label="Tasks">
      <div class="task-node-inspector__tasks">
        <label v-for="(item, index) in node.data.items" :key="item.id" class="task-node-inspector__task">
          <a-checkbox
            :checked="item.done"
            @change="(event: Event) => replaceTaskItem(index, { done: checkedValue(event) })"
          />
          <a-input
            :maxlength="PLAIN_TEXT_MAX_LENGTH"
            :value="item.title"
            size="small"
            @change="(event: Event) => replaceTaskItem(index, { title: textValue(event).trim() })"
          />
        </label>
      </div>
    </StyleField>
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

.task-node-inspector__tasks {
  display: grid;
  gap: 6px;
}

.task-node-inspector__task {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}
</style>
