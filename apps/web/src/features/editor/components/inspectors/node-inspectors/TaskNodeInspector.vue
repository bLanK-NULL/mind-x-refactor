<script setup lang="ts">
import type { MindNode, TaskContentStyle } from '@mind-x/shared'
import StyleField from '../StyleField.vue'

type TaskNodeModel = Extract<MindNode, { type: 'task' }>

defineProps<{
  node: TaskNodeModel
}>()

const emit = defineEmits<{
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function emitDensityChange(density: unknown): void {
  emit('contentStyleChange', { density: density as TaskContentStyle['density'] })
}
</script>

<template>
  <section class="task-node-inspector" aria-label="Task node inspector">
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
</style>
