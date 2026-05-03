<script setup lang="ts">
import type { MindNode } from '@mind-x/shared'
import StyleField from '../StyleField.vue'

type TopicNodeModel = Extract<MindNode, { type: 'topic' }>

defineProps<{
  node: TopicNodeModel
}>()

const emit = defineEmits<{
  contentStyleChange: [stylePatch: Record<string, unknown>]
}>()

function emitTextWeightChange(textWeight: unknown): void {
  emit('contentStyleChange', { textWeight })
}
</script>

<template>
  <section class="topic-node-inspector" aria-label="Topic node inspector">
    <StyleField label="Text">
      <a-select
        :value="node.contentStyle.textWeight"
        size="small"
        @change="emitTextWeightChange"
      >
        <a-select-option value="regular">Regular</a-select-option>
        <a-select-option value="medium">Medium</a-select-option>
        <a-select-option value="bold">Bold</a-select-option>
      </a-select>
    </StyleField>
  </section>
</template>

<style scoped>
.topic-node-inspector {
  display: grid;
  gap: 10px;
}
</style>
